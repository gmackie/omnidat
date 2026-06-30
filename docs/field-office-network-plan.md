# Field Office Network Plan

## Goal

The OMNIDAT Field Office network lets a campsite, village, vendor, or event
service become reachable on the OMNIDAT Packet Clearing address space. The
network should feel like a historical packet-data carrier: addresses,
directories, service orders, demarcation points, access circuits, terminal
sessions, accounting records, trouble tickets, and printed receipts.

The core promise is simple:

```text
Every campsite can obtain a packet address.
Every packet address can be reached through one or more access paths.
Packet Clearing remains the authoritative network.
```

## Design Principles

- **X.25 first**: Packet Clearing is the network identity and routing layer.
- **Transport neutral**: LoRa, Wi-Fi, POTS, hosted terminals, and PBX access are
  attachment methods, not separate application networks.
- **Self-service where possible**: open campsite apps can receive provisional
  addresses without manual operator database edits.
- **Operator controlled where needed**: official directories, trusted carrier
  services, merchant circuits, and incident states remain operator-governed.
- **Paper-visible**: address assignments, demarc sheets, queue tickets, activity
  receipts, and trouble reports must be printable.
- **Old-digital, not web-native**: the web is for intake and administration; the
  participant experience should prefer terminals, PAD commands, printed forms,
  receipts, and terse service output.

## Logical Network

Packet Clearing owns the logical service address. Each address maps to a
service record, owner, namespace, access policy, status, and one or more
transports.

```text
participant or campsite
        |
        | terminal, modem, Wi-Fi, radio PAD, hosted admin
        v
access gateway
        |
        v
Packet Clearing router
        |
        +--> OMNIDAT core services
        +--> hosted campsite app
        +--> remote campsite app
        +--> event operations app
        +--> merchant/carrier service
```

The Packet Clearing router can be terminal-faithful emulation at first. It must
preserve the contracts that would matter if the network later moves toward XOT
or real X.25 hardware: `CALL`, connected service, clear reason, session record,
account/passport identity, and printable transaction log.

## Address Plan

| Range | Name | Owner | Provisioning | Notes |
|---:|---|---|---|---|
| `000000-000099` | OMNIDAT core | OMNIDAT | Manual | Directory, accounts, operator messages, documents, Media Vault |
| `000100-000999` | OMNIDAT expansion | OMNIDAT | Manual | Future internal services |
| `001000-001999` | carrier partners | OMNIDAT/ShadyTel | Manual approval | ShadyTel, interconnect, exchange tests |
| `002000-002999` | merchant carrier | OMNIDAT/Shadybucks | Manual approval | POS, ATM, NiteMarkt, settlement, vendor circuits |
| `010000-019999` | approved villages | OMNIDAT + village owner | Operator promoted | Reviewed village/campsite services |
| `020000-029999` | open campsite apps | Campsite owner | Self-service | Provisional apps, default landing zone |
| `030000-039999` | event operations | OMNIDAT/event ops | Operator or template | Dispatch, activity passport, temporary queues |
| `090000-090999` | diagnostics | OMNIDAT | Manual | Echo, loopback, training, test services |

The UI can shorten six-digit addresses to three-digit groups where convenient,
but records should store the canonical six-digit address. Existing `000001`
style services remain valid aliases for core services.

## Service Classes

| Class | Meaning |
|---|---|
| `CORE` | OMNIDAT-owned infrastructure |
| `CARRIER` | ShadyTel or carrier interconnect service |
| `MERCHANT` | Shadybucks, NiteMarkt, vendor, POS, ATM, settlement service |
| `APPROVED` | Reviewed campsite or village service |
| `OPEN` | Self-service campsite application |
| `EVENT` | Temporary event operations, dispatch, passport, queue, or puzzle service |
| `TEST` | Diagnostics and training |

## Access Classes

| Class | Meaning |
|---|---|
| `PUBLIC` | Anyone can call the service |
| `PASSPORT` | Requires a passport ID or handle account |
| `REGISTERED` | Requires an OMNIDAT account |
| `OWNER` | Requires campsite/vendor app-owner credentials |
| `OPERATOR` | Operator desk only |
| `MAINTENANCE` | Recovery, diagnostics, and break-glass access |

Access class is independent from namespace. An `OPEN` campsite app can still
have an owner-only admin function. A `CORE` directory service can still be
public.

## Transports

### PAD / Terminal

The preferred rich experience. A user reaches `PAD>` from a serial terminal,
terminal server, local console, hosted web terminal, modem, or PBX PAD hunt
group. It supports interactive directory browsing, service calls, forms, and
receipts.

