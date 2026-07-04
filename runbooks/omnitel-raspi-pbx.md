# OmniTel Raspberry Pi PBX Runbook

OmniTel is the local bootstrap peer for OMNIDAT before the real ShadyTel handoff is available. It is a small Asterisk + SIP lab exchange that routes Exchange 88 calls into OMNIDAT and lets us test VeriFone terminals, USB modem lines, and PJSIP trunk behavior on a bench.

The target V1 hardware is a Raspberry Pi running Asterisk, one Ethernet connection, and a USB modem bank or USB-attached analog/FXS adapters for local terminal lines. The same configuration can later be moved behind a PRI gateway or a ShadyTel-provided SIP handoff.

## Roles

- OmniTel: bootstrapped peer exchange and SIP trunk simulator.
- OMNIDAT: owns Packet Clearing, X.25/X.121 service routing, NOC, and terminal applications.
- ShadyTel: eventual event carrier peer for POTS, T1, PRI, and camp telephone plant.
- VeriFone simulator: repeatable software terminal client for bench tests before real terminals arrive.

## SIP Layout

```text
VeriFone simulator or real terminal
  -> USB modem / analog adapter / soft endpoint
  -> Raspberry Pi Asterisk
  -> PJSIP omnitel-lab peer
  -> OMNIDAT inbound context
  -> PAD or terminal service route
```

The lab PJSIP profile is `omnitel-lab` with contact `sip:127.0.0.1:5063`. The ShadyTel placeholder profile remains `shadytel-lab` with contact `sip:127.0.0.1:5062`.

## Terminal Service Block

```text
8810  POS authorization and settlement to X.121 311088002010
8811  ZONTALK / TCLOAD terminal updates to X.121 311088002020
8812  Nightmarkt directory to X.121 311088010110
8813  Miliways food order and line status to X.121 311088020501
8814  Activity passport and merit badge stamps to X.121 311088030021
```

## Raspberry Pi Setup

1. Install Raspberry Pi OS Lite.
2. Install Asterisk with PJSIP support.
3. Copy `configs/asterisk/pjsip-omnidat-lab.conf` into the Asterisk PJSIP include path.
4. Copy `configs/asterisk/extensions-omnidat.conf` into the dialplan include path.
5. Reload PJSIP and dialplan from the Asterisk console.
6. Attach the USB modem bank or FXS adapters and label each port.
7. Map the first terminal test line to `8810`.
8. Map update, directory, food, and passport test lines to `8811`, `8812`, `8813`, and `8814`.

## Bench Test

Run the VeriFone simulator from the OMNIDAT repo:

```sh
./scripts/verifone-sim sale 12.50 SBQR-TEST-0001
./scripts/verifone-sim --terminal VF-FIELD-01 directory miliways
./scripts/verifone-sim --terminal VF-FOOD-01 food PASS-04271 tea --quantity 2
./scripts/verifone-sim --terminal VF-PASS-01 passport PASS-04271 "CALL TEST LOOP"
./scripts/verifone-sim update OMNIDAT.DTZ
```

For a visual bench display, launch the TUI:

```sh
./scripts/verifone-tui
```

For screenshots, docs, or non-interactive checks, render one deterministic
screen:

```sh
./scripts/verifone-tui --demo sale
./scripts/verifone-tui --demo food
```

To verify terminal-to-bank settlement without the real ShadyBank database
stack, run the fake OmniBank end-to-end harness:

```sh
./scripts/e2e-omnibank
```

This uses the ShadyBank merchant API shape from
`/Volumes/dev/shady/shadybank/src/apiserver.py`, but writes to local JSONL
ledgers under `build/e2e-omnibank`.

The harness fails if any required evidence is missing. A passing run writes:

- `build/e2e-omnibank/report.json`
- `build/e2e-omnibank/events.jsonl`
- `build/e2e-omnibank/terminal-checks.jsonl`
- `build/e2e-omnibank/omnibank-ledger.jsonl`

The report must show `status: passed`, terminal events
`terminal.dialed`, `session.started`, `session.ended`, `terminal.receipt`,
bank ledger events `omnibank.authorized`, `omnibank.captured`, and adjacent
terminal checks for directory, food, passport, and update programs.

For a larger operating rehearsal, run:

```sh
./scripts/weekend-sim
```

That creates `build/weekend-sim/weekend-report.json` for a 1,000-camper camp
weekend. It seeds distinct OmniAuth camper identities, OmniBucks balances,
merchant OmniBank settlement accounts, two Night Market nights, four Miliways
meal windows, campsite X.121 provisioning checks, and historical OMNIDAT
deployment records. ShadyBucks conversion is represented as a future 2028
bridge ledger rather than the authoritative balance source.

Expected sale behavior:

```text
DIAL 8810
CONNECT 2400
X121 311088002010
OMNIBANK POST /api/authorize
OMNIBANK POST /api/capture
CAPTURED
```

Expected directory behavior:

```text
DIAL 8812
CONNECT 2400
DIR|311088010110|miliways
COMPLETE
```

Expected food order behavior:

```text
DIAL 8813
CONNECT 2400
ORDER.CREATE|311088020501|PASS-04271|tea|2
TICKET MLY-000001
```

Expected passport behavior:

```text
DIAL 8814
CONNECT 2400
STAMP|311088030021|PASS-04271|CALL TEST LOOP
CLEARED
```

Expected update behavior:

```text
DIAL 8811
CONNECT 2400
APP.UPDATE|311088002020|OMNIDAT.DTZ
DOWNLOAD READY
```

## USB Modem Notes

- Keep each USB modem on a stable powered hub.
- Label physical ports with Asterisk endpoint names and dial numbers.
- Use one known-good modem for `8810` before expanding the bank.
- Capture terminal audio/modem failures as line faults until a clean line test proves otherwise.
- After a clean line test, escalate application or X.25 failures to OMNIDAT NOC.

## Turn-Up Checklist

1. `pjsip show endpoints` lists `omnitel-lab`.
2. Calls to `8810`, `8811`, `8812`, `8813`, and `8814` enter `omnidat-inbound`.
3. The VeriFone simulator emits `terminal.dialed`, `session.started`, `session.ended`, and `terminal.receipt` for a sale.
4. A real or simulated terminal sees `CONNECT 2400`.
5. OMNIDAT NOC can distinguish ShadyTel carrier issues from OmniTel lab issues.
