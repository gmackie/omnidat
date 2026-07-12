# H1b Operator CRUD Implementation Plan

Date: 2026-07-05

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the H1 operator system: the persistent CRUD and lifecycle
that [H1a](2026-07-04-h1a-operator-core-slice.md) deferred, so an operator can
create an event, onboard a campsite, allocate and verify an X.121 address,
suspend it, run the provisioning lifecycle, manage incidents and roles, and
export evidence — all gated, audited, and instrumented, with no shell access.

**Architecture:** Extend the H1a surface. Every write is an
`omnidatOperatorProcedure` gated on a capability, threads `auditActor(ctx)`,
records an `omnidatAuditEvent`, and routes KPI counts through
`recordOperationalMetric`. Persistence helpers follow the
`gmacko/packages/api/src/router/omnidat-persistence.ts` pattern (zod input →
insert/update helper → audit). No new auth model; H1a's roles and middleware
are reused. Journal seam stays at the existing choke points.

**Tech Stack:** TypeScript, tRPC, Drizzle ORM, Postgres, Vitest, Next.js/gmacko.

## Current State

- Schema exists for `omnidatEvent`, `omnidatCampsite`, `omnidatCampsiteApp`,
  `omnidatAddressAllocation`, `omnidatService`, `omnidatServiceVerb`,
  `omnidatProvisioningRequest`, `omnidatBillingAccount`,
  `omnidatBillingLedgerEntry`, `omnidatNocIncident`, `omnidatOperatorRole`.
- H1a shipped: role matrix + middleware, actor-attributed audit, packet
  sessions, evidence + verb mutations, KPI choke point, role grant/revoke,
  gated read queries, operator-session `transferAuthority`.
- Missing: write paths for events, campsites, vendors, X.121 allocations, the
  provisioning lifecycle state machine, billing/fee-policy CRUD, incident
  CRUD, a role-list query, and printed/PDF artifacts.

## New Capabilities

Add to `OMNIDAT_CAPABILITIES` in `omnidat-roles.ts`:

| Capability | Roles |
| --- | --- |
| `event.write` | `admin` (via implies-all). |
| `campsite.write` | `packet-operator`, `admin`. |
| `incident.write` | already present (`packet-operator`, `noc-operator`). |

`allocation.write`, `provisioning.write`, `service.write`, `bank.write`,
`role.write` already exist and are reused.

## Task 1: Event CRUD

**Files:** `omnidat.ts`, `omnidat-persistence.ts`, `omnidat.test.ts`,
`omnidat-roles.ts`.

- `createEvent` (`event.write`): insert `omnidatEvent`
  (eventCode, displayName, eventKind, startsAt, endsAt), audit `event.created`.
- `updateEventStatus` (`event.write`): set status
  (`planning`/`active`/`closed`/`archived`), audit `event.status.changed`.
- `listEvents` (`operator.read`): all events with counts.
- Test: create → list → update status; auditor forbidden; non-admin forbidden.

## Task 2: Campsite And Vendor CRUD

**Files:** `omnidat.ts`, `omnidat-persistence.ts`, `omnidat.test.ts`.

- `createCampsite` (`campsite.write`): insert `omnidatCampsite`
  (namespace, slug, displayName, contactHandle), audit `campsite.created`.
- `updateCampsiteStatus` (`campsite.write`): pending → active → suspended,
  audit `campsite.status.changed`.
- `listCampsites` (`operator.read`).
- Vendors reuse `omnidatCampsite` with `namespace: "vendor"` for H1b (a
  dedicated vendor table is H2+ scope); document this.
- Test: create → list → suspend; capability boundaries.

## Task 3: X.121 Allocation Lifecycle

**Files:** `omnidat.ts`, `omnidat-persistence.ts`, `omnidat.test.ts`.

- `allocateAddress` (`allocation.write`): insert `omnidatAddressAllocation`
  (networkId, x121, assignedToKind, assignedToId, namespace, status
  `reserved`), audit `allocation.assigned`, KPI `x121.allocation.assigned`.
- `updateAllocationStatus` (`allocation.write`): reserved → assigned →
  verified → suspended → revoked, audit `allocation.status.changed`.
- `listAllocations` (`operator.read`), filterable by status.
- Enforce the X.121 unique constraint;
  a duplicate allocation returns a conflict, not a silent overwrite.
- Test: allocate → verify → suspend → revoke; duplicate rejected; boundaries.

## Task 4: Provisioning Lifecycle State Machine

**Files:** `omnidat.ts`, `omnidat-persistence.ts`, `omnidat-roles.ts` (states
helper), `omnidat.test.ts`.