### POTS / ShadyTel / Modem

The historical access path. A caller dials Exchange 88, reaches a modem/PAD
line, then calls packet services. This path is capacity-limited but carries the
strongest old-network feel.

### Wi-Fi / TCP

The practical campsite access path. A campsite or participant device opens a
local terminal page, telnet-like endpoint, SSH-style shell, or app admin page
that calls the same Packet Clearing services.

### MeshCore

The managed radio field network. OMNIDAT should own the baseline MeshCore
loaners, fixed repeaters, and room-server/gateway nodes. MeshCore should carry
short Radio PAD commands, dispatches, queue notices, and field confirmations.

### Meshtastic

The BYO guest radio path. It should expose the same Radio PAD grammar where
practical, with stricter rate limits and smaller responses. Meshtastic is guest
ingress, not the authoritative OMNIDAT network.

### Hosted Node

The lowest-friction campsite path. OMNIDAT hosts the app template, address,
directory record, and admin interface. The campsite only needs a web signup and
printed address card.

### Remote Node

A campsite hosts its own service on a local device. OMNIDAT assigns the address
and transport credentials, then proxies or routes to the remote app through
Wi-Fi/TCP, POTS, or a future XOT/real-X.25 gateway.

## Reference Topologies

### Laptop Field Office

```text
operator laptop / mini PC
  |-- Packet Clearing
  |-- campsite app host
  |-- activity ledger
  |-- print spool
  |-- Wi-Fi AP
  |-- MeshCore gateway
  '-- optional Meshtastic gateway
```

Use this for a small hackercamp, Vibecamp-adjacent event, tabletop demo, or
early ToorCamp proof.

### Campsite Hosted App

```text
campsite admin uses web intake
        |
        v
OMNIDAT issues 020xxx address
        |
        v
hosted app template runs on OMNIDAT
        |
        v
visible through directory, PAD, Radio PAD, and print artifacts
```

This should be the default path for most campsites.

### Campsite Remote App

```text
campsite mini host / laptop
        |
        | Wi-Fi/TCP, POTS, or future XOT
        v
OMNIDAT access gateway
        |
        v
Packet Clearing address 020xxx or 010xxx
```

The campsite owns its app runtime. OMNIDAT owns address assignment, directory
status, access policy, session records, and trouble ticketing.

### Full ToorCamp Carrier

```text
ShadyTel PRI
  |
PBX / Exchange 88
  |-- modem pool
  |-- PAD hunt group
  |-- operator desk
  |-- fax/document services
  '-- Media Vault request lines

Packet Clearing
  |-- OMNIDAT core
  |-- campsite app namespaces
  |-- Shadybucks merchant circuits
  |-- event operations
  '-- activity clearing
```

The Field Office model should not depend on the full carrier buildout. ToorCamp
adds PBX/modem/PAD richness and spectacle.

## Provisioning Flow

### Open Campsite App

1. Campsite submits a service order through the intake page.
2. System allocates a `020xxx` address or small range.
3. System creates a provisional directory record.
4. Campsite selects an app template.
5. System creates owner credentials.
6. System renders an address assignment letter.
7. System renders a quick-start card for PAD and Radio PAD access.
8. Operator can later approve, suspend, rename, or promote the service.

### Approved Village Service

1. Village proves the service is useful or official enough for the public
   directory.
2. Operator reviews owner contact, app behavior, and access class.
3. Operator promotes the record from `020xxx` to `010xxx` or creates a
   forwarding alias.
4. New directory listing and service certificate print.
5. Old address can remain as an alias until the end of the event.

### Merchant / Shadybucks Circuit

1. Vendor or Shadybucks team requests a trusted circuit.
2. Operator assigns `002xxx` service address and carrier circuit.
3. Terminal, proxy, POS, ATM, or BOH system receives a terminal ID.
4. Token and ledger authority remain with Shadybucks.
5. OMNIDAT logs carrier access and terminal status only.

## Routing Rules

- Directory lookup returns only services visible to the caller's access class.
- `CALL <address>` opens a session record even for failed access.
- Missing address returns `CLR 01 NO SUCH ADDRESS`.
- Suspended service returns `CLR 05 SERVICE SUSPENDED`.
- Maintenance service returns `CLR 09 MAINTENANCE`.
- Busy queue-capacity returns `CLR 11 SERVICE BUSY`.
- Radio PAD commands are single transaction calls unless explicitly continued.
- Hosted apps receive a synthetic terminal/session identity.
- Remote apps receive only the fields needed to serve the request.
- Every session has a clear reason.

## Radio PAD Grammar

