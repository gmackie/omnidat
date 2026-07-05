# H1a Operator Core Slice Implementation Plan

Date: 2026-07-04

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the H1a slice from the [roadmap](../roadmap.md) and
[Workstream B of the roadmap expansion](2026-07-04-roadmap-expansion.md):
role-gated tRPC, an audit event on every write, and only the CRUD the packet
bridge needs — services, service verbs, X.121 allocations, packet sessions,
and evidence artifacts — with KPI instrumentation hooks from day one. H2
(packet bridge) starts as soon as this slice passes.

**Architecture:** Build directly on top of the current gmacko OMNIDAT tRPC
surface, the persistent projection helpers in
`gmacko/packages/api/src/router/omnidat-persistence.ts`, and the split-authority
journal tables now present in the shared schema. This plan wraps existing
operator writes in a role model, makes the audit path mandatory, adds the
remaining bridge-critical object type (packet sessions), fills the missing
evidence/service-verb write paths, and routes operational counts through one
KPI choke point so the field kit journal can take over instrumentation without
touching call sites.

**Tech Stack:** TypeScript, tRPC, Drizzle ORM, Postgres, Vitest, Next.js/gmacko.

## Current State

Already in the repo (do not rebuild):

- Schema: `gmacko/packages/db/src/omnidat-schema.ts` already has
  `omnidatOperatorRole`, `omnidatAuditEvent`, `omnidatEvent`,
  `omnidatEvidenceArtifact`, `omnidatService`, `omnidatServiceVerb`,
  `omnidatAddressAllocation`, `omnidatNetworkMetric`,
  `omnidatJournalEntry`, `omnidatSyncSource`, and
  `omnidatEventAuthority`. Migrations through
  `gmacko/packages/db/drizzle/0004_omnidat_journal_authority.sql` exist.
- Auth plumbing: `gmacko/packages/api/src/trpc.ts` provides
  `protectedProcedure`, session context with `ctx.session.user`, API-key
  procedures, and `ctx.db`. There is no role middleware yet.
- Audit helper: `persistAuditEvent` in
  `gmacko/packages/api/src/router/omnidat-persistence.ts` writes
  `omnidatAuditEvent` rows, and the `persist*Result` helpers each emit an
  audit row — but none of them record `actorUserId` or the acting role.
- Router: every procedure in
  `gmacko/packages/api/src/router/omnidat.ts` is `publicProcedure`,
  including the current operational mutations (`vintageTerminalDownloadPackage`,
  `verifyProvisioning`, `provisionCampsiteService`, `configurePad`,
  `setupAtmTerminal`, `createFoodOrder`, `stampActivityPassport`,
  `iso8583Transaction`, `iso8583ShadyBankPurchase`, `vintagePosSale`,
  `xotCommand`, and `transferAuthority`). `syncPush`/`syncPull` authenticate
  with per-source sync tokens in the procedure body, but they are still shaped
  as `publicProcedure` at the tRPC layer and must remain the only documented
  token-authenticated exceptions.
- Current router writes `journalCloudWrite(...)` for several operational
  mutations. H1a keeps that journal seam and adds actor attribution, role
  metadata, packet sessions, and KPI metrics around it instead of replacing it.
- The campsite/service/allocation mutations named in the roadmap may not all
  exist yet in this checkout. If a task below references a missing mutation,
  implement the narrow bridge-critical mutation in that task and gate it before
  merging; do not add another public write and "gate later".

Missing pieces this plan owns:

- a named role set and capability matrix.
- role-check tRPC middleware and an operator procedure factory.
- admin-only role grant/revoke mutations (full role management UI is H1b).
- actor identity threaded into every audit event, and a test proving every
  mutation is both role-gated and audited.
- a packet session table and session open/clear/list operations with honest
  X.25 clear cause and diagnostic codes (locked protocol-fidelity decision).
- evidence-artifact create/list operations (the table and loader exist; no
  write path does).
- service verb mutations independent of service creation.
- KPI instrumentation hooks aligned to the Workstream G KPI set.

## Role Set

Roles are rows in `omnidatOperatorRole` (`role` varchar, event-scoped via
`eventId`, `eventId = null` means a global grant). The H1a role strings:

| Role | Grant scope | Can mutate in H1a |
| --- | --- | --- |
| `campsite-owner` | own campsite | request a service for their campsite. |
| `vendor-operator` | own vendor services | request services, food orders, POS sale, terminal packages, passport stamps. |
| `packet-operator` | event | services, verbs, X.121 allocations, PADs, provisioning, sessions, evidence. |
| `noc-operator` | event | sessions, incidents, service disable, evidence. |
| `bank-operator` | event | ATM setup, ISO 8583, POS sale, terminal packages. |
| `admin` | event or global | everything, including role grants. |
| `auditor` | event or global | nothing — read-only access to all operator views. |

