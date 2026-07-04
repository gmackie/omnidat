# Split-Authority Sync Implementation Plan

Date: 2026-07-04

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Workstream A of the
[Roadmap Expansion](2026-07-04-roadmap-expansion.md): an append-only journal,
epoch-fenced authority transfers, and an HTTPS sync path so the field kit is
authoritative for event-scoped data during an active event, the cloud is
primary otherwise, and the weekend simulation exercises the same sync path as
a real event.

**Architecture:** The field kit keeps an append-only operation journal in
local SQLite and applies every write locally first. The gmacko tRPC layer
gains journal, authority, and sync tables in the shared `omnidat` Postgres
schema plus `syncPush`/`syncPull` procedures. A journal apply engine on the
cloud maps op types onto the existing projection helpers in
`gmacko/packages/api/src/router/omnidat-persistence.ts`. Authority is an
append-only per-event epoch record; stale-epoch writes are rejected and
quarantined, never silently dropped. The Python sync client reuses the
HTTP-to-tRPC pattern already proven in `tools/omnidat_fryos_bridge.py`.

**Tech Stack:** TypeScript, tRPC, Drizzle ORM, Postgres, Vitest, Python 3,
SQLite, unittest, existing shell scripts under `scripts/`.

## Design

### Authority model

Locked by the roadmap expansion; restated here as the contract this plan
implements:

```text
event active + field kit online   -> field kit authoritative for event-scoped data
                                     cloud follows as replica + public status
field kit offline or failed       -> cloud primary (NOC failover, epoch increment)
no active event                   -> cloud authoritative for everything
simulation                        -> sim field kit, same sync path as production
```

Global data (identities, roles, OAuth config) never flows through the
journal. It is provisioned before the event and cached read-only on the field
kit, per the data ownership matrix in the roadmap expansion.

### Journal entries

Every event-scoped write, on either side, is an appended journal entry:

| Field | Meaning |
| --- | --- |
| `sourceId` | writer identity: `field-kit-01`, `sim-field-kit`, `cloud`. |
| `seq` | per-source monotonic sequence; never reused, never reordered. |
| `eventId` | the `omnidatEvent` row the op is scoped to. |
| `epoch` | the authority epoch the writer held when it appended. |
| `opType` | operation name; reuses existing audit event types where they exist (`food.order.created`, `passport.stamped`, `provisioning.verified`, `pad.configured`, `atm.activated`, `xot.command` from `omnidat-persistence.ts`). |
| `payload` | JSON op payload; the interchange format between stores. |
| `idempotencyKey` | `{sourceId}:{seq}`; unique on the receiver. |
| `payloadChecksum` | sha256 of the canonical payload, for tamper evidence. |
| `recordedAt` | writer-side timestamp. |

The journal is the sync unit. Projection tables (services, orders, stamps,
ledger) are derived state on both sides; the journal is the source of truth
for event-scoped history. Op types without a projection mapping still land as
`omnidatAuditEvent` rows, so an unknown op is never lost.

### Event authority and epoch transfer

Each event carries an append-only authority history in
`omnidat_event_authority`: `{eventId, epoch, holder, holderSourceId,
fenceSeq, transferredByUserId, reason}`. Current authority is the row with
the highest epoch. Rules:

- transfers increment the epoch; epochs are monotonically increasing and
  unique per event.
- failover is a NOC operator action through a role-gated tRPC mutation, never
  automatic, and writes an audit event.
- at transfer time the cloud records `fenceSeq`: the highest sequence it has
  received from the outgoing holder. On a clean handoff the outgoing holder
  pushes its tail first, so `fenceSeq` equals its final sequence.
- a recovered field kit rejoins as a replica, pulls until it matches the
  cloud watermark, and only then can an operator transfer authority back
  (epoch increments again).

Apply rules on the receiver, per entry:

- `idempotencyKey` already present: count `duplicate`, no-op.
- `epoch` equals current epoch and sender is the current holder: apply.
- `epoch` is a past epoch, sender was that epoch's holder, and
  `seq <= fenceSeq` for that epoch: apply (late arrival of already-fenced
  history; usually a duplicate).
