# OMNIDAT Hacker Camp Readiness Validation

Date: 2026-07-04

## Verdict

OMNIDAT is ready for a camp-leadership pilot conversation and a credible live
simulation, but it is not yet ready to operate as camp-critical infrastructure.
The current system demonstrates the story: X.25 Packet Clearing, campsite X.121
provisioning, service directory verbs, OmniBank-style settlement, network fees,
NOC/admin views, protected demo operator sessions, and a full 1,000-camper
weekend simulation with downloadable ledgers.

The main readiness gap is no longer broad code health. Current local gates pass.
The gap is operationalization: real identity and role enforcement in the gmacko
V1 app, operator CRUD over persistent rows, one real packet/terminal bridge,
bank/currency governance, a reproducible field kit, rehearsed incident/fallback
procedures, and partner-facing approval materials.

## Fresh Validation Performed

Local verification:

- `npm test`
  - 100 Python tests passed.
  - 35 Worker tests passed.
- `./scripts/validate-data`
  - All seed JSON files validated.
  - Service map covers `8800-8823`.
  - Service endpoint references resolve.
- `npm run deploy:worker:dry-run --silent`
  - Worker bundled successfully.
  - Production config points at `postgres-shared-fryos-v1`.
  - Hyperdrive binding is present.

Production smoke on `https://omnidat.cc`:

- `/api/health`
  - healthy.
  - database: `postgres-shared-fryos-v1`.
- `/api/network`
  - protocol: `X.25`.
  - status: operational.
  - 5 directory entries and 5 service definitions with verbs.
- `/api/provisioning`
  - returns current provisioning queue and PDF profile.
- Demo-authenticated protected APIs:
  - admin `/api/admin/overview` returns services, billing, provisioning.
  - NOC `/api/noc/status` returns circuits, weekend operations, incidents, and
    terminal health.
- Weekend simulation:
  - 1,000 campers.
  - 2,000 bank ledger events.
  - 1,600 Miliways queue orders.
  - 1,544 network fee ledger lines.
  - 5,888 event log lines.
  - 181.86 OmniBucks assessed in network fees.
  - downloadable billing statements are present.
- `/dashboard`
  - renders the camp weekend operations dashboard.
  - exposes links for event log, bank ledger, queue orders, network fee ledger,
    and billing statements.

## Deep Validation Refresh: 2026-07-04

Current local branch: `71b5fef Clean up gmacko release warnings`.

Fresh local verification:

- `npm test`
  - 100 Python tests passed.
  - 35 Worker tests passed.
- `./scripts/validate-data`
  - all seed JSON files validated.
  - service map covers `8800-8823`.
  - service endpoint references resolve.
- `npm run deploy:worker:dry-run --silent`
  - Worker bundles successfully.
  - production config points at `postgres-shared-fryos-v1`.
  - Hyperdrive binding is present.
  - `OMNIDAT_PERSISTENCE=database` and `OMNIDAT_DB_SCHEMA=omnidat` are set.
- `corepack pnpm@10.32.1 --dir gmacko test`
  - 21 Turbo tasks passed.
  - API tests passed, including provisioning, PAD, XOT, billing, ISO 8583,
    Shady Bank HTTP contract, Verifone dial POS, food orders, activity passport
    stamps, audit events, and persisted operational dashboards.
- `corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs build`
  - passed.
- `corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs typecheck`
  - passed.
- `corepack pnpm@10.32.1 --dir gmacko test:scaffold`
  - passed.
- `./scripts/weekend-sim`
  - passed with 1,000 campers, 80,000.00 OmniBucks seeded, 1,000 Night Market
    sales captured, 1,600 Miliways orders, and 12 verified campsite X.121
    assignments.
- `./scripts/e2e-omnibank`
  - passed with a Verifone-style `OMNISALE.TCL` dial sale through X.121
    `311088002010`, fake OmniBank authorization, capture, and evidence logs.

Fresh production smoke on `https://omnidat.cc`:

- `/api/health`
  - healthy.
  - database `postgres-shared-fryos-v1`.
  - schema `omnidat`.
- `/api/network`
  - protocol `X.25`.
  - status `operational`.
  - 5 service definitions with verbs, inputs, outputs, and X.121 addresses.
  - radio gateway status is intentionally `degraded` in the demo data.
- `/api/provisioning`
  - one queued provisioning record for Camp Laminar.
