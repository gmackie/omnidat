# OMNIDAT POTS Verifone and Federated X.25 Network Plan

## Purpose

OMNIDAT should stand as its own packet-data carrier for camp networks, merchant
terminals, X.25 experiments, and recreational commerce. ShadyTel remains the
telephone company: POTS, dial tone, T1/PRI, phone numbers, modems, and line
plant. OMNIDAT owns Packet Clearing: X.25/XOT, X.121 addressing, PADs, service
directories, route advertisements, billing policies, terminal management,
settlement paths, and NOC visibility.

The immediate product path is a real vintage point-of-sale network: old Verifone
terminals dial over POTS, reach an OMNIDAT front-end processor, and transact
against ShadyBucks, bearer instruments, and event services through the OMNIDAT
X.25 network.

```text
ShadyTel
  POTS, PBX, T1/PRI, modem hunt groups, phone numbers, line operations

OMNIDAT
  PADs, X.25/XOT, X.121, routing, directory, billing, terminal bureau, NOC
```

## Network Boundary

OMNIDAT is not an app running on ShadyTel. OMNIDAT is the packet carrier that
uses ShadyTel as one access provider.

```text
Vintage Verifone / campsite host / ATM / food POS
        |
Access method:
  POTS dial-up via ShadyTel
  direct serial LAPB
  XOT over IP
  Wi-Fi PAD
  MeshCore or LoRa PAD
        |
OMNIDAT PAD / access concentrator
        |
OMNIDAT X.25 Packet Clearing
        |
Services:
  ShadyBucks
  bearer instruments
  campsite apps
  directory
  food ordering
  NOC
  billing
```

This keeps OMNIDAT useful outside ToorCamp. Other groups can run nodes, operate
their own packet exchanges, or peer with OMNIDAT without joining ShadyTel's phone
network.

## Addressing and Namespaces

OMNIDAT should make ownership and trust visible through X.121 ranges.

| Range | Namespace | Purpose |
|---:|---|---|
| `000xxx` | OMNIDAT core | Directory, PAD, terminal bureau, diagnostics |
| `001xxx` | OMNIDAT operations | NOC, operator consoles, interconnect desks |
| `002xxx` | Merchant and settlement | ShadyBucks, POS, ATM, bearer instruments, batch settlement |
| `010xxx` | Approved services | Reviewed event, village, and campsite services |
| `020xxx` | Open campsite services | Self-service campsite apps and provisional listings |
| `030xxx` | Registered nodes | Remote campsite or village OMNIDAT nodes |
| `040xxx` | Dial access | POTS concentrators, modem banks, terminal-origin addresses |
| `050xxx` | Radio access | MeshCore, LoRa, Meshtastic, packet-radio PADs |
| `080xxx` | Federated peers | Other packet exchanges and remote networks |
| `090xxx` | Test and quarantine | Loopback, diagnostics, training, suspended services |

The existing low-numbered service aliases can remain in the product UI, but
financial and terminal services should also be addressable under the `002xxx`
namespace when the real packet network is instantiated.

## Registered Nodes and Federated Peers

OMNIDAT supports two operator modes.

```text
Registered node
  A campsite, village, vendor, or operator runs an OMNIDAT node.
  It registers with the central exchange.
  OMNIDAT assigns X.121 space, credentials, route records, service entries,
  fee policy, and NOC visibility.

Federated peer
  Another group runs its own X.25 or X.25-like packet network.
  OMNIDAT peers with it through an interconnect agreement.
  Each side keeps its own namespace, policies, directory, and NOC.
```

V1 should make registered nodes fully operational. Federation should be present
as a first-class control-plane concept: peer records, route advertisements,
directory import/export, NOC status, and explicit clearing agreements. Financial
verbs must not cross a peer boundary unless a clearing agreement permits them.

```text
Directory visibility != financial trust
Route reachability != settlement authorization
Registered node != federated peer
```

## Directory Presentation

The directory supports both unified and visibly federated presentation.

```text
Native OMNIDAT listing
  Looks like a normal OMNIDAT service.
  Used when OMNIDAT vouches for operations, status, or support.

Federated listing
  Clearly shows the remote packet exchange.
  Used when another operator owns uptime, policy, billing, or service behavior.
```

Example directory session:

```text
CALL 000100
CONNECTED OMNIDAT DIRECTORY

002010  SHADYBUCKS POS AUTHORIZATION     OMNIDAT VERIFIED
010204  MILIWAYS FOOD ORDERS             TOORCAMP VILLAGE SERVICES
020887  CAMP LASERFICHE ACTIVITY LOG     OPEN CAMPSITE
080042  BLACKLODGE MESSAGE SWITCH        FEDERATED: BLACKLODGE PACKET EXCHANGE
080077  NULL ROUTE LIBRARY INDEX         FEDERATED: NULL ROUTE DATA BUREAU
```

Service records need at least:

```text
service_name
x121_address
owning_network
operator_id
presentation_mode: native | federated
trust_level: verified | registered | open | experimental | quarantined
financial_clearance: none | inquiry | authorization | settlement
route_status: reachable | degraded | suspended
published_verbs
input_schema
output_schema
fee_policy_id
```