- `epoch` is a past epoch and `seq > fenceSeq`: store the entry as
  `quarantined`, count `rejected-stale`, do not apply. Quarantined entries
  are preserved and exported as evidence for operator reconciliation.
- `epoch` greater than current: count `rejected-stale`, refuse.

This makes split-brain structurally impossible: no path applies two writers'
ops under the same epoch, and nothing is deleted.

### Sync protocol

HTTPS to the gmacko tRPC surface, the same `/api/trpc/{procedure}` path the
Python FryOS bridge already calls (`tools/omnidat_fryos_bridge.py`).

- `omnidat.syncPush` — request: `{sourceId, entries[]}`. The receiver applies
  idempotently and returns a reconciliation report:
  `{applied, duplicate, rejectedStale, quarantined, highWatermark,
  authority: {holder, epoch}}`.
- `omnidat.syncPull` — request: `{sourceId, watermarks: {source: seq}}`.
  Returns entries above the watermarks plus the current authority record.
- `omnidat.authorityStatus` — current holder, epoch, and per-source
  `lastSyncAt` for dashboards.
- `omnidat.transferAuthority` — NOC-initiated epoch transfer, audited.

Sync sessions are store-and-forward: the field kit pushes on an interval
(default 15 s) with backoff, keeps appending locally during an outage, and
drains its unpushed tail on reconnect. Every session's reconciliation report
is logged on both sides; the field kit prints one on demand.

Sync authentication uses a per-source token registered in
`omnidat_sync_source` (hash stored, same pattern as
`omnidatSecurityCredential`), supplied as a bearer header. Role-gating of the
transfer mutation lands with H1a via the `authority.transfer` capability;
until then the procedure requires the sync token plus an explicit operator
identifier in the input, both audited.

### Field kit store: SQLite

**Recommendation: SQLite.** Rationale:

- the field kit toolchain is already SQLite: `tools/omnidat_db.py` builds the
  seed database via `scripts/build-db`, and the field-office network plan
  targets the same SQLite build path for directory/PAD/print data.
- no daemon to supervise or recover after generator power loss; a single file
  in WAL mode survives hard cuts and backs up as a file copy to USB.
- field concurrency is 2-12 terminal users (capacity tables in
  `docs/field-office-network-plan.md`), well inside SQLite's envelope.
- the journal payload is the interchange format, so the field store does not
  need Postgres type or wire parity with the Drizzle schema. Nothing
  replicates at the SQL level.

Local Postgres is rejected: it adds a service to install, monitor, and
crash-recover on camp hardware, and its only advantage (schema parity with
the cloud) is unnecessary given journal-based sync.

Field kit SQLite tables (created by `tools/omnidat_journal.py`):

```sql
create table journal_entry (
  seq integer primary key autoincrement,
  event_id text not null,
  epoch integer not null,
  op_type text not null,
  payload text not null,
  idempotency_key text not null unique,
  payload_checksum text not null,
  recorded_at text not null,
  pushed_at text
);
create table sync_watermark (
  source_id text primary key,
  last_pulled_seq integer not null default 0,
  last_sync_at text
);
create table authority_cache (
  event_id text primary key,
  holder text not null,
  epoch integer not null,
  fetched_at text not null
);
```

`seq` from `autoincrement` gives the per-source monotonic sequence.
Printing, NOC views, and evidence export read local state only and keep
working with no uplink.

### Staleness display

The cloud tracks `lastSyncAt` per source in `omnidat_sync_source`. While the
field kit holds authority, every cloud dashboard that shows event-scoped data
must carry the sync status: "FIELD DATA AS OF HH:MM (N MIN AGO)", computed
from `lastSyncAt`, plus holder and epoch. Stale data is never presented as
live; the banner escalates visually past a staleness threshold (default
5 minutes). When the cloud holds authority the banner states that instead.

### Failover and rejoin

Runbook hooks (new `runbooks/authority-failover.md`, referenced from
`runbooks/incident-response.md`):

- **Field -> cloud (kit dead):** NOC confirms the kit is unreachable, runs
  `omnidat.transferAuthority` with a reason, cloud epoch increments, fence is
  recorded at the last received sequence, dashboard flips to "CLOUD
  PRIMARY".
