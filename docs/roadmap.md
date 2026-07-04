# OMNIDAT Future Roadmap

Date: 2026-07-04

## North Star

OMNIDAT should become a credible retro packet-data carrier for hacker camps:
X.25-style service identity, X.121 addressing, PAD terminals, campsite service
orders, service directories, operator desks, billing statements, merchant
terminal rails, printed evidence, and a NOC that can run during an event without
developer shell access.

The durable model is:

```text
X.25 / Packet Clearing = network authority
web / POTS / Wi-Fi / MeshCore / Meshtastic / hosted nodes = access transports
printed receipts / forms / ledgers = human-visible truth
```

ToorCamp 2028 is the flagship target, especially if ShadyTel can provide a real
phone or T1/PRI handoff. The product should still work at smaller camps,
Vibecamp-adjacent events, villages, night markets, and local rehearsals without
requiring full ShadyTel infrastructure.

## Current State

OMNIDAT is ready for a leadership pilot conversation and live simulation, not
camp-critical operation.

Currently proven:

- public Worker demo at `https://omnidat.gmac.io`.
- X.25 network status, service directory, verbs, and X.121 records.
- 1,000-camper weekend simulation with Night Market, Miliways, OmniBank,
  OmniBucks, network fees, forms, terminal sessions, and evidence artifacts.
- protected demo admin/NOC Worker APIs.
- gmacko V1 tests for provisioning, PAD, XOT, billing, ISO 8583, Shady Bank
  HTTP contract, Verifone dial POS, food orders, activity passport stamps,
  audit events, and persisted operational dashboards.
- Python field-office UI with Radio PAD `DIR`, health checks, packet apps,
  passports, orders, and activity.
- seed data for services, terminals, carrier circuits, packet namespaces,
  transport profiles, queue apps, activity passports, and media catalog.

Known hard gaps:

- authoritative production surface is not settled: Worker demo versus gmacko V1
  operator app.
- OMNIDAT tRPC operations still need real role-gating.
- operator CRUD is incomplete for persistent events, campsites, services,
  verbs, allocations, incidents, evidence, billing, and roles.
- at least one deployed browser XOT or real terminal bridge must write NOC and
  evidence records end to end.
- real bank/currency policy is not signed off.
- actual field hardware has not been inventoried and bench-proved.
- partner-facing PDF/deck and human rehearsal are not done.

See [Hacker Camp Readiness Validation](plans/2026-07-04-hackercamp-readiness-validation.md)
for current validation evidence.

## Roadmap Shape

The roadmap is organized by horizons. A horizon can overlap with the next one,
but it should not be called done until its exit gates pass.

| Horizon | Name | Outcome |
| --- | --- | --- |
| H0 | Pilot Story and Control Plane | Leadership can understand and approve a bounded pilot. |
| H1 | Real V1 Operator System | Operators can manage the network without shell access. |
| H2 | Packet Bridge Slice | A terminal calls a provisioned X.121 service and leaves evidence. |
| H3 | Camp Utility Apps | Food, passports, campsite apps, documents, and dispatch are useful. |
| H4 | Merchant and Bank Rails | POS/ATM simulations and bounded money policy are operational. |
| H5 | Field Hardware Kit | PBX, modems, printers, terminals, and radio gateways are reproducible. |
| H6 | Rehearsals and Pilot Events | Human users prove the system before a major camp. |
| H7 | ToorCamp 2028 Buildout | OMNIDAT operates as an opt-in official or village-scale packet service. |
| H8 | Multi-Event Network | Historical records, recurring deployments, and partner nodes work. |

## H0: Pilot Story And Control Plane

Goal: make the current demo approval-ready without overstating readiness.

Build:

- keep `docs/leadership-pilot-package.md` as the source text for event
  leadership.
