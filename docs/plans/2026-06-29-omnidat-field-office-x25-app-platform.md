# OMNIDAT Field Office X.25 App Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build OMNIDAT into a portable camp packet carrier where ToorCamp
villages and smaller hackercamp campsites can request X.25 addresses, create
packet applications, log activity-passport records, and access services through
terminal, radio, Wi-Fi, POTS, or hosted infrastructure.

**Architecture:** Packet Clearing remains the authoritative OMNIDAT network.
MeshCore, Meshtastic, Wi-Fi, POTS, hosted terminals, and physical PADs are
transport adapters into the same X.25-style address space. Campsite apps live
as subscriber packet services with assigned addresses, directory records,
operator status, activity logs, and optional printed receipts.

**Tech Stack:** Existing OMNIDAT Python tools, JSON seed data, append-only JSONL
event logs, SQLite build output, terminal-faithful PAD emulation, future
MeshCore/Meshtastic gateway adapters, and printable artifacts.

**Network Reference:** The detailed address, transport, routing, provisioning,
capacity, and failure-mode plan lives in
[Field Office Network Plan](../field-office-network-plan.md).

## Product Frame

OMNIDAT should feel like a historical packet-data carrier and service bureau,
not a generic web platform. Campsites do not merely "install an app"; they
request packet service, receive address assignments, publish subscriber
applications, file changes through a service desk, and get receipts.

The modern webpage is only the intake counter. Its output should be in-world
paperwork:

```text
OMNIDAT PACKET CLEARING
APPLICATION FOR CAMPSITE DATA SERVICE

APPLICANT        CAMP LAMINAR
REQUESTED CLASS  OPEN CAMPSITE PACKET APPLICATION
TRANSPORT        HOSTED, RADIO-PAD, WIFI
ADDRESS RANGE    020184-020187
DIRECTORY        PROVISIONAL
OPERATOR         PENDING
```

## Network Hierarchy

Packet identity and transport must stay separate:

```text
Packet identity:
  address, namespace, app name, owner, service class, access class, status

Transport:
  terminal/PAD
  modem/POTS/ShadyTel
  Wi-Fi/TCP
  MeshCore
  Meshtastic
  OMNIDAT-hosted service
```

Core principle:

```text
X.25 / Packet Clearing is the network.
Radio and web are access paths.
Paper is the receipt layer.
```

## Address Namespaces

Start with fixed address namespaces so participants can infer trust and
ownership from an address.

| Range | Namespace | Purpose |
|---:|---|---|
| `000xxx` | OMNIDAT core | Directory, account inquiry, operator messages, document services, Media Vault |
| `001xxx` | ShadyTel / carrier partners | Trusted interconnect, test services, future carrier handoffs |
| `002xxx` | Shadybucks / merchant carrier | POS, ATM, settlement, NiteMarkt, merchant proxy services |
| `010xxx` | Approved village services | Reviewed campsite/village apps in the official directory |
| `020xxx` | Open campsite services | Self-service campsite apps and provisional listings |
| `030xxx` | Event operations | Dispatch, passport events, temporary queues, game/puzzle nodes |
| `090xxx` | Test and training | Echo, loopback, diagnostics, PAD training |

The open namespace is intentionally usable without operator approval. Operator
review promotes a service into official directory status, but provisional
services still work.

Example directory output:

```text
ADDR    NS        STATUS  SERVICE
000001  CORE      ACTIVE  OMNIDAT DIRECTORY
000006  CORE      ACTIVE  OPERATOR MESSAGES
010042  VILLAGE   ACTIVE  HARDWARE HACKERS BULLETIN
020184  OPEN      PROV    CAMP LAMINAR ROOT
020185  OPEN      PROV    CAMP LAMINAR LOST PROPERTY
030010  EVENT     ACTIVE  FIELD DISPATCH QUEUE
090099  TEST      ACTIVE  TEST LOOP
```

## Campsite Signup

The signup flow should resemble a business packet-service order:

```text
web signup
  -> service order
  -> provisional packet address assignment
  -> hosted app or remote-node credentials
  -> directory entry
  -> printable provisioning packet
  -> optional operator approval / promotion
```

The intake page should accept:

- campsite, village, vendor, or participant group name
- operator/admin contact
- desired service type
- desired transports: hosted, Wi-Fi, POTS/modem, MeshCore, Meshtastic
- public directory description
- hours/status fields
- whether the app may log passport/activity records
- whether the app may print receipts or request operator delivery

Output artifacts:

- service order number
- assigned packet address or range
- app-admin credential
- directory listing receipt
- demarcation/provisioning sheet
- printable campsite service certificate

## Campsite App Types

V1 should use templates. Templates let camps create real apps without needing to
deploy arbitrary code before the platform exists.

| Template | Use |
|---|---|
| `BULLETIN` | Posts, announcements, hours, status |
| `MESSAGE_DESK` | Send messages to a camp or receive messages from participants |
| `QUEUE` | Line management, workshop registration, pickup windows |
| `CLASSIFIEDS` | Need/have/trade board |
| `INVENTORY` | Food, parts, supplies, tools, stock status |
| `SCHEDULE` | Workshop and shift schedule |
| `FORM` | Structured submissions with receipt numbers |
| `TELEGRAM` | Store-and-forward messages with delivery status |
| `STATUS_BOARD` | Open/closed/need help/need supplies style updates |
| `REMOTE_PRINT` | App-generated slips or notices at an OMNIDAT printer |
| `PUZZLE_NODE` | Addressable clue/checkpoint app |

Later, `REMOTE_SERVICE` can allow a campsite to host its own service behind a
gateway, with OMNIDAT wrapping it as a packet address.

## Radio PAD Gateway

MeshCore and Meshtastic should emulate a constrained PAD, not a full terminal.
They submit short commands and receive compact replies.

```text
MeshCore loaner node
Meshtastic BYO node
        |
        v
Radio PAD Gateway
        |
        v
OMNIDAT Packet Clearing / X.25 services
```

Supported command grammar:

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

Radio responses should be terse:

```text
OMNIDAT FIELD PAD
SESS R-001284
CALL 020502 MILIWAYS QUEUE
TKT MLY-00482
POS 17
EST 18 MIN
CLR 00
```

MeshCore should be the managed infrastructure path for loaners, repeaters, and
fixed village coverage. Meshtastic should be guest/BYO support with stricter
message size, rate limits, and gateway policy. Both feed the same parser and
Packet Clearing service calls.

## Activity Passport and Merit Badges

Activity logging is a first-class X.25 use case. OMNIDAT should act as an
activity clearinghouse, not as a passive tracking system.

Identity modes:

```text
Named account     ACCT-000128  MACKIE G
Passport account  PASS-04271   RED-LINE-27
```

Passport accounts are good for playful, anonymous, or handle-based activity:

- activity stamps
- merit badges
- quests
- dispatch runs
- workshop attendance
- paper receipt loops

Named accounts are reserved for higher-trust work:

- campsite app ownership
- packet app administration
- vendor/merchant services
- lost credential recovery
- terminal operator certification
- Shadybucks/Shadybank follow-up

Activity record shape:

```text
ACT-000482
PASS-04271 RED-LINE-27
SERVICE 020184 CAMP LAMINAR
ACTION WORKSHOP-COMPLETE
STATUS CLEARED
RECEIPT PRINTABLE
```

Important privacy rule: activity logging is explicit. Participants file or
present a code, receipt, passport ID, or terminal form. OMNIDAT should not imply
background tracking.

## Example Packet Apps

### Miliways Food Orders and Line Management

Miliways-style food service is the clearest useful app because it creates real
traffic, visible queues, runner dispatch, paper receipts, and radio
notifications.

```text
020500  MILIWAYS MENU STATUS
020501  MILIWAYS ORDER ENTRY
020502  MILIWAYS QUEUE POSITION
020503  MILIWAYS KITCHEN EXPEDITE
020504  MILIWAYS SPECIAL HANDLING
```

Core flows:

- view menu and sold-out items
- enter an order
- issue a queue ticket
- print a kitchen slip
- query queue position
- send radio notice when ready
- log pickup or missed pickup
- issue optional passport credit for runner/kitchen participation

Terminal response:

```text
ORDER ACCEPTED
TKT MLY-00482
WINDOW 3
EST 18 MIN
PRESENT RECEIPT
```

### Activity Clearing

```text
030020  ACTIVITY DIRECTORY
030021  PASSPORT LOG ENTRY
030022  BADGE REQUIREMENTS
030023  BADGE CLAIM
030024  ENDORSEMENT VERIFY
```

Use cases:

- workshop completion
- field courier completion
- operator certification
- campsite challenge stamps
- physical passport endorsement receipts

### Inter-Camp Telegraph Office

```text
030030  TELEGRAM ENTRY
030031  TELEGRAM DELIVERY STATUS
030032  UNDELIVERED MESSAGES
```