- **Field -> cloud (planned):** kit drains its journal tail first, then the
  same transfer; fence equals the kit's final sequence, so nothing
  quarantines.
- **Cloud -> field (rejoin):** kit pulls until its watermark matches the
  cloud, operator verifies counts in the reconciliation report, then
  transfers authority back. Quarantined entries from the dead-kit window are
  reviewed and either re-entered as new ops or archived as evidence.
- both drills are scripted by `scripts/authority-drill` so rehearsals and the
  H5 exit gate run the same procedure.

### Sim field kit

`./scripts/weekend-sim` currently drives `tools/omnidat_weekend.py`, which
writes JSONL event logs and ledgers directly into `build/weekend-sim/`. It
moves to a sim field kit: the simulator appends every op through the SQLite
journal store under `sourceId: sim-field-kit`, and when
`OMNIDAT_SYNC_TARGET` is set, the sync client pushes to that gmacko target.
With no target set it runs journal-local, so `npm run e2e:weekend` still
works offline. This makes the weekend sim a permanent sync soak test and
kills sim-versus-production drift.

## Current State

What exists today:

- Cloud schema: `gmacko/packages/db/src/omnidat-schema.ts` has projection
  tables (services, verbs, allocations, orders, stamps, ledger, audit
  events, incidents, evidence) plus `omnidatEvent`, but no journal, no
  authority record, no sync-source registry. Migrations run through
  `gmacko/packages/db/drizzle/` (next number: `0004`).
- Cloud API: `gmacko/packages/api/src/router/omnidat.ts` exposes
  `publicProcedure` queries/mutations; `omnidat-persistence.ts` has
  projection helpers (`projectFoodOrderPersistenceRows`, etc.) and
  `persist*` writers gated by `OMNIDAT_PERSISTENCE === "database"`.
- Field kit: Python tools under `tools/` with SQLite seed data
  (`tools/omnidat_db.py`), JSONL append-only event logs
  (`tools/omnidat_events.py`), and an HTTP-to-tRPC client pattern
  (`tools/omnidat_fryos_bridge.py`). No journal store, no epoch awareness,
  no sync client.
- Simulation: `scripts/weekend-sim` -> `tools/omnidat_weekend.py` writes
  JSONL directly; it never touches the cloud or any sync path.
- Dashboards: `omnidat.dashboard`/`omnidat.noc` queries and the NOC
  component `gmacko/apps/nextjs/src/app/_components/omnidat-noc-dashboard.tsx`
  show no sync or authority state.

## Task 1: Add Cloud Journal, Authority, And Sync-Source Schema

**Files:**

- Modify: `gmacko/packages/db/src/omnidat-schema.ts`
- Create: `gmacko/packages/db/drizzle/0004_omnidat_journal_authority.sql`
- Test: `gmacko/packages/db/src/__tests__/omnidat-schema.test.ts`

**Step 1: Write the failing schema test**

```ts
import {
  omnidatEventAuthority,
  omnidatJournalEntry,
  omnidatSyncSource,
} from "../omnidat-schema";

it("exports journal, authority, and sync source tables", () => {
  expect(omnidatJournalEntry).toBeDefined();
  expect(omnidatEventAuthority).toBeDefined();
  expect(omnidatSyncSource).toBeDefined();
});
```

**Step 2: Run the failing test**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/db test -- omnidat-schema
```

Expected: fail because the exports do not exist.

**Step 3: Add schema**

```ts
export const omnidatSyncSource = omnidatNamespace.table("omnidat_sync_source", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  sourceId: t.varchar({ length: 80 }).notNull(),
  sourceKind: t.varchar({ length: 32 }).notNull().default("field-kit"),
  tokenHash: t.text().notNull(),
  lastPushedSeq: t.bigint({ mode: "number" }).notNull().default(0),
  lastSyncAt: t.timestamp({ mode: "date", withTimezone: true }),
  active: t.boolean().notNull().default(true),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}), (table) => [
  unique("omnidat_sync_source_source_id_unique").on(table.sourceId),
]);