- turn the leadership package into a short PDF/deck with:
  - one-page proposal.
  - field footprint.
  - risk register.
  - opt-in and privacy language.
  - money policy starter.
  - demo script.
  - clear ask for space, power, network, phone, RF, ops liaison, and money
    boundaries.
- decide the production split:
  - Worker remains public demo/status edge.
  - gmacko V1 becomes authenticated operator system.
  - or gmacko V1 replaces the Worker at `omnidat.gmac.io`.
- publish one clear "what is real today" page:
  - simulation is real.
  - event-critical utility is not yet promised.
  - real terminal bridge is pending.
  - money is play-money unless separately posted.

Exit gates:

- leadership pack exists as PDF/deck and markdown.
- demo script works on production.
- public wording does not imply emergency, official comms, guaranteed food
  operations, or real cash redemption.
- OMNIDAT, ShadyTel, ShadyBank/OmniBank, and event-leadership boundaries are
  explicit.

## H1: Real V1 Operator System

Goal: make OMNIDAT administrable through the web app.

Build:

- route `omnidat.gmac.io` to the authoritative V1 surface, or document the
  split if Worker and gmacko remain separate.
- run `omnidat` schema migrations against shared FryOS Postgres through a
  controlled deploy path.
- replace public OMNIDAT operational tRPC mutations with role-gated procedures:
  - campsite owner.
  - vendor operator.
  - OMNIDAT packet operator.
  - OMNIDAT NOC operator.
  - bank/settlement operator.
  - admin.
  - auditor.
- add CRUD for:
  - events and historical festivals.
  - campsites, villages, vendors, and service owners.
  - X.121 blocks and allocations.
  - service directory entries.
  - service verbs, inputs, outputs, and security policy.
  - PAD configs and transport endpoints.
  - provisioning requests.
  - NOC incidents.
  - evidence artifacts.
  - billing accounts and fee policies.
  - operator roles.
- implement provisioning lifecycle:
  - requested.
  - reviewed.
  - approved.
  - assigned.
  - installed.
  - verified.
  - active.
  - suspended.
  - revoked.
- make printed/PDF artifacts first-class:
  - address assignment.
  - demarc sheet.
  - service certificate.
  - provisioning verification transcript.
  - daily NOC summary.

Exit gates:

- no shell access needed for ordinary operator workflows.
- every write action records an audit event.
- role tests prove non-admins cannot mutate admin-only objects.
- an operator can create a campsite, assign X.121, verify it, suspend it, and
  export evidence from the UI.

## H2: Packet Bridge Slice

Goal: prove the first real terminal path before adding more transports.

Recommended first bridge:

```text
browser XOT terminal
  -> OMNIDAT packet-call API
  -> Packet Clearing service directory
  -> provisioned X.121 service
  -> service verb execution
  -> NOC event
  -> evidence artifact / receipt
```

Build:

- browser terminal/XOT UI with `PAD>` prompt.
- `CALL <x121>`, `DIR`, `LOOKUP`, `CLR`, and at least one service verb.
- packet session table:
  - source identity.
  - source transport.
  - destination X.121.
  - connect time.
  - clear reason.
  - transcript hash.
  - evidence URL.
- NOC visibility for active and recently cleared sessions.
- evidence export for terminal transcript and service result.
- fallback simulator mode for demos.

Then add:

- POTS/modem path through Asterisk/SIP/USB modem.
- MeshCore Radio PAD path.
- Meshtastic guest Radio PAD path with stricter limits.
- Wi-Fi/TCP campsite remote-node adapter.

Exit gates:

- one deployed terminal can call one provisioned X.121 service.
- NOC shows the session.
- the service result is persisted.
- the operator can export or print a receipt.
- failure paths produce explicit clear reasons, not silent errors.

## H3: Camp Utility Apps

Goal: make OMNIDAT useful enough that campsites and vendors want to interact
with it, even if the whole thing remains opt-in.

Priority apps:

- Packet Clearing Directory:
  - public `DIR`.
  - scoped `LOOKUP`.
  - approved versus open namespaces.
