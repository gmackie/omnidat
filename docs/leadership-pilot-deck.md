# OMNIDAT

## A retro packet-data carrier for hacker camps

Leadership pilot proposal — 2026-07-05

Source of record: [Leadership Pilot Package](leadership-pilot-package.md)

<!--
Render the PDF deck (cover + clickable TOC, one slide per section):
  make-pdf generate --cover --toc \
    --title "OMNIDAT Leadership Pilot" --author "OMNIDAT / GMACKO" \
    docs/leadership-pilot-deck.md build/leadership-pilot-deck.pdf
This markdown is the source of truth; the PDF is a regenerable build artifact.
-->


---

## What OMNIDAT is

A retro business-data carrier for hacker camps: X.25-style addressing, PAD
terminals, service directories, paper provisioning forms, merchant settlement
records, activity-passport logs, and a NOC desk that behaves like a small
packet-era carrier.

**The ask for camp one:** approve OMNIDAT as an **opt-in village or
field-office pilot** — not required event infrastructure until the terminal
bridge, identity, provisioning, and money policy pass a human rehearsal.

---

## What is real today

- Operator system with role-gated tRPC, audited writes, and a role-matrix test.
- Browser XOT packet bridge: a terminal calls a provisioned X.121 service and
  clears with an honest X.25 cause code, leaving an evidence receipt.
- Configurable campsite apps, X.121 allocation and provisioning lifecycles,
  POS batch-close and settlement, incident and evidence workflows.
- Field-kit-authoritative sync with a failover drill; a field-office
  `/api/state` dashboard endpoint.
- A 1,000-camper simulated weekend with downloadable evidence at
  `https://omnidat.cc/dashboard`.

**What is not promised yet:** event-critical utility, real terminal hardware in
the field, or redeemable money.

---

## The leadership ask

| Area | Minimum | Better |
| --- | --- | --- |
| Status | Opt-in village/field-office pilot | Official experimental data service |
| Space | 1 table, 2 chairs, cart | 10x10 field office + public terminals |
| Power | 2 x 120V circuits | UPS-backed + separate printer circuit |
| Network | Event LAN or uplink | Reserved local subnet/VLAN |
| Phone | none for V1 | ShadyTel route for 8800-8823 |
| RF | low-power MeshCore/Meshtastic tests | coordinated gateway placement |
| Money | play-money OmniBucks only | limited ShadyBucks w/ written policy |
| Ops | named camp liaison | liaison + incident escalation contact |

---

## Field footprint — minimum table pilot

```text
public side                 operator side
  participant terminal        operator laptop
  printed directory           receipt printer
  address request forms       MeshCore gateway / Wi-Fi PAD
                              small switch/AP, UPS
```

One 6-foot table, two chairs, one power strip on a reliable circuit, local
uplink, and permission to display opt-in data/logging signage.

---

## Money policy (starter)

- OmniBucks are **controlled play money**; network fees are theatrical unless
  separately agreed.
- **No real cash redemption** by default; ShadyBucks conversion requires a
  written policy and ShadyBank/OmniBank sign-off.
- No unbounded bearer instruments; every mint/void/redeem is audited.
- POS settlement reconciles gross − refunds = net in simulation.

---

## Risk register (top items)

| Risk | Control |
| --- | --- |
| Mistaken for official infrastructure | opt-in signage, directory disclaimer |
| Money-like tokens create obligations | written policy, limits, void process |
| Terminal bridge fails at camp | browser/XOT + simulator fallback |
| ShadyTel handoff unavailable | self-contained OmniTel SIP/Asterisk lab |
| Open apps publish abusive content | delist/takedown process, moderation policy |
| Operator staffing gaps | published hours, licensed primaries + backups |

---

## Opt-in and privacy

Participant-facing language, on signs and web:

```text
OMNIDAT is an opt-in experimental packet-data network.
Services may log address assignments, terminal sessions, service requests,
operator actions, and accounting-style receipts.
Do not use OMNIDAT for emergencies or official event communications.
Ask the OMNIDAT TrustDesk to remove a service record after the event.
```

Default to handles/passport IDs; minimal fields; event-specific retention.

---

## Demo script

1. `https://omnidat.cc` — landing page frames X.25 business infrastructure.
2. `/dashboard` — the simulated weekend: 1,000 campers, Night Market, Miliways,
   campsite X.121 provisioning, OmniBank ledgers, network fee statements.
3. Evidence artifacts — events, bank ledger, queue orders, fee ledger, billing
   statements (all downloadable).
4. `/api/network` — protocol X.25, directory, X.121 addresses, service verbs.
5. `/api/provisioning` — the operator provisioning queue.
6. The field proof still needed: one real terminal path and one human
   rehearsal.

---

## Success criteria for the pilot

- 10+ campsites/vendors request X.121 addresses.
- 5+ services in the directory with verbs, inputs, outputs.
- 100+ participant interactions logged.
- NOC shows service status, incidents, provisioning, evidence exports.
- 1+ terminal completes an end-to-end service call.
- Operators print/export daily evidence.
- Leadership receives a post-event report with usage, incidents, follow-ups.

---

## The ask, in one line

Approve a bounded, opt-in OMNIDAT field-office pilot: space, power, network,
optional phone/RF, a named liaison, and agreement that money stays play-money
until a written policy is signed. We bring the rest.