export const omnidatJournalEntry = omnidatNamespace.table("omnidat_journal_entry", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  sourceId: t.varchar({ length: 80 }).notNull(),
  seq: t.bigint({ mode: "number" }).notNull(),
  eventId: t.uuid().references(() => omnidatEvent.id, { onDelete: "set null" }),
  epoch: t.integer().notNull(),
  opType: t.varchar({ length: 120 }).notNull(),
  payload: t.json().$type<Record<string, unknown>>().notNull().default({}),
  idempotencyKey: t.varchar({ length: 160 }).notNull(),
  payloadChecksum: t.varchar({ length: 64 }).notNull(),
  recordedAt: t.timestamp({ mode: "date", withTimezone: true }).notNull(),
  receivedAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  applyStatus: t.varchar({ length: 32 }).notNull().default("pending"),
  appliedAt: t.timestamp({ mode: "date", withTimezone: true }),
}), (table) => [
  unique("omnidat_journal_source_seq_unique").on(table.sourceId, table.seq),
  unique("omnidat_journal_idempotency_unique").on(table.idempotencyKey),
]);

export const omnidatEventAuthority = omnidatNamespace.table("omnidat_event_authority", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  eventId: t
    .uuid()
    .notNull()
    .references(() => omnidatEvent.id, { onDelete: "cascade" }),
  epoch: t.integer().notNull(),
  holder: t.varchar({ length: 16 }).notNull(),
  holderSourceId: t.varchar({ length: 80 }).notNull(),
  fenceSeq: t.bigint({ mode: "number" }),
  transferredByUserId: t
    .text()
    .references(() => user.id, { onDelete: "set null" }),
  reason: t.text(),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}), (table) => [
  unique("omnidat_event_authority_event_epoch_unique").on(table.eventId, table.epoch),
]);
```

`applyStatus` values: `pending`, `applied`, `quarantined`.

**Step 4: Add migration**

Create the matching SQL in
`gmacko/packages/db/drizzle/0004_omnidat_journal_authority.sql`.

**Step 5: Run tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/db test -- omnidat-schema
```

Expected: pass.

**Step 6: Commit**

```sh
git add gmacko/packages/db/src/omnidat-schema.ts gmacko/packages/db/drizzle/0004_omnidat_journal_authority.sql gmacko/packages/db/src/__tests__/omnidat-schema.test.ts
git commit -m "Add OMNIDAT journal and authority schema"
```

## Task 2: Build The Cloud Journal Apply Engine

**Files:**

- Create: `gmacko/packages/api/src/router/omnidat-sync.ts`
- Test: `gmacko/packages/api/src/router/omnidat-sync.test.ts`

**Step 1: Write failing tests**

Using the same fake Drizzle adapter pattern as
`omnidat-persistence.test.ts`, test `applyJournalBatch(db, batch)`:

- applies a fresh entry and returns `{applied: 1}`.
- returns `{duplicate: 1}` for a repeated idempotency key, without a second
  projection write.
- rejects an entry whose epoch is stale past the fence:
  `{rejectedStale: 1}`, entry stored with `applyStatus: "quarantined"`.
- applies a past-epoch entry with `seq <= fenceSeq` for that epoch.
- maps `food.order.created` onto the food-order projection and an unmapped
  op type onto an `omnidatAuditEvent` row.
- report shape:
  `{applied, duplicate, rejectedStale, quarantined, highWatermark, authority}`.

**Step 2: Run failing tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat-sync
```

Expected: fail because the module does not exist.

**Step 3: Implement**

- `getCurrentAuthority(db, eventId)`: highest-epoch
  `omnidatEventAuthority` row; default `{holder: "cloud", epoch: 0}` when no
  row exists.
- `applyJournalBatch(db, {sourceId, entries})` applying the rules in the
  Design section, in ascending `seq` order.
- op-type dispatch table reusing the existing projection helpers from
  `omnidat-persistence.ts`; default branch writes an `omnidatAuditEvent`.
- update `omnidatSyncSource.lastPushedSeq`/`lastSyncAt` after each batch.
- `appendCloudJournalEntry(db, entry)`: helper for cloud-side writes,
  stamping `sourceId: "cloud"` and the current epoch, refusing to append if
  the cloud is not the current holder for the target event.

**Step 4: Run tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat-sync
```

Expected: pass.

