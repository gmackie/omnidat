# Budget And Sourcing

Date: 2026-07-04

This is the per-tier costing and sourcing plan for the H5 field hardware kit
(Workstream J in [Roadmap Expansion](plans/2026-07-04-roadmap-expansion.md)).
It prices the four kit tiers from [the roadmap](roadmap.md) against the
[Hardware BOM](hardware-bom.md), sets acquire-by dates against the Workstream K
calendar, and defines the borrow-versus-buy and spares policies.

Scope notes:

- Media Vault robot, OMNIDAT TV, and the ATV station (BOM sections 8-10) are
  excluded from these budgets. Unattended Media Vault operation is a roadmap
  non-goal until after the first pilot; those subsystems get their own budget
  when they are scheduled.
- ShadyTel provides the PRI handoff itself (BOM section 2); only OMNIDAT-side
  termination gear is budgeted here.

## Pricing basis

Every price below is an **estimate to verify at purchase time**. Basis:

- 2026 street prices for vintage gear on eBay and surplus channels. Vintage
  lots are frequently sold untested; quantities below already include
  buy-extra margin where noted.
- New-equipment prices are typical online retail, not negotiated.
- Prices exclude shipping. Vintage telecom gear is heavy; assume 10-20%
  shipping on used line items, absorbed by the contingency line.
- Actual paid prices must be recorded in the H5 inventory file (asset tag,
  owner, cost) so the next event budgets from actuals, not these estimates.

Source column values:

| Source | Meaning |
| --- | --- |
| new | buy new retail |
| used | buy used, eBay/surplus/thrift |
| ShadyTel | borrow from ShadyTel (written loan) |
| village | borrow from another village or member |
| owned | already owned, no spend |

## Tier 1: Table Pilot

Roadmap contents: laptop, printer, browser terminal, MeshCore gateway. Matches
the Laptop Field Office Minimum in [Hardware BOM](hardware-bom.md) section 6A.
The browser terminal runs on the laptop; no serial terminal is required.

| Item | Qty | Est. unit USD | Source | Lead time |
| --- | --- | --- | --- | --- |
| Laptop or mini PC (field kit host) | 1 | 0 | owned | none |
| Wi-Fi travel AP/router | 1 | 60-100 | new | days |
| USB thermal receipt printer | 1 | 35-60 | new | days |
| MeshCore gateway node (LoRa) | 1 | 25-45 | new | 1-2 weeks |
| MeshCore loaner radios | 4 | 25-45 | new | 1-2 weeks |
| Meshtastic gateway node | 1 | 25-45 | new | 1-2 weeks |
| USB serial adapter (FTDI) | 1 | 12-18 | new | days |
| Battery pack or small UPS for host/AP/radio | 1 | 60-120 | new | days |
| Label maker and labels | 1 | 0 | owned | none |
| Paper: passport cards, order forms, cheat cards, laminate | lot | 40-80 | new | 1-2 weeks |
| Cables, spare USB power, power strip | lot | 30-60 | new | days |

- Subtotal (estimate): $390-710.
- Contingency 25%: $100-180.
- **Tier total (estimate): $490-890. Plan against the high end: $900.**

This tier must be fully costed and funded before the human rehearsal
(Rehearsal 3, 2027 Q2 per Workstream K). Target: funded by 2026 Q4, since the
MeshCore/Meshtastic radio set has a 2026 Q4 acquire-by for firmware burn-in.

## Tier 2: Village Field Office

Incremental over Table Pilot. Matches the OMNIDAT Village Field Office Target
in [Hardware BOM](hardware-bom.md) section 6A: dedicated mini PC, switch, UPS,
dot matrix printing, one real terminal station, expanded radio fleet, optional
POTS test path.

| Item | Qty | Est. unit USD | Source | Lead time |
| --- | --- | --- | --- | --- |
| Mini PC, N100-class (primary service host) | 1 | 160-240 | new | 1-2 weeks |
| Imaged spare SSD (cold spare path) | 1 | 30-50 | new | days |
| Managed switch, 8-port | 1 | 50-90 | new | days |
| UPS, 1000-1500 VA | 1 | 130-220 | new | 1-2 weeks |
| Dot matrix printer (Epson LX/Okidata ML class) | 1 | 60-150 | used | 2-6 weeks |
| Ribbon cartridges | 3 | 10-15 | new | 1-2 weeks |
| Continuous-feed paper, boxes | 2 | 30-45 | new | 1-2 weeks |
| Serial terminal (Wyse/VT class, cosmetic OK) | 1 | 100-250 | used or village | 4-8 weeks |
| Label printer | 1 | 35-90 | new | days |
| MeshCore loaner radios (to reach 8 total) | 4 | 25-45 | new | 1-2 weeks |
| MeshCore repeater/room-server nodes | 2 | 30-50 | new | 1-2 weeks |
| 2-port FXS ATA (Grandstream HT802 class) | 1 | 40-55 | new | days |
| External serial modems (hardware controller) | 2 | 25-60 | used | 2-6 weeks |
| Operator laptop | 1 | 0 | owned | none |
| Runbook binder, forms, demarc labels | lot | 30-50 | new | 1-2 weeks |

