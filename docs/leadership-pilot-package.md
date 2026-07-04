# OMNIDAT Leadership Pilot Package

Date: 2026-07-04

## One-Page Proposal

OMNIDAT is a retro business-data carrier for hacker camps. It gives camps,
villages, vendors, and event services a historical packet-network experience:
X.25-style addressing, PAD terminals, service directories, paper provisioning
forms, merchant settlement records, activity passport logs, and a NOC desk that
looks and behaves like a small packet-era carrier.

For the first camp deployment, OMNIDAT should be approved as an opt-in village
or field-office pilot. It should not be positioned as required event
infrastructure until the terminal bridge, identity, provisioning, and money
policy have passed a human rehearsal.

The pilot can still be useful. It can run a packet directory, campsite app
signup, activity passport logging, food-order/line demos, Night Market merchant
simulation, ShadyBucks/OmniBucks ATM experiments, and a NOC dashboard. The
public production surface at `https://omnidat.gmac.io/dashboard` already shows a
1,000-camper simulated weekend with downloadable event, bank, queue, network
fee, and billing evidence.

## Leadership Ask

OMNIDAT needs a clear yes/no on these items:

| Area | Minimum ask | Better ask |
| --- | --- | --- |
| Status | Opt-in village/field-office pilot | Official experimental camp data service |
| Space | 1 table, 2 chairs, small rack/cart | 10x10 field office with public terminal area |
| Power | 2 independent 120V circuits | UPS-backed circuit plus separate printer/media circuit |
| Network | Event LAN or isolated uplink | Event LAN plus reserved local subnet/VLAN |
| Phone | none required for V1 | ShadyTel route for `8800-8823` or local SIP handoff |
| RF | permission for low-power local MeshCore/Meshtastic tests | coordinated radio gateway placement |
| Money | play-money OmniBucks only | limited ShadyBucks conversion with written policy |
| Signage | permission for opt-in data/logging signage | printed directory and official map listing |
| Ops | named camp liaison | named liaison plus incident escalation contact |

## Pilot Scope

### In Scope

- Public OMNIDAT field office / NOC desk.
- X.25-style service directory and X.121 address assignments.
- Open campsite namespace for opt-in campsite apps.
- Operator-reviewed approved service namespace.
- Browser terminal/XOT or terminal-faithful PAD demo.
- MeshCore-managed radio PAD demo if RF placement is approved.
- Meshtastic/BYO ingress only if rate-limited and clearly marked experimental.
- Activity passport and merit-badge logs.
- Miliways-style food order and line-status protocol demo.
- Night Market merchant/POS simulation.
- OmniBank/OmniBucks test ledger.
- Network fee statements as in-world accounting artifacts.
- Printed provisioning receipts, service certificates, and daily summaries.

### Out Of Scope For First Approval

- Any claim that OMNIDAT is required for food, safety, registration, or official
  event communications.
- Real cash withdrawal or redemption without a separate ShadyBank/OmniBank
  written policy.
- Unbounded bearer instruments.
- Unreviewed third-party services in the approved namespace.
- Direct access to camp leadership data systems.
- Long-term personal-data retention without explicit consent language.

## Success Criteria

The pilot is successful if:

- at least 10 campsites or vendors request X.121 addresses.
- at least 5 services appear in the directory with verbs, inputs, and outputs.
- at least 100 participant interactions are logged through terminal, web, radio,
  or operator entry.
- NOC can show service status, incidents, provisioning, and evidence exports.
- at least one real or simulated terminal completes an end-to-end service call.
- operators can print or export daily evidence.
- camp leadership receives a post-event report with incidents, usage, and
  follow-up recommendations.

## Demo Script For Leadership

Use this script before asking for space or phone/network commitments.

1. Open `https://omnidat.gmac.io`.
2. Show that the landing page frames OMNIDAT as X.25 business infrastructure and
   links "business" language to `https://haha.business`.
3. Open `https://omnidat.gmac.io/dashboard`.
4. Show the simulated weekend:
   - 1,000 campers.
   - Night Market and Miliways activity.
   - campsite X.121 provisioning.
   - OmniBank/OmniBucks ledgers.
   - network fee statements.
5. Open evidence artifacts:
   - `/api/weekend-simulation/weekend-events.jsonl`
   - `/api/weekend-simulation/weekend-bank-ledger.jsonl`
   - `/api/weekend-simulation/miliways-queue/orders.json`
   - `/api/weekend-simulation/weekend-network-fees.jsonl`
   - `/api/weekend-simulation/billing-statements/OMNI-NIGHTMARKT.txt`
6. Open `/api/network` and show:
   - protocol: `X.25`.
   - service directory.
   - X.121 addresses.
   - service verbs with inputs and outputs.
7. Open `/api/provisioning` and show the operator provisioning queue.
8. Explain the field proof still needed:
   - one real terminal/XOT/POTS/radio path calling one provisioned X.121 service.
   - one human rehearsal before the event.

## Field Footprint

### Minimum Table Pilot

```text
public side
  participant terminal or laptop
  printed directory
  address request forms

operator side
  operator laptop
  receipt printer
  MeshCore gateway or local Wi-Fi PAD
  small switch/AP
  UPS
```

Needs:

- one 6-foot table.
- two chairs.
- one power strip on a reliable circuit.
- local Wi-Fi or Ethernet uplink.
- permission to display opt-in data/logging signage.