**Step 5: Commit**

```sh
git add gmacko/packages/api/src/router/omnidat-sync.ts gmacko/packages/api/src/router/omnidat-sync.test.ts
git commit -m "Add OMNIDAT journal apply engine"
```

## Task 3: Add Sync And Authority tRPC Procedures

**Files:**

- Modify: `gmacko/packages/api/src/router/omnidat.ts`
- Modify: `gmacko/packages/api/src/router/omnidat-sync.ts`
- Test: `gmacko/packages/api/src/router/omnidat.test.ts`

**Step 1: Write failing tests**

Test procedures:

- `omnidat.syncPush` returns a reconciliation report and rejects a bad sync
  token.
- `omnidat.syncPull` returns entries above the supplied watermarks plus the
  current authority record.
- `omnidat.authorityStatus` returns holder, epoch, and per-source
  `lastSyncAt`.
- `omnidat.transferAuthority` increments the epoch, records the fence and
  reason, writes an `authority.transferred` audit event, and refuses a
  transfer to a source that has not caught up to the cloud watermark.

**Step 2: Run failing tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat
```

Expected: fail because the procedures do not exist.

**Step 3: Implement**

- zod inputs mirroring the protocol shapes in the Design section.
- token check against `omnidatSyncSource.tokenHash` (sha256, same style as
  `activationHash` in `omnidat-persistence.ts`).
- procedures stay `publicProcedure` with the sync-token check. The H1a
  capability matrix ([H1a plan](2026-07-04-h1a-operator-core-slice.md))
  defines the `authority.transfer` capability (granted to `noc-operator`
  and `admin`) for `transferAuthority` and a documented token-authenticated
  sync procedure class for `syncPush`/`syncPull`; the H1a router-walk test
  annotates the sync procedures as exceptions until the sync credential
  model lands. Until then `transferAuthority` additionally requires an
  operator identifier in the input and records it in the audit event.
- existing mutating procedures that call `persist*` helpers
  (`provisionCampsiteService`, `configurePad`, `setupAtmTerminal`,
  `createFoodOrder`, `stampActivityPassport`, `xotCommand`) also call
  `appendCloudJournalEntry` when the cloud is the current holder, so
  pre-event provisioning is pullable by a field kit.

**Step 4: Run tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat
```

Expected: pass.

**Step 5: Commit**

```sh
git add gmacko/packages/api/src/router/omnidat.ts gmacko/packages/api/src/router/omnidat-sync.ts gmacko/packages/api/src/router/omnidat.test.ts
git commit -m "Add OMNIDAT sync and authority procedures"
```

## Task 4: Add The Field Kit Journal Store

**Files:**

- Create: `tools/omnidat_journal.py`
- Test: `tests/test_journal.py`

**Step 1: Write failing tests**

- `JournalStore(path).append(event_id, op_type, payload)` assigns
  `seq` 1, 2, 3... and a `{source_id}:{seq}` idempotency key.
- append is refused with an explicit error when the cached authority holder
  is not this source (stale-epoch writes are rejected at the writer, not
  just the receiver).
- `unpushed()` returns entries with `pushed_at` null, ascending.
- `mark_pushed(seqs)` stamps `pushed_at`.
- payload checksum is a stable sha256 over sorted-key JSON.
- store survives reopen: sequences continue, no reuse.

**Step 2: Run the failing test**

```sh
python3 -m unittest tests.test_journal
```

Expected: fail because the module does not exist.

**Step 3: Implement**

- SQLite schema from the Design section, `pragma journal_mode = wal`,
  `pragma foreign_keys = on`, matching the style of `tools/omnidat_db.py`.
- `source_id` from constructor argument or `OMNIDAT_SOURCE_ID` env,
  defaulting to `field-kit-01`.
- `authority_cache` helpers: `set_authority(event_id, holder, epoch)` and
  `current_epoch(event_id)`; append stamps the cached epoch.
- a small `main()` for `append`/`list`/`report` subcommands in the style of
  `tools/omnidat_events.py`, so operators can inspect the journal from a
  terminal.

**Step 4: Run tests**

```sh
python3 -m unittest tests.test_journal
```

Expected: pass.