- Incremental subtotal (estimate): $940-1,730.
- Contingency 25%: $235-430.
- **Tier increment (estimate): $1,175-2,160.**
- **Cumulative with Table Pilot (estimate): $1,665-3,050.**

## Tier 3: Carrier Lab

Incremental over Village Field Office. Roadmap contents: Asterisk PBX, SIP,
USB modems, terminal server, Verifone terminals. The PBX host is the
Raspberry Pi Asterisk lab from
[runbooks/omnitel-raspi-pbx.md](../runbooks/omnitel-raspi-pbx.md); required
hardware tracks `data/verifone-simulator-profile.json` (raspberry-pi,
usb-modem-bank, asterisk-pjsip, analog-line-splitter-or-fxs-adapter). Terminal
families follow [Verifone Terminal Programming](verifone-terminal-programming.md):
TRANZ 330/380 primary, Omni 3200 fallback. Per
[PBX Design](pbx-design.md), the PRI endpoint is a PRI-to-SIP gateway rather
than a native card for V1.

| Item | Qty | Est. unit USD | Source | Lead time |
| --- | --- | --- | --- | --- |
| Raspberry Pi 5 kit (PBX host: PSU, case, SD/SSD) | 1 | 110-150 | new | 1-2 weeks |
| FXS gateway, 16-port (Grandstream GXW4216 class) | 1 | 120-300 | used | 2-6 weeks |
| External serial modems (USR Courier/Sportster class) | 6 | 25-60 | used | 4-8 weeks |
| USB-serial adapters (FTDI) | 6 | 12-18 | new | days |
| Terminal server, 8-16 port (Digi/Avocent class) | 1 | 60-150 | used | 4-8 weeks |
| Verifone TRANZ 330/380 (buy 3 to bench 2 working) | 3 | 25-75 | used | 4-12 weeks |
| Verifone Omni 3200 (fallback family) | 1 | 20-60 | used | 4-12 weeks |
| Verifone P250/P900 receipt printer | 1 | 20-60 | used | 4-12 weeks |
| Verifone programming/power cables, paper rolls | lot | 30-80 | used/new | 4-8 weeks |
| PRI-to-SIP gateway (Vega 100G/Patton SN417x class) | 1 | 100-300 | ShadyTel, else used | 4-12 weeks |
| Telephone line simulator (Viking DLE-200B class) | 1 | 60-120 | used | 2-6 weeks |
| Analog desk phones | 3 | 10-25 | used/thrift | 2-4 weeks |
| Fax machine | 1 | 20-60 | used/thrift | 2-6 weeks |
| RS-232 cable kit: DB25/DB9, null-modem, breakout | lot | 60-100 | new/used | 1-3 weeks |
| RJ11 patch, splitters, line cords | lot | 30-60 | new | days |
| Spare modem power supplies | 3 | 10-20 | used | 2-6 weeks |

- Incremental subtotal (estimate): $985-2,270.
- Contingency 25%: $245-570.
- **Tier increment (estimate): $1,230-2,840.**
- **Cumulative (estimate): $2,895-5,890.**
- If ShadyTel lends the PRI gateway, subtract $100-300 (long-lead tranche).

Funding tranches (see totals summary). Split so no item's acquire-by date
precedes its funding date:

- **Long-lead tranche, funded by 2027 Q1**: every line above with a
  2027 Q1-Q2 acquire-by in the long-lead list — FXS gateway, external serial
  modems x6, spare modem PSUs, terminal server, Verifone TRANZ x3, Omni 3200,
  P250/P900 printer, Verifone cables/rolls, PRI-to-SIP gateway. Subtotal
  $605-1,595; contingency 25% $150-400; **tranche total $755-1,995**.
- **Remainder tranche, funded by 2027 Q3**: Pi 5 kit, USB-serial adapters x6,
  telephone line simulator, analog desk phones, fax machine, RS-232 cable
  kit, RJ11 patch stock. Subtotal $380-675; contingency 25% $95-170;
  **tranche total $475-845**.

Vintage caveats baked into the quantities above:

- eBay Verifone lots are usually untested; assume 1-in-3 dead-on-arrival,
  hence three TRANZ units for two working benches. The generated
  `OMNISALE.TCL` is `bench-validation-required` per
  [Verifone Terminal Programming](verifone-terminal-programming.md), so real
  terminals are on the critical path, not decoration.
- Softmodems and winmodems do not count. Only hardware-controller external
  serial modems satisfy the BOM section 4/5 modem pool.