- `/api/weekend-simulation`
  - 1,000 OmniAuth identities.
  - 1,000 Night Market captures.
  - 1,600 Miliways orders.
  - 340 filed forms.
  - 312 terminal sessions.
  - 12 verified X.121 campsite assignments.
  - 1,544 network-fee ledger records.
- `/dashboard`
  - renders the public camp weekend operations board and artifact links.
- `/login`
  - renders OmniAuth Passkey, ForgeGraph OAuth, and GitHub OAuth login options.
- `/api/admin/overview` and `/api/noc/status`
  - return `401` without a session.
  - return protected admin/NOC JSON after the Worker demo OAuth callback issues
    an admin session cookie.

Fresh local field-office UI smoke:

- `./scripts/ui --port 8838`
  - started without disturbing the existing process on `8828`.
- `http://127.0.0.1:8838/api/health`, `/api/health/ready`, and
  `/api/health/live`
  - healthy.
  - seed files present.
  - queue and activity directories writable.
- `http://127.0.0.1:8838/`
  - renders the field-office dashboard with packet apps, passports, orders, and
    activity.
- `http://127.0.0.1:8838/radio?command=DIR`
  - returns the Radio PAD directory response with `CLR 00`.
- `http://127.0.0.1:8838/api/state`
  - returns `404`; this local UI does not yet expose a machine-readable state
    endpoint beyond health checks.

This refresh supersedes the earlier local release blockers: the gmacko Turbo
cycle, Next.js build env issue, and scaffold gate are now clear. The remaining
blockers are product/operations blockers, not the basic release gates.

## What Is Leadership-Ready Now

OMNIDAT can be presented as a scoped pilot, not as a guaranteed event utility.
The credible story is:

- OMNIDAT operates the packet-data/business network while ShadyTel owns POTS,
  T1, and telephone interconnect.
- Camps, villages, vendors, and services request packet service the way a small
  business would request data service from a historical carrier.
- X.121 addressing, service verbs, billing policy, provisioning receipts, and
  NOC visibility are first-class concepts.
- The network can support both spectacle and utility: terminal directory,
  Miliways ordering, Night Market merchant settlement, activity passports,
  ShadyBucks/OmniBucks ATM workflows, radio PAD, and campsite apps.
- The current live dashboard can show a full simulated camp weekend with
  auditable evidence artifacts.

This is enough for a leadership discussion about space, power, network
demarcation, phone interconnect, money-policy boundaries, signage, and pilot
scope.

## Not Ready Yet

These are hard blockers before OMNIDAT should be relied on by a real camp.

### Real Provisioning

Current production provisioning is still mostly static/demo-backed. Local V1
work now has schema and loader support for persistent events, campsites,
services, service verbs, address allocations, audit events, incidents, evidence
artifacts, and infra endpoints. We still need persistent operator CRUD for:

- events and historical festivals.
- campsites, villages, vendors, and operators.
- X.121 blocks and individual addresses.
- circuit requests, install status, verification transcripts, and revocation.
- namespace rules for open campsite apps versus approved services.

The signup path should produce an operator-reviewable work order, not just a
sample response.

### Release Engineering

Before this can be taken seriously by camp leadership as a deployable system,
the deploy path needs to make the current green gates boring and repeatable:

- confirm the latest gmacko V1 app is deployed to the intended production lane,
  not only the seeded Worker demo.
- run migrations against the shared FryOS Postgres `omnidat` schema in a
  controlled deploy step.
- keep `npm test`, `./scripts/validate-data`, Worker dry-run, gmacko test,
  gmacko Next build, gmacko Next typecheck, `test:scaffold`,
  `./scripts/weekend-sim`, and `./scripts/e2e-omnibank` as release gates.
- document the exact Cloudflare Worker versus gmacko V1 ownership boundary so
  operators know which production surface is authoritative for each flow.
- add post-deploy smoke that exercises login, admin, NOC, provisioning, XOT/PAD,
  and evidence export on the deployed V1 app.

### Real Network Bridge

The Worker reports an X.25-style network surface, but the field bridge still
needs to prove real packets or terminal sessions through at least one non-demo
access path:

- XOT or PAD-to-service bridge.
- POTS/modem path through Asterisk/SIP/USB modem lab.
- MeshCore managed gateway.
- Meshtastic/BYO ingress with stricter rate and size limits.
- browser XOT terminal tied to the same service directory and evidence log.

