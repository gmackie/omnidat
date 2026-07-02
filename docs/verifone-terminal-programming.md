# Verifone Terminal Programming Plan

OMNIDAT should treat vintage POS terminals as field appliances on the X.25
network, not as browsers with a novelty skin. The target v1 is a TCL-era
VeriFone sale program that dials a ShadyTel access number, reaches the OMNIDAT
front-end processor at X.121 `311088002010`, and lets OMNIDAT settle through
ShadyBank without placing merchant bearer tokens on the terminal.

## Verified Source Basis

- VeriFone TCL Terminal Control Language Programmer's Manual, part 00368:
  `https://cybarcode.com/sites/cy/files/manuals/verifone/tranz_330_tcl_program_guide.pdf`
  - OCR verified that PNC 330, XL, TRANZ 330, and TRANZ 380 are TCL dial
    terminals with internal modems.
  - OCR verified that TCL controls terminal operations, cardreader/keypad
    input, host communication, prompts, and application flow.
  - OCR verified that the Tranz 330/380 family supports auto-answer behavior
    and host-initiated communication paths.
- TCLOAD Reference Manual:
  `https://www.gbppr.net/2600/tranz_330_tcl_load_guide.pdf`
  - Search metadata and manual title identify TCLOAD as the VeriFone load path
    for TCL terminal files.
- Omni 3200 Reference Manual:
  `https://www.possupply.com/sca/pdf/Verifone/verifone-omni-3200-reference-manual.pdf`
  - Text extraction verified direct downloads, telephone downloads, ZONTALK,
    VeriTalk, SRAM application storage, remote diagnostics, terminal ID/SRAM
    display, password-controlled system mode, and modem-based download flows.
- ShadyBank source:
  `/Volumes/dev/shady/shadybank/src/apiserver.py`
  - Merchant APIs are bearer-authenticated form posts:
    `/api/authorize`, `/api/capture`, `/api/void`, `/api/reverse`,
    `/api/credit`.
  - Payment inputs include track 1/2 magstripe data, PAN plus OTP/SHOTP, and
    NFC token flows.

## Terminal Families

The primary hardware path is `TRANZ_330_380_TCL`.

- Runtime: VeriFone TCL.
- Models: TRANZ 330 and TRANZ 380.
- Capabilities to use: track 1/2 cardreader, keypad amount entry, clerk code
  entry, internal POTS modem, display prompts, receipt printing, TCLOAD direct
  download, and ZONTALK telephone download where supported.
- Historical fit: highest. These are exactly the kind of dial POS terminals
  that should make OMNIDAT feel like a packet-era business network.

The fallback hardware path is `OMNI_3200_ZONTALK`.

- Runtime: Omni application in SRAM.
- Models: Omni 3200 and adjacent Omni family terminals we can acquire.
- Capabilities to use: direct or telephone application download, ZONTALK or
  VeriTalk tooling, system-mode diagnostics, and modem access.
- Historical fit: good, but this is the newer fallback when the acquired
  hardware is not actually TCL-capable.

## OMNIDAT Host Model

Terminals should not connect directly to ShadyBank. They should connect to an
OMNIDAT FEP that speaks the vintage terminal protocol on one side and ShadyBank
HTTP on the other.

```
TRANZ 330/380
  POTS dial 8810
  ShadyTel carrier plant
  OMNIDAT FEP
  X.121 311088002010
  ShadyBank merchant API
```

The FEP owns:

- terminal profile lookup
- merchant account binding
- fee policy
- ISO 8583 transcript/audit wrapping
- ShadyBank bearer token custody
- redaction of PAN/track data from OMNIDAT logs
- receipt and batch numbering

## Program Pack

### Sale

Terminal program name: `OMNIDAT SALE`

Pseudo TCL flow:

```text
DISPLAY "OMNIDAT SALE"
INPUT AMOUNT
INPUT CLERK
READ CARD TRACK2
DIAL 8810
SEND POS.SALE
PRINT RECEIPT
```

Host message:

```text
POS.SALE|terminalId|clerkCode|amount|track2|noteSerial|retrievalReference
```

FEP action:

- Validate terminal profile and merchant account.
- Apply the configured OMNIDAT network fee policy.
- Post ShadyBank `/api/authorize`.
- If approved, post ShadyBank `/api/capture`.
- Return response code, auth code, and receipt fields.

### Refund

Terminal program name: `OMNIDAT REFUND`

```text
DISPLAY "OMNIDAT REFUND"
INPUT AUTHCODE
DIAL 8810
SEND POS.REFUND
PRINT RECEIPT
```

FEP action:

- Validate merchant/terminal/batch ownership.
- Post ShadyBank `/api/reverse`.
- Print linked reversal receipt.

### Credit

Terminal program name: `OMNIDAT CREDIT`

```text
DISPLAY "OMNIDAT CREDIT"
INPUT AMOUNT
READ CARD TRACK2
DIAL 8810
SEND POS.CREDIT
PRINT RECEIPT
```

FEP action:

- Validate that the merchant is allowed to issue credit.
- Post ShadyBank `/api/credit`.
- Print credit receipt.

### Batch Close

Terminal program name: `OMNIDAT CLOSE`

```text
DISPLAY "CLOSE BATCH"
INPUT CLERK
DIAL 8810
SEND POS.CLOSE-BATCH
PRINT TOTALS
```

FEP action:

- Summarize approved sale, credit, refund, and fee ledger entries.
- Compare pending ShadyBank authorizations.
- Print operator totals and retain the NOC/audit copy.

## Deployment Runbook

1. Enroll the physical terminal in OMNIDAT and bind it to a ShadyBucks merchant
   account.
2. Assign terminal ID, origin X.121, fee policy, and allowed programs.
3. Bench-load the TRANZ 330/380 program using TCLOAD direct download.
4. Configure host dial number `8810`, host X.121 `311088002010`, and terminal
   ID memory/config records.
5. Use ZONTALK telephone download for field updates after the terminal is
   reachable over the ShadyTel plant.
6. Run a `0.01 SHDY` sale against a test ShadyBank account.
7. Verify the OMNIDAT receipt, ShadyBank auth/capture, fee ledger entry, and
   NOC audit event all reference the same retrieval reference.

## Open Lab Work

- Extract exact TCL command syntax from the scanned programmer manual pages
  for display, input, cardreader, communication, and print commands.
- Acquire or borrow a known-unlocked TRANZ 330/380 and record the system
  password state before wiping or downloading.
- Build a bench cable inventory for TCLOAD direct download.
- Decide whether ShadyTel extension `8810` terminates as modem audio, a modem
  bank, or an emulator during early lab bring-up.
- Add a hardware-in-loop verifier that runs sale, refund, credit, and batch
  close against a ShadyBank test merchant account.