## Tier 4: Full ToorCamp

Incremental over Carrier Lab. Roadmap contents: ShadyTel handoff, PBX,
modem/PAD pool, NOC desk, printers, media/doc services. Media Vault and TV
excluded (see scope notes). Sized against the Event Target columns of
[Hardware BOM](hardware-bom.md) sections 1, 2, 6, 7, and 11.

| Item | Qty | Est. unit USD | Source | Lead time |
| --- | --- | --- | --- | --- |
| 12U road case or rolling rack | 1 | 150-350 | used or village | 4-8 weeks |
| Second UPS (telecom vs services split) | 1 | 130-220 | new | 1-2 weeks |
| Rack PDUs | 2 | 40-80 | used | 2-6 weeks |
| Ethernet patch panel + RJ11/66-block voice field | lot | 60-120 | new/used | 2-6 weeks |
| Cold spare PBX host (mini PC, imaged) | 1 | 160-240 | new | 1-2 weeks |
| Spare PRI-to-SIP gateway or PRI card | 1 | 0-300 | ShadyTel, else used | 4-12 weeks |
| RJ48 cables + loopback plug | lot | 30-60 | new | 1-2 weeks |
| Additional terminal stations (to reach 4+ total) | 3 | 100-250 | used or village | 4-12 weeks |
| Second dot matrix printer (spare/public split) | 1 | 60-150 | used | 2-6 weeks |
| Fax modem for fax-server path | 1 | 20-40 | used | 2-6 weeks |
| NOC status displays | 2 | 0 | owned/village | none |
| Consumables scale-up: paper, ribbons, forms, rolls | lot | 150-250 | new | 2-4 weeks |
| Signage, laminated cards, rubber stamps | lot | 60-120 | new | 2-4 weeks |

- Incremental subtotal (estimate): $960-2,180.
- Contingency 25%: $240-545.
- **Tier increment (estimate): $1,200-2,725.**
- **Cumulative program total (estimate): $4,095-8,615.**

## Totals summary

All figures are estimates to verify; contingency (25%) included.

| Tier | Increment USD | Cumulative USD | Must be funded by |
| --- | --- | --- | --- |
| Table Pilot | 490-890 | 490-890 | 2026 Q4 (radio burn-in acquire-by) |
| Village Field Office | 1,175-2,160 | 1,665-3,050 | 2027 Q2-Q3 if pilot targets this tier |
| Carrier Lab: long-lead tranche | 755-1,995 | 2,420-5,045 | 2027 Q1 (covers all 2027 Q1-Q2 acquire-by items) |
| Carrier Lab: remainder | 475-845 | 2,895-5,890 | 2027 Q3 (bench proof 2027 Q4) |
| Full ToorCamp | 1,200-2,725 | 4,095-8,615 | 2028 Q1 (go/no-go gate) |

The Carrier Lab tier is funded in two tranches so no long-lead item's
acquire-by date precedes its funding date; tranche membership is itemized in
the Tier 3 section.

The contingency line covers shipping on used gear, dead-on-arrival churn
beyond the buy-extra margins, and price drift between this estimate and
purchase date. Do not plan spend against subtotals without it.

## Long-lead acquisition list

Carrier Lab bench work must be done by 2027 Q4 (Workstream K). Vintage gear
needs bench time before that, and eBay sourcing is unpredictable, so long-lead
items get explicit acquire-by dates. "Acquire-by" means working on the bench,
not ordered.

| Item | Acquire by | Why |
| --- | --- | --- |
| MeshCore/Meshtastic radios (full Table Pilot set) | 2026 Q4 | Needed through all rehearsals; firmware/config burn-in. |
| Dot matrix printer + ribbons | 2027 Q1 | Print path proof for Rehearsal 3 collateral. |
| Verifone TRANZ 330/380 x3 + P250 printer + cables | 2027 Q1 | TCL programs are bench-validation-required; longest validation tail. |
| Verifone Omni 3200 | 2027 Q1 | Fallback family must be proven before it is needed. |
| External serial modems x6 + spare PSUs | 2027 Q2 | Modem pool bench, dial-in path, hunt group tests. |
| Terminal server | 2027 Q2 | PAD/terminal port bench. |
| FXS gateway (16-port) | 2027 Q2 | Analog line plant for modem/fax/phone bench. |
| PRI-to-SIP gateway (or confirmed ShadyTel loan) | 2027 Q2 | PRI settings bench before ShadyTel interop talks (2027 Q3). |
| Serial terminals (watch listings from 2026 Q4) | 2027 Q3 | Prices rising; collectible market, sporadic supply. |
| Road case/rack + patch panels | 2028 Q1 | Only needed for the ToorCamp buildout. |

Standing sourcing practice: saved eBay searches for each long-lead category
now, buy opportunistically when a good listing appears rather than
just-in-time at the acquire-by date.

