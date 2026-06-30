# System Requirements

This document turns the OMNIDAT concept into testable requirements. A subsystem
is not considered real until it has a user-facing path, an operator-facing path,
and a failure path.

## Global Requirements

| ID | Requirement | Acceptance |
|---|---|---|
| SYS-001 | OMNIDAT must expose `8800-8823` as the Exchange 88 number block. | Every number routes to a service, direct line, or intercept in the lab PBX. |
| SYS-002 | ShadyTel interconnect must be replaceable with a simulator before the event. | Test calls can enter through a fake trunk with identical called-number behavior. |
| SYS-003 | Operators must see service status without shell access. | Operator console/status page shows PBX, modem/PAD, fax, print, media, and TV state. |
| SYS-004 | Every public service must have a maintenance/intercept mode. | Operator can mark a service unavailable and callers receive an explicit message. |
| SYS-005 | Every physical subsystem must have a manual recovery path. | Runbook documents recovery and the operator can bypass or disable it. |
| SYS-006 | Daily logs must be printable. | Dot matrix printer can produce daily call/service/incident summaries. |

## PBX Requirements

| ID | Requirement | Acceptance |
|---|---|---|
| PBX-001 | PBX must route by called number. | `8800`, `8802`, `8805`, `8810`, `8814`, `8818`, and `8820` reach distinct handlers. |
| PBX-002 | PBX must support hunt groups. | `8802`, `8805`, and `8810` select free endpoints and skip busy endpoints. |
| PBX-003 | PBX must expose direct diagnostic lines. | `8820-8823` map to fixed modem/PAD endpoints. |
| PBX-004 | PBX must produce call records. | Each call creates a record with caller, called number, route, endpoint, and disposition. |
| PBX-005 | PBX must protect shared PRI capacity. | Per-service channel limits can prevent one service from exhausting all channels. |

## Packet and BBS Requirements

| ID | Requirement | Acceptance |
|---|---|---|
| DATA-001 | BBS must be reachable by dial-in. | A modem caller reaches OMNIDAT Online through `8802`. |
| DATA-002 | Packet Clearing must expose a PAD-like prompt. | A caller reaches `PAD>` through `8810` and can call the directory. |
| DATA-003 | Packet services must expose Media Vault catalog status. | Terminal user can list catalog entries and queue state. |
| DATA-004 | Data sessions must produce session records. | Modem/PAD session start/end and endpoint appear in logs. |
| DATA-005 | Public and authenticated access must be separable. | `8812` guest PAD cannot reach registered-only services. |
| DATA-006 | Packet services must expose carrier addresses for Shadybucks terminals. | Directory includes ATM, POS authorization, merchant proxy, settlement, and terminal management services. |
| DATA-007 | NiteMarkt BOH/WMS must be a first-class carrier tenant. | Directory includes NiteMarkt WMS, receiving, and stock count services. |
| DATA-008 | Packet Clearing must reserve namespaces for core, partner, merchant, approved village, open campsite, event, and diagnostic services. | Directory can render services from `000xxx`, `001xxx`, `002xxx`, `010xxx`, `020xxx`, `030xxx`, and `090xxx` ranges with status labels. |
| DATA-009 | Campsites must be able to create provisional packet applications in an open namespace. | A web/service-order flow can issue a `020xxx` address and directory listing without manual database editing. |
| DATA-010 | MeshCore and Meshtastic must act as Radio PAD access transports, not independent authorities. | Radio commands are parsed into Packet Clearing requests and all authoritative state is stored by Packet Clearing/core records. |
| DATA-011 | Activity-passport logging must be explicit and account-mode aware. | A user can log an activity as either a named account or a passport/handle ID, and the receipt shows which identity was used. |

## Merchant Carrier Requirements

| ID | Requirement | Acceptance |
|---|---|---|
| MCN-001 | OMNIDAT must distinguish bank authority from carrier authority. | Proposal states Shadybucks owns ledger/tokens and OMNIDAT owns access/circuits/status. |
| MCN-002 | ATMs, POS, proxies, BOH/WMS, and vendor terminals must have distinct device classes. | Seed data includes examples for each class. |
| MCN-003 | Merchant-token paths must stay on trusted devices or merchant proxy hosts. | Carrier proposal maps directGateway to trusted terminals and proxyGateway to merchant proxies. |
| MCN-004 | Terminals must be disableable at the carrier layer. | Terminal seed data includes status and circuit assignment. |

## Document Requirements

| ID | Requirement | Acceptance |
|---|---|---|
| DOC-001 | Fax receive must be dialable. | A fax to `8818` is received by the physical fax or capture server. |
| DOC-002 | Dot matrix printer must accept system jobs. | PBX, BBS/PAD, and Media Vault can each print one receipt/log. |
| DOC-003 | Operators must control print queues. | Operator can pause, resume, cancel, and reprint a job. |
| DOC-004 | Document artifacts must carry OMNIDAT identity. | Receipts include OMNIDAT, Exchange 88, timestamp, and request number. |

## Media Vault Requirements

| ID | Requirement | Acceptance |
|---|---|---|
| MEDIA-001 | Media Vault must maintain tape inventory. | Tape ID maps to slot, title, status, and runtime. |
| MEDIA-002 | Users must be able to request playback. | Request can enter from phone, BBS, X.25, or operator console. |
| MEDIA-003 | Robot must expose a state machine. | Operator sees IDLE/HOMING/FETCHING/PLAYING/FAULT states. |
| MEDIA-004 | Faults must stop motion safely. | E-stop or fault state disables motion and preserves recovery context. |
| MEDIA-005 | Video output must feed OMNIDAT TV. | A VCR/test source appears on analog display and IP preview. |

## ATV Requirements

| ID | Requirement | Acceptance |
|---|---|---|
| ATV-001 | Amateur TV must be physically separable from OMNIDAT TV. | Operator can disconnect ATV feed without interrupting closed-circuit TV. |
| ATV-002 | Licensed control operator must own the station path. | Runbook identifies control operator role and shutdown authority. |
| ATV-003 | ATV feed must have station ID overlay path. | Callsign/ID slate can be inserted before RF transmission. |

## Non-Goals for V1

- Public PSTN access outside ShadyTel/C*NET.
- Real payment processing.
- Unattended mechanical operation without an operator present.
- Internet dependence for core services.
- High-definition video as a primary goal.
