# Integration Map

This map defines the boundaries between OMNIDAT subsystems. Each integration
should be testable with one subsystem replaced by a simulator.

## System Context

```text
ShadyTel
  |
  | PRI / SIP test trunk
  v
PBX
  |-- IVR / intercept
  |-- operator phones
  |-- modem pool
  |-- PAD gateways
  |-- Shadybucks ATM/POS carrier circuits
  |-- NiteMarkt BOH/WMS circuits
  |-- fax
  |-- ShadyRoulette
  '-- Media Vault request line

BBS / Packet Clearing / Document Services / Media Vault
  |
  | events + commands
  v
OMNIDAT core records and operator console
```

## Field Office Network Context

The portable Field Office adds campsite apps and radio access without changing
the Packet Clearing authority model. Every transport enters through an access
gateway and resolves to the same packet address space.

```text
MeshCore / Meshtastic / Wi-Fi / POTS / terminal / hosted node
        |
        v
OMNIDAT access gateway
        |
        v
Packet Clearing address space
        |
        +--> OMNIDAT core services
        +--> open campsite apps
        +--> approved village services
        +--> event operations
        '-- merchant carrier services
```

See [Field Office Network Plan](field-office-network-plan.md).

## Integration Contracts

| Producer | Consumer | Contract | Purpose |
|---|---|---|---|
| PBX | core records | `CallRecord` | Call accounting and operator view |
| modem pool | BBS | serial/data session | BBS access |
| modem pool | core records | `SessionRecord` | Usage accounting |
| PAD | Packet services | terminal session | X.25-style access |
| Packet services | Media Vault | `MediaRequest` | Queue tape playback |
| POS terminal | Shadybucks | ShadyPay typed verbs | Authorize/capture/void/reverse |
| merchant proxy | Shadybucks | ShadyPay proxy backend | Token-bearing payer checkout proxy |
| ATM terminal | Shadybucks | ATM transaction session | Cash/card terminal access |
| NiteMarkt WMS | Packet services | terminal/business session | Inventory and back-office operations |
| BBS | Media Vault | `MediaRequest` | Queue tape playback |
| Media Vault | video overlay | now-playing state | TV metadata |
| Media Vault | Document Services | `PrintJob` | Load tickets and fault slips |
| fax server | Document Services | `FaxRecord` | Received request tracking |
| Document Services | printer | print job payload | Receipts and logs |
| operator console | PBX | maintenance flags | Service enable/disable |
| operator console | Media Vault | commands | Approve, pause, recover |
| Radio PAD gateway | Packet services | compact PAD command | MeshCore/Meshtastic field access |
| Wi-Fi access gateway | Packet services | terminal/PAD session | Local campsite and hosted terminal access |
| campsite app host | Packet services | subscriber app request | Hosted or remote campsite service |
| Packet services | activity ledger | `ActivityRecord` | Passport and merit badge logging |

## Event Bus

V1 uses append-only JSONL files as the event bus. A later version can replace
this with MQTT, NATS, Redis streams, or another broker.

The important constraint is that every event is printable and inspectable.

Example event:

```json
{
  "event_id": "EVT-20280701-000931",
  "type": "media.request.created",
  "source": "packet-clearing",
  "created_at": "2028-07-01T10:20:31-07:00",
  "payload": {
    "request_id": "VAULT-000064",
    "tape_id": "PUB-0007",
    "account_id": "ACCT-000128"
  }
}
```

Current tooling:

```sh
./scripts/events append call.ended pbx --payload '{"called":"8800","disposition":"answered"}'
./scripts/events summary --output build/daily-summary.txt
```

## Core Flows

### BBS Dial-In

```text
caller dials 8802
  -> PBX hunts free modem
  -> modem answers
  -> BBS session starts
  -> SessionRecord opens
  -> user disconnects
  -> SessionRecord closes
  -> optional receipt prints
```

### Packet Directory

```text
caller dials 8810
  -> PBX hunts free PAD endpoint
  -> PAD prompt appears
  -> user CALLs 000001
  -> Packet Directory session opens
  -> service list is shown
```

### Shadybucks POS Authorization

```text
merchant POS connects over OMNIDAT
  -> terminal authenticates to assigned carrier circuit
  -> POS uses ShadyPay directGateway or merchant proxy path
  -> Shadybucks authorizes purchase/preauth
  -> capture/void/reverse events are logged by merchant system
  -> OMNIDAT records carrier session and terminal status
```

### NiteMarkt BOH/WMS

```text
NiteMarkt BOH terminal connects to Packet Clearing
  -> CALL 000020 for WMS
  -> operator performs receiving/stock/register close
  -> settlement or exception report prints through Document Services
  -> OMNIDAT records terminal session and print job
```

### Media Request

```text
user browses catalog by BBS/PAD/phone/operator
  -> request is submitted
  -> request enters submitted state
  -> operator approves
  -> Media Vault queue loads tape
  -> video overlay updates now-playing
  -> load ticket prints
```

### Fax Request

```text
fax arrives on 8818
  -> fax machine prints received form
  -> optional fax server records metadata
  -> operator enters request into console
  -> receipt or rejection prints
```

### Service Maintenance

```text
operator marks 8810 maintenance
  -> PBX route changes to maintenance intercept
  -> status board updates
  -> calls receive explicit maintenance message
  -> existing sessions are left alone or cleared by operator
```

## Simulator Requirements

Before hardware is available, each boundary should have a simulator:

| Real System | Simulator |
|---|---|
| ShadyTel PRI | SIP trunk from softphone or second Asterisk |
| Modems | local TCP/PTY terminal sessions |
| PAD/X.25 | terminal-faithful CLI |
| Fax | watched folder with fake received fax metadata |
| Printer | text file spool directory |
| Media Vault robot | state-machine simulator |
| Video output | generated slate PNG/video feed |

Simulators should emit the same records as real systems wherever possible.
