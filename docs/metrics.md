# OMNIDAT Metrics And Reporting

Date: 2026-07-04

This spec implements Workstream G of the
[Roadmap Expansion](plans/2026-07-04-roadmap-expansion.md) and the KPI items
in the roadmap's Observability track. Exit gates elsewhere in the roadmap are
binary; rehearsals and leadership need numbers, and those numbers must be
generated, never hand-assembled.

## Single Source: The Field Kit Journal

Every KPI derives from the field kit append-only journal defined in
Workstream A. No KPI may be computed from dashboard state, operator memory,
or any side channel.

- during an active event the field kit is authoritative; every KPI-bearing
  write lands in its journal first, stamped with the current authority epoch.
- the cloud replica computes the same KPIs from the synced journal and shows
  sync staleness honestly, never presenting stale numbers as live.
- during cloud-primary periods (failover or no active event) the cloud
  journal is the source through the same aggregation code.
- the weekend simulation runs on a sim field kit through the same sync path,
  so KPI reporting is soaked continuously, not just at camp.

Interim (H1a): until the Workstream A journal ships, KPI facts land as
gmacko `omnidat_network_metric` rows through the single
`recordOperationalMetric` choke point
([H1a plan](plans/2026-07-04-h1a-operator-core-slice.md), Task 7). The
journal statements above describe the target state; the choke point is the
invariant. See Instrument Once below.

Today's concrete shape of the journal is the simulator event log.
`tools/omnidat_weekend.py` (`JsonlEventWriter`) writes
`build/weekend-sim/weekend-events.jsonl`, `weekend-bank-ledger.jsonl`, and
`weekend-network-fees.jsonl`; the field office writes the same envelope via
`append_event` in `tools/omnidat_events.py`:

```json
{"event_id": "EVT-20280701-000001", "type": "session.ended",
 "source": "packet-clearing", "created_at": "...", "payload": {}}
```

The [Split-Authority Sync plan](plans/2026-07-04-split-authority-sync.md)
owns the production journal schema. This spec adopts its field names; the
sim's JSONL envelope maps onto them as follows:

| Sim JSONL field | Production journal field |
| --- | --- |
| `event_id` | journal entry id (`idempotencyKey` = `{sourceId}:{seq}`); distinct from `omnidatEvent.eventId`, which scopes the entry to an event row. |
| `type` | `opType` |
| `source` | `sourceId` |
| `created_at` | `recordedAt` |
| `payload` | `payload` |

The production envelope also carries `epoch` and the per-source monotonic
`seq`, so every report can state exactly which journal range it covers.

## Conventions

- "day" means an event-local calendar day, 00:00-24:00 in the event's posted
  timezone, matching the daily open/close runbooks (see Open Questions).
- money KPIs are OmniBucks unless a posted money policy says otherwise.
- identity KPIs count pseudonymous keys (passport ID, handle, account ID),
  never legal names, per the privacy track.
- canonical KPI names are `snake_case` and match journal/report fields; API
  surfaces may expose camelCase aliases (the Worker already does).

## KPI Catalog

### Network

| KPI | Definition | Unit | Journal source | Window |
| --- | --- | --- | --- | --- |
| `packet_sessions` | Count of `session.ended` events. | sessions/day | `session.ended` | daily + cumulative |
| `failed_call_rate` | Sessions cleared with a non-normal X.25 clear cause, divided by all sessions, grouped by cause/diagnostic pair. | percent + count per cause | `session.ended` `payload.clear_cause`, `payload.diagnostic` | daily |
| `verb_calls` | Count of verb executions grouped by destination X.121 and verb. | calls/day per service+verb | `verb.executed` (proposed) | daily + cumulative |
| `terminal_sessions` | Count of Verifone/TCL terminal program runs grouped by program. | sessions/day per program | `terminal.session` `payload.program` | daily |

Notes:

