# Authority Failover

OMNIDAT event data has one authoritative writer at a time. During an active
event the field kit holds authority and syncs to the cloud; the cloud is
primary when the field kit is offline or no event is active. Authority moves by
an epoch-incrementing, NOC-initiated transfer. Stale-epoch writes are rejected
at the writer and quarantined (never dropped) at the receiver, so a mistaken
failover cannot corrupt history.

See [Split-Authority Sync](../docs/plans/2026-07-04-split-authority-sync.md) for
the model this runbook operates.

## Concepts

```text
holder       field | cloud (who may append event-scoped ops now)
epoch        monotonic per-event counter; every transfer increments it
fenceSeq     highest sequence received from the outgoing holder at transfer
quarantine   a stale-epoch entry, preserved for operator reconciliation
```

## Field -> Cloud (kit dead)

Use when the field kit is unreachable and cannot drain its journal first.

1. Confirm the kit is actually down: no `/api/state`, no heartbeat, no sync in
   the NOC "FIELD DATA AS OF" banner for longer than the staleness threshold.
2. Announce the failover to the NOC and any operators writing to the kit.
3. Transfer authority to the cloud:
   ```sh
   OMNIDAT_SYNC_TARGET=<gmacko-url> OMNIDAT_OPERATOR_TOKEN=<noc-api-key> \
     ./scripts/authority-drill --event-id <event> --operator-id <you>
   ```
   or call `omnidat.transferAuthority` with `toHolder: cloud` directly as a
   NOC operator (the mutation is gated on the authority.transfer capability).
4. The cloud epoch increments; the fence is recorded at the last sequence the
   cloud received from the kit.
5. The NOC dashboard flips to "CLOUD PRIMARY (EPOCH n)".
6. Operators now write through the cloud.

Any op the dead kit had appended past the fence but not yet pushed will
quarantine when the kit later reconnects. That is expected; reconcile in the
rejoin step.

## Field -> Cloud (planned)

Use for an orderly handoff (kit maintenance, teardown).

1. Stop operators from writing to the kit.
2. Drain the kit's journal tail: run `python3 -m tools.omnidat_sync --db <kit-db>
   --event-id <event> once` until `unpushed` is empty.
3. Transfer authority to the cloud as above. Because the tail is drained, the
   fence equals the kit's final sequence and nothing quarantines.

## Cloud -> Field (rejoin)

Use when the field kit is back and should retake authority.

1. Bring the kit online and let it pull until its watermark matches the cloud:
   `python3 -m tools.omnidat_sync --db <kit-db> --event-id <event> once`,
   repeated, until a pull returns no new entries.
2. Verify the reconciliation report: `applied + duplicate` equals the cloud
   watermark and `rejected-stale` is zero.
3. Transfer authority back to the field. The transfer is refused if the kit has
   not caught up to every source's watermark, so a premature retake cannot
   happen.
4. Review quarantined entries from the dead-kit window:
   - re-enter each as a new op under the current epoch if the work is still
     valid, or
   - archive it as evidence if it was superseded while the cloud held
     authority.
5. The NOC dashboard returns to "FIELD DATA AS OF ...".

Default allocation-collision policy during a dead-kit window: the cloud
allocation wins and the kit's quarantined allocation is re-entered under a new
address. Confirm this with the NOC before the tabletop rehearsal.

## H5 Exit-Gate Drill: Pull The Uplink

Run this before relying on the kit at an event.

1. Start the weekend sim with a 60+ simulated-minute outage window against a
   staging gmacko target:
   ```sh
   OMNIDAT_SYNC_TARGET=<staging-url> OMNIDAT_SYNC_TOKEN=<token> \
     python3 -m tools.omnidat_weekend --runtime-dir build/outage-soak \
     --campers 1000
   ```
   (the sim's `outage_window` parameter drives the refused-uplink checkpoints;
   see `tools/omnidat_weekend.py`).
2. Confirm from `weekend-report.json`:
   - `journal.outage.refused_pushes >= 1` and
     `journal.outage.simulated_minutes >= 60`.
   - `journal.sync.applied + journal.sync.duplicate == journal.total`.
   - `journal.sync.rejected_stale == 0`.
   - field-office flows (orders, stamps, ledger) completed during the window.
3. Run the bidirectional drill and keep the printed transcript as evidence:
   ```sh
   OMNIDAT_SYNC_TARGET=<gmacko-url> OMNIDAT_OPERATOR_TOKEN=<noc-api-key> \
     ./scripts/authority-drill --event-id <event> --operator-id <you>
   ```
   Confirm `RESULT: PASS` with both `FIELD-TO-CLOUD` and `CLOUD-TO-FIELD` steps.

Zero lost records and a clean reconciliation are the gate. Print the report and
the drill transcript for the rehearsal file.