The first field-grade proof should be one end-to-end flow:

```text
real or simulated terminal
  -> POTS/modem, Wi-Fi PAD, MeshCore, or XOT
  -> OMNIDAT Packet Clearing
  -> provisioned X.121 service
  -> NOC event
  -> receipt or downloadable evidence
```

### Identity And Roles

The deployed Worker has demo-compatible OmniAuth, ForgeGraph, and GitHub OAuth
redirects plus protected admin/NOC JSON. Before a camp deployment, the gmacko V1
app needs real issuer/client configuration, session-to-role mapping, and
procedure-level authorization for:

- camp leadership administrators.
- OMNIDAT NOC operators.
- campsite owners.
- vendor operators.
- bank/settlement operators.
- read-only auditors.

ShadyTel or event leadership should not need shell access to manage approvals.
The OMNIDAT tRPC router currently exposes operational mutations through
`publicProcedure`; this must become role-gated before the app is used by event
operators.

### Money And Risk Model

The OmniBank/OmniBucks simulation is useful, but any real exchangeable value
needs a written policy before camp:

- Is OmniBucks play money, ShadyBucks-convertible credit, bearer paper, or
  merchant settlement credit?
- Who can mint, void, redeem, and reconcile?
- What happens when an ATM, POS terminal, or bearer instrument fails?
- What are the limits per account, per merchant, and per weekend?
- Which records are retained after camp?

Network fees can remain theatrical, but their policy engine should be real and
auditable.

### Hardware Fleet

The docs describe the shape of the hardware, but the fleet needs a checked-in
field inventory and bench proof:

- Raspberry Pi or mini-PC PBX host.
- Asterisk + SIP + USB modem path.
- vintage Verifone terminals and TCL/load path.
- at least one POS sale/refund/batch-close loop.
- at least one ATM or ATM-like kiosk loop.
- terminal stations or browser terminal stations.
- MeshCore and optional Meshtastic gateways.
- printer/fax/document output path.
- spares, cables, power, labels, and transport cases.

### Partner Operations

Camp leadership will need documents that do not assume they know the repo:

- one-page pilot proposal.
- required footprint, power, wired network, RF, and phone demarc.
- setup and teardown schedule.
- daily operating hours.
- incident escalation tree.
- safety and privacy summary.
- money/currency policy.
- signage and participant consent language.
- what happens if OMNIDAT is unavailable.

## Build Gaps Found In This Pass

These are the concrete gaps to close before asking for an event-ready approval:

1. **Authoritative production surface**
   - Decide whether `omnidat.cc` serves the gmacko V1 app, the Worker demo,
     or a split where the Worker is a status/demo edge and gmacko is the
     operator system.
   - Right now the deployed Worker is good for leadership demo and public
     simulation, while gmacko contains the richer persistent operational model.

2. **Role-gated OMNIDAT tRPC**
   - Replace `publicProcedure` on operational OMNIDAT mutations with
     user/operator/admin procedures.
   - Enforce roles for provisioning, PAD configuration, ATM setup, food-order
     operator actions, passport stamping, ISO 8583/Shady Bank flows, and XOT
     command execution.

3. **Operator CRUD**
   - Add UI and mutations for events, historical festivals, campsites, vendors,
     services, service verbs, X.121 blocks, individual allocations, PAD configs,
     incidents, evidence artifacts, billing accounts, and role assignments.
   - Existing schema supports much of this, but the UI is still mostly
     operational-action forms and read-only dashboards.

4. **Provisioning lifecycle**
   - Move from "provision and verify" demos to a reviewable workflow:
     requested, approved, assigned, installed, verified, active, suspended,
     revoked.
   - Store the verification transcript and printed/PDF receipt as evidence.

5. **Terminal bridge**
   - Implement one deployed browser XOT terminal first.
   - It should call the same service directory, execute one verb against a
     provisioned X.121 address, write a NOC event, and export evidence.
   - Then add POTS/modem and radio adapters behind the same packet-call
     interface.

6. **Local NOC state API**
   - The Python field-office UI has health endpoints and rendered pages, but no
     `/api/state`.
   - Add a machine-readable local status endpoint if it will be used as the
     Raspi/PBX field dashboard.

7. **Bank and currency governance**
   - Keep OmniBucks as controlled play money until the ShadyBank/ShadyBucks team
     signs off on mint, burn, redeem, void, dispute, bearer instrument, ATM, and
     conversion rules.
   - Implement POS batch close and terminal settlement reports before any
     merchant-facing money pilot.

