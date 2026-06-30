# Lab Bring-Up Plan

This plan builds OMNIDAT in layers. Each layer should run without ShadyTel, real
PRI, real X.25, or the final Media Vault hardware.

## Stage 1: Repo and Records

Goal: establish the shared vocabulary and records.

- Create SQLite schema or JSON fixture files for accounts, services, endpoints,
  tapes, and events.
- Seed `8800-8823` services from [Service Index](service-index.md) and
  `data/services.json`.
- Build the local SQLite database with `./scripts/build-db`.
- Append one sample event with `./scripts/events append ...`.
- Render one daily summary with `./scripts/events summary`.
- Seed 3 test accounts:
  - public guest
  - registered user
  - operator
- Seed 5 media tapes and 2 dummy incidents.
- Generate one printable daily summary from fixture records.

Exit criteria:

- Service map can be rendered from data.
- Operator can inspect records with ordinary command-line tools.
- Daily summary can be printed or saved as plain text.
- `./scripts/validate-data` passes.
- `./scripts/build-db` creates `build/omnidat.db`.
- `./scripts/events summary` renders a dot-matrix-friendly summary.
- `./scripts/status` renders an operator-readable status board.

## Stage 2: PBX Simulator

Goal: prove dialed-number routing before hardware.

- Install Asterisk or FreeSWITCH locally.
- Configure a fake ShadyTel ingress trunk.
- Configure softphone or SIPp test calls into `8800-8823`.
- Route core numbers to simple IVRs or echo handlers.
- Emit call records.
- Add maintenance mode for at least one service.

Exit criteria:

- Calls to `8800`, `8802`, `8805`, `8810`, `8814`, `8818`, and `8820` reach
  different handlers.
- Busy/maintenance/intercept behavior is visible.
- Call records are produced.

## Stage 3: BBS and Modem Pool

Goal: get a caller into OMNIDAT Online.

- Stand up BBS or terminal service host.
- Connect one softmodem or TCP/PTY modem simulator.
- If hardware exists, attach one external modem through FXS.
- Route `8802` and `8820`.
- Log session records.

Exit criteria:

- User can dial or simulate dialing into BBS.
- Direct modem line and hunt number both work.
- Session receipt can be printed or spooled.

## Stage 4: Packet Clearing

Goal: establish the PAD experience.

- Build terminal-faithful PAD prompt.
- Implement `CALL 000001` directory.
- Implement `CALL 000004` Media Vault catalog.
- Route `8810`, `8811`, `8812`, `8813`, and `8822`.
- Enforce public vs registered access class.
- Prove the simulator CLI:
  - `./scripts/packet directory`
  - `./scripts/packet call 000001`
  - `./scripts/packet --account ACCT-000001 call 000002`
  - `./scripts/packet --account ACCT-000001 call 000011`
  - `./scripts/packet --account ACCT-000001 call 000020`

Exit criteria:

- Guest user can reach public directory.
- Registered user can submit a Media Vault request.
- Session records show called packet service.
- Packet sessions emit `session.started` and `session.ended` events.
- Registered carrier test account can reach POS authorization and NiteMarkt WMS
  packet services.

## Stage 5: Document Services

Goal: make the paper loop real.

- Attach dot matrix printer or file-spool simulator.
- Attach fax machine or fake fax metadata folder.
- Implement print queues:
  - forms
  - receipts
  - logs
  - vault
  - settlement
- Print one of each artifact type.
- Prove the Document Services CLI:
  - `./scripts/documents print receipts "PAD SESSION RECEIPT"`
  - `./scripts/documents fax --pages 1 --caller ShadyTel:5555`
  - `./scripts/documents list`

Exit criteria:

- Operator can print directory, account card, session receipt, and load ticket.
- Fax receive path creates a record.
- Printer failure can be simulated and recovered.
- Document Services emits `print.printed` and `fax.received` events.

## Stage 6: Media Vault Simulator

Goal: prove queue and state machine before motion hardware.

- Implement tape inventory.
- Implement request queue.
- Implement state transitions:
  - IDLE
  - HOMING
  - FETCHING_TAPE
  - LOADING_VCR
  - PLAYING
  - EJECTING
  - RETURNING_TAPE
  - FAULT
- Connect BBS/PAD requests to queue.
- Generate now-playing metadata for video overlay.
- Prove the simulator CLI:
  - `./scripts/media-vault init`
  - `./scripts/media-vault request PUB-0001`
  - `./scripts/media-vault approve-next`
  - `./scripts/media-vault start`
  - `./scripts/media-vault complete`

Exit criteria:

- Request from Packet Clearing appears in queue.
- Operator approves and simulator reaches PLAYING.
- Fault state blocks further motion/jobs until cleared.
- Media Vault events appear in `build/events.jsonl`.

## Stage 7: Video Chain

Goal: put OMNIDAT TV on screens.

- Feed VCR or test pattern into capture/switcher path.
- Generate overlay slate from Media Vault state.
- Display on one analog monitor or CRT.
- Encode local IP preview.
- Record a short clip.

Exit criteria:

- Same program output is visible on local display and IP preview.
- Overlay contains now-playing or maintenance state.
- Recording captures program output.

## Stage 8: Hardware Integration

Goal: replace simulators one at a time.

Order:

1. FXS gateway and one analog phone.
2. One external modem.
3. One fax machine.
4. Dot matrix printer.
5. Terminal server and one physical terminal.
6. Media Vault 3-5 slot prototype.
7. PRI gateway/card with local loop or ShadyTel test.

Exit criteria:

- Each real subsystem produces the same records as its simulator.
- Operator can fall back to simulator or maintenance mode.

## Stage 9: ShadyTel Interop

Goal: prove OMNIDAT behaves as an Exchange 88 trunk tenant.

- Test called-number delivery.
- Test caller ID behavior.
- Test simultaneous channel usage.
- Test busy/intercept behavior.
- Test ShadyTel operator escalation path.
- Print and sign off interop test sheet.

Exit criteria:

- ShadyTel can call at least 5 representative OMNIDAT numbers.
- OMNIDAT can recover from trunk down/up.
- Interop settings are documented and printed.