Rules:

- `admin` implies every capability; no other role implies another.
- `auditor` passes operator read gates and fails every mutation gate. The
  role-matrix test in Task 8 proves this.
- ownership scoping (campsite owners editing only their own objects) is
  enforced inside mutation bodies for `campsite-owner`/`vendor-operator`;
  broad self-service editing is H1b/H3 scope.
- these gmacko roles are distinct from the field-desk staffing roles in
  `docs/operator-model.md` (TrustDesk, Document Clerk, Media Vault, ATV);
  those desks map onto these API roles when H1b builds role management.

## Task 1: Role Constants And Capability Matrix

**Files:**

- Create: `gmacko/packages/api/src/router/omnidat-roles.ts`
- Test: `gmacko/packages/api/src/router/omnidat-roles.test.ts`

**Step 1: Write failing tests**

Assert the module exports the seven roles, a capability list, and a
`roleGrants(role, capability)` predicate:

```ts
import { OMNIDAT_ROLES, roleGrants } from "./omnidat-roles";

it("defines the seven H1a roles", () => {
  expect(OMNIDAT_ROLES).toEqual([
    "campsite-owner",
    "vendor-operator",
    "packet-operator",
    "noc-operator",
    "bank-operator",
    "admin",
    "auditor",
  ]);
});

it("grants everything to admin and nothing to auditor", () => {
  expect(roleGrants("admin", "service.write")).toBe(true);
  expect(roleGrants("auditor", "service.write")).toBe(false);
  expect(roleGrants("auditor", "operator.read")).toBe(true);
});
```

**Step 2: Run the failing tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat-roles
```

Expected: fail because the module does not exist.

**Step 3: Implement**

```ts
export const OMNIDAT_ROLES = [
  "campsite-owner",
  "vendor-operator",
  "packet-operator",
  "noc-operator",
  "bank-operator",
  "admin",
  "auditor",
] as const;

export type OmnidatRole = (typeof OMNIDAT_ROLES)[number];

export const OMNIDAT_CAPABILITIES = {
  "operator.read": [...OMNIDAT_ROLES],
  "service.request": ["campsite-owner", "vendor-operator", "packet-operator"],
  "service.write": ["packet-operator"],
  "service.disable": ["packet-operator", "noc-operator"],
  "verb.write": ["packet-operator"],
  "allocation.write": ["packet-operator"],
  "provisioning.write": ["packet-operator"],
  "session.write": ["packet-operator", "noc-operator"],
  "evidence.write": ["packet-operator", "noc-operator"],
  "incident.write": ["packet-operator", "noc-operator"],
  "authority.transfer": ["noc-operator"],
  "bank.write": ["bank-operator"],
  "vendor.write": ["vendor-operator", "bank-operator"],
  "role.write": [],
} satisfies Record<string, readonly OmnidatRole[]>;

export type OmnidatCapability = keyof typeof OMNIDAT_CAPABILITIES;

export function roleGrants(role: OmnidatRole, capability: OmnidatCapability) {
  if (role === "admin") return true;
  return OMNIDAT_CAPABILITIES[capability].includes(role);
}
```

`role.write` is empty on purpose: only `admin` can grant or revoke roles.
`auditor` appears only in `operator.read`. `authority.transfer` is granted to
`noc-operator` and `admin` (admin via the implies-all rule); it gates the
authority transfer flow defined in
[Split Authority Sync](2026-07-04-split-authority-sync.md).

The sync procedures are a separate, documented procedure class:
`syncPush`/`syncPull` authenticate with a field-kit sync token, not an
operator session, so they carry no capability from this matrix. The
token-authenticated class is specified in
[Split Authority Sync](2026-07-04-split-authority-sync.md); the router-walk
test in Task 3 enumerates these two procedures as an annotated exception and
requires any future exception to name its authentication mode.

**Step 4: Run tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat-roles
```

Expected: pass.

**Step 5: Commit**

```sh
git add gmacko/packages/api/src/router/omnidat-roles.ts gmacko/packages/api/src/router/omnidat-roles.test.ts
git commit -m "Add OMNIDAT role capability matrix"
```

## Task 2: Operator Procedure Middleware And Role Grants

**Files:**