### Village Field Office

```text
camp network / ShadyTel / local lab peer
          |
     OMNIDAT edge host
          |
   +------+---------+------------+
   |                |            |
 NOC laptop     PAD terminal   printer
   |                |            |
 service desk   public demo   paper receipts
   |
 MeshCore/Meshtastic gateway, optional
```

Needs:

- 10x10 footprint or equivalent.
- rack/cart or protected equipment table.
- two power circuits if printers/media hardware are present.
- event network drop or isolated uplink.
- optional ShadyTel SIP/POTS/PRI handoff.
- safe cable paths and weather plan if outdoors.

## Roles And Responsibilities

| Role | Owner | Responsibilities |
| --- | --- | --- |
| Camp liaison | event leadership | scope, escalation, placement, safety concerns |
| ShadyTel liaison | ShadyTel team | phone handoff, dial plan, line testing |
| OMNIDAT NOC lead | OMNIDAT | service health, incidents, operator schedule |
| Packet operator | OMNIDAT | X.121 provisioning, service directory, PAD sessions |
| Bank operator | OmniBank/ShadyBank | currency policy, mint/redeem/void, settlement records |
| Vendor liaison | OMNIDAT or Night Market | merchant onboarding, terminal testing, receipts |
| Privacy reviewer | event leadership or delegate | consent text, retention, participant-facing notices |

## Risk Register

| Risk | Impact | Control |
| --- | --- | --- |
| Participants mistake the pilot for official infrastructure | support load and event confusion | opt-in signage, map language, directory disclaimer |
| Money-like tokens create unclear obligations | trust and accounting risk | written OmniBucks/ShadyBucks policy, limits, void process |
| Terminal bridge fails at camp | poor demo and vendor disruption | browser/XOT fallback, simulator fallback, printed manual flow |
| ShadyTel handoff unavailable | no POTS spectacle | self-contained OmniTel SIP/Asterisk lab mode |
| Radio gateway noisy or unreliable | lost messages | managed MeshCore preferred, Meshtastic rate limits, operator retry |
| Personal data over-collected | privacy risk | minimal fields, opt-in consent, retention schedule |
| Open campsite apps publish abusive content | community risk | open namespace label, removal process, approved namespace review |
| Operator staffing gaps | stale status and slow incident response | published operating hours, shift checklist, close services when unstaffed |
| Hardware loss or damage | downtime | inventory labels, cold spares, daily shutdown checklist |

## Participant-Facing Language

Use language like this on signs and web surfaces:

```text
OMNIDAT is an opt-in experimental packet-data network.
Services may log address assignments, terminal sessions, service requests,
operator actions, and accounting-style receipts.
Do not use OMNIDAT for emergencies or official event communications.
Ask the OMNIDAT TrustDesk if you want a service record removed after the event.
```

For money-like experiences:

```text
OmniBucks are experimental camp tokens and accounting records unless a separate
posted ShadyBucks conversion policy applies. Keep paper instruments secure.
Lost bearer instruments may not be recoverable.
```

## Money Policy Starter

Default for first pilot:

- OmniBucks are play-money ledger units.
- Seed balances are limited and reversible.
- No cash redemption.
- No guarantee of ShadyBucks conversion.
- Network fees are in-world accounting artifacts.
- Merchants can receive printed statements but not real settlement unless a
  separate policy is signed off.

Upgrade path:

- ShadyBank/OmniBank team defines mint, burn, redeem, void, and dispute flows.
- ATM bearer instruments get serial numbers, QR payloads, and expiry.
- POS batch close reconciles terminal totals against bank ledger and OMNIDAT
  network fee ledger.
- Leadership approves any cash-equivalent or redeemable instrument language.

## Data And Retention

Minimum participant data:

- handle or passport ID.
- campsite/vendor/service affiliation if voluntarily provided.
- service request metadata.
- timestamped operator events.
- receipt IDs and ledger references.

Avoid by default:

- legal names.
- government IDs.
- phone numbers.
- email addresses except for operators and campsite owners.
- location history beyond service/campsite affiliation.

Retention:

- publish a post-event summary.
- keep operational ledgers long enough to debug disputes.
- delete or anonymize participant-level logs after the agreed retention window.
- preserve historical camp records as aggregate/public artifacts unless a
  participant opted into named records.

## Technical Readiness Gates

Before event approval:

- production dashboard and network API pass smoke checks.
- admin and NOC roles work without developer shell access.
- provisioning creates persistent X.121 assignments.
- one real terminal or browser XOT terminal calls a provisioned service.
- evidence log receives the terminal call.
- operator can revoke or disable a service.
- money policy is posted if any ATM/POS flow is participant-facing.
- fallback mode is documented.

Before opening each day:

- health endpoint is healthy.
- service directory exports.
- terminal bridge test call succeeds.
- printer path works.
- NOC dashboard shows current status.
- incident log is writable.
- public signage is visible.

## Post-Event Report

Within one week of the pilot, publish:

- number of users, campsites, vendors, and services.
- terminal/PAD/radio/web interaction counts.
- provisioning counts by namespace.
- incident summary.
- money/ledger summary if applicable.
- what worked.
- what failed.
- recommendation for next camp: stop, repeat, expand, or make official.