## Service Publication

Campsite apps need both open publication and operator approval.

```text
Open listing
  Any registered campsite node can publish immediately.
  Visible in the open or experimental directory.
  Marked as campsite-published.
  Good for logs, games, activity passport stamps, messages, queues, and odd
  terminal services.

Approved listing
  OMNIDAT or event operators review and promote it.
  Appears in the main directory.
  May receive stable addresses, better routing priority, billing privileges,
  printed-directory placement, and NOC monitoring.
```

Publication state:

```text
draft
published_open
submitted_for_approval
approved
suspended
rejected
archived
```

Open services can receive calls and appear in the open directory. They cannot
move funds, charge network-wide fees, impersonate official services, or receive
settlement access. Approved services can join clearing agreements and use fee
policies when permitted.

## Vintage Verifone Product Path

OMNIDAT should target real dial-up Verifone terminals from the TRANZ/Omni era,
including TCL-programmable devices where available. P400-style modern
semi-integrated payment is explicitly not the first path.

```text
Vintage Verifone terminal
  TCL or native application
  keypad and small display
  built-in modem
  receipt printer
        |
POTS / camp PBX / ATA / modem bank
        |
OMNIDAT Dial POS Front-End Processor
        |
OMNIDAT X.25 Packet Clearing
        |
ShadyBucks, bearer instruments, food service, settlement
```

V1 is dual-track:

```text
Real terminal path
  Acquire ShadyTel and surplus terminals.
  Identify model, modem behavior, memory, printer, download protocol, and TCL
  support.
  Build and load a payment app where the terminal allows it.
  Dial OMNIDAT over POTS and process real transactions.

Soft terminal path
  Browser and CLI emulator.
  Same screens, host messages, batch behavior, receipts, and failure states.
  Used for CI, demos, training, and protocol debugging before hardware is ready.
```

The emulator must stay terminal-faithful. It should model a small display,
function keys, dial/connect/fail states, short numeric entry, batch close,
receipt output, host response codes, and slow transaction pacing.

## Terminal Host Split

Payment flows should stay separate from experimental apps.

```text
Dial Host A: OMNIDAT POS FEP
  Sale, authorization, capture, void, refund, bearer-note redemption, batch
  close, receipt reprint. Stable, boring, and payment-specific.

Dial Host B: OMNIDAT Terminal Management Bureau
  Enrollment, parameter download, phone-number updates, app download where
  supported, health check, test host, key or credential rotation.

Dial Host C: OMNIDAT PAD / General Services
  Directory, activity passport, food apps, messages, and terminal experiments.
```

This lets real terminals act as payment devices first, while still allowing
additional programs to be loaded over POTS using their historical management
protocols when the hardware supports it.

## Payment Terminal App

The first terminal app should prioritize sale/payment flows.

```text
V1 payment app
  sale
  void
  refund or reversal
  bearer-note redeem
  close batch
  reprint receipt
  host test
```

Example terminal transcript:

```text
OMNIDAT POS
MERCHANT NIGHT-MARKET-04
CLERK? 042

SALE 13.00 SHDY
NOTE SBMO-2028-000123-7

DIALING 8810
CONNECT 2400
CALL 002010
APPROVED 284911
RC 00
FEE 0.25
PRINT RECEIPT
```

The POS FEP translates terminal frames into OMNIDAT service calls and settlement
messages.

```text
POS.TERMINAL.ENROLL
POS.SALE.START
POS.AUTHORIZE
POS.CAPTURE
POS.VOID
POS.REVERSE
POS.REDEEM-NOTE
POS.CLOSE-BATCH
POS.STATUS
```

## General Terminal Programs

General X.25 client behavior should be delivered through separate downloadable
or selectable programs rather than weakening the payment app.

```text
PAYMENT.APP
  merchant sale/payment flow

DIRECTORY.APP
  call OMNIDAT directory and print listings

PASSPORT.APP
  activity passport and merit badge stamps

FOOD.APP
  menu, order, wait-line, and vendor status

MESSAGE.APP
  short store-and-forward packet messages

PAD.APP
  terminal-as-X.25-ish client where the UI is tolerable
```

Program distribution belongs to the Terminal Management Bureau.

```text
000120  TERMINAL MANAGEMENT BUREAU

TERMINAL.ENROLL
TERMINAL.PROFILE
TERMINAL.PARAMETERS
TERMINAL.DOWNLOAD.REQUEST
TERMINAL.DOWNLOAD.SESSION
TERMINAL.DOWNLOAD.VERIFY
TERMINAL.HEALTHCHECK
TERMINAL.RETIRE
```

## Terminal and Clerk Identity

Physical terminal identity and human operator identity are separate.

```text
Terminal profile
  model
  serial number
  assigned merchant
  X.121 origin
  allowed apps
  dial numbers
  fee policy
  risk limits
  settlement account
  last known line or PAD

Clerk session
  operator code
  shift id
  permissions
  cash drawer or batch responsibility
  transaction audit trail
```