- Campsite apps:
  - bulletin.
  - message desk.
  - lost property.
  - queue.
  - form intake.
  - classifieds.
  - puzzle node.
  - remote print.
- Activity passport and merit badges:
  - account mode.
  - handle/passport mode.
  - badge evidence.
  - review queue.
  - post-event export.
- Miliways/FryOS food service:
  - menus.
  - prices.
  - line status.
  - order create.
  - order status.
  - print ticket.
  - optional FryOS bridge.
- Dispatch and incident paperwork:
  - operator notes.
  - field dispatch queue.
  - non-emergency only signage.
- Document Services:
  - receipt printer.
  - daily summary.
  - fax metadata.
  - spool review.

Exit gates:

- five useful service types can be configured without code changes.
- campsite owners can create and update their own open-namespace apps.
- operators can promote or delist services.
- daily summary includes provisioning, sessions, incidents, orders, activity,
  and billing artifacts.

## H4: Merchant And Bank Rails

Goal: support the fun money and terminal use cases without creating unclear
real-world obligations.

Default policy:

- OmniBucks are controlled play-money ledger units.
- network fees are theatrical unless separately agreed.
- no real cash redemption by default.
- ShadyBucks conversion requires a written policy.

Build:

- fork or stand up OmniBank as OMNIDAT-controlled test bank.
- keep ShadyBank integration behind a clear test/production boundary.
- support ISO 8583 profile docs and tests:
  - authorization.
  - capture.
  - reversal.
  - balance inquiry.
  - withdrawal simulation.
  - deposit simulation.
  - network management.
- Verifone/TCL app pack:
  - `OMNISALE.TCL`.
  - food order app.
  - directory app.
  - passport app.
  - terminal config package.
  - download/update protocol over POTS.
- POS flows:
  - sale.
  - refund.
  - void.
  - batch close.
  - settlement report.
- ATM/bearer instrument flows:
  - serial-numbered paper instrument.
  - QR transfer or money-order payload.
  - deposit.
  - cash-out simulation.
  - void/lost process.
- network fee policy engine:
  - flat.
  - percentage.
  - per-message.
  - waived.
  - event-sponsored.
  - merchant-pays.
  - operator-pays.

Exit gates:

- POS sale/refund/void/batch-close work in simulation.
- ATM setup and balance/withdraw/deposit work in simulation.
- fee statements reconcile against terminal and bank ledgers.
- ShadyBank/OmniBank team signs off before any redeemable value is exposed.

## H5: Field Hardware Kit

Goal: make a repeatable kit that can be packed, shipped, powered, operated, and
recovered.

Kit tiers:

| Tier | Use | Contents |
| --- | --- | --- |
| Table Pilot | small event or demo | laptop, printer, browser terminal, MeshCore gateway |
| Village Field Office | hackercamp village | mini PC, switch/AP, UPS, printer, terminal, radio gateway |
| Carrier Lab | ShadyTel-heavy event | Asterisk PBX, SIP, USB modems, terminal server, Verifone terminals |
| Full ToorCamp | flagship install | ShadyTel handoff, PBX, modem/PAD pool, NOC desk, printers, media/doc services |

Build:

- inventory file for every device:
  - asset tag.
  - owner.
  - location.
  - power needs.
  - cables.
  - spares.
  - config profile.
  - bench status.
- Asterisk + SIP lab:
  - `8800-8823` routes.
  - modem/PAD hunt groups.
  - direct diagnostic lines.
  - maintenance intercept.
  - call records.
- USB modem loop:
  - at least one dial-in path.
  - one direct modem endpoint.
  - one PAD endpoint.
- Verifone bench:
  - simulator.
  - real terminal loader path.
  - TCL app download.
  - sale/refund/batch test.
- printing:
  - receipt.
  - daily summary.
  - provisioning certificate.
  - incident report.
