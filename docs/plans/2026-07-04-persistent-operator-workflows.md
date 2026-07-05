# Persistent Operator Workflows Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make OMNIDAT's V1 operator workflows database-backed so camp operators can provision X.121 services, configure PADs, manage service registry entries, review NOC state, and export evidence without developer edits.

**Architecture:** Keep `@omnidat/operator-core` as the deterministic domain engine, but make the gmacko tRPC layer the authoritative operational API. Static seed state remains a fallback only when `OMNIDAT_PERSISTENCE !== "database"` or a database is unavailable. Production uses shared FryOS Postgres through the existing Hyperdrive binding and the `omnidat` schema.

**Tech Stack:** TypeScript, Next.js/gmacko, tRPC, Drizzle ORM, Postgres, Vitest, Cloudflare Workers, existing Python/Worker smoke tests.

## Current State

The repo already has most of the model surface:

- Schema: `gmacko/packages/db/src/omnidat-schema.ts`
  - campsites
  - campsite apps
  - transport endpoints
  - networks
  - X.25 nodes and circuits
  - address allocations
  - services and service verbs
  - PDF profiles
  - provisioning requests
  - PAD configs
  - billing accounts and ledger entries
  - ATMs
  - food orders
  - passport stamps
  - infra endpoints
  - network metrics
  - security credentials
  - audit events
  - NOC incidents
- API: `gmacko/packages/api/src/router/omnidat.ts`
  - dashboard, network, services, NOC, billing, provisioning, PAD, ATM, food,
    passport, ISO 8583, ShadyBank, XOT, and vintage POS operations.
- Persistence adapter: `gmacko/packages/api/src/router/omnidat-persistence.ts`
  - projection functions and partial load/persist support.
- UI:
  - `gmacko/apps/nextjs/src/app/_components/omnidat-operator-console.tsx`
  - `gmacko/apps/nextjs/src/app/_components/omnidat-noc-dashboard.tsx`
  - `gmacko/apps/nextjs/src/app/_components/omnidat-admin-dashboard.tsx`

Missing pieces:

- database-backed campsite and service-registry CRUD.
- explicit address allocation lifecycle.
- admin approval/rejection flows.
- NOC incident create/update flows.
- event/historical camp model.
- persistent evidence export index.
- production smoke command that proves the database path is active.

## Task 1: Add Event And Evidence Tables

**Files:**

- Modify: `gmacko/packages/db/src/omnidat-schema.ts`
- Create: `gmacko/packages/db/drizzle/0003_omnidat_events_and_evidence.sql`
- Test: `gmacko/packages/db/src/__tests__/omnidat-schema.test.ts`

**Step 1: Write the failing schema test**

Add expectations that the schema exports `omnidatEvent`, `omnidatEvidenceArtifact`, and `omnidatOperatorRole`.

```ts
import {
  omnidatEvent,
  omnidatEvidenceArtifact,
  omnidatOperatorRole,
} from "../omnidat-schema";

it("exports event, evidence, and operator role tables", () => {
  expect(omnidatEvent).toBeDefined();
  expect(omnidatEvidenceArtifact).toBeDefined();
  expect(omnidatOperatorRole).toBeDefined();
});
```

**Step 2: Run the failing test**

Run:

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/db test -- omnidat-schema
```

Expected: fail because the exports do not exist.

**Step 3: Add schema**

Add tables:

```ts
export const omnidatEvent = omnidatNamespace.table("omnidat_event", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  eventCode: t.varchar({ length: 80 }).notNull(),
  displayName: t.varchar({ length: 180 }).notNull(),
  eventKind: t.varchar({ length: 80 }).notNull().default("hackercamp"),
  status: t.varchar({ length: 32 }).notNull().default("planning"),
  startsAt: t.timestamp({ mode: "date", withTimezone: true }),
  endsAt: t.timestamp({ mode: "date", withTimezone: true }),
  publicArchive: t.boolean().notNull().default(false),
  notes: t.text(),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}), (table) => [
  unique("omnidat_event_code_unique").on(table.eventCode),
]);

export const omnidatEvidenceArtifact = omnidatNamespace.table("omnidat_evidence_artifact", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  eventId: t.uuid().references(() => omnidatEvent.id, { onDelete: "set null" }),
  artifactKind: t.varchar({ length: 80 }).notNull(),
  label: t.varchar({ length: 180 }).notNull(),
  url: t.text().notNull(),
  recordCount: t.integer(),
  contentType: t.varchar({ length: 120 }).notNull().default("application/json"),
  checksum: t.varchar({ length: 128 }),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

export const omnidatOperatorRole = omnidatNamespace.table("omnidat_operator_role", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  userId: t.text().notNull().references(() => user.id, { onDelete: "cascade" }),
  eventId: t.uuid().references(() => omnidatEvent.id, { onDelete: "cascade" }),
  role: t.varchar({ length: 64 }).notNull(),
  scope: t.varchar({ length: 80 }).notNull().default("event"),
  active: t.boolean().notNull().default(true),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}), (table) => [
  unique("omnidat_operator_role_user_event_role_unique").on(table.userId, table.eventId, table.role),
]);
```

**Step 4: Add migration**

Create the matching SQL migration in `gmacko/packages/db/drizzle/0003_omnidat_events_and_evidence.sql`.

**Step 5: Run tests**

Run:

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/db test -- omnidat-schema
```