This supports both unattended vendor mode and accountable cashier mode.

```text
Unattended/simple mode
  Terminal profile is enough.
  All sales settle to the assigned merchant.
  Batch close is per terminal.

Staffed/accountable mode
  Clerk enters a code at shift start or per transaction.
  Sales include terminal id and clerk id.
  Batch close can be per clerk, per terminal, or per merchant.
```

## Bearer Instruments

Printed ShadyBucks should work as bearer instruments, but the network remains
authoritative.

```text
ISSUED -> ACTIVE -> REDEEMED
            |          ^
            |          |
         VOIDED     deposit, cash out, or merchant payment
            |
         EXPIRED / FRAUD-HOLD
```

For vintage terminals, V1 should not depend on QR scanning. The terminal path
should support:

```text
manual serial entry with check digit
optional magstripe bearer card/note
optional barcode wedge accessory
```

Example:

```text
SALE 25.00
NOTE SBMO-2028-000123-7
APPROVED 184921
```

The FEP verifies signature or serial format, checks that the note is active and
unredeemed, atomically redeems it, then deposits, pays, or cashes out according
to the transaction type.

## Fees and Billing

OMNIDAT charges network fees, not bank ledger fees. Fee policy must be flexible
and data-driven.

```text
fee_policy_id
applies_to: service | terminal_class | namespace | peer | merchant
flat_fee
percent_bps
min_fee
max_fee
payer: requester | operator | merchant | treasury | split | waived
settlement_account
waiver_reason
```

V1 policy examples:

```text
OPEN_ATM_USER_PAYS
OPEN_ATM_OPERATOR_PAYS
OFFICIAL_EVENT_WAIVED
MERCHANT_POS_MERCHANT_PAYS
FEDERATED_DIRECTORY_NO_FEE
FEDERATED_FINANCIAL_CLEARING_REQUIRED
```

Fee decisions should be recorded on every transaction even when waived, because
the accounting trail is part of the in-world experience and later ShadyBank
settlement work.

## Data Model Additions

The operational schema should include these first-class records:

```text
network_operators
packet_nodes
route_advertisements
service_directory_entries
service_publications
clearing_agreements
fee_policies
terminal_profiles
terminal_programs
terminal_parameters
terminal_clerks
terminal_sessions
terminal_batches
pos_transactions
bearer_instruments
bearer_redemptions
```

Relationships:

```text
network_operator -> packet_nodes
network_operator -> service_directory_entries
packet_node -> route_advertisements
terminal_profile -> terminal_sessions
terminal_session -> terminal_batches
terminal_batch -> pos_transactions
pos_transaction -> fee_policy
pos_transaction -> bearer_redemption optional
clearing_agreement -> allowed financial verbs and route prefixes
```

## V1 Implementation Wedge

V1 should prove one end-to-end sale over the soft terminal and keep hardware
bring-up parallel.

1. Add schema and seed data for operators, nodes, services, routes, fee
   policies, terminal profiles, clerk sessions, batches, and bearer instruments.
2. Build a soft vintage terminal UI and CLI that models dial/connect/payment
   behavior.
3. Build the OMNIDAT POS FEP service for sale, bearer redemption, void, status,
   and close-batch.
4. Wire POS settlement to existing ShadyBucks/Shady Bank integration.
5. Add terminal management records and a management UI for profiles,
   parameters, and program assignments.
6. Add directory support for open, approved, native, and federated listings.
7. Add NOC views for dial hosts, terminal sessions, route advertisements, and
   service health.
8. Document ShadyTel interconnect requirements for dial numbers, modem hunt
   groups, ATA behavior, and terminal lab setup.
9. Add real terminal model profiles as ShadyTel inventory is identified.

Success criteria:

```text
Soft terminal can enroll, open a clerk session, dial POS FEP, redeem or charge,
print a receipt, close batch, and show the transaction in admin/NOC.

A terminal profile can be switched between terminal-only and clerk-required
merchant policy.

The directory can show native OMNIDAT services, open campsite services, approved
services, and visibly federated peer services.

Financial verbs cannot cross a federated peer boundary without a clearing
agreement.
```

## Hardware Lab Path

ShadyTel and OMNIDAT should maintain an inventory sheet for each acquired
terminal:

```text
model
serial
firmware
memory
display size
printer status
modem behavior
programming protocol
TCL support
download method
known passwords or locked state
line requirements
test receipts
```

First lab milestones:

```text
power on
print self-test
identify modem speed and dialing behavior
connect to local modem or PBX test line
capture host negotiation
load or configure test app
dial OMNIDAT management host
run host test
run $1.00 ShadyBucks authorization
close batch
```

## Open Questions

- Which exact Verifone models does ShadyTel already have?
- Which models support TCL download, parameter download, or only acquirer-style
  configuration?
- Do we want the first field demo to use manual bearer-note serial entry,
  magstripe, or both?
- What phone numbers should ShadyTel reserve for POS FEP, terminal management,
  and general PAD access?
- What is the first financial clearing policy for federated peers: directory
  only, inquiry only, or authorization with explicit limits?