- radio:
  - MeshCore managed loaner path.
  - Meshtastic guest path.
  - rate limits and retry behavior.

Exit gates:

- one-command lab health check covers PBX, PAD, terminal, printer, radio, NOC,
  and evidence export.
- startup/shutdown runbooks are printable.
- all critical spares are labeled.
- field operators can recover from one simulated device failure.

## H6: Rehearsals And Pilot Events

Goal: prove the system with humans before asking a major camp to depend on it.

Rehearsal 1: synthetic weekend

- run 1,000-camper simulation.
- verify Night Market, Miliways, campsite provisioning, terminal sessions,
  network fees, and evidence artifacts.
- compare dashboard counts to exported ledgers.

Rehearsal 2: operator tabletop

- 3-5 operators.
- create event.
- onboard campsites.
- configure services.
- provision X.121 addresses.
- run terminal calls.
- create incident.
- export daily summary.

Rehearsal 3: human evening

- 10-20 participants.
- at least one public terminal.
- at least one campsite app.
- at least one food/queue flow.
- at least one passport/badge flow.
- at least one POS or bank simulation.
- post-event evidence report.

Pilot event:

- opt-in only.
- published hours.
- clear signage.
- no emergency dependency.
- no redeemable money unless separately approved.
- daily summary to event liaison.

Exit gates:

- humans can use the system without developer coaching.
- operators can resolve common failures.
- leadership receives a credible post-event report.
- next-camp recommendation is explicit: stop, repeat, expand, or make official.

## H7: ToorCamp 2028 Buildout

Goal: operate OMNIDAT as a field-office or official experimental packet-data
service at ToorCamp 2028.

Build:

- leadership agreement:
  - scope.
  - footprint.
  - power.
  - network.
  - phone/ShadyTel demarc.
  - RF.
  - signage.
  - privacy.
  - money policy.
  - incident escalation.
- ShadyTel interop:
  - route `8800-8823`.
  - validate called digits.
  - validate caller ID if provided.
  - validate busy behavior.
  - validate failover to OmniTel local lab.
- event services:
  - public directory.
  - campsite signup.
  - approved village services.
  - Night Market merchant onboarding.
  - Miliways queue.
  - activity passport.
  - document/print station.
  - NOC dashboard.
- staffing:
  - NOC lead.
  - packet operator.
  - bank operator.
  - vendor liaison.
  - ShadyTel liaison.
  - privacy/contact desk.
- runbooks:
  - startup.
  - daily open.
  - daily close.
  - incident response.
  - terminal failure.
  - radio failure.
  - money dispute.
  - shutdown/teardown.

Exit gates:

- Launch-Ready acceptance tests pass.
- ShadyTel-ready or self-contained fallback tests pass.
- at least one terminal path works end to end.
- money policy is posted.
- participant-facing language is printed and visible.
- event liaison signs off on pilot scope.

## H8: Multi-Event Network

Goal: make OMNIDAT a recurring network, not a one-off art build.

Build:

- historical archive:
  - previous events.
  - public service directories.
  - aggregate stats.
  - evidence artifacts.
  - incident summaries.
  - post-event recommendations.
- event templates:
  - small camp.
  - night market.
  - village-only.
  - full ShadyTel interop.
  - self-contained OmniTel lab.
- partner nodes:
  - other X.25/XOT experimenters.
  - ShadyTel peer networks.
  - MeshCore gateway operators.
  - hosted campsite nodes.
- stable APIs:
  - service registry.
  - service verb catalog.
  - provisioning.
  - NOC status.
  - evidence export.
  - fee statements.
- durable data governance:
  - per-event retention policy.
  - participant deletion/anonymization.
  - public archive consent.
  - operator audit retention.

Exit gates:

- a new event can be created from a template.
- historical records can be browsed without exposing private participant data.
- partner nodes can be provisioned with documented contracts.
- post-event reports are repeatable.

## Cross-Cutting Tracks

