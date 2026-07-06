# H5-H8 Field Kit, Rehearsals, Pilot, And Multi-Event Plan

Date: 2026-07-05

These horizons are mostly hardware, operations, and rehearsal, not application
code. The software spine they depend on is already built and merged: the
operator system (H1a/H1b), the browser XOT bridge and transport policies (H2),
configurable camp apps (H3), POS settlement (H4), split-authority sync with the
field-kit journal and failover drill (Workstream A), the field-office
`/api/state` endpoint, and the weekend simulation. What remains is procurement,
bench proof, drilling, and running events. This plan turns each horizon into an
executable checklist against the roadmap exit gates.

## H5: Field Hardware Kit

Goal: a repeatable kit that can be packed, powered, operated, and recovered.

Checklist:

- [ ] fill `docs/hardware-bom.md` per-tier costs from
  `docs/budget-sourcing.md`; fund the Table Pilot tier (radio burn-in
  acquire-by 2026 Q4).
- [ ] acquire long-lead Carrier Lab items (Verifone terminals, USB modems,
  PRI gear) by their `docs/budget-sourcing.md` acquire-by dates.
- [ ] check-in an inventory row per device: asset tag, owner, power, cables,
  spares, config profile, bench status.
- [ ] Asterisk + SIP lab answering `8800-8823`, modem/PAD hunt groups,
  diagnostic lines, call records (see `docs/pbx-design.md`).
- [ ] one USB modem dial-in path bridged to `packetCall` with
  `sourceTransport: pots-modem` (the transport budget is already enforced).
- [ ] Verifone bench: simulator + real loader path + `posBatchClose` proven
  against a real terminal tape.
- [ ] printing path: receipt, daily summary, provisioning certificate,
  incident report (the document builders exist; wire a physical printer).
- [ ] radio: MeshCore managed loaner and Meshtastic guest bridges to
  `packetCall` (`meshcore`/`meshtastic` budgets already enforced).

Exit gate: one-command lab health check covering PBX, PAD, terminal, printer,
radio, NOC, and evidence export; the field-office `/api/state` endpoint is the
machine-readable half of that check. Startup/shutdown runbooks printable
(`runbooks/startup.md`, `runbooks/shutdown.md`); recover from one simulated
device failure; the 60-minute uplink-pull drill passes
(`runbooks/authority-failover.md`).

## H6: Rehearsals And Pilot Events

Goal: prove the system with humans before a major camp depends on it.

- [ ] **Rehearsal 1 (synthetic):** run `./scripts/weekend-sim` on the sim field
  kit; compare dashboard counts to exported ledgers; confirm the journal
  reconciles (already automated).
- [ ] **Rehearsal 2 (operator tabletop, 3-5 ops):** create event → onboard
  campsite → configure services/apps → allocate + verify X.121 → run terminal
  calls → open/resolve incident → export daily summary → run the authority
  failover drill. Doubles as the operator licensing exam (Workstream F).
- [ ] **Rehearsal 2.5 (red team):** invite-only adversarial pass under
  `docs/rules-of-engagement.md`; triage findings; fix criticals; verify NOC
  abuse/rate-limit signals.
- [ ] **Rehearsal 3 (human evening, 10-20 people):** one public terminal, one
  campsite app, one food/queue flow, one passport/badge flow, one POS or bank
  sim; produce a post-event evidence report.
- [ ] **CC Camp 2027 rehearsal target:** lighter portable kit (meshtastic focus), no PRI, validate H6/H8 multi-event for European camp.
- [ ] **Pilot event:** opt-in, published hours, clear signage, no emergency
  dependency, no redeemable money unless separately approved; daily summary to
  the event liaison.

Exit gate: humans use the system without developer coaching; operators resolve
common failures; leadership receives a credible post-event report; explicit
next-camp recommendation (stop / repeat / expand / make official).

Decision needed by 2026-10-01: which named 2026/2027 events host Rehearsal 3
and the pilot, and whether the pilot targets Table Pilot or Village Field
Office tier.

## H7: ToorCamp 2028 Buildout

Goal: operate OMNIDAT as a field-office or official experimental packet-data
service at ToorCamp 2028.

- [ ] leadership agreement: scope, footprint, power, network, phone/ShadyTel
  demarc, RF, signage, privacy, money policy, incident escalation.
- [ ] ShadyTel interop: route `8800-8823`, validate called digits/caller ID/
  busy/failover to the OmniTel local lab (`docs/shadytel-interconnect-request.md`).
- [ ] event services live: public directory, campsite signup, approved village
  services, Night Market onboarding, Miliways queue, activity passport,
  document/print station, NOC dashboard.
- [ ] staffing: NOC lead, packet operator, bank operator, vendor liaison,
  ShadyTel liaison, privacy/contact desk — each a licensed primary + backup
  (Workstream F).
- [ ] runbooks: startup, daily open/close, incident, terminal failure, radio
  failure, money dispute, teardown.

Exit gate: Launch-Ready acceptance tests pass (`docs/acceptance-tests.md`);
ShadyTel-ready or self-contained fallback tested; at least one terminal path
end to end; money policy posted; participant language printed and visible;
event liaison signs off.

## H8: Multi-Event Network

Goal: a recurring network, not a one-off art build.

- [ ] historical archive: previous events, public directories, aggregate
  stats, evidence artifacts, incident summaries, post-event recommendations
  (the event + evidence-export model is in place; add the archive view).
- [ ] event templates: small camp, night market, village-only, full ShadyTel
  interop, self-contained OmniTel lab.
- [ ] partner nodes: other X.25/XOT experimenters, ShadyTel peers, MeshCore
  gateway operators, hosted campsite nodes — with the documented XOT interop
  profile and X.121 sub-allocation rules (`docs/protocol-fidelity.md`).
- [ ] stable APIs: service registry, verb catalog, provisioning, NOC status,
  evidence export, fee statements (all present as gated tRPC).
- [ ] data governance: per-event retention, participant deletion/anonymization,
  public archive consent, operator audit retention.

Exit gate: a new event can be created from a template; historical records
browsable without exposing private participant data; partner nodes provisioned
with documented contracts; post-event reports repeatable.

**Camp Deployments note (see root README):** ToorCamp 2028 is flagship (full ShadyTel interconnect preferred, physical robot, NOC desk). CC Camp 2027 is potential large rehearsal / European validation for H6/H8. Portable Field Office mode works for both without full PRI. Hardware kit / telnet PAD / radio adapters in active BOM updates.

## Cross-Cutting Still Open (decisions, not code)

- money policy signoff by the ShadyBank/OmniBank team and the bearer-instrument
  legal sanity pass (H4 gate).
- named-event calendar (H6 decision, by 2026-10-01).
- X.121 DNIC governance (`docs/protocol-fidelity.md` open question).
- which transport is the second real bridge after browser XOT (POTS/modem is
  the natural choice given the PBX lab dependency).