- [Protocol Fidelity](protocol-fidelity.md) defines the clear cause and
  diagnostic taxonomy. `session.ended` must carry real X.25 codes and
  `failed_call_rate` buckets on `C:<cause>` (normal clear is C:0; failure
  buckets include C:13 not obtainable, C:11 access barred, C:9 out of
  order, C:1 busy, C:5 congestion), never on free text. The sim's free-text
  `clear_reason` (`tools/omnidat_weekend.py:provision_campsites`) is a
  placeholder until the bridge normalizes it.
- `verb.executed` does not exist yet; it is emitted by the H2 packet bridge
  per verb call (service X.121, verb, status, session reference). Until then
  the nearest real signal is `terminals.by_program` in the sim report.
- there is no packet session table in `gmacko/packages/db/src/omnidat-schema.ts`
  yet; H1a adds it. Its rows are projections of journal session events, not a
  second source.

### Participation

| KPI | Definition | Unit | Journal source | Window |
| --- | --- | --- | --- | --- |
| `unique_identities` | Distinct identity keys appearing in any journal event payload in the window. | identities | all events (identity fields) | daily + cumulative |
| `forms_filed` | Count of `form.filed`, grouped by `payload.form_type`. | forms/day per type | `form.filed` | daily |
| `activity_stamps` | Count of activity/passport stamps logged. | stamps/day | `activity.logged` | daily |
| `x121_provisioned` | Campsite/service X.121 assignments, with verified subset. | assignments (verified count) | `x121.provisioned` `payload.verified` | daily + cumulative |

Notes:

- the sim reports `identity.unique_subjects` by counting distinct
  `omniauth_subject` values; a camper also appears as `camper_id`,
  `passport_id`, and `account_id` (`seed_campers`). The canonical key for
  `unique_identities` is an open question below.
- `activity.logged` is already counted by the field-office summary
  (`tools/omnidat_events.py` `SUMMARY_KEYS.activities_logged`).

### Commerce

| KPI | Definition | Unit | Journal source | Window |
| --- | --- | --- | --- | --- |
| `orders` | Count of accepted queue/food orders. | orders/day | `queue.order.accepted` + `food.order.created` | daily + cumulative |
| `orders_gross` | Sum of order amounts. | OmniBucks | `miliways.window.order` `payload.amount` | daily |
| `pos_sales` | Count and gross of captured POS sales, grouped by merchant. | sales + OmniBucks per merchant | `omnibank.captured` (bank ledger) | daily |
| `auth_approval_rate` | Share of authorizations with response code `00` over all authorizations, plus full response-code distribution. | percent + count per code | `omnibank.authorized` `payload.response_code` | daily |
| `fee_totals` | Sum of assessed network fees grouped by policy mode and `policy_id`. | OmniBucks per mode | `network_fee.assessed` (fee ledger) `payload.fee_amount` | daily + cumulative |
| `omnibucks_outstanding` | Total seeded minus total captured/spent; participant float. | OmniBucks | `omnibucks.seeded` minus captures | cumulative |
| `negative_balances` | Count of participant accounts below zero; must stay 0. | accounts | derived from ledger | cumulative |

Notes:

- these match the sim report fields in `weekend-report.json`:
  `night_market.sales`/`captured`/`totals_by_merchant`,
  `miliways.orders`/`tickets_issued`/`gross`,
  `network_fees.total_assessed`/`by_mode`,
  `campers.ending_balance_total`, and `bank.response_codes`
  (`count_response_codes` in `tools/omnidat_weekend.py`).
- fee statements per account remain artifacts
  (`billing-statements/<ACCOUNT>.txt`); `fee_totals` must reconcile to the
  sum of statement lines, which is already a Rehearsal 1 check.

### Operations

