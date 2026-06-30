# OMNIDAT Packet Clearing

## Goal

Packet Clearing is the data side of OMNIDAT: X.25, PAD access, terminal
sessions, business-data applications, and fake-but-consistent financial records.
The PBX provides dialable access; Packet Clearing provides the packet network
experience.

## Access Paths

```text
PBX 8810 main PAD hunt group
PBX 8811 authenticated PAD
PBX 8812 public guest PAD
PBX 8813 X.25 directory
PBX 8822 direct PAD line 1
PBX 8823 direct PAD line 2

Serial terminal stations
Terminal servers
Modem pool
Operator console
```

## Service Model

V1 should expose a small, coherent set of hosts:

```text
000001  OMNIDAT DIRECTORY
000002  ACCOUNT INQUIRY
000003  SETTLEMENT QUEUE
000004  MEDIA VAULT CATALOG
000005  DOCUMENT SERVICES
000006  OPERATOR MESSAGES
000010  SHADYBUCKS ATM SWITCH
000011  SHADYBUCKS POS AUTHORIZATION
000012  MERCHANT PROXY REGISTRY
000013  SETTLEMENT BATCH SERVICE
000014  TERMINAL MANAGEMENT
000020  NITEMARKT BOH WMS
000021  NITEMARKT RECEIVING
000022  NITEMARKT STOCK COUNT
000030  VENDOR SERVICES DIRECTORY
000031  VENDOR POS PROVISIONING
000099  TEST LOOP
```

## Address Namespaces

Packet Clearing should reserve address ranges so OMNIDAT can mix core
infrastructure, trusted partners, open campsite apps, and event operations
without making every service look equally official.

```text
000xxx  OMNIDAT core services
001xxx  ShadyTel and trusted carrier interconnect services
002xxx  Shadybucks, NiteMarkt, merchant, and settlement services
010xxx  Approved village/campsite service nodes
020xxx  Open campsite packet applications
030xxx  Temporary event, dispatch, passport, and quest services
090xxx  Test, loopback, diagnostics, and training
```

The `020xxx` namespace is intentionally self-service. Campsites can create
packet applications and receive provisional addresses through the web intake.
Operator review can promote a service into the approved directory, but
provisional services should still be reachable.

The detailed namespace, transport, provisioning, and routing plan lives in
[Field Office Network Plan](field-office-network-plan.md).

Examples:

```text
020184  CAMP LAMINAR ROOT
020185  CAMP LAMINAR LOST PROPERTY
020500  MILIWAYS MENU STATUS
020501  MILIWAYS ORDER ENTRY
030010  FIELD DISPATCH QUEUE
030021  PASSPORT LOG ENTRY
```

The addresses can be real X.25 addresses, emulated X.25-style addresses, or a
transition format while hardware choices are unresolved. The user-facing
experience should preserve packet-network behavior: connect, clear, directory,
session accounting, and terse terminal output.

## Radio PAD Access

MeshCore and Meshtastic should provide low-bandwidth PAD emulation. They send
short commands to a Radio PAD Gateway, which turns them into Packet Clearing
service calls and returns compact terminal output.

```text
DIR
CALL 000001
CALL 020184
MSG 000006 ARRIVED AT NITEMARKT
REQ 020500 MENU
STAT 020502 TKT-00482
CLR
HELP
```

The radio layer should be transactional rather than a full chatty terminal
session. Packet Clearing remains authoritative for account state, directory
state, activity records, queues, receipts, and service logs.

## Terminal UX

The PAD prompt should be terse and official:

```text
OMNIDAT PACKET CLEARING
AUTHORIZED TERMINAL SERVICE

PAD> CALL 000001
```

The current simulator exposes the same behavior as command-line operations:

```sh
./scripts/packet directory
./scripts/packet call 000001
./scripts/packet --account ACCT-000001 call 000002
```

Guest accounts can call `PUBLIC` services. Registered-only services require an
account with at least `REGISTERED` access.

Directory entries should look operational, not whimsical:

```text
ADDR    SERVICE                 CLASS
000001  DIRECTORY               PUBLIC
000002  ACCOUNT INQUIRY         REGISTERED
000003  SETTLEMENT QUEUE        REGISTERED
000004  MEDIA VAULT CATALOG     PUBLIC
000005  DOCUMENT SERVICES       PUBLIC
000099  TEST LOOP               PUBLIC
```

## Real vs Emulated X.25

There are three acceptable implementation tiers:

1. **Real hardware/protocol**: routers, PADs, and X.25-capable interfaces.
2. **XOT or IP-backed X.25**: packet semantics over a modern network.
3. **Terminal-faithful emulation**: PAD-like session manager with X.25-inspired
   addressing while real hardware is staged later.

V1 should keep the UI and service contracts independent of the transport so the
installation can move up the authenticity ladder without rewriting every app.

## Integrations

- BBS can publish account notices and Media Vault status.
- Document Services can print packet-session receipts.
- Media Vault catalog can be browsed and queued from a PAD session.
- PBX call records can be exposed as daily settlement files.
- Packet Clearing simulator emits `session.started` and `session.ended` events
  to the OMNIDAT event ledger.
