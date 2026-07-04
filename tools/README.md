# Tools

Small repo-local utilities for turning OMNIDAT seed data into useful artifacts.

## Artifact Renderer

Run:

```sh
./scripts/render-artifacts
```

Default output:

```text
build/artifacts/service-directory.txt
build/artifacts/packet-directory.txt
build/artifacts/asterisk-routes.conf
```

The renderer reads:

```text
data/services.json
data/packet-services.json
```

The generated Asterisk route map is for review and lab scaffolding. It is not a
complete production PBX configuration.

## Database Builder

Run:

```sh
./scripts/build-db
```

Default output:

```text
build/omnidat.db
```

The builder loads the JSON seed files into SQLite tables for:

- services
- endpoints
- service endpoint membership
- packet services
- accounts
- account packet permissions
- media tapes
- print queues

This database is the first local data spine for lab tools. It can be deleted and
rebuilt from seed data at any time.

## Event Ledger

Append events:

```sh
./scripts/events append call.ended pbx --payload '{"called":"8800","disposition":"answered"}'
./scripts/events append session.ended packet-clearing --payload '{"kind":"pad"}'
```

Render a daily summary:

```sh
./scripts/events summary --output build/daily-summary.txt
```

Default log:

```text
build/events.jsonl
```

Events are append-only JSONL so they can be tailed, copied, printed, or repaired
with basic tools during the event.

## Media Vault Simulator

Initialize state from the sample catalog:

```sh
./scripts/media-vault init
```

Queue and run a request:

```sh
./scripts/media-vault request PUB-0001 --source pad --requested-by ACCT-000001
./scripts/media-vault approve-next --operator MG
./scripts/media-vault start
./scripts/media-vault complete
```

Inspect state:

```sh
./scripts/media-vault status
```

Fault the vault:

```sh
./scripts/media-vault fault "jam detected" --operator MG
```

Default files:

```text
build/media-vault-state.json
build/events.jsonl
```

The simulator is the software contract for the eventual robot controller: queue
state, tape status, active request, fault state, and event emission should remain
stable as physical hardware is added.

## Packet Clearing Simulator

Show the PAD directory:

```sh
./scripts/packet directory
```

Call a public service as the guest account:

```sh
./scripts/packet call 000001
```

Call a registered service:

```sh
./scripts/packet --account ACCT-000001 call 000002
```

The `call` command opens and clears a short simulated PAD session, emitting
`session.started` and `session.ended` events into `build/events.jsonl`.

## VeriFone Terminal Simulator

Run a Nightmarkt POS sale over the simulated terminal path:

```sh
./scripts/verifone-sim sale 12.50 SBQR-TEST-0001
```

Run the same sale through the local fake OmniBank rail, which mirrors the
checked-out ShadyBank `/api/authorize` and `/api/capture` merchant contract:

```sh
./scripts/e2e-omnibank
```

Run a field terminal directory lookup:

```sh
./scripts/verifone-sim --terminal VF-FIELD-01 directory miliways
```

Run food, passport, and update paths:

```sh
./scripts/verifone-sim --terminal VF-FOOD-01 food PASS-04271 tea --quantity 2
./scripts/verifone-sim --terminal VF-PASS-01 passport PASS-04271 "CALL TEST LOOP"
./scripts/verifone-sim update OMNIDAT.DTZ
```

The simulator uses `data/verifone-simulator-profile.json`, emits terminal,
Packet Clearing, queue, and activity events, and is intended to test the
Raspberry Pi Asterisk + SIP OmniTel bench before real USB modem and VeriFone
hardware is attached.

Launch the visual TUI simulator:

```sh
./scripts/verifone-tui
```

Print a deterministic visual frame for a specific flow:

```sh
./scripts/verifone-tui --demo sale
./scripts/verifone-tui --demo food
```

## Field Office App Platform

List activity badges:

```sh
./scripts/activity badges
```

Log a passport activity:

```sh
./scripts/activity log PASS-04271 020184 WORKSHOP-COMPLETE
```

Show the Miliways menu and create a queue ticket:

```sh
./scripts/queue menu miliways
./scripts/queue order miliways PASS-04271 tea
```

Submit a compact Radio PAD command:

```sh
./scripts/radio-pad DIR
./scripts/radio-pad REQ 020501 ORDER tea PASS-04271
./scripts/radio-pad STAT 020502 MLY-000001
```

Serve the lightweight Field Office UI:

```sh
./scripts/ui --port 8828
```

Health endpoints:

```sh
curl -fsS http://127.0.0.1:8828/api/health
curl -fsS http://127.0.0.1:8828/api/health/live
curl -fsS http://127.0.0.1:8828/api/health/ready
```

The repo also exposes FryOS-style package scripts:

```sh
npm run dev
npm run health
npm test
```

Create a local create-gmacko-app preview shell:

```sh
npm run scaffold:gmacko
```

Verify the shared FryOS Postgres service and OMNIDAT schema:

```sh
npm run db:shared:check
```

Default runtime paths:

```text
build/activity/activity-records.jsonl
build/queue/orders.json
build/events.jsonl
```

## Document Services

Spool a print job:

```sh
./scripts/documents print receipts "PAD SESSION RECEIPT" --body "SESSION COMPLETE"
```

Record an inbound fax:

```sh
./scripts/documents fax --pages 2 --caller ShadyTel:1234 --operator MG
```

List queued output:

```sh
./scripts/documents list
```

Default paths:

```text
build/spool/
build/fax/
build/events.jsonl
```

Print jobs are plain text files grouped by queue. Fax records are JSON metadata
files that can later point at scans or captured fax images.

## Operator Status

Render the current operator board:

```sh
./scripts/status
```

The status command reads seed services, event summaries, Media Vault state,
print spool counts, and fax records. It writes no state.
