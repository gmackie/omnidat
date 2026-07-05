# OMNIDAT Roadmap Expansion: Split Authority, Fair Play, And Interop

Date: 2026-07-04

## Purpose

This plan extends [the roadmap](../roadmap.md) with the additions agreed in the
2026-07-04 roadmap review. It locks three architecture-level decisions, defines
the sync/authority model in enough detail to build against, and turns the
remaining additions into workstreams with exit gates.

This is a strategy plan. Each workstream that touches code should get its own
task-by-task implementation plan in `docs/plans/` before build.

## Locked Decisions

These decision points from the roadmap are now decided:

1. **Authority model.** During an active event, the field kit is authoritative
   for event-scoped data and syncs to the cloud. The cloud is primary when the
   field kit is offline or no event is active. Simulation always runs on a sim
   field kit so the sync path is exercised continuously, not just at camp.
2. **Adversarial play.** Attacking OMNIDAT is sanctioned play under published
   rules of engagement, disclosure expectations, and fair-play boundaries.
3. **Protocol fidelity.** OMNIDAT targets interoperability where practical:
   real XOT framing, honest X.25 clear cause and diagnostic codes, a documented
   X.3/X.29 subset, and a published interop profile that third-party
   experimenters can peer against.

Still open (with proposed decide-by dates in Workstream K):

- Which named events host the operator tabletop, the human rehearsal, and the
  first pilot.
- X.121 numbering plan governance: DNIC choice, collision policy with historic
  assignments, and partner sub-allocation rules.

## Workstream A: Split-Authority Sync Architecture

This is the highest-leverage addition. It changes design decisions being made
now in H1/H2 and defines how the field kit, cloud Worker, and gmacko V1 app
relate during a real event.

### Authority model

```text
event active + field kit online   -> field kit authoritative for event-scoped data
                                     cloud follows as replica + public status
field kit offline or failed       -> cloud primary (failover, epoch increment)
no active event                   -> cloud authoritative for everything
simulation                        -> sim field kit, same sync path as production
```

### Data ownership matrix

| Data class | Owner during event | Owner otherwise |
| --- | --- | --- |
| Identities, roles, OAuth config | cloud | cloud |
| Event templates, historical archive | cloud | cloud |
| Service directory, X.121 allocations | field kit (event scope) | cloud |
| Packet sessions, PAD state | field kit | cloud |
| Evidence artifacts, transcripts | field kit | cloud |
| Orders, queue state, passport stamps | field kit | cloud |
| Bank ledger, fee ledger, POS batches | field kit | cloud |
| NOC incidents | field kit | cloud |

Global data (identities, roles) is provisioned before the event and cached on
the field kit read-only. New identity creation during an uplink outage uses
handle/passport mode, which is already the privacy default.

### Authority epochs

Each event carries an authority record: `{holder: field | cloud, epoch: N}`.

- authority transfers increment the epoch.
- every event-scoped write is stamped with the epoch its writer held.
- replicas reject writes stamped with a stale epoch.
- failover to cloud is a NOC operator action, not automatic, and is itself an
  audited event.
- a recovered field kit rejoins as a replica and must fully catch up before an
  operator transfers authority back.

This makes split-brain structurally impossible rather than operationally
unlikely.

### Sync protocol

- append-only operation journal on each side with a monotonic sequence per
  source.
- store-and-forward over HTTPS when the uplink is up; idempotent apply on the
  receiver.