8. **Hardware bench proof**
   - Inventory the actual ShadyTel terminals/modems/PBX gear.
   - Prove at least one end-to-end transaction through a real or near-real
     terminal path before representing this as event-ready.

9. **Camp approval packet**
   - Turn `docs/leadership-pilot-package.md` into a small PDF/deck plus a
     one-page field footprint and risk summary.
   - Include explicit opt-in, privacy, money, failure, staffing, RF, power, and
     ShadyTel demarcation language.

10. **Rehearsal gate**
    - Run a human rehearsal with 10-20 people using the operator console and at
      least one terminal path.
    - Treat this as the go/no-go before asking for a real camp placement.

## Recommended Build Order

### Phase 1: Leadership Pilot Package

Build the partner-facing pack first. It should turn the current demo into a
proposal:

- pilot scope and success criteria.
- exact ask from camp leadership.
- dependency list for ShadyTel, ShadyBank/OmniBank, FryOS, vendors, and
  campsite operators.
- risk register.
- demo script using `https://omnidat.cc/dashboard`.
- field footprint diagram.

### Phase 2: Persistent Operator System

Make the web app operational:

- event model.
- campsite/vendor/user model.
- X.121 allocation model.
- service registry CRUD.
- provisioning workflow.
- evidence ledger persistence.
- admin and NOC role UI.
- historical camp archive view.

The existing Worker and gmacko surfaces should stop depending on static arrays
for anything an operator is expected to change.

### Phase 3: Packet Bridge Slice

Prove one real access path before adding more:

- use XOT or terminal-over-WebSocket as the easiest controlled path.
- bind it to the live service directory.
- let a provisioned campsite call one verb.
- append the event to the evidence log.
- show status in NOC.

After this works, add POTS/modem and radio adapters behind the same interface.

### Phase 4: Bank And Merchant Slice

Keep money limits small and explicit:

- OmniBank fork or ShadyBank test integration.
- seeded camper accounts.
- merchant account setup.
- POS sale, refund, void, and batch close.
- network fee assessment.
- statement generation.
- audit export.

Do not make real cash conversion a dependency of the first leadership demo.

### Phase 5: Hardware Lab

Make the field kit reproducible:

- Asterisk/SIP lab config.
- USB modem loop.
- Verifone simulator plus real terminal loader path.
- MeshCore gateway harness.
- browser terminal/XOT harness.
- one-button health check that tests the whole lab.

### Phase 6: Camp Rehearsal

Run two rehearsals:

- synthetic: 1,000 campers, vendors, campsite provisioning, food ordering,
  activity-passport stamps, and terminal sessions.
- human: 10-20 people using real or near-real terminals for one evening.

The human rehearsal should be the gate before asking leadership for production
placement.

## Go/No-Go Criteria For A Real Camp

Go only if all are true:

- leadership has approved scope, footprint, and risk boundaries.
- ShadyTel interconnect or local fallback is tested.
- NOC can provision, revoke, and verify X.121 services without code changes.
- at least one real terminal/PAD path works end to end.
- money policy is written and signed off by the ShadyBank/OmniBank team.
- offline/fallback mode is documented.
- incident response and teardown are rehearsed.
- participant-facing language is ready.
- all field hardware is inventoried and labeled.

No-go if any are true:

- the only working flows are static demo data.
- identity or admin access still requires developer intervention.
- real terminals cannot complete a transaction or service call.
- billing/currency behavior is unclear to operators.
- the event cannot tolerate OMNIDAT being down.

## Leadership Questions

Ask these early:

- Do they want OMNIDAT to be official infrastructure, a village installation, or
  an opt-in art/utility pilot?
- Can we get a phone/network demarc, or should V1 be self-contained?
- Are money-like bearer instruments acceptable if clearly marked and bounded?
- What participant data can be collected for activity passports and service
  records?
- Who approves vendors and campsite service listings?
- Can OMNIDAT publish a directory of participating camps and services?
- What incident categories must be escalated to camp staff?

## Immediate Next Build

The next useful commit should be the leadership pilot package plus persistent
operator workflow design. The technical priority after that is the packet bridge
slice: one provisioned X.121 service callable through one real terminal/XOT
path, with the call visible in NOC and downloadable as evidence.