- A `PROVISIONING_STATES` order:
  `requested → reviewed → approved → assigned → installed → verified → active
  → suspended → revoked`.
- `requestProvisioning` (`service.request`): insert
  `omnidatProvisioningRequest` status `requested`, audit.
- `advanceProvisioning` (`provisioning.write`): move to the next legal state
  (or `suspended`/`revoked` from any active state); reject illegal jumps;
  store the verification transcript on `verified`; audit
  `provisioning.<state>`.
- `listProvisioning` (`operator.read`).
- Test: full legal path; illegal jump rejected; suspend-from-active allowed.

## Task 5: Incident And Billing/Fee CRUD

**Files:** `omnidat.ts`, `omnidat-persistence.ts`, `omnidat.test.ts`.

- `openIncident` / `updateIncident` (`incident.write`): `omnidatNocIncident`
  open → mitigating → resolved, audit; KPI `incident.opened` /
  `incident.resolved` with a time-to-clear value on resolve.
- `createBillingAccount` (`bank.write`): `omnidatBillingAccount`, audit.
- `setFeePolicy` (`bank.write`): store a fee policy row
  (flat/percentage/per-message/waived/sponsored) — reuse
  `omnidatBillingLedgerEntry` metadata or a small policy note; audit
  `fee.policy.set`.
- Test: incident lifecycle with time-to-clear metric; account creation
  boundaries.

## Task 6: Role List Query And Evidence Export

**Files:** `omnidat.ts`, `omnidat-persistence.ts`, `omnidat.test.ts`.

- `listOperatorRoles` (`role.write`, admin-only): all active role grants, so
  an admin sees who holds what without shell access.
- `exportEventEvidence` (`evidence.write`): assemble the event's evidence
  artifacts, packet sessions, incidents, and allocations into one export
  payload and record an `omnidatEvidenceArtifact` of kind `event-export`;
  audit `evidence.exported`. This is the H1b exit-gate export path.
- Test: role list admin-only; evidence export records an artifact.

## Task 7: Printed / PDF Artifacts

**Files:** `omnidat-documents.ts` (new), `omnidat.ts`, `omnidat.test.ts`.

Deterministic text/HTML document builders (PDF rendering is a later
concern — these produce the printable source, matching the existing
receipt-style renderers):

- `address-assignment` — X.121, campsite, transport, verified state.
- `demarc-sheet` — service, endpoint, transport, contacts.
- `service-certificate` — service identity + verbs.
- `provisioning-transcript` — the stored verification transcript.
- `daily-noc-summary` — sessions, incidents, allocations, orders for a day.
- `buildOmnidatDocument(kind, data)` returns `{ title, body }`; a
  `renderDocument` procedure (`operator.read`) returns it for a given subject.
- Test: each builder renders its required fields.

## Task 8: Operator Console CRUD Forms

**Files:** `omnidat-operator-console.tsx`, `home.spec.ts`.

- Add forms for create-event, create-campsite, allocate-address, and
  advance-provisioning behind the authenticated operator session, surfacing
  `FORBIDDEN` as an explicit "role required" notice.
- Show an events list and an allocations table.
- Verify with `nextjs build` + `nextjs typecheck` (e2e assertions where the
  harness supports them).

**Status:** Forms for events, campsites, allocations, provisioning advance, incidents (with demo list), campsite apps, batch close implemented in omnidat-operator-crud.tsx. Incident update added. Typechecks and tests passing. Parallel work on H3/H4 integrated.

**2026-07-11:** Provisioning UI no longer jumps illegally. Operators can request provisioning, **Advance → next legal state** (with verification transcript on `verified`), Suspend, and Revoke. Allocation list gains Revoke. `nextProvisioningStatus` helper exported; full-path test covers requested → … → active → revoked.

## Task 9: Full Verification

Run every release gate:

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

Commit the plan doc.

## Acceptance Criteria (roadmap H1b / H1 exit gate)

- an operator can create an event, create a campsite, allocate an X.121
  address, run it through the provisioning lifecycle to verified, suspend it,
  and export evidence — entirely through gated tRPC, no shell access.
- every write records an audit event with the acting operator.
- role tests prove non-admins cannot mutate admin-only objects.
- illegal provisioning/allocation state transitions are rejected.
- printed artifacts render from live data.
- all release gates pass.

## Out Of Scope (H2+ / other workstreams)

- terminal/service credentials for participant-originated calls (H2).
- dedicated vendor table and vendor self-service (H2/H3).
- real PDF binary rendering (these builders produce printable source).
- open-namespace takedown tooling (Workstream H, moderation-policy.md).
- fee reconciliation against bank ledgers beyond policy storage (H4).