Radio PAD is intentionally smaller than terminal PAD.

```text
HELP
DIR
DIR <namespace>
CALL <address>
MSG <address> <text>
REQ <address> <verb> [args]
STAT <address> [ticket]
ACT <passport> <code>
CLR
```

Response format:

```text
OMNIDAT FIELD PAD
SESS R-001284
ADDR 020502 MILIWAYS QUEUE
TKT MLY-00482
POS 17
EST 18 MIN
CLR 00
```

Design limits:

- responses should fit in a few short radio messages
- no large menus over radio
- no rich forms over radio
- no expectation of native MeshCore-to-Meshtastic DMs
- commands must be idempotent or return a receipt number

## Capacity Planning

### Small Field Office

| Resource | Target |
|---|---:|
| Hosted campsite apps | 10-25 |
| Simultaneous terminal/PAD users | 2-5 |
| MeshCore loaner devices | 2-4 |
| Fixed radio gateways | 1 |
| Meshtastic gateway | 0-1 |
| Printer | 1 |

### Village Field Office

| Resource | Target |
|---|---:|
| Hosted campsite apps | 50-100 |
| Simultaneous terminal/PAD users | 5-12 |
| MeshCore loaner devices | 4-8 |
| Fixed MeshCore repeaters/gateways | 2-3 |
| Meshtastic gateways | 1 |
| Printers | 1-2 |
| Operator stations | 1-2 |

### Full ToorCamp Buildout

| Resource | Target |
|---|---:|
| Hosted or remote campsite apps | 100+ |
| Simultaneous PAD/modem sessions | 8-16 |
| PRI channels | up to 23 shared |
| Physical terminal stations | 4-8 |
| MeshCore loaner devices | 8-20 |
| Fixed radio gateways/repeaters | 3-6 |
| Dot matrix/document printers | 2+ |
| Operator stations | 2+ |

## Operations

### Daily Opening

- Start Packet Clearing and app host.
- Verify directory service.
- Verify `000099` test loop.
- Place one terminal/PAD test call.
- Send one MeshCore Radio PAD `DIR` command.
- Send one Meshtastic Radio PAD `DIR` command if enabled.
- Print service availability sheet.
- Confirm printer, paper, labels, and passport forms.
- Mark unavailable transports in the directory.

### During Event

- Watch active sessions and stuck calls.
- Review provisional app names and directory descriptions.
- Promote useful apps to approved status when appropriate.
- Suspend abusive, broken, or confusing services.
- Print daily packet/session summary.
- Keep paper address cards stocked.
- Log transport incidents separately from app incidents.

### Daily Closing

- Stop new print-heavy jobs.
- Export event log.
- Print summary and incident sheet.
- Back up app records and activity records.
- Mark hosted services unavailable if the system will be powered down.

## Failure Modes

| Failure | Behavior |
|---|---|
| Packet Clearing down | All transports return maintenance or visible signage; preserve logs |
| Web intake down | Operator can issue addresses manually from paper forms |
| Printer down | Continue service, queue print jobs, stamp handwritten receipts |
| MeshCore gateway down | Radio PAD disabled; terminal/PAD/Wi-Fi remain authoritative |
| Meshtastic gateway noisy | Disable guest ingress; MeshCore/terminal remain available |
| Remote campsite app down | Directory marks service degraded or suspended |
| Open namespace abuse | Suspend address, preserve event log, print incident ticket |
| Address collision | New service order fails; operator resolves before publication |

## Security and Privacy

- Activity logging must be explicit and receipt-based.
- Passport IDs can remain pseudonymous.
- Named accounts are only required for ownership, admin, recovery, merchant, or
  higher-trust operations.
- Radio gateways should not expose app-owner admin commands.
- Remote apps should not receive more identity data than required.
- Operator actions should produce event records.
- Abusive apps should be suspendable without deleting history.

## V1 Network Slice

Build the first slice around:

- `000001` directory
- `000006` operator messages
- `020xxx` open campsite apps
- `030010` field dispatch queue
- `030021` passport log entry
- `090099` test loop
- one Miliways-style queue app
- one MeshCore Radio PAD gateway
- optional Meshtastic guest gateway
- one printer path

This is enough to prove that campsites can join the network, users can reach
apps over multiple transports, activities can be logged, and the system can
produce old-digital paperwork.

## Data to Add Next

The next implementation step should add seed data and validation for:

- packet namespaces
- transport profiles
- campsite app records
- activity passport records
- address assignment artifacts

Those records should be loaded into the same SQLite build path used by existing
OMNIDAT data so the directory, PAD simulator, and print artifacts share one
source of truth.