| KPI | Definition | Unit | Journal source | Window |
| --- | --- | --- | --- | --- |
| `incident_count` | Incidents opened, grouped by severity. | incidents/day per severity | `incident.opened` | daily + cumulative |
| `incident_time_to_clear` | Cleared-at minus opened-at for incidents cleared in the window. | minutes, median + p90 | `incident.opened` + `incident.cleared` (proposed) | daily + cumulative |
| `print_jobs` | Print jobs completed by document services. | jobs/day | `print.printed` | daily |
| `evidence_artifacts` | Evidence artifacts exported, with record counts. | artifacts + records | `evidence.exported` (proposed) | daily + cumulative |

Notes:

- `incident.opened` is already counted by the field-office summary. The
  gmacko `omnidat_noc_incident` table has `openedAt`/`resolvedAt` but no
  journal event marks clearing yet; `incident.cleared` must be emitted so
  time-to-clear is computable from the journal alone.
- the sim's evidence block (`weekend-report.json` `evidence.*`) and the
  gmacko `omnidat_evidence_artifact` table (`recordCount`, `checksum`) are
  the projection targets for `evidence_artifacts`.

### Sync Health

| KPI | Definition | Unit | Journal source | Window |
| --- | --- | --- | --- | --- |
| `sync_staleness` | On the replica, now minus the origin `recordedAt` of the newest applied journal entry, sampled once per minute. | seconds, p50/p95/max | sync apply log | daily |
| `sync_reconciliation` | Per sync session: applied, skipped-duplicate, and rejected-stale-epoch counts (Workstream A reconciliation report). | counts | `sync.session` | per session + daily |
| `journal_backlog` | Journal entries written but not yet acknowledged by the replica, at sample time. | records, max | journal sequence vs ack | daily |

Notes:

- `rejected-stale-epoch` must be 0 outside a sanctioned failover drill; any
  nonzero value outside a drill is an automatic NOC incident.
- these KPIs land with the
  [Split-Authority Sync plan](plans/2026-07-04-split-authority-sync.md),
  which defines the `sync.session` record, and are required before the
  60-minute uplink-pull exit gate can be scored.

## Instrument Once

- the invariant is a single choke point, not journal-from-day-one: every
  KPI-bearing mutation reports its fact through one helper,
  `recordOperationalMetric`
  ([H1a plan](plans/2026-07-04-h1a-operator-core-slice.md), Task 7).
- during H1a the choke point writes gmacko `omnidat_network_metric` rows;
  when Workstream A lands
  ([Split-Authority Sync](plans/2026-07-04-split-authority-sync.md)) the
  same choke point swaps to journal writes and no mutation call site
  changes. From then on every KPI is a fold over journal entries.
- dashboards and the Worker NOC surfaces (`nocWeekendOperations()` in
  `worker/omnidat-worker.mjs`) are projections and may cache, but any
  projected number must recompute from the current source of record (metric
  rows during H1a, the journal after) with zero variance.
- the H1a tRPC slice instruments sessions, verbs, provisioning, and evidence
  through the choke point (roadmap Near-Term Build Order item 3); incidents
  and later KPIs are instrumented as their write paths land.
- proposed events to add: `verb.executed`, `incident.cleared`,
  `evidence.exported`, plus real clear cause codes on `session.ended`;
  `sync.session` is defined by the split-authority plan. Everything else in
  the catalog is already emitted by the sim or the field office.

## Daily Printed Summary

The daily summary is generated by the same aggregation code that computes the
KPI catalog, run over one event-local day of journal data, and printed
through document services like any other artifact. It extends the existing
generator (`summarize_events` + `render_daily_summary` in
`tools/omnidat_events.py`), which already renders the receipt skeleton.

Proposed layout (receipt printer, uppercase, 42 columns max):

