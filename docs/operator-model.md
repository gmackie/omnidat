# Operator Model

## Goal

OMNIDAT needs a credible operations desk. Operators should be able to answer
TrustDesk calls, inspect PBX status, recover stuck modem/PAD ports, approve or
reject document/media requests, and keep the experience moving.

## Roles

### TrustDesk Operator

- Answers `8800` and `8819`.
- Provides directory help.
- Reads service status.
- Escalates stuck lines and Media Vault faults.
- Logs incidents.

### Packet Operator

- Watches PAD and modem pools.
- Clears stuck sessions.
- Maintains public directory entries.
- Helps users reach BBS, terminal, and X.25 services.

### Document Clerk

- Handles fax requests.
- Prints forms, receipts, and settlement reports.
- Maintains paper logs.
- Keeps account cards and directories stocked.

### Media Vault Operator

- Approves playback requests.
- Controls robot queue.
- Handles tape faults and manual recovery.
- Switches video sources and slates.

### ATV Control Operator

- Owns amateur television station operation.
- Approves content on the amateur RF path.
- Handles station identification and shutdown.

## Operator Console

The console should show:

- PRI status and active channel count.
- Active calls by dialed number.
- Hunt group occupancy.
- Modem/PAD availability.
- Fax status.
- Print queue.
- Media Vault state.
- TV now-playing and stream state.
- Open incidents.

The current command-line status board is:

```sh
./scripts/status
```

It reads the service map, event ledger, Media Vault simulator state, Document
Services spool, and fax records.

## Incident Classes

```text
TELCO     PRI, called digits, channel exhaustion
PBX       dial plan, endpoint, hunt group
DATA      modem, PAD, BBS, terminal service
DOC       fax, printer, form queue
MEDIA     robot, VCR, tape, video chain
ATV       amateur TV station chain
SAFETY    mechanical, electrical, crowd, emergency stop
```

## Daily Ritual

Opening:

- Verify PRI/trunk or simulator.
- Place test calls to `8800`, `8802`, `8805`, `8810`, `8818`.
- Print status sheet.
- Home Media Vault.
- Run TV slate.

Closing:

- Stop new Media Vault jobs.
- Print daily settlement and incident logs.
- Park robot.
- Archive call/service logs.
- Mark unavailable services in directory/status IVR.