Expected: pass.

**Step 6: Commit**

```sh
git add gmacko/packages/db/src/omnidat-schema.ts gmacko/packages/db/drizzle/0003_omnidat_events_and_evidence.sql gmacko/packages/db/src/__tests__/omnidat-schema.test.ts
git commit -m "Add OMNIDAT event evidence schema"
```

## Task 2: Add Persistent Registry Queries

**Files:**

- Modify: `gmacko/packages/api/src/router/omnidat-persistence.ts`
- Test: `gmacko/packages/api/src/router/omnidat-persistence.test.ts`

**Step 1: Write failing tests**

Add tests proving that persistent state loads campsites, services, service verbs,
address allocations, NOC incidents, infra endpoints, and evidence artifacts.

Expected assertions:

```ts
expect(snapshot.services.map((service) => service.slug)).toContain("persisted-bulletin");
expect(snapshot.provisioningRequests[0]?.campsiteName).toBe("Camp Durable");
expect(snapshot.auditEvents[0]?.eventType).toBe("service.approved");
```

**Step 2: Run failing tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat-persistence
```

Expected: fail because loader only derives services from PADs and ATMs.

**Step 3: Extend `loadPersistentOperationalState`**

Add selected row types and `selectRows` calls for:

- `omnidatCampsite`
- `omnidatCampsiteApp`
- `omnidatAddressAllocation`
- `omnidatService`
- `omnidatServiceVerb`
- `omnidatInfraEndpoint`
- `omnidatNetworkMetric`
- `omnidatAuditEvent`
- `omnidatNocIncident`
- `omnidatEvidenceArtifact`

Project persistent service rows into `OmnidatServiceDefinition` before adding
derived PAD/ATM services. Use service verbs from `omnidatServiceVerb`.

**Step 4: Preserve seed fallback**

If no persistent rows exist, return the existing seed state exactly. This keeps
local demos and tests stable.

**Step 5: Run tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat-persistence
```

Expected: pass.

**Step 6: Commit**

```sh
git add gmacko/packages/api/src/router/omnidat-persistence.ts gmacko/packages/api/src/router/omnidat-persistence.test.ts
git commit -m "Load persistent OMNIDAT registry state"
```

## Task 3: Add Operator Mutations For Campsites And Services

**Files:**

- Modify: `gmacko/packages/api/src/router/omnidat.ts`
- Modify: `gmacko/packages/api/src/router/omnidat-persistence.ts`
- Test: `gmacko/packages/api/src/router/omnidat.test.ts`

**Step 1: Write failing API tests**

Add tests for:

- `omnidat.createCampsite`
- `omnidat.requestService`
- `omnidat.approveService`
- `omnidat.disableService`
- `omnidat.allocateAddress`

Use a fake Drizzle adapter matching existing persistence tests.

**Step 2: Run failing tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat
```

Expected: fail because procedures do not exist.

**Step 3: Add inputs**

Use `zod` input schemas:

```ts
const createCampsiteInput = z.object({
  namespace: z.string().min(1).default("camp"),
  slug: z.string().min(1),
  displayName: z.string().min(1),
  contactHandle: z.string().min(1),
});

const requestServiceInput = z.object({
  campsiteId: z.string().uuid(),
  slug: z.string().min(1),
  displayName: z.string().min(1),
  serviceKind: z.string().min(1),
  requestedX121: z.string().min(6).optional(),
  verbs: z.array(z.object({
    verb: z.string().min(1),
    description: z.string().optional(),
    inputs: z.array(z.string()).default([]),
    outputs: z.array(z.string()).default([]),
  })).default([]),
});
```

**Step 4: Add persistence helpers**

Add helpers that insert/update:

- campsite rows.
- service rows.
- service verb rows.
- address allocation rows.
- provisioning request rows.
- audit event rows.

Keep operator-core calls for transcript generation and deterministic receipt
content.

**Step 5: Add router procedures**

Procedures can remain `publicProcedure` until auth middleware is wired into this
router, but they must accept `ctx.db` and persist when available. Add TODO-free
role notes in comments only if the auth middleware is not currently available.

**Step 6: Run tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat
```

Expected: pass.

**Step 7: Commit**

```sh
git add gmacko/packages/api/src/router/omnidat.ts gmacko/packages/api/src/router/omnidat-persistence.ts gmacko/packages/api/src/router/omnidat.test.ts
git commit -m "Add persistent OMNIDAT operator mutations"
```

## Task 4: Add NOC Incident Mutations

**Files:**