```text
OMNIDAT DAILY SUMMARY
A GMACKO CORPORATION
EXCHANGE 88

DATE 2028-07-14           DAY 2 OF 5
EVENT TOORCAMP-2028
AUTHORITY FIELD KIT       EPOCH 4
JOURNAL SEQ 018211-024906

-- NETWORK --
PACKET SESSIONS            214
FAILED CALLS             9 (4.2%)
  C:13 NP NOT OBTAINABLE     5
  C:9 DER OUT OF ORDER       4
TOP SERVICES BY VERB CALLS
  311088000001 DIR            88
  311088020501 ORDER          61
  311088030100 BAL            34
TERMINAL SESSIONS          131

-- PARTICIPATION --
UNIQUE IDENTITIES    312 (TOTAL 481)
FORMS FILED                 44
ACTIVITY STAMPS            129
X.121 PROVISIONED     3 (VERIFIED 3)

-- COMMERCE (OMNIBUCKS) --
ORDERS                     240
POS SALES        188 GROSS 1620.00
AUTH APPROVAL     98.9% (RC 00)
NETWORK FEES ASSESSED    41.15

-- OPERATIONS --
INCIDENTS OPENED 2 CLEARED 2
TIME TO CLEAR   MED 18M  P90 42M
PRINT JOBS                  57

-- SYNC --
STALENESS  P50 40S P95 3M MAX 12M
RECONCILED 6021 OK / 14 DUP / 0 STALE

EVIDENCE EVENTS 6188 BANK 2044 FEE 1544
GENERATED FROM JOURNAL SEQ RANGE ABOVE
```

Layout rules:

- the header always states authority holder, epoch, and the journal sequence
  range the numbers cover, so any line is recomputable and disputes are
  resolvable.
- failed-call causes and top services print at most the top three lines each;
  the full breakdown lives in the post-event report.
- a section with no activity prints its zeroes; missing sections are how
  hand-assembly hides problems.

## Post-Event Report

The post-event report is the same aggregation code run over the whole event
window plus a per-day breakdown:

- one row per event day for every KPI in the catalog.
- full failed-call cause table and full verb-calls-per-service table.
- incident log with per-incident time-to-clear.
- fee statements index and reconciliation against terminal and bank ledgers.
- sync health across the event, including any failover drills and their
  epochs.
- evidence index: every artifact with path, record count, and checksum
  (projection of `omnidat_evidence_artifact`).
- the explicit next-camp recommendation required by the H6 exit gates.

`build/weekend-sim/weekend-report.json` is the prototype of this document:
one generated artifact whose counts are cross-checked against the exported
ledgers (Rehearsal 1). The production report replaces its hard-coded
scenario checks with the KPI catalog over the journal.

## Exit Gates

- the daily summary and the post-event report are generated from the field
  kit journal by the same aggregation code; no hand-assembled numbers.
- rehearsals report the full KPI set without developer involvement: one
  operator action (NOC button or field-office command) produces the printed
  daily summary.
- every dashboard or projected KPI value recomputes from the exported
  journal with zero variance.
- every printed summary states its epoch and journal sequence range.
- sync-health KPIs are reported during the Workstream A uplink-pull and
  failover drills, not just asserted.

## Open Questions

- day boundary: event-local calendar day (default proposed here) versus the
  NOC daily open/close window from the runbooks. Owner: NOC lead; decide
  before Rehearsal 2.
- journal shape: does the production journal unify today's three files
  (events, bank ledger, fee ledger) as typed entries in one stream, or keep
  separate hash-chained ledgers under a manifest? Owned by the
  [Split-Authority Sync plan](plans/2026-07-04-split-authority-sync.md).
- canonical identity key for `unique_identities`: one camper appears as
  `camper_id`, `passport_id`, `account_id`, and `omniauth_subject` in
  different events today; pick one join key and normalize at emit time.
- KPI materialization after Workstream A: recompute on demand from the
  journal, or keep writing materialized rows into gmacko
  `omnidat_network_metric` (`metricName`/`value`/`unit`/`observedAt`) for
  dashboard reads. During H1a the metric rows are the interim store (see
  Instrument Once); once the journal ships it is the source of truth either
  way.
