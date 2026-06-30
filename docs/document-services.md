# OMNIDAT Document Services

## Goal

Document Services makes OMNIDAT feel like a working business network. It owns
fax receive, fax request forms, dot matrix printing, account cards, receipts,
operator logs, and hard-copy artifacts.

## Hardware

V1 hardware:

- One physical fax machine on an analog PBX port.
- One networked dot matrix printer.
- One operator workstation.
- Optional fax server/capture path.
- Optional flatbed scanner for received forms.

## Phone Services

```text
8818  fax receive
8819  operator / print desk / trouble line
```

The fax machine should be directly dialable from ShadyTel. If a fax server is
added, it can archive incoming faxes, generate thumbnails for the operator, and
optionally forward selected documents to the print queue.

The current fax simulator records inbound fax metadata under `build/fax/`:

```sh
./scripts/documents fax --pages 2 --caller ShadyTel:1234 --operator MG
```

## Print Queues

Recommended print queues:

```text
forms        blank request forms and account cards
receipts     BBS, PAD, modem, and media-vault receipts
logs         operator and PBX daily logs
vault        Media Vault load tickets and fault slips
settlement   fake financial batch reports
```

The current spooler implements these queues as plain text files under
`build/spool/`:

```sh
./scripts/documents print receipts "PAD SESSION RECEIPT" --body "SESSION COMPLETE"
./scripts/documents list
```

## Artifact Types

- Exchange 88 directory.
- OMNIDAT account card.
- PAD session receipt.
- BBS registration slip.
- Media Vault request form.
- Media Vault load ticket.
- Fax cover sheet.
- Daily settlement report.
- Operator incident report.

## Operator Flow

```text
fax arrives or terminal user submits request
      |
operator reviews queue
      |
request is approved, rejected, or sent to service
      |
dot matrix receipt/log is printed
      |
request status is visible from BBS/X.25/TrustDesk
```

The simulator emits `print.printed` and `fax.received` events into the OMNIDAT
event ledger.

## Tone

Printed material should be plain and bureaucratic. Prefer all-caps labels,
fixed-width fields, timestamps, operator initials, and sequence numbers.

Example receipt header:

```text
OMNIDAT DOCUMENT SERVICES
A GMACKO CORPORATION
EXCHANGE 88 / FORM DS-104

REQUEST NO: 000128
STATUS: PENDING OPERATOR REVIEW
```