- Create: `gmacko/packages/api/src/router/omnidat-operator-procedure.ts`
- Modify: `gmacko/packages/api/src/trpc.ts` (export meta type only, if needed)
- Modify: `gmacko/packages/api/src/router/omnidat.ts` (grant/revoke procedures)
- Test: `gmacko/packages/api/src/router/omnidat-operator-procedure.test.ts`

**Step 1: Write failing tests**

Using the fake Drizzle adapter pattern from `omnidat.test.ts` and
`omnidat-persistence.test.ts`, seed `omnidatOperatorRole` rows and assert:

- no session -> `UNAUTHORIZED`.
- session but no role rows -> `FORBIDDEN`.
- session with `packet-operator` -> `service.write` mutation passes.
- session with `auditor` -> same mutation `FORBIDDEN`, operator read passes.
- `active: false` role row -> `FORBIDDEN`.
- user id listed in `OMNIDAT_BOOTSTRAP_ADMINS` -> passes as admin and an
  audit event `role.bootstrap-admin.used` is written.
- `omnidat.grantOperatorRole` succeeds for admin, `FORBIDDEN` for
  `packet-operator`.

**Step 2: Run failing tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat-operator-procedure
```

Expected: fail because the middleware does not exist.

**Step 3: Implement the procedure factory**

Build on `protectedProcedure` from `gmacko/packages/api/src/trpc.ts`:

```ts
export function omnidatOperatorProcedure(capability: OmnidatCapability) {
  return protectedProcedure
    .meta({ omnidat: { capability, audited: true } })
    .use(async ({ ctx, next }) => {
      const roles = await loadActiveOperatorRoles(
        ctx.db,
        ctx.session.user.id,
      );
      if (bootstrapAdmin(ctx.session.user.id)) roles.push("admin");
      if (!roles.some((role) => roleGrants(role, capability))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return next({
        ctx: { operator: { userId: ctx.session.user.id, roles } },
      });
    });
}

export const omnidatOperatorReadProcedure =
  omnidatOperatorProcedure("operator.read");
```

Details:

- `loadActiveOperatorRoles` selects `omnidatOperatorRole` rows where
  `userId` matches and `active` is true. Event scoping (`eventId`) is stored
  and returned but not yet filtered on — the active-event concept lands with
  the Workstream A plan
  ([Split Authority Sync](2026-07-04-split-authority-sync.md); see Open
  Questions).
- `OMNIDAT_BOOTSTRAP_ADMINS` is a comma-separated list of user ids that act
  as admin before any role rows exist. Every request that relies on it writes
  a `role.bootstrap-admin.used` audit event. This solves first-admin
  bootstrap and keeps seed-fallback demos usable.
- register the tRPC meta shape (`initTRPC.meta<...>()`) if the existing `t`
  instance does not already carry a meta type.

**Step 4: Add role grant/revoke mutations**

Add to `omnidatRouter` (admin-only via capability `role.write`):

```ts
grantOperatorRole: omnidatOperatorProcedure("role.write")
  .input(z.object({
    userId: z.string().min(1),
    role: z.enum(OMNIDAT_ROLES),
    eventId: z.string().uuid().optional(),
  }))
  .mutation(/* upsert omnidatOperatorRole, audit "role.granted" */),

revokeOperatorRole: omnidatOperatorProcedure("role.write")
  .input(z.object({ userId: z.string().min(1), role: z.enum(OMNIDAT_ROLES) }))
  .mutation(/* set active=false, audit "role.revoked" */),
```

The full role management UI is H1b; these two mutations exist so an admin can
stand up operators without shell access, which is an H1 exit gate.

**Step 5: Run tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat-operator-procedure
```

Expected: pass.

**Step 6: Commit**

```sh
git add gmacko/packages/api/src/router/omnidat-operator-procedure.ts gmacko/packages/api/src/router/omnidat-operator-procedure.test.ts gmacko/packages/api/src/router/omnidat.ts gmacko/packages/api/src/trpc.ts
git commit -m "Add OMNIDAT operator role middleware"
```

## Task 3: Actor-Attributed Audit Write Path

**Files:**

- Modify: `gmacko/packages/api/src/router/omnidat-persistence.ts`
- Modify: `gmacko/packages/api/src/router/omnidat.ts`
- Test: `gmacko/packages/api/src/router/omnidat-persistence.test.ts`

**Step 1: Write failing tests**

Assert that audit rows written through the mutation path carry the actor:

```ts
expect(auditInserts[0]).toMatchObject({
  eventType: "provisioning.verified",
  actorUserId: "user-packet-1",
  details: expect.objectContaining({ actorRoles: ["packet-operator"] }),
});
```

Also assert that when the audit insert throws and database persistence is
enabled, the mutation rejects — a write without an audit event must be
impossible, not best-effort.

**Step 2: Run failing tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat-persistence
```

Expected: fail because `persist*` helpers do not accept an actor.

**Step 3: Implement**

- add an `OmnidatAuditActor` type `{ userId: string; roles: OmnidatRole[]; ipAddress?: string }`.
- extend `persistAuditEvent` and every `persist*Result` helper
  (`persistProvisioningResult`, `persistPadResult`, `persistAtmResult`,
  `persistXotCommandResult`, `persistFoodOrderResult`,
  `persistPassportStampResult`) to take the actor and set
  `actorUserId`, `ipAddress`, and `details.actorRoles`. `omnidatAuditEvent`
  already has `actorUserId` and `ipAddress` columns
  (`gmacko/packages/db/src/omnidat-schema.ts`), so no migration is needed;
  roles ride in the `details` json.
- do not catch audit-insert errors; let them fail the mutation.
- pass `ctx.operator` from the middleware into every helper call in
  `omnidat.ts`.

**Step 4: Add the router coverage test**

In `omnidat.test.ts`, walk the router definition and assert every mutation is
gated and audited — this is the structural guarantee behind the H1a exit
gates:

```ts
// Token-authenticated sync procedures (Split Authority Sync) are exempt from
// operator-session gates. They still verify source tokens inside the procedure.
const SYNC_TOKEN_EXCEPTIONS = ["syncPush", "syncPull"];

it("role-gates and audits every omnidat mutation", () => {
  for (const [name, procedure] of Object.entries(omnidatRouter)) {
    if (procedure._def.type !== "mutation") continue;
    if (SYNC_TOKEN_EXCEPTIONS.includes(name)) continue;
    expect(procedure._def.meta?.omnidat?.audited, name).toBe(true);
    expect(procedure._def.meta?.omnidat?.capability, name).toBeDefined();
  }
});
```

Any future mutation added without `omnidatOperatorProcedure` fails this test.
`syncPush`/`syncPull` are the only exceptions: they use the
token-authenticated sync procedure class from
[Split Authority Sync](2026-07-04-split-authority-sync.md), not operator
sessions. `authorityStatus` is a query and may be public or
`operator.read` depending on the production-status decision, but
`transferAuthority` is a mutation and must be gated on `authority.transfer`
in Task 4. The exception list is annotated in the test and must never grow
without a documented authentication mode.

**Step 5: Run tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat
```

Expected: pass (Task 4 migrates the procedures; run this test file expecting
the coverage test to fail until Task 4 completes, then re-run).

**Step 6: Commit**

```sh
git add gmacko/packages/api/src/router/omnidat-persistence.ts gmacko/packages/api/src/router/omnidat-persistence.test.ts gmacko/packages/api/src/router/omnidat.ts gmacko/packages/api/src/router/omnidat.test.ts
git commit -m "Attribute OMNIDAT audit events to acting operators"
```

## Task 4: Role-Gate The Existing Router

**Files:**

- Modify: `gmacko/packages/api/src/router/omnidat.ts`
- Test: `gmacko/packages/api/src/router/omnidat.test.ts`

**Step 1: Apply the capability map**

Replace `publicProcedure` per this table. Some rows exist today in
`omnidat.ts`; some are bridge-critical H1a additions. If a procedure is
missing, add it with the gate listed here before merging rather than adding
another ungated write.

| Procedure | Kind | Gate |
| --- | --- | --- |
| `network`, `services`, `foodProtocol`, `atmProtocol`, `vintageTerminalProgramPack`, `shadyBankStatus` | query | stays `publicProcedure` (public status/directory surface). |
| `authorityStatus` | query | `publicProcedure` for status-only fields, or `omnidatOperatorReadProcedure` if it includes source-token or operator-sensitive fields. Pick one in the implementation and add the matching test. |
| `dashboard`, `noc`, `billing`, `operations`, `listPacketSessions`, `listEvidenceArtifacts` | query | `omnidatOperatorReadProcedure`. |
| `provisionCampsiteService`, `verifyProvisioning`, `configurePad` | mutation | `provisioning.write`. |
| `xotCommand`, `openPacketSession`, `clearPacketSession` | mutation | `session.write`. |
| `setupAtmTerminal`, `iso8583Transaction`, `iso8583ShadyBankPurchase` | mutation | `bank.write`. |
| `vintagePosSale`, `vintageTerminalDownloadPackage`, `createFoodOrder`, `stampActivityPassport` | mutation | `vendor.write`. |
| `createCampsite`, `allocateAddress` | mutation | `allocation.write`. |
| `requestService` | mutation | `service.request` (ownership check in body for `campsite-owner`/`vendor-operator`). |
| `approveService` | mutation | `service.write`. |
| `upsertServiceVerb`, `disableServiceVerb` | mutation | `verb.write`. |
| `createEvidenceArtifact` | mutation | `evidence.write`. |
| `disableService` | mutation | `service.disable`. |
| `openIncident`, `updateIncident` | mutation | `incident.write`. |
| `transferAuthority` | mutation | `authority.transfer`. |
| `grantOperatorRole`, `revokeOperatorRole` | mutation | `role.write` (Task 2). |
| `syncPush`, `syncPull` | mutation | stays token-authenticated by sync source token; these are the only non-operator-session mutation exceptions. |

Participant-facing terminal calls (a camper's own `xotCommand`, food order
from a terminal) will use terminal/service credentials in H2, not operator
sessions; until then those flows require an operator role.

**Step 2: Update existing tests**

`omnidat.test.ts` currently calls `appRouter.createCaller({} as never)`. Add
two helpers: `publicCaller` (no session) and `operatorCaller(roles)` (session
plus fake-db role rows), and move every mutation test onto
`operatorCaller`. Keep at least one assertion per public query that it still
works unauthenticated.

**Step 3: Run tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat
```

Expected: pass, including the Task 4 coverage test from Task 3 Step 4.

**Step 4: Commit**

```sh
git add gmacko/packages/api/src/router/omnidat.ts gmacko/packages/api/src/router/omnidat.test.ts
git commit -m "Role-gate OMNIDAT tRPC procedures"
```

## Task 5: Packet Session Table And Operations

**Files:**

- Modify: `gmacko/packages/db/src/omnidat-schema.ts`
- Create: `gmacko/packages/db/drizzle/0005_omnidat_packet_session.sql`
- Modify: `gmacko/packages/api/src/router/omnidat.ts`
- Modify: `gmacko/packages/api/src/router/omnidat-persistence.ts`
- Test: `gmacko/packages/db/src/__tests__/omnidat-schema.test.ts`
- Test: `gmacko/packages/api/src/router/omnidat.test.ts`

Migration numbering:
[Split Authority Sync](2026-07-04-split-authority-sync.md) keeps drizzle
migration 0004; this plan's packet-session migration is 0005. Numbers are
assigned at build time, and split-authority lands first per the roadmap
Near-Term Build Order.

**Step 1: Write failing tests**

Schema test: `omnidatPacketSession` is exported. API tests:

- `omnidat.openPacketSession` persists a session row and audits
  `session.opened`.
- `omnidat.clearPacketSession` stores `clearCause`, `clearDiagnostic`,
  `clearedAt`, `transcriptHash`, and audits `session.cleared`.
- `omnidat.listPacketSessions` returns active and recently cleared sessions
  (NOC visibility, an H2 exit gate).
- `omnidat.xotCommand` opens and clears a session row around the existing
  `executeXotCommand` call so today's XOT path leaves session evidence.

**Step 2: Run failing tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/db test -- omnidat-schema
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat
```

Expected: fail.

**Step 3: Add schema and migration**

Matches the roadmap H2 packet session table field list:

```ts
export const omnidatPacketSession = omnidatNamespace.table("omnidat_packet_session", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  eventId: t.uuid().references(() => omnidatEvent.id, { onDelete: "set null" }),
  serviceId: t.uuid().references(() => omnidatService.id, { onDelete: "set null" }),
  sourceIdentity: t.varchar({ length: 160 }).notNull(),
  sourceTransport: t.varchar({ length: 80 }).notNull(),
  sourceX121: t.varchar({ length: 32 }),
  destinationX121: t.varchar({ length: 32 }).notNull(),
  status: t.varchar({ length: 32 }).notNull().default("connected"),
  connectedAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  clearedAt: t.timestamp({ mode: "date", withTimezone: true }),
  clearCause: t.integer(),
  clearDiagnostic: t.integer(),
  transcriptHash: t.varchar({ length: 128 }),
  evidenceArtifactId: t.uuid().references(() => omnidatEvidenceArtifact.id, { onDelete: "set null" }),
}));
```

Per the locked protocol-fidelity decision, `clearCause` and `clearDiagnostic`
are raw X.25 code points (integers), never free-text failure strings.
`clearPacketSession` requires a cause; "success" is DTE-originated clearing
(cause `0x00`), and failure paths must supply the honest cause. The code
table itself belongs to `docs/protocol-fidelity.md` (H2, Workstream C); this
slice only guarantees the storage is code-shaped from day one.

**Step 4: Implement mutations and loader**

- `openPacketSession`, `clearPacketSession`, `listPacketSessions` gated on
  `session.write` / `operator.read`, following the persistence-helper pattern
  in `omnidat-persistence.ts`.
- `transcriptHash` is sha256 of the transcript text (reuse the
  `activationHash` pattern in `omnidat-persistence.ts`).
- extend `loadPersistentOperationalState` with a `packetSessions` projection
  and include sessions in the `noc` query response.
- wrap `xotCommand` so it opens a session, executes, and clears with the
  result status mapped to a cause code.

**Step 5: Run tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/db test -- omnidat-schema
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat
```

Expected: pass.

**Step 6: Commit**

```sh
git add gmacko/packages/db/src/omnidat-schema.ts gmacko/packages/db/drizzle/0005_omnidat_packet_session.sql gmacko/packages/db/src/__tests__/omnidat-schema.test.ts gmacko/packages/api/src/router/omnidat.ts gmacko/packages/api/src/router/omnidat-persistence.ts gmacko/packages/api/src/router/omnidat.test.ts
git commit -m "Add OMNIDAT packet session records"
```

## Task 6: Evidence Artifact And Service Verb Mutations

**Files:**

- Modify: `gmacko/packages/api/src/router/omnidat.ts`
- Modify: `gmacko/packages/api/src/router/omnidat-persistence.ts`
- Test: `gmacko/packages/api/src/router/omnidat.test.ts`

The `omnidatEvidenceArtifact` table and its loader projection already exist
(Persistent Operator Workflows Tasks 1-2). What is missing is any gated write
path, and verb mutations independent of `requestService`.

**Step 1: Write failing tests**

- `omnidat.createEvidenceArtifact` (gate `evidence.write`) inserts a row with
  `artifactKind`, `label`, `url`, `recordCount`, `contentType`, `checksum`,
  optional `eventId`, and audits `evidence.created`.
- `omnidat.listEvidenceArtifacts` (gate `operator.read`) returns rows,
  optionally filtered by `artifactKind`.
- `omnidat.upsertServiceVerb` (gate `verb.write`) inserts or updates a verb
  on an existing service, including `inputs`, `outputs`, and
  `securityPolicy` (all columns exist on `omnidatServiceVerb`), and audits
  `verb.upserted`.
- `omnidat.disableServiceVerb` (gate `verb.write`) sets `active = false` and
  audits `verb.disabled`.
- `clearPacketSession` can link an evidence artifact id to the session
  (bridge exit gate: session -> evidence -> receipt).

**Step 2: Run failing tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat
```

Expected: fail because the procedures do not exist.

**Step 3: Implement**

Follow the persistence-helper pattern: zod input, insert/upsert helper in
`omnidat-persistence.ts`, audit event with actor, gated procedure in
`omnidat.ts`. Verb upsert conflicts on the existing
`omnidat_service_verb_service_verb_unique` constraint.

**Step 4: Run tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat
```

Expected: pass.

**Step 5: Commit**

```sh
git add gmacko/packages/api/src/router/omnidat.ts gmacko/packages/api/src/router/omnidat-persistence.ts gmacko/packages/api/src/router/omnidat.test.ts
git commit -m "Add OMNIDAT evidence and service verb mutations"
```

## Task 7: KPI Instrumentation Hooks

**Files:**

- Create: `gmacko/packages/api/src/router/omnidat-kpi.ts`
- Modify: `gmacko/packages/api/src/router/omnidat.ts`
- Test: `gmacko/packages/api/src/router/omnidat-kpi.test.ts`

**Step 1: Write failing tests**

Assert that one choke-point helper records metrics into
`omnidatNetworkMetric` (`gmacko/packages/db/src/omnidat-schema.ts`) and that
the bridge-critical mutations call it:

```ts
expect(metricInserts.map((row) => row.metricName)).toEqual(
  expect.arrayContaining([
    "packet.session.opened",
    "packet.session.cleared.cause.0",
    "service.verb.called",
  ]),
);
```

**Step 2: Run failing tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat-kpi
```

Expected: fail.

**Step 3: Implement**

`recordOperationalMetric(db, { metricName, value, unit, serviceId?, circuitId? })`
writing `omnidatNetworkMetric` rows. Metric names align to the roadmap
Observability KPI set so daily summaries can aggregate without renames:

| KPI (roadmap) | H1a metric name |
| --- | --- |
| packet sessions per day | `packet.session.opened` (count 1). |
| failed-call rate by clear cause | `packet.session.cleared.cause.<code>` (count 1). |
| verb calls per service | `service.verb.called` with `serviceId` (count 1). |
| allocations | `x121.allocation.assigned` (count 1). |
| evidence artifacts | `evidence.artifact.created` (count 1). |

Call sites: `openPacketSession`/`clearPacketSession` (and the wrapped
`xotCommand`), `allocateAddress`, `upsertServiceVerb` execution paths, and
`createEvidenceArtifact`. Orders, fee totals, incident time-to-clear, unique
identities, and sync staleness are instrumented by later slices when their
write paths change (H1b/H4/Workstream A).

Workstream G says KPIs are ultimately instrumented "once in the field kit
journal". That journal is designed in
[Split Authority Sync](2026-07-04-split-authority-sync.md) (Workstream A).
This helper is deliberately the single call site to swap: when Workstream A
lands, `recordOperationalMetric` writes journal entries instead and no
mutation changes. [Metrics](../metrics.md) documents this interim
explicitly.

**Step 4: Run tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat-kpi
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat
```

Expected: pass.

**Step 5: Commit**

```sh
git add gmacko/packages/api/src/router/omnidat-kpi.ts gmacko/packages/api/src/router/omnidat-kpi.test.ts gmacko/packages/api/src/router/omnidat.ts
git commit -m "Add OMNIDAT KPI instrumentation hooks"
```

## Task 8: Role Matrix Tests

**Files:**

- Create: `gmacko/packages/api/src/router/omnidat-role-matrix.test.ts`

This test file is the roadmap H1 exit gate "role tests prove non-admins
cannot mutate admin-only objects", made exhaustive.

**Step 1: Write the matrix test**

For every role in `OMNIDAT_ROLES` and every mutation in `omnidatRouter`,
derive the expected outcome from `roleGrants` plus the procedure's
`meta.omnidat.capability`, call the mutation with a caller holding exactly
that one role, and assert `FORBIDDEN` or success accordingly. Explicit spot
checks on top of the derived matrix:

- `auditor` is rejected by every mutation.
- `campsite-owner` cannot call `approveService`, `allocateAddress`,
  `grantOperatorRole`, or `createEvidenceArtifact`.
- `bank-operator` cannot call `approveService` or `grantOperatorRole`.
- only `admin` can call `grantOperatorRole` and `revokeOperatorRole`.
- a rejected call writes no audit event and no domain rows.
- every accepted call writes exactly one audit event with the caller's
  `actorUserId`.

Because the expected outcomes derive from the same capability matrix the
middleware uses, this test catches drift in either direction: a mutation
whose gate loosens, or a matrix entry that silently widens.

**Step 2: Run tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat-role-matrix
```

Expected: pass.

**Step 3: Commit**

```sh
git add gmacko/packages/api/src/router/omnidat-role-matrix.test.ts
git commit -m "Prove OMNIDAT role boundaries with matrix tests"
```

## Task 9: Operator Console Session Gating And Session/Evidence Views

**Files:**

- Modify: `gmacko/apps/nextjs/src/app/_components/omnidat-operator-console.tsx`
- Modify: `gmacko/apps/nextjs/src/app/_components/omnidat-noc-dashboard.tsx`
- Modify: `gmacko/apps/nextjs/e2e/home.spec.ts`

Persistent Operator Workflows Task 5 already wires the campsite, service,
allocation, and approval forms. This task only adds what H1a's exit gate
needs: signed-in operator context and visibility of sessions and evidence.

**Step 1: Extend e2e assertions**

- an unauthenticated visitor sees the public directory/status views but not
  operator mutation forms.
- the NOC dashboard lists packet sessions (destination X.121, status, clear
  cause) and evidence artifacts.

**Step 2: Implement**

- gate the operator console and NOC mutation forms behind the authenticated
  session (existing auth plumbing in `gmacko/packages/api/src/trpc.ts`);
  surface `FORBIDDEN` errors as an explicit "role required" notice, not a
  silent failure.
- add a packet sessions table and an evidence artifacts table to the NOC
  dashboard fed by `listPacketSessions` and `listEvidenceArtifacts`.

**Step 3: Run tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs test:e2e
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs build
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs typecheck
```

Expected: pass.

**Step 4: Commit**

```sh
git add gmacko/apps/nextjs/src/app/_components/omnidat-operator-console.tsx gmacko/apps/nextjs/src/app/_components/omnidat-noc-dashboard.tsx gmacko/apps/nextjs/e2e/home.spec.ts
git commit -m "Gate OMNIDAT operator console and show sessions"
```

## Task 10: Full Verification

Run the release gates from the roadmap Developer Experience track:

```sh
npm test
./scripts/validate-data
npm run deploy:worker:dry-run --silent
corepack pnpm@10.32.1 --dir gmacko test
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs build
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs typecheck
corepack pnpm@10.32.1 --dir gmacko test:scaffold
./scripts/weekend-sim
./scripts/e2e-omnibank
```

If `scripts/production-operator-smoke` exists (Persistent Operator Workflows
Task 6), extend it with one negative check: an unauthenticated tRPC mutation
against the deployed app returns `UNAUTHORIZED`, and run
`npm run smoke:production`.

Expected: all gates pass; the weekend simulation still completes (it drives
the Worker/simulation surface, not the gated gmacko mutations — moving it
onto the sim field kit path is Workstream A scope).

Commit the plan doc:

```sh
git add docs/plans/2026-07-04-h1a-operator-core-slice.md
git commit -m "Plan OMNIDAT H1a operator core slice"
```

## Out Of Scope (H1b And Later)

Explicitly not in this slice, per the Workstream B split:

- CRUD for events and historical festivals, villages, vendors, and service
  owners beyond the existing campsite mutations.
- billing accounts and fee policy CRUD (reads stay as-is).
- provisioning lifecycle states (requested/reviewed/approved/assigned/
  installed/verified/active/suspended/revoked).
- PAD config and transport endpoint CRUD beyond the existing `configurePad`.
- role management UI (only `grantOperatorRole`/`revokeOperatorRole` land
  here).
- printed/PDF artifacts (address assignment, demarc sheet, certificates,
  daily NOC summary).
- open-namespace takedown tooling (Workstream H).
- terminal/service credentials for participant-originated calls (H2).
- journal/epoch stamping of writes and the sim-field-kit sync path
  (Workstream A).
- gating or splitting the public Worker demo endpoints — this plan touches
  only the gmacko tRPC surface.

## Acceptance Criteria

This slice is complete when:

- every mutation in `omnidatRouter` is role-gated; the router-walk test
  fails if a new mutation ships ungated or unaudited.
- every accepted write records exactly one audit event carrying
  `actorUserId`, roles, and IP address; audit failure fails the write.
- the role matrix test proves non-admins cannot mutate admin-only objects
  and `auditor` cannot mutate anything.
- an admin can grant and revoke operator roles through tRPC without shell
  access.
- packet sessions persist with honest X.25 clear cause/diagnostic code
  points, a transcript hash, and an optional evidence artifact link, and are
  visible in the NOC view.
- evidence artifacts and service verbs have gated create/update paths.
- KPI metrics for sessions, clear causes, verb calls, allocations, and
  evidence flow through one `recordOperationalMetric` choke point.
- an operator can create a service, allocate an X.121 address, and see its
  sessions and evidence from the UI (Workstream B H1a exit gate).
- public directory/status queries still work unauthenticated.

## Open Questions

- The Workstream A journal/sync/epoch design is
  [Split Authority Sync](2026-07-04-split-authority-sync.md); H1a consumes
  its schema constraints — split-authority keeps migration 0004 and this
  plan's packet-session migration is 0005 (Task 5), and the journal seam
  stays at `recordOperationalMetric` and the audit/persistence helpers. This
  plan writes directly to Postgres; epoch stamping columns come from that
  plan, not this one.
- Which identity provider operators use (OmniAuth passkeys first per the
  Identity track, ForgeGraph OAuth, GitHub) is not decided; this plan relies
  only on the existing session contract in
  `gmacko/packages/api/src/trpc.ts`.
- Whether `dashboard`/`noc`/`billing`/`operations` should stay publicly
  readable on the demo surface or move behind `operator.read` as specified
  here depends on the unresolved `omnidat.gmac.io` production-split decision
  (roadmap decision point). Default here: gate them in gmacko; the Worker
  demo remains the public status surface.
- `OMNIDAT_BOOTSTRAP_ADMINS` as the first-admin mechanism is a proposal;
  alternatives (seed migration, first-user-is-admin) need a decision before
  production cutover. Bootstrap use is audited either way.
- Event-scoped role filtering (`eventId` on `omnidatOperatorRole`) is stored
  but not enforced until an "active event" concept exists, which arrives with
  [Split Authority Sync](2026-07-04-split-authority-sync.md) and H1b event
  CRUD.