Messages can be delivered by terminal, radio, operator printout, or campsite
message desk.

### Parts and Supply Counter

```text
030040  NEED/HAVE BOARD
030041  PARTS INVENTORY
030042  BORROW/RETURN LOG
030043  TOOL CHECKOUT
```

This creates practical utility while preserving old data-bureau behavior:
requests, receipts, return slips, overdue notices.

### Camp Status Board

```text
020xxx  CAMP ROOT
020xxx  CAMP STATUS
020xxx  CAMP SCHEDULE
020xxx  CAMP MESSAGE DESK
```

Standard status vocabulary:

```text
OPEN
CLOSED
QUIET HOURS
NEED ICE
NEED PARTS
WORKSHOP AT 1600
RADIO OPERATOR AVAILABLE
```

### Field Dispatch

```text
030010  FIELD DISPATCH QUEUE
030011  COURIER CLAIM
030012  DELIVERY CONFIRMATION
030013  DEAD DROP REGISTRY
030014  INCIDENT FIELD REPORT
```

Dispatch creates the mobile game loop:

```text
ASSIGNMENT FD-0042
PICKUP OMNIDAT DESK
DELIVER CAMP LAMINAR
CONFIRM CODE 71Q
```

## Accounting Boundary

OMNIDAT accounting is cosmetic until Shadybank/Shadybucks chooses an explicit
integration.

Track carrier-style records:

- packet call units
- print/fax charges
- message delivery fees
- address deposits
- directory listing fees
- service-order charges
- settlement batch status

Do not treat these as real payment movement.

Open Shadybank/Shadybucks question:

```text
Should OMNIDAT cosmetic carrier accounting ever map to Shadybucks balance or
settlement, or should it remain a separate service-bureau fiction?
```

Recommended V1 answer: keep it separate. If integration happens later, expose
one approved settlement service rather than mixing carrier logs with bank
ledger authority.

## Sample Hardware Kits

### A. Laptop Field Office Kit

Purpose: smallest proof for a smaller camp or early demo.

- 1 laptop or mini PC running Packet Clearing, signup admin, and event log
- 1 Wi-Fi AP/router
- 1 USB receipt or dot matrix printer path
- 1 USB serial adapter and one terminal, optional
- 2-4 MeshCore loaner radios
- 1 Meshtastic gateway radio, optional
- paper passport cards and service-order forms
- label maker, spare USB power, printed quick-start sheet

Supports:

- hosted campsite apps
- packet directory
- activity passport logging
- radio PAD demo
- printed receipts

### B. Portable Campsite Exchange Kit

Purpose: one campsite can host a visible local packet node.

- small fanless mini PC or Raspberry Pi-class host
- Wi-Fi AP in campsite mode
- serial terminal or rugged laptop running terminal emulator
- small receipt printer or shared OMNIDAT print queue
- 1 MeshCore companion/relay radio
- optional Meshtastic node for guest/BYO bridge
- optional analog phone/modem if ShadyTel/POTS is available
- laminated packet address card and demarc label

Supports:

- one campsite root app
- message desk
- status board
- queue app
- local terminal access to OMNIDAT

### C. OMNIDAT Village Field Office Kit

Purpose: event-ready portable field office before full ToorCamp buildout.

- 1 primary service mini PC
- 1 cold spare service mini PC or imaged SSD
- 1 managed switch
- 1 Wi-Fi AP/router
- 1 Packet Clearing terminal station
- 1 operator laptop
- 1 dot matrix printer with paper/ribbons
- 1 label printer
- 4-8 MeshCore loaner radios
- 2 fixed MeshCore repeater/room-server nodes
- 1 Meshtastic gateway node
- optional FXS gateway plus 1-2 modems for POTS/ShadyTel testing
- battery/UPS for service host, AP, and radio gateway
- binder with service orders, address assignments, passport forms, runbook

Supports:

- open campsite namespace
- hosted campsite apps
- radio PAD gateway
- passport/activity clearing
- Miliways-style queue/order app
- print receipts
- operator approval and directory status

### D. ToorCamp Carrier Buildout Add-On

Purpose: connect the field-office system to the larger Exchange 88 concept.

- ShadyTel PRI/SIP handoff
- PBX server and FXS gateway
- modem pool
- PAD terminal server
- Packet Clearing host
- operator desk
- Document Services printer/fax
- Media Vault integration
- Shadybucks/NiteMarkt carrier circuits