### Identity And Trust

- OmniAuth passkeys first.
- ForgeGraph OAuth for operators and infrastructure admins.
- GitHub as optional developer/operator login.
- ShadyTel SSO later when ready.
- role grants scoped by event and organization.
- break-glass admin audited and time-limited.

### Security

- role-gated writes.
- audit events for every mutation.
- signed session and OAuth state verification.
- API keys scoped by service and event.
- terminal credentials revocable by operator.
- public/open namespace content removal path.
- no secrets in terminal packages or printed artifacts.

### Privacy

- default to handles/passport IDs.
- avoid legal names, phone numbers, government IDs, and precise location
  history.
- consent text for activity passport and named historical records.
- event-specific retention windows.
- post-event aggregate archive by default.

### Observability

- NOC dashboard for service, circuit, terminal, incident, and evidence status.
- local field-office `/api/state` for Raspi/PBX dashboards.
- event logs for packet sessions, operator actions, provisioning, terminal
  transactions, and evidence exports.
- post-deploy smoke for production.
- daily printed summary.

### Developer Experience

- keep release gates explicit:
  - `npm test`.
  - `./scripts/validate-data`.
  - `npm run deploy:worker:dry-run --silent`.
  - `corepack pnpm@10.32.1 --dir gmacko test`.
  - `corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs build`.
  - `corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/nextjs typecheck`.
  - `corepack pnpm@10.32.1 --dir gmacko test:scaffold`.
  - `./scripts/weekend-sim`.
  - `./scripts/e2e-omnibank`.
- maintain simulation realism without hiding failures.
- keep docs and runbooks close to implemented behavior.

## Decision Points

These need explicit decisions before event-ready work:

- Is `omnidat.gmac.io` the gmacko V1 app, the Worker demo, or a split surface?
- What is the first real packet bridge: browser XOT, POTS/modem, MeshCore, or
  Verifone dial path?
- Is OmniBank a forked ShadyBank service, a thin test fixture, or a separate
  product?
- Are bearer instruments allowed at the first pilot, or only after a money
  policy rehearsal?
- Which hardware tier is the first target: Table Pilot, Village Field Office,
  Carrier Lab, or Full ToorCamp?
- What does event leadership allow for RF, power, network, phone, signage, and
  participant data?

## Near-Term Build Order

1. Make gmacko V1 the authoritative operator app or document the split.
2. Role-gate OMNIDAT tRPC operations.
3. Add operator CRUD for events, campsites, services, X.121 allocations, and
   provisioning lifecycle.
4. Build browser XOT terminal slice with NOC/evidence output.
5. Add local field-office `/api/state`.
6. Generate leadership PDF/deck from the pilot package.
7. Inventory hardware and create bench-check records.
8. Add POS batch-close and money-policy artifacts.
9. Run tabletop rehearsal.
10. Run 10-20 person human rehearsal.

## Non-Goals Until After First Pilot

- making OMNIDAT required for food, safety, registration, or official event
  communications.
- real cash redemption or unlimited bearer instruments.
- unattended mechanical Media Vault operation.
- transparent cross-protocol radio messaging outside Packet Clearing.
- direct access to camp leadership data systems.
- high availability beyond what the pilot scope promises.

## Canonical References

- [Hacker Camp Readiness Validation](plans/2026-07-04-hackercamp-readiness-validation.md)
- [Leadership Pilot Package](leadership-pilot-package.md)
- [Architecture](architecture.md)
- [Field Office Network Plan](field-office-network-plan.md)
- [Packet Clearing](packet-clearing.md)
- [System Requirements](system-requirements.md)
- [Acceptance Tests](acceptance-tests.md)
- [Hardware BOM](hardware-bom.md)
- [PBX Design](pbx-design.md)
- [Verifone Terminal Programming](verifone-terminal-programming.md)
- [ShadyBucks Carrier Network](shadybucks-carrier-network.md)