**Step 5: Commit**

```sh
git add tools/omnidat_journal.py tests/test_journal.py
git commit -m "Add field kit journal store"
```

## Task 5: Add The Field Kit Sync Client

**Files:**

- Create: `tools/omnidat_sync.py`
- Test: `tests/test_sync_client.py`

**Step 1: Write failing tests**

Use an injected fake transport, the same pattern as
`tests/test_fryos_bridge.py`:

- `SyncClient.push()` sends unpushed entries to
  `{base_url}/api/trpc/omnidat.syncPush` with the bearer token, marks pushed
  entries on success, and returns the parsed reconciliation report.
- a transport error leaves entries unpushed (store-and-forward) and returns
  a failure result instead of raising.
- `pull()` requests entries above local watermarks, applies them to local
  projection state, updates `sync_watermark` and `authority_cache`.
- `render_reconciliation_report(report)` prints applied/duplicate/
  rejected-stale/quarantined counts in the terse uppercase style of
  `render_daily_summary` in `tools/omnidat_events.py`.

**Step 2: Run failing tests**

```sh
python3 -m unittest tests.test_sync_client
```

Expected: fail.

**Step 3: Implement**

- `urllib.request` transport like `tools/omnidat_fryos_bridge.py`; base URL
  from `OMNIDAT_SYNC_TARGET`, token from `OMNIDAT_SYNC_TOKEN`.
- `sync_once()` = push then pull; `sync_loop(interval=15)` with exponential
  backoff capped at 5 minutes.
- every session appends a `sync.session` record to the local event log via
  `tools.omnidat_events.append_event` with the report counts, so sync
  history is printable evidence.

**Step 4: Run tests**

```sh
python3 -m unittest tests.test_sync_client
```

Expected: pass.

**Step 5: Commit**

```sh
git add tools/omnidat_sync.py tests/test_sync_client.py
git commit -m "Add field kit sync client"
```

## Task 6: Route Field-Office Writes Through The Journal

**Files:**

- Modify: `tools/omnidat_queue.py`
- Modify: `tools/omnidat_activity.py`
- Modify: `tools/omnidat_omnibank.py`
- Modify: `tools/omnidat_events.py`
- Test: `tests/test_journal.py`, `tests/test_queue.py`,
  `tests/test_activity.py`

**Step 1: Write failing tests**

- accepting a queue order with a journal store attached appends a
  `queue.order.accepted` journal entry whose payload round-trips the order.
- logging an activity record appends `activity.logged`.
- an OmniBank ledger posting appends `omnibucks.ledger.posted`.
- with no journal store attached, behavior is unchanged (JSONL only), so
  existing tests keep passing.

**Step 2: Run failing tests**

```sh
python3 -m unittest tests.test_queue tests.test_activity tests.test_journal
```

Expected: fail on the new assertions.

**Step 3: Implement**

- add an optional `journal` parameter to the write entry points; when
  present, append the journal op in the same call that writes local state.
  Local state stays the read path; the journal is the sync path.
- keep op payloads self-contained (full record, not a diff) so the cloud
  apply engine can project them without extra lookups.
- note: the orders KPI in `docs/metrics.md` counts both
  `queue.order.accepted` and `food.order.created` op types, so both must
  land as journal entries.

**Step 4: Run tests**

```sh
python -m unittest discover -s tests
```

Expected: pass.

**Step 5: Commit**

```sh
git add tools/omnidat_queue.py tools/omnidat_activity.py tools/omnidat_omnibank.py tools/omnidat_events.py tests/
git commit -m "Journal field-office writes"
```

## Task 7: Show Sync Staleness On The Cloud Dashboard

**Files:**

- Modify: `gmacko/packages/api/src/router/omnidat.ts`
- Modify: `gmacko/apps/nextjs/src/app/_components/omnidat-noc-dashboard.tsx`
- Test: `gmacko/packages/api/src/router/omnidat.test.ts`,
  `gmacko/apps/nextjs/e2e/home.spec.ts`

**Step 1: Write failing tests**

- `omnidat.dashboard` and `omnidat.noc` include
  `sync: {holder, epoch, sourceId, lastSyncAt, stalenessSeconds}` when a
  sync source exists.
