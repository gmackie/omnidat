# OMNIDAT Architecture

## Boundaries

OMNIDAT does not operate ShadyTel. ShadyTel provides camp telephone service,
C*NET interconnect, and the trunk into OMNIDAT. OMNIDAT operates the PBX,
gateways, business-data services, packet network, media systems, and public
experience behind its assigned Exchange 88 numbers.

## High-Level Topology

```text
ShadyTel / C*NET
      |
ISDN PRI T1 to OMNIDAT
      |
OMNIDAT PBX
      |
      +--> voice apps and IVRs
      +--> modem pool
      +--> BBS and shell hosts
      +--> X.25 PAD gateways
      +--> Shadybucks ATM/POS/proxy carrier circuits
      +--> NiteMarkt BOH/WMS terminal circuits
      +--> fax machine and fax server
      +--> dot matrix print service
      +--> VHS Media Vault control
      +--> ShadyRoulette
```

## Core Responsibilities

### PBX

The PBX owns dial tone inside OMNIDAT, receives `8800-8823` from ShadyTel, and
routes each called number to a service, hunt group, direct line, or operator
function.

Likely implementation paths:

- Modern Asterisk or FreeSWITCH with a PRI card.
- PRI-to-SIP gateway in front of Asterisk or FreeSWITCH.
- Vintage PBX island with Asterisk handling apps and gateways.

The first practical version should prefer a modern PBX or PRI-to-SIP gateway so
the application layer can be built and tested before ToorCamp hardware choices
are final.

### Packet and Terminal Network

OMNIDAT Packet Clearing is separate from the voice PBX. The PBX answers dialed
access numbers and connects callers to PADs, modems, terminal servers, or
service hosts. Packet Clearing owns X.25 addressing, PAD sessions, terminal
menus, host routing, and service identity.

### Document Services

Document Services includes one physical fax machine, optional fax server
capture, and a networked dot matrix printer. The printer should be reachable
from BBS, X.25, operator console, and Media Vault logging.

### Media Vault

The Media Vault is a physical VHS library using a linear shelf or slot carousel
with gantry. It exposes catalog, queue, and playback controls through PBX IVR,
BBS, X.25 terminal UI, and operator console.

The playback chain produces one program output that splits to:

- Analog RF/coax closed-circuit OMNIDAT TV.
- Local IP stream for browsers and operations.
- Recording/archive.
- Selected controlled amateur television experimental feed under licensed
  operator control.

## Operating Principle

PBX routes access. Packet services route data. Media Vault routes playback.
ShadyTel routes OMNIDAT's number block to the PRI.

## Field Office and Campsite Apps

The portable OMNIDAT Field Office extends Packet Clearing beyond the OMNIDAT
desk. Campsites can request packet service, receive addresses, and publish
subscriber applications in controlled namespaces. The X.25-style Packet
Clearing address remains the service identity; LoRa, Wi-Fi, POTS, hosted
terminals, and ShadyTel/OMNIDAT infrastructure are only access transports.

```text
campsite app / hosted node / field device
        |
        | LoRa, Wi-Fi, POTS, terminal, hosted service
        v
OMNIDAT access gateway
        |
        v
Packet Clearing address space
```

MeshCore and Meshtastic act as Radio PAD access paths. They expose a compact
command grammar for directory lookup, message submission, queue checks, and
activity-passport logging. They do not replace Packet Clearing and should not
promise transparent cross-protocol direct messaging.

See [Field Office Network Plan](field-office-network-plan.md) and
[Field Office X.25 App Platform Plan](plans/2026-06-29-omnidat-field-office-x25-app-platform.md).

## Service Ownership

| Service | Owner | Primary Access |
|---|---|---|
| Exchange 88 | PBX | ShadyTel PRI, local extensions |
| TrustDesk | PBX/operator | `8800`, `8819` |
| OMNIDAT Online | BBS hosts | `8802-8804`, modem pool |
| Modem Pool | PBX/data gateways | `8805`, `8820-8821` |
| Packet Clearing | PAD/X.25 hosts | `8810-8813`, `8822-8823` |
| Merchant Carrier | Packet Clearing/PBX/data gateways | packet services, terminal circuits |
| Media Vault | media-vault service | `8814-8815`, BBS, X.25 |
| Document Services | operator/print/fax | `8818-8819`, BBS, X.25 |
| ShadyRoulette | telephony app | `8816-8817` |

## Related Docs

- [Identity](identity.md)
- [System Requirements](system-requirements.md)
- [Data Model](data-model.md)
- [Integration Map](integration-map.md)
- [Field Office Network Plan](field-office-network-plan.md)
- [Lab Bring-Up Plan](lab-bringup.md)
- [Acceptance Tests](acceptance-tests.md)
- [PBX Design](pbx-design.md)
- [Packet Clearing](packet-clearing.md)
- [Shadybucks Carrier Network](shadybucks-carrier-network.md)
- [Document Services](document-services.md)
- [Media Vault](media-vault.md)
- [Video Distribution](video-distribution.md)
- [Operator Model](operator-model.md)
- [Field Office X.25 App Platform Plan](plans/2026-06-29-omnidat-field-office-x25-app-platform.md)
