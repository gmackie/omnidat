# OMNIDAT Open-Namespace Moderation Policy

Date: 2026-07-04

## Purpose

This policy implements Workstream H of
[Roadmap Expansion](plans/2026-07-04-roadmap-expansion.md) and the
"Open-namespace moderation" item in roadmap H3. The open campsite namespace
is intentionally self-service ([Packet Clearing](packet-clearing.md)), which
means participant-authored content goes live without prior review. This
document defines who moderates it, what is out of bounds, how fast takedowns
happen, how appeals work, and what the operator console must support.

The H3 exit gate this serves: a takedown can be executed and appealed
entirely from the operator UI, and the policy is printed and posted with the
participant pack.

## Scope

In scope:

- the open campsite namespace `020000-029999` (self-service, provisional
  directory status per `data/packet-namespaces.sample.json`): service names,
  directory descriptions, and all participant-authored content in
  `BULLETIN`, `MESSAGE_DESK`, `FORM`, `QUEUE`, and classifieds template apps
  (templates per `data/campsite-apps.sample.json`).
- provisional directory listings themselves — the name and description shown
  by `DIR` and `LOOKUP`.
- content on approved village services (`010000-019999`). Promotion implies
  operator review of the service, not perpetual review of its content.
- printed artifacts derived from open-namespace content: phone book
  classifieds pages and remote print jobs
  ([Participant Collateral](participant-collateral.md),
  [Document Services](document-services.md)).

Out of scope:

- core, carrier, merchant, and event-operations namespaces — those are
  operator-provisioned and governed by the operator model.
- protocol attacks, fuzzing, and planted challenges — governed by the rules
  of engagement (`docs/rules-of-engagement.md`), not this policy. A
  sanctioned challenge or in-bounds attack is not a moderation violation.
- ShadyTel voice traffic and camp infrastructure.

Publicity note for participants: everything posted to an open-namespace app
is public, terminal-visible, and printable. There is no expectation of
privacy in open-namespace content.

## Who moderates

Roles map to the roadmap H1 role set and the existing
[Operator Model](operator-model.md):

| Role | Moderation authority |
| --- | --- |
| campsite owner | removes posts on their own apps; actions audited like any other write |
| packet operator | first responder: content removal, delist, suspend |
| NOC operator / NOC lead | approves revocations; hears appeals |
| admin | role grants; break-glass only, audited and time-limited |
| auditor | read-only review of the moderation audit trail |
| event liaison | second-level appeal for cases overlapping the event code of conduct |

Rules:

- no anonymous moderation: every action carries the acting operator's
  identity and writes an audit event.
- the appeal reviewer must not be the operator who took the original action.
- "suspend abusive, broken, or confusing services" is already a packet
  operator duty in
  [Field Office Network Plan](field-office-network-plan.md); this policy
  bounds and audits that duty rather than inventing a new role.

## What is out of bounds

- targeting people: harassment, threats, and doxxing — publishing another
  participant's legal name, phone number, government ID, precise location
  history, or images without consent (Privacy track defaults: handles and
  passport IDs only).
- impersonation: content or service names posing as OMNIDAT core services,
  TrustDesk, ShadyTel, camp leadership, medical, or emergency services.
  Corporate-sounding labels are the house style
  ([Service Index](service-index.md) naming rule); claiming to *be* the
  official desk is not.
- emergency or official-communication claims: anything presenting OMNIDAT as
  an emergency channel or required event communication (H0 boundary).
- real-money dealings: soliciting real currency, offering real cash
  redemption of OmniBucks/ShadyBucks, or selling regulated goods.
  Classifieds trade in play-money and barter only (H4 default money policy).
- content unlawful in the event's jurisdiction, and content that violates the
  host event's code of conduct. The event CoC is incorporated by reference
  and wins wherever it is stricter than this policy.
- spam and flooding of bulletins, queues, or print spools — also
  out-of-bounds under the rules of engagement as resource flooding.

Explicitly in bounds: weird art, bureaucratic satire, hoax-corporate
ceremony consistent with the network's tone, and adversarial play against
your own accounts under the rules of engagement.

## Enforcement ladder

| Step | Action | Effect | Who |
| --- | --- | --- | --- |
| 1 | contact and fix | `MSG` to the owner's desk requesting an edit | packet operator |
| 2 | content removal | single post or listing removed from the app | owner or packet operator |
| 3 | delist | entry removed from `DIR` output; address still reachable | packet operator |
| 4 | suspend | `CALL` clears `CLR NA C:11 D:70` (access barred) | packet operator; NOC notified |
| 5 | revoke | allocation revoked (suspended -> revoked); `CALL` clears `CLR NA C:11 D:70` | NOC lead approval |

- person-targeting content skips the ladder: remove or suspend first, talk
  after.
- clear codes stay honest per the protocol-fidelity decision;
  [Protocol Fidelity](protocol-fidelity.md) is the cause-code source of
  truth. A suspended service clears `CLR NA C:11 D:70` (access barred),
  never a fake success or silent timeout. During an event, a revoked
  allocation also clears `CLR NA C:11 D:70` — the address visibly exists
  but is barred. Only a fully withdrawn/unallocated address clears
  `CLR NP C:13 D:0` (not obtainable).
- before any removal, the content and directory record are snapshotted as an
  evidence artifact (see tooling below). Takedowns delete from view, never
  from the record.

## Takedown SLA

Staffed hours are the published field-office hours in the phone book.

| Report class | Acknowledge | Act |
| --- | --- | --- |
| person-targeting (doxxing, harassment, safety) | 15 min staffed | immediate suspend permitted |
| impersonation of official or emergency services | 30 min staffed | same shift |
| money-policy or unlawful content | 1 hour staffed | same shift |
| everything else (spam, broken, misleading) | same day | by next daily close |