- Playwright asserts the NOC page renders a "FIELD DATA AS OF" banner when
  the holder is `field`.

**Step 2: Run failing tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs test:e2e
```

Expected: fail.

**Step 3: Implement**

- compute staleness from `omnidatSyncSource.lastSyncAt` server-side; never
  trust the browser clock.
- banner states holder and age: `FIELD DATA AS OF 14:02 (6 MIN AGO)`;
  escalated styling past 5 minutes; `CLOUD PRIMARY (EPOCH 4)` when the cloud
  holds authority. No spinner, no fake liveness.

**Step 4: Run tests and build**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs test:e2e
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs build
```

Expected: pass.

**Step 5: Commit**

```sh
git add gmacko/packages/api/src/router/omnidat.ts gmacko/apps/nextjs/src/app/_components/omnidat-noc-dashboard.tsx gmacko/apps/nextjs/e2e/home.spec.ts
git commit -m "Show OMNIDAT sync staleness on NOC dashboard"
```

## Task 8: Run The Weekend Sim Through A Sim Field Kit

**Files:**

- Modify: `tools/omnidat_weekend.py`
- Modify: `scripts/weekend-sim`
- Test: `tests/test_weekend_simulation.py`

**Step 1: Write failing tests**

- the weekend report includes a `journal` section: total entries appended,
  entries per op type, and `source_id: "sim-field-kit"`.
- journal entry count reconciles with the JSONL event/ledger counts the sim
  already reports (zero unexplained variance).
- with a fake sync transport injected, the sim pushes batches and the report
  includes the aggregated reconciliation counts
  (`applied`, `duplicate`, `rejected_stale`).
- with no `OMNIDAT_SYNC_TARGET`, the sim completes journal-local with no
  network access.

**Step 2: Run failing tests**

```sh
python3 -m unittest tests.test_weekend_simulation
```

Expected: fail.

**Step 3: Implement**

- `run_weekend_simulation` opens a `JournalStore` in the runtime dir with
  `source_id="sim-field-kit"`, seeds a sim event authority record
  (`holder: field, epoch: 1`), and passes the store to the journaled writers
  from Task 6.
- push in batches during the sim when a sync target is configured (env
  `OMNIDAT_SYNC_TARGET` + `OMNIDAT_SYNC_TOKEN`, read by
  `scripts/weekend-sim`).
- keep JSONL outputs unchanged; they remain the printable evidence surface.

**Step 4: Run the sim and tests**

```sh
python3 -m unittest tests.test_weekend_simulation
./scripts/weekend-sim
```

Expected: tests pass; sim report includes the journal section.

**Step 5: Commit**

```sh
git add tools/omnidat_weekend.py scripts/weekend-sim tests/test_weekend_simulation.py
git commit -m "Run weekend sim through sim field kit journal"
```

## Task 9: Add Failover Drill, Outage Soak, And Runbook

**Files:**

- Create: `scripts/authority-drill`
- Create: `runbooks/authority-failover.md`
- Modify: `tools/omnidat_weekend.py`
- Modify: `runbooks/incident-response.md`
- Test: `tests/test_weekend_simulation.py`

**Step 1: Write failing tests**

Exit-gate tests, matching the roadmap-expansion Workstream A gates:

- **Uplink pull:** run the sim with `--outage-window` covering at least 60
  simulated minutes of operations mid-sim. The sync transport refuses during
  the window. Assert: every journal entry eventually reaches the (fake)
  cloud, `applied + duplicate == total`, `rejected_stale == 0`, and
  field-office flows (orders, stamps, ledger) completed during the outage.
- **Failover both directions:** drive transfer field -> cloud against the
  apply engine, assert a subsequent field-epoch write past the fence is
  quarantined and counted `rejected_stale`; catch the kit up, transfer back,
  assert cloud-epoch writes are then rejected at the cloud writer. No entry
  is deleted in either direction.

**Step 2: Run failing tests**

```sh
python3 -m unittest tests.test_weekend_simulation
```

Expected: fail.

**Step 3: Implement**

- `--outage-window START END` (simulated timestamps) on
  `tools/omnidat_weekend.py`; the sync client store-and-forwards through the
  window and drains on recovery.