- Modify: `gmacko/packages/api/src/router/omnidat.ts`
- Modify: `gmacko/packages/api/src/router/omnidat-persistence.ts`
- Test: `gmacko/packages/api/src/router/omnidat.test.ts`

**Step 1: Write failing tests**

Test:

- `omnidat.openIncident`
- `omnidat.updateIncident`
- NOC query includes incidents from the database.

**Step 2: Run failing tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat
```

Expected: fail because incident mutations and persistent incident projection are
missing.

**Step 3: Implement helpers and router procedures**

Support:

- title.
- severity: `minor`, `major`, `critical`.
- status: `open`, `monitoring`, `resolved`.
- optional network/service IDs.
- audit events for open/update/resolve.

**Step 4: Run tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test -- omnidat
```

Expected: pass.

**Step 5: Commit**

```sh
git add gmacko/packages/api/src/router/omnidat.ts gmacko/packages/api/src/router/omnidat-persistence.ts gmacko/packages/api/src/router/omnidat.test.ts
git commit -m "Add persistent OMNIDAT NOC incidents"
```

## Task 5: Wire Operator Console Forms To Persistent Procedures

**Files:**

- Modify: `gmacko/apps/nextjs/src/app/_components/omnidat-operator-console.tsx`
- Modify: `gmacko/apps/nextjs/src/app/_components/omnidat-admin-dashboard.tsx`
- Test: `gmacko/apps/nextjs/e2e/home.spec.ts`

**Step 1: Add Playwright assertions**

Extend the e2e test to assert:

- operator console exposes campsite creation fields.
- admin dashboard exposes service approval controls.
- NOC page links to incident management.

Run:

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs test:e2e
```

Expected: fail.

**Step 2: Update operator console**

Add form sections for:

- create campsite.
- request service.
- allocate X.121.
- approve/disable service.

Use existing `useMutation(trpc.omnidat.*.mutationOptions())` pattern.

**Step 3: Update admin dashboard**

Add tables for:

- pending services.
- address allocations.
- recent audit events.
- evidence artifacts.

Keep controls compact and operational. Do not turn this into a marketing page.

**Step 4: Run e2e and component tests**

```sh
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs test:e2e
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs build
```

Expected: pass.

**Step 5: Commit**

```sh
git add gmacko/apps/nextjs/src/app/_components/omnidat-operator-console.tsx gmacko/apps/nextjs/src/app/_components/omnidat-admin-dashboard.tsx gmacko/apps/nextjs/e2e/home.spec.ts
git commit -m "Wire OMNIDAT operator workflow UI"
```

## Task 6: Add Production Database Smoke Script

**Files:**

- Create: `scripts/production-operator-smoke`
- Modify: `package.json`
- Modify: `runbooks/cloudflare-worker-deploy.md`

**Step 1: Write script**

The script should:

- fetch `/api/health`.
- assert database is `postgres-shared-fryos-v1`.
- authenticate with demo admin only if demo codes are still enabled.
- call public `/api/network`.
- call `/api/provisioning`.
- call gmacko tRPC health/operator procedures if available through the deployed
  app.
- print a compact pass/fail summary.

Use Node `fetch`; do not depend on `curl` because direct shell `curl` was not on
PATH in the current environment.

**Step 2: Add package script**

```json
"smoke:production": "./scripts/production-operator-smoke"
```

**Step 3: Document deployment gate**

Update `runbooks/cloudflare-worker-deploy.md` with:

```sh
npm run deploy:worker:dry-run --silent
npm run smoke:production
```

**Step 4: Run smoke**

```sh
npm run smoke:production
```

Expected: pass against `https://omnidat.cc`.

**Step 5: Commit**

```sh
git add package.json scripts/production-operator-smoke runbooks/cloudflare-worker-deploy.md
git commit -m "Add OMNIDAT production operator smoke"
```

## Task 7: Full Verification

Run from repo root:

```sh
npm test
./scripts/validate-data
npm run deploy:worker:dry-run --silent
npm run smoke:production
corepack pnpm@10.32.1 --dir gmacko test
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs build
```

Expected:

- all Python tests pass.
- all Worker tests pass.
- all gmacko tests pass.
- data validates.
- Worker dry-run succeeds.
- production smoke proves the deployed public surface.
- Next.js build succeeds.

Commit any final docs updates:

```sh
git add docs/plans/2026-07-04-persistent-operator-workflows.md
git commit -m "Plan persistent OMNIDAT operator workflows"
```

## Acceptance Criteria

This implementation is complete when:

- A campsite can be created through tRPC and visible in admin UI.
- A campsite can request a service with verbs, inputs, outputs, and requested
  X.121 address.
- An operator can approve or disable that service.
- The address allocation lifecycle is persisted.
- NOC shows persistent circuits, incidents, services, and recent audit events.
- Evidence artifacts are indexed and visible to operators.
- Static seed data is still available as local/demo fallback.
- Production smoke proves deployed health, network directory, provisioning, and
  database configuration.