- outside staffed hours, reports queue to daily open; the terminal report
  path accepts reports at all hours.
- these are OMNIDAT defaults; per-event values are confirmed with event
  leadership in the leadership pack (see Open Questions).

How to report:

- dial `8819` (print desk / trouble) or `8800` TrustDesk
  ([Service Index](service-index.md)).
- from any terminal or Radio PAD: `MSG 000006 <report>` (Operator Messages,
  `data/packet-services.json`), or the report path named in every service's
  `HELP` output.
- in person at the field office.

Every report opens a NOC incident with a moderation class and a visible SLA
timer.

## Appeal path

- the owner of a delisted, suspended, or revoked service — or the author of
  removed content — may appeal at any time during the event, and within the
  event retention window for revocations.
- filing: paper form at the field office, `MSG 000006` from a terminal, or
  directly in the operator console. The appeal is logged as an incident
  linked to the original takedown's audit record.
- review: a NOC lead or operator who did not take the original action,
  within 24 hours or before end of event, whichever is sooner.
- outcomes: restore (directory status reinstated), modify (restored after
  required edits), or uphold.
- the decision prints via Document Services and is delivered to the owner's
  desk; it is recorded as an audit event linked to the takedown chain.
- second level: cases overlapping the event code of conduct escalate to the
  event liaison; their decision is final for that event.
- the entire flow — report, action, appeal, decision — must be executable
  from the operator UI with no shell access (H3 exit gate).

## Operator console tooling requirements

Audit plumbing already exists in the gmacko operator core (`appendAudit` in
`gmacko/packages/operator-core/src/omnidat.ts`); moderation actions ride the
same rails as every other write (roadmap H1a: audit events on every write).

Required:

- role-gated tRPC mutations for: remove-content, delist, suspend, restore,
  promote, revoke. Each writes an audit event carrying operator identity,
  target address, linked incident/report ID, reason code, and the policy
  clause invoked.
- authority correctness: during an active event, moderation actions execute
  on the field kit and journal to the cloud stamped with the current epoch;
  stale-epoch moderation writes are rejected like any other write (locked
  authority model).
- pre-removal snapshot: an evidence artifact capturing the removed content
  and directory record, hash-chained like other evidence, access-restricted
  to operators and the auditor, retained per the event retention window.
- report intake queue: moderation incidents visible in NOC with SLA timers.
  The incident class list in [Operator Model](operator-model.md) has no
  moderation class today; add a `MOD` class when tooling lands.
- appeal linkage: an appeal record references the takedown audit ID, and the
  console can walk report -> action -> appeal -> decision as one chain.
- printed artifacts: takedown notice and appeal decision print through the
  Document Services spool with form numbers, matching the house tone.
- directory honesty: `DIR` omits delisted entries; `LOOKUP` of a suspended
  address reports `SUSPENDED` status rather than pretending the address
  never existed.

## Posting with the participant pack

- the participant-facing digest below (NOTICE MOD-100) prints in every phone
  book edition next to the fair-play digest, and posts at the field office
  and every terminal.
- this full policy is available on request at the field office and readable
  from a directory service.
- form PC-201 (campsite service order) carries the line "I HAVE READ THE
  OPEN NAMESPACE MODERATION POLICY (MOD-100)"
  ([Participant Collateral](participant-collateral.md)).

### Posted policy text (NOTICE MOD-100)

```text
OMNIDAT OPEN NAMESPACE POLICY                 NOTICE MOD-100

THE 020XXX NAMESPACE IS SELF-SERVICE. YOUR CAMP POSTS FIRST
AND OPERATORS REVIEW AFTER. EVERYTHING POSTED IS PUBLIC AND
MAY BE PRINTED.

DO NOT POST:
  - OTHER PEOPLE'S NAMES, NUMBERS, OR WHEREABOUTS.
  - HARASSMENT OR THREATS.
  - FAKE OFFICIAL, MEDICAL, OR EMERGENCY SERVICES.
  - REAL-MONEY DEALS. PLAY MONEY AND BARTER ONLY.
  - ANYTHING AGAINST THE EVENT CODE OF CONDUCT OR THE LAW.
  - SPAM OR FLOODS.

OPERATORS MAY REMOVE POSTS, DELIST, OR SUSPEND SERVICES.
SUSPENDED OR REVOKED SERVICES ANSWER CLR NA C:11 D:70
(ACCESS BARRED). EVERY ACTION IS LOGGED
AND EVERY ACTION CAN BE APPEALED: FILE AT THE FIELD OFFICE
OR SEND MSG 000006 FROM ANY TERMINAL. A DIFFERENT OPERATOR
REVIEWS WITHIN 24 HOURS.

REPORT A PROBLEM: DIAL 8819, DIAL 8800 TRUSTDESK, OR SEND
MSG 000006. HACKING THE NETWORK IS A SEPARATE GAME WITH ITS
OWN RULES: SEE THE POSTED RULES OF ENGAGEMENT.

OPT-IN ART NETWORK. NOT FOR EMERGENCIES.
```

## Open questions

- Final SLA numbers per event: the table above is the OMNIDAT default and
  needs event-leadership signoff in the leadership pack before each pilot.
- Classifieds involving physical goods: whether barter listings need their
  own liability language in the leadership pack, alongside the H4 bearer
  instrument legal sanity pass.
- Moderation authority when no event is active and the cloud is
  authoritative: default is that any packet operator role scoped to the
  organization moderates the cloud surface, but this is not yet decided.
- Retention of takedown snapshots versus participant deletion and
  anonymization requests (H8 durable data governance) — which wins and when.
- Whether `MOD` becomes a formal incident class in
  [Operator Model](operator-model.md) or moderation reuses the `DATA` class
  with a subtype.