- `scripts/authority-drill`: drives `omnidat.authorityStatus`,
  `omnidat.transferAuthority`, and a verification pull in both directions
  against a target from `OMNIDAT_SYNC_TARGET`; prints a pass/fail transcript
  suitable for printing as rehearsal evidence.
- `runbooks/authority-failover.md`: the two failover procedures and the
  rejoin procedure from the Design section, each step naming the command or
  dashboard element it uses; the literal 60-minute pull-the-uplink drill for
  the H5 exit gate; quarantine review steps. Link it from
  `runbooks/incident-response.md`.

**Step 4: Run tests**

```sh
python -m unittest discover -s tests
```

Expected: pass.

**Step 5: Commit**

```sh
git add scripts/authority-drill runbooks/authority-failover.md runbooks/incident-response.md tools/omnidat_weekend.py tests/test_weekend_simulation.py
git commit -m "Add authority failover drill and outage soak"
```

## Task 10: Full Verification

Run from repo root:

```sh
npm test
./scripts/validate-data
npm run deploy:worker:dry-run --silent
corepack pnpm@10.32.1 --dir gmacko test
corepack pnpm@10.32.1 --dir gmacko test:scaffold
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs build
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs typecheck
./scripts/weekend-sim
./scripts/e2e-omnibank
```

Expected: all release gates from the roadmap Developer Experience track
pass, and the weekend sim runs through the sim field kit journal by default.

Commit the plan doc:

```sh
git add docs/plans/2026-07-04-split-authority-sync.md
git commit -m "Plan split-authority sync"
```

## Acceptance Criteria

This implementation is complete when:

- every event-scoped field-office write lands in the SQLite journal first,
  with per-source monotonic sequence, epoch stamp, idempotency key, and
  payload checksum.
- the cloud applies pushed journal batches idempotently and returns a
  reconciliation report with applied, duplicate, and rejected-stale counts.
- authority transfers are NOC-initiated, audited, epoch-incrementing, and
  fence-recorded; stale-epoch writes are rejected at the writer and
  quarantined (never dropped) at the receiver.
- pulling the uplink for a 60-minute window mid-simulation loses zero
  records, produces a clean reconciliation report on resync, and all
  field-office flows keep working during the window.
- the authority failover drill passes in both directions with no
  stale-epoch write accepted.
- the cloud NOC dashboard shows sync staleness honestly during the outage
  window and never presents stale field data as live.
- `./scripts/weekend-sim` runs through the sim field kit journal path as its
  default mode, syncing when `OMNIDAT_SYNC_TARGET` is set.

## Open Questions

- **Sync credential model after H1a.** The bearer token in
  `omnidat_sync_source` is interim. The
  [H1a plan](2026-07-04-h1a-operator-core-slice.md) documents the
  token-authenticated sync procedure class and annotates the sync
  procedures in its router-walk test; whether sync sources become
  `omnidatSecurityCredential` rows scoped by role once H1a role-gating
  lands still needs a decision there.
- **Sync endpoint host.** This plan targets the gmacko tRPC surface. The
  roadmap decision "is `omnidat.gmac.io` the gmacko V1 app, the Worker
  demo, or a split surface?" is still open; if the Worker remains the public
  edge, the sync procedures stay gmacko-only and are unaffected, but the
  staleness banner must also reach the Worker status pages.
- **Quarantine review UI.** This plan stores and reports quarantined
  entries; the operator review/re-enter/archive UI is H1b scope and needs a
  home in the H1b plan.
- **Conflict policy for allocation collisions.** If the cloud allocates an
  X.121 address during a dead-kit failover window that the kit had also
  allocated pre-failover, the kit's entry quarantines. The default (cloud
  allocation wins, kit allocation re-entered under a new address) needs NOC
  sign-off before the tabletop rehearsal.
- **Journal retention.** Per-event retention windows for journal entries
  (including quarantined ones) belong to the H8 data governance track; no
  pruning is implemented in this plan.
- **Staging sync target.** Which deployed gmacko environment serves as the
  permanent weekend-sim soak target (and who owns its database) is
  undecided; until then the soak runs against a local gmacko instance.