The field-office app platform should work before this add-on exists. The
ToorCamp carrier buildout adds richer access paths and spectacle, not a
different application model.

## Implementation Tasks

### Task 1: Add Field Office Docs to the Repo Map

**Files:**

- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/hardware-bom.md`

**Steps:**

1. Add this plan to the README design-doc list.
2. Add a Field Office section to `docs/architecture.md`.
3. Add a field-office phase to `docs/roadmap.md` before the full ToorCamp
   buildout.
4. Add a Field Office hardware section to `docs/hardware-bom.md`.
5. Run `./scripts/validate-data`.

### Task 2: Model Packet App Namespaces

**Files:**

- Create: `data/packet-namespaces.sample.json`
- Modify: `docs/packet-clearing.md`
- Modify: `docs/data-model.md`
- Test: `tests/test_database.py` or a new focused test

**Steps:**

1. Add namespace seed records for `000xxx`, `001xxx`, `002xxx`, `010xxx`,
   `020xxx`, `030xxx`, and `090xxx`.
2. Document namespace routing and directory rendering.
3. Add a database table or loader path only when implementation begins.
4. Test that namespace records load and duplicate ranges are rejected.

### Task 3: Add Campsite App Records

**Files:**

- Create: `data/campsite-apps.sample.json`
- Modify: `docs/data-model.md`
- Modify: `tools/omnidat_db.py`
- Test: `tests/test_database.py`

**Steps:**

1. Define `CampsiteApp` records with address, owner, template, transports,
   status, directory status, and access class.
2. Seed sample Miliways, Camp Laminar, and Field Dispatch apps.
3. Add SQLite schema and loader support.
4. Test sample records are inserted and summarized.

### Task 4: Add Activity Passport Records

**Files:**

- Create: `data/activity-passports.sample.json`
- Modify: `docs/data-model.md`
- Create or modify: `tools/omnidat_activity.py`
- Test: `tests/test_activity.py`

**Steps:**

1. Define `PassportAccount`, `ActivityRecord`, `Badge`, and `BadgeClaim`
   records.
2. Add commands to create an activity record and render a receipt.
3. Test named account and passport account logging separately.
4. Test that activity logging is explicit and includes source service/address.

### Task 5: Add Radio PAD Command Parser

**Files:**

- Create: `tools/omnidat_radio_pad.py`
- Create: `scripts/radio-pad`
- Test: `tests/test_radio_pad.py`

**Steps:**

1. Write tests for `DIR`, `CALL`, `MSG`, `REQ`, `STAT`, `CLR`, and `HELP`.
2. Implement a transport-neutral parser.
3. Route parsed commands into existing Packet Clearing helpers where possible.
4. Keep responses short and line-bounded for LoRa use.

### Task 6: Add Miliways Queue Sample App

**Files:**

- Create: `tools/omnidat_queue.py`
- Create: `scripts/queue`
- Create: `data/queue-apps.sample.json`
- Test: `tests/test_queue.py`

**Steps:**

1. Model menu status, order entry, queue position, kitchen expedite, and pickup.
2. Emit event-log entries for accepted orders and status changes.
3. Render terminal and radio-safe responses.
4. Render printable kitchen slips and pickup receipts through Document Services.

### Task 7: Add Printable Provisioning Artifacts

**Files:**

- Modify: `tools/omnidat_artifacts.py`
- Modify: `scripts/render-artifacts`
- Test: `tests/test_artifacts.py`

**Steps:**

1. Render packet address assignment letters.
2. Render campsite service certificates.
3. Render radio PAD quick-start cards.
4. Render passport activity receipts.
5. Test generated artifacts include OMNIDAT identity, address, service order,
   timestamp, and operator/status fields.

## Verification Commands

Use these after each implementation slice:

```sh
./scripts/validate-data
python -m unittest discover
./scripts/render-artifacts
./scripts/build-db
```

For documentation-only changes, run at minimum:

```sh
./scripts/validate-data
python -m unittest discover
```

## Open Questions

- What should the public signup URL and hosting surface be?
- Should open campsite apps receive one address or a small range by default?
- Which MeshCore hardware should be the managed loaner baseline?
- Which Meshtastic gateway mode is acceptable for a noisy event environment?
- Should passport IDs be printed at central registration, OMNIDAT, or both?
- What activity-passport data should be shared with ToorCamp organizers?
- Should Miliways be a real food operations tool, a demo app, or both?
- What is the narrow Shadybank/Shadybucks follow-up question for cosmetic
  accounting?