## Borrow versus buy

Decision rule:

- **Buy** anything that gets custom config or firmware burned in and is used
  across multiple events: service hosts, radios, modems, Verifone terminals,
  printers, the Pi PBX.
- **Borrow** bulky, single-event, or test-only items: racks, CRTs, T1 test
  sets, extra terminals, displays.
- Never borrow an item on the critical-spares list without a written loan
  that covers the full event window plus teardown and a shipping/return plan.
- Every borrowed item enters the same H5 inventory file with `owner` set to
  the lender.

Ask list by lender (all unconfirmed; see open questions):

| Lender | Items | When to confirm |
| --- | --- | --- |
| ShadyTel | PRI-to-SIP gateway or PRI card (bench loan), T1/PRI test set, RJ48/demarc materials, PRI settings guidance | Bench loan ask 2027 Q1-Q2; event gear at the 2027 Q3 leadership conversation |
| Other villages / members | serial terminals, CRT displays, road case or rack, fax machine, analog phones | Alongside pilot-event planning, 2027 Q1-Q2 |
| OMNIDAT members | laptops, label maker, monitors, hand tools | Now; record in inventory as owned |

[Open Questions](open-questions.md) already tracks "what can be borrowed from
ShadyTel or other villages" — answers land there and in the inventory file.

## Spares policy

Policy, matching the H5 exit gate that all critical spares are labeled:

- Every single-point-of-failure device in the deployed tier has either a
  labeled cold spare on site or a printed, rehearsed degradation path.
- Consumables (ribbons, paper, receipt rolls, labels, batteries) are stocked
  at 2x the expected event burn.
- Spares are bench-tested and imaged before packing, not at camp.

Cost treatment: spares already itemized above (spare SSD, spare PBX host,
spare gateway, second printer, modem buy-extra margin, spare PSUs) are in the
tier tables. Additional spares budget on top:

| Tier | Extra spares budget (estimate) |
| --- | --- |
| Table Pilot | $50-100 (spare radio, spare receipt paper/power) |
| Village Field Office | $100-200 (spare AP, spare switch PSU, extra ribbons) |
| Carrier Lab | $150-300 (7th/8th modem, spare Verifone unit kept whole) |
| Full ToorCamp | $200-400 (spare switch, spare terminal, cable stock) |

These are inside each tier's 25% contingency at the low end; treat the high
end as new money if failures during bench work eat the margin.

## Funding offsets (optional)

None of these are load-bearing. The Table Pilot tier must be fundable out of
pocket by project members; offsets only accelerate the later tiers.

- Sponsors: village or company sponsorship of named terminal stations or the
  printed phone book back cover. Requires leadership-pack-consistent wording
  (no implication of official event services).
- Merch: printed camp phone book / directory zine, PAD cheat-card art prints,
  patches. Production cost must be recovered at small volumes before counting
  any margin.
- Collectibles: serial-numbered OmniBucks-adjacent paper artifacts. Blocked
  on the Workstream I legal sanity pass for bearer-instrument-like paper;
  do not sell anything money-shaped before that note is on file.

Any offset income is tracked in the same budget sheet as spend, and offsets
never justify skipping the funded-by dates in the totals table.

## Exit gates

- Table Pilot tier fully costed and funded before the human rehearsal
  (Rehearsal 3, 2027 Q2); funding confirmed by 2026 Q4 so the radio set can
  be acquired on schedule.
- Carrier Lab long-lead tranche funded by 2027 Q1; remainder tranche funded
  by 2027 Q3.
- Every long-lead Carrier Lab item acquired and bench-working by its
  acquire-by date, all before the 2027 Q4 bench-proof milestone.
- Every purchase records actual price, source, and asset tag in the H5
  inventory file; the budget sheet reconciles estimates against actuals.
- Borrowed critical items have written loan terms on file before the event
  they serve.

## Open questions

- Who funds each tier: personal spend, a village pool, or sponsor money?
  Owner and decision needed before the 2027 Q1 funding gate (Table Pilot
  plus the Carrier Lab long-lead tranche).
- Does the 2027 pilot target Table Pilot or Village Field Office tier
  (roadmap decision, decide by 2026-10-01)? This sets whether Tier 2 money
  is needed in 2027 Q2 or can slip.
- What is the transport budget and maximum rack/case size (open in
  [Open Questions](open-questions.md))? This decides road case versus
  borrowed rack in Tier 4.
- What will ShadyTel actually lend, and on what terms? The PRI gateway line
  swings $0-600 across Tiers 3-4.
- New versus used dot matrix: used Epson/Okidata at $60-150 or new Epson
  LX-350-class at roughly $250-350; decide when the print path is benched.
- Media Vault, OMNIDAT TV, and ATV budgets are unowned and unscheduled;
  they need their own costing pass if they enter pilot scope.