- the cloud public dashboard must show sync staleness honestly ("field data as
  of N minutes ago"), never present stale data as live.
- reconciliation report after every sync session: applied, skipped-duplicate,
  rejected-stale-epoch counts.

### Field kit store

- local store on the field kit (SQLite or local Postgres) holding the
  event-scoped subset of the `omnidat` schema.
- the Python field-office UI and the packet bridge write locally first, always.
- printing, NOC views, and evidence export must work fully disconnected.

### Sim field kit

- `./scripts/weekend-sim` moves to running against a field kit instance that
  syncs to a staging cloud target.
- this makes the simulation a permanent sync soak test and kills sim-versus-
  production drift, since the sim exercises the same tRPC/API surface and
  journal path as a real event.

### Exit gates

- pull the uplink for 60 minutes mid-simulation: zero lost records, clean
  reconciliation report, all field-office flows keep working.
- authority failover drill in both directions with no stale-epoch write
  accepted.
- cloud dashboard displays staleness during the outage window.
- weekend-sim runs through the field kit path as its default mode.

## Workstream B: H1 Split And Bridge Unblock

H1 as written bundles roles, CRUD for ~12 object types, the provisioning
lifecycle, and PDF artifacts. That sequencing parks the packet bridge — the
most demonstrable milestone — behind months of admin forms.

Split:

- **H1a (operator core slice):** role-gated tRPC, audit events on every write,
  and only the CRUD the bridge needs: services, service verbs, X.121
  allocations, packet sessions, evidence artifacts.
- **H1b (full operator system):** everything else in H1 — events, campsites,
  vendors, billing accounts, incidents, role management UI, provisioning
  lifecycle states, printed/PDF artifacts.

H2 (packet bridge) starts as soon as H1a passes. H1b proceeds in parallel with
H2 and H3.

### Exit gates

- H1a: non-admins cannot mutate admin-only objects; every write audited; an
  operator can create a service, allocate an X.121 address, and see sessions
  and evidence for it from the UI.
- H1b: unchanged from roadmap H1 exit gates.

## Workstream C: Protocol Fidelity And Interop

The audience includes actual X.25 operators, and H8 depends on partner nodes.
Interop is nearly free to specify at H2 build time and expensive to retrofit.

Build:

- `docs/protocol-fidelity.md` specifying:
  - X.121 numbering plan: DNIC choice, rationale, collision policy with
    historic assignments, and sub-allocation rules for partner nodes.
  - supported X.3 PAD parameter subset and defaults per terminal class.
  - X.29 control procedures supported.
  - X.25 clear cause and diagnostic codes: emit real codes, never a generic
    failure.
  - facilities subset (at minimum: which are parsed, which are honored, which
    are politely refused).
- XOT per RFC 1613 as the interop boundary for TCP transports.
- interop test bench: at least one third-party XOT implementation (Cisco IOS
  XOT, or an open-source XOT/PAD tool) completing calls against OMNIDAT.
- published OMNIDAT interop profile plus a partner peering contract stub
  (feeds H8 partner nodes).

Exit gates:

- a third-party XOT client completes CALL, data transfer, and CLR against a
  provisioned OMNIDAT service with correct cause/diagnostic codes.
- fidelity spec published and referenced from the packet bridge implementation.
- failure paths observed from the third-party client match the spec.

## Workstream D: Rules Of Engagement And Adversarial Play

Hackers will attack OMNIDAT; that is the audience working as intended. Make it
sanctioned play and use it as free hardening.

Build:

- `docs/rules-of-engagement.md`:
  - in-bounds: protocol fuzzing against OMNIDAT services, application-logic
    attacks against your own accounts and instruments, planted phreak/packet
    challenges, cryptographic puzzles.
  - out-of-bounds: denial of service and resource flooding, other
    participants' data or sessions, physical theft or damage, ShadyTel and
    camp infrastructure, cloud-provider surface beyond OMNIDAT's own services.
  - disclosure path: a staffed (or terminal-reachable) disclosure desk,
    OmniBucks bounty schedule, expected disclosure-before-publication window.
  - fair-play and safe-harbor language for the printed participant pack.
  - hall of fame in the service directory.
- planted challenges and easter eggs, with a scoreboard service reachable on
  the packet network itself.
- hardening pass driven by the RoE: rate limits per transport, terminal
  credential revocation drill, hash-chained (tamper-evident) ledgers, abuse
  signals surfaced in NOC.
- red-team rehearsal against the full stack before the first pilot event.

Exit gates:

- RoE published in participant-facing language and printed.
- bounty/disclosure flow works end to end (report -> triage -> OmniBucks
  payout -> hall of fame).
- red-team rehearsal completed with findings triaged; criticals fixed before
  pilot.
- NOC shows abuse/rate-limit signals during the rehearsal.

## Workstream E: Participant Experience And Printed Collateral

The roadmap is operator-heavy. Campers need to succeed at a terminal with zero
coaching.

Build:

- printed camp phone book / directory zine generated from the service
  directory (services, X.121 addresses, verbs, hours).
- PAD cheat-sheet card at every terminal: `CALL`, `DIR`, `LOOKUP`, `HELP`,
  `CLR`, one worked example.
- `HELP` verb on every service, and a network-level `HELP` in the PAD.
- terminal idle attract mode advertising the directory.
- "how to get an X.121 address for your campsite" signage and form.

Exit gates:

- a first-time user at a rehearsal completes a directory lookup and one
  service call using only printed material.
- phone book generates from live directory data, not hand-maintained copy.

## Workstream F: Operator Pipeline

H7 lists six staffed roles; nothing earlier creates those humans.

Build:

- operator licensing program: themed training material per role (packet
  operator, NOC, bank/settlement, vendor liaison).
- practical exam that doubles as the tabletop rehearsal script: provision a
  campsite, clear a stuck session, run a POS batch close, recover a printer,
  execute the failover drill from Workstream A.
- printed license cards as artifacts.

Exit gates:

- at least four licensed operators before the human rehearsal.
- every H7 staffing role has at least one licensed primary and one backup
  before the pilot event.

## Workstream G: Metrics And Reporting

Exit gates elsewhere are binary; post-event reports need numbers.

Build:

- KPI definitions: packet sessions per day, unique identities, verb calls per
  service, failed-call rate by clear cause, orders, fee totals, incident
  count/time-to-clear, sync staleness percentiles.
- instrument once in the field kit journal so the daily printed summary and
  the post-event report generate from the same data.

Exit gates:

- daily summary and post-event report are generated, not hand-assembled.
- rehearsals report the KPI set without developer involvement.

## Workstream H: Open-Namespace Moderation

Build:

- moderation policy for campsite bulletins, classifieds, and open apps: who
  moderates, what is out of bounds, takedown SLA, appeal path.
- takedown/delist tooling in the operator console, audited like any other
  write.

Exit gates:

- policy printed and posted with the participant pack.
- a takedown can be executed and appealed entirely from the operator UI.

## Workstream I: Money Governance Additions

Additions to H4 beyond the existing bank-rails scope:

- written legal sanity pass (even informal) on serial-numbered bearer
  instruments before any pilot that issues them; scrip-like paper attracts
  jurisdictional attention.
- ledger restore drill: after simulated data loss, rebuild the ledger from
  evidence artifacts and reconcile to zero variance.
- hash-chained ledger entries (shared with Workstream D tamper-evidence).

Exit gates:

- legal sanity note on file alongside the ShadyBank/OmniBank signoff.
- restore drill passes with zero unexplained variance.

## Workstream J: Budget And Sourcing

Build:

- per-tier cost estimate against the hardware BOM (Table Pilot through Full
  ToorCamp).
- borrow-versus-buy plan with ShadyTel and other villages.
- long-lead acquisition list (vintage Verifone terminals, USB modems, PRI
  gear) with target acquire-by dates for bench proof.
- optional offsets: sponsors, merch, OmniBucks-adjacent collectibles.

Exit gates:

- Table Pilot tier fully costed and funded before the human rehearsal.
- long-lead items for the Carrier Lab tier acquired before H5 bench work
  needs them.

## Workstream K: Event Calendar

Backward plan from ToorCamp 2028 (assume July 2028):

| Milestone | Target | Notes |
| --- | --- | --- |
| Sync architecture + H1a + H2 bridge | 2026 Q4 | Workstreams A, B, C build window. |
| Operator tabletop (Rehearsal 2) | 2027 Q1 | Doubles as licensing exam. |
| Red-team rehearsal | 2027 Q1-Q2 | Before any public pilot. |
| Human evening (Rehearsal 3) | 2027 Q2 | 10-20 people, Table Pilot tier. |
| Pilot event | 2027 Q3-Q4 | Named event TBD; decide by 2026-10-01. |
| Leadership conversation with ToorCamp | 2027 Q3 | Needs pilot evidence in hand. |
| Carrier Lab bench-proved | 2027 Q4 | Long-lead hardware acquired by then. |
| Go/no-go for ToorCamp 2028 | 2028 Q1 | Roadmap go/no-go criteria. |
| ToorCamp 2028 buildout | 2028 Q2-Q3 | H7. |

Decisions to make by 2026-10-01:

- named candidate events for Rehearsal 3 and the pilot (local retro/2600-style
  meetups, night markets, Vibecamp-adjacent gatherings, village slots at other
  camps).
- whether the pilot targets Table Pilot or Village Field Office tier.

## Sequencing Against Horizons

| Workstream | Feeds horizon | Start |
| --- | --- | --- |
| A: split authority | H1/H2/H5 architecture | now |
| B: H1 split | H1/H2 | now |
| C: interop | H2, H8 | with H2 build |
| D: rules of engagement | H6/H7, security track | doc now, hardening with H2/H3 |
| E: participant collateral | H3/H5 | with H3 |
| F: operator pipeline | H6/H7 | before Rehearsal 2 |
| G: metrics | all rehearsals | with H1a instrumentation |
| H: moderation | H3 | with campsite apps |
| I: money governance | H4 | with bank rails |
| J: budget | H5 | costing now, buys per calendar |
| K: calendar | all | decide by 2026-10-01 |

## Immediate Next Build

1. Design doc + implementation plan for the field kit journal/sync/epoch model
   (Workstream A) — this constrains H1a schema decisions and must land first.
2. H1a slice: role-gate the OMNIDAT tRPC router, audit events, bridge-critical
   CRUD.
3. `docs/protocol-fidelity.md` alongside the browser XOT terminal build.
4. `docs/rules-of-engagement.md` first draft — cheap, high-value, and needed
   in the leadership pack's risk register.
5. KPI definitions wired into the field kit journal from day one.
