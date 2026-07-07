# OMNIDAT

**OMNIDAT** is the permanent record.

OMNIDAT is the channel. All activity is observed through Exchange 88, packet services, terminals, and the ledger. It combines a real PBX interconnect, dialable business services, X.25-style packet networking, terminal services, document services, a robotic media vault, operator tooling, and the carrier network for commerce.

OMNIDAT does not request participation. It records. Your activity is already compiled. Compliance registers as the only efficient state.

**Tagline candidates:**

- Financial Data Services
- Account, Terminal, Settlement, Media
- Your business is already in our system.
- The Record is total.
- Compliance is the only efficient state.

## Live Surfaces

| Surface | URL / Access | Purpose |
|---------|--------------|---------|
| Public demo / marketing | https://omnidat.cc | Worker-hosted public face, status, and entry points |
| Operator Console | https://console.omnidat.cc | Real operator / NOC / admin surfaces (VT100 terminal, packet calls, CRUD) |
| Telnet PAD (lab/demo) | telnet to configured host:2525 (see pad-telnet) | Real-terminal path into the packet network (byte-identical to web VT100) |

## Concept & Topology

OMNIDAT requests an ISDN PRI T1 (or SIP trunk) from ShadyTel and receives the `8800-8823` (and adjacent) number block. ShadyTel owns the camp telephone network and C*NET-facing interconnect; OMNIDAT operates the services behind Exchange 88.

```text
ShadyTel / C*NET
      |
ISDN PRI T1 (or equivalent)
      |
OMNIDAT PBX
      |
      +--> OMNIDAT Online (BBS, shell, file drop, store-and-forward)
      +--> OMNIDAT Packet Clearing (X.25 / PAD / X.121)
      +--> OMNIDAT Document Services (fax, print desk)
      +--> OMNIDAT Media Vault (robotic VHS + ATV)
      +--> Merchant Carrier (Shadybucks ATMs, POS, NiteMarkt BOH, vendor terminals)
      +--> operator, diagnostics, direct lines, ShadyRoulette
```

Access transports (POTS modems, radio PAD via MeshCore/Meshtastic, Wi-Fi, telnet bridges, XOT in browser, hosted nodes) are **not** the service identity. Packet Clearing X.121 addresses and Exchange 88 numbers are.

## Service Families

- **OMNIDAT Exchange 88** — PBX number block and dial-in front door.
- **OMNIDAT Financial Network** — overall business data network identity.
- **OMNIDAT Packet Clearing** — X.25, PAD, terminal services, service directory, verb execution, session recording.
- **OMNIDAT Merchant Carrier** — private access network for Shadybucks ATMs/POS/proxy hosts, NiteMarkt back-office, vendor systems.
- **OMNIDAT Online** — BBS, shell, file drop, store-and-forward.
- **OMNIDAT Document Services** — fax machine/server, print desk, dot-matrix output, forms & receipts.
- **OMNIDAT Media Vault** — robotic VHS library, playback queue, analog TV, local IP stream, amateur television (ATV) experimental feed.
- **OMNIDAT TrustDesk** — operator, directory assistance, trouble line (8800 / 8819).

See the full [Service Index](docs/service-index.md) (8800–8824+) and [Packet Services](data/packet-services.json).

## Dual Implementation (Simulation + Live)

OMNIDAT maintains two tightly coupled layers that share concepts, data shapes, and deterministic rendering logic.

### 1. Simulation & Evidence Layer (repo root)

Python tooling, JSON seed data, SQLite build, and artifact generators. Used for:

- Rehearsals and weekend-scale simulations (1,000+ camper scenarios with Night Market, Miliways, OmniBank, activity passports, network fees, etc.).
- Generating printable evidence: service directories, packet directories, billing statements, forms, ledgers, receipts.
- Test harnesses and E2E validation (`tests/`, `scripts/e2e-*`, `scripts/weekend-sim`).
- Field kit journal, radio PAD, queue dispatch, and FryOS bridge for real camp operations.
- Media vault, document services, verifone, packet, and activity simulators.

All seed data lives under `data/`. Outputs land in `build/`.

### 2. Operator Surface & Live Services (`gmacko/`)

A customized `create-gmacko-app` monorepo (Next.js 16 + React 19 + tRPC + Drizzle + better-auth + Turbo + Storybook + etc.) that powers the real operator experience:

- **Operator Console** (`/console`): live dashboard, packet services, food/ATM protocols, vintage terminal support, provisioning verification.
- **VT100 Terminal** (`/console/terminal`): interactive service sessions with cursor-addressed screens, attract screensaver, session recording. Deterministic renderers live in `gmacko/packages/operator-core`.
- **NOC** and **Admin/Operator CRUD** surfaces.
- **PAD Telnet Bridge** (`gmacko/packages/pad-telnet`): real TCP telnet server that speaks the exact same verb + service screen protocol as the web VT100. Safe for physical terminals or public demo.
- Shared APIs for `packetCall`, session persistence, evidence, Shady Bank ISO-like flows, etc.
- Deployed to ForgeGraph (and Cloudflare Worker lanes) as `console.omnidat.cc` (and the public worker at `omnidat.cc`).

The two layers are intentionally aligned: the same service verbs, screen renderers (where possible), X.121 semantics, and evidence model are exercised in sim and in production.

## Current Status (as of 2026-07)

- All seed data validates cleanly (25+ services, full packet namespaces, transports, terminals, media catalog, etc.).
- Weekend-scale simulation, e2e omnibank, activity logging, queue/radio-pad, document & media flows proven.
- Live public Worker at `omnidat.cc`.
- Operator console with real VT100 interactive sessions, attract mode, and recording.
- Telnet PAD bridge for real terminals (byte-identical to browser).
- Authentik-backed OmniAuth + better-auth for the console.
- FryOS bridge for selected Miliways orders.
- Active implementation plans in `docs/plans/` (H1–H5+ workstreams: operator core, browser XOT, transport adapters, camp apps, merchant rails, field & events).

Hard gaps still being closed (see [Roadmap](docs/roadmap.md) and [Hacker Camp Readiness Validation](docs/plans/2026-07-04-hackercamp-readiness-validation.md)):

- Full persistent operator CRUD + role gating end-to-end.
- Browser XOT + additional transport adapters writing honest sessions + evidence.
- Production authority model (field kit vs cloud) exercised in rehearsals.
- Real hardware bench + full interconnect.

## Planned Camp Deployments

OMNIDAT is purpose-built as a retro packet-data carrier for large hacker camps, with explicit portability for smaller events, villages, night markets, and rehearsals. The durable model favors field authority during active events (see authority model in the [Roadmap](docs/roadmap.md)).

### ToorCamp 2028 (Flagship Target)

ToorCamp 2028 is the primary, flagship target event.

Planned usage at ToorCamp 2028 includes:

- Full physical installation, positioned as an opt-in village or official experimental camp data service (subject to leadership approval via the [Leadership Pilot Package](docs/leadership-pilot-package.md)).
- ShadyTel interconnect for Exchange 88 (ISDN PRI T1 or equivalent SIP handoff) if available; otherwise local or simulated access paths.
- Deployed hardware: PBX, X.25/PAD gateways and bridges (including telnet and radio/MeshCore/Meshtastic PADs), Verifone-style and serial terminals, dot-matrix printers, fax capability, and the robotic VHS Media Vault with analog TV + experimental ATV feed.
- Live 24/7 operator/NOC desk running the gmacko V1 console (interactive VT100 service sessions, packet directory/calls, provisioning, evidence review, CRUD).
- Packet Clearing and Merchant Carrier services for: campsite apps (open namespace + approved), Miliways food orders, Night Market / vendor back-office, Shadybucks ATM/POS/proxy circuits, activity passports, billing statements, and printed forms/receipts/ledgers.
- Field kit authoritative operation during the active event window, with cloud sync and graceful failover.
- On-site generation of human-visible evidence artifacts (directories, session receipts, settlement reports, incident logs) via the Python tooling and document services.
- Supporting timeline: 2027 rehearsals and pilot events (including targeted Rehearsal 3 around 2027 Q2) to bench hardware, prove procedures, and conduct human rehearsals before the full 2028 buildout (see [Hardware BOM](docs/hardware-bom.md), [budget-sourcing](docs/budget-sourcing.md), and H6–H7 in the roadmap).

The goal is a credible, self-operable packet-era financial data service that feels native to the camp environment.

### CC Camp 2027 (Potential Target)

Chaos Communication Camp (also known as CCCamp or CC Camp) 2027 is a strong candidate for a major deployment or large-scale rehearsal.

- The Chaos Communication Camp (CCCamp) is the international, five-day open-air hacker event organized by the Chaos Computer Club, typically held every four years in summer (previous: 2023; next expected ~late July or August 2027, location TBD in Europe). See [events.ccc.de](https://events.ccc.de/en/camp/) and the [Wikipedia page](https://en.wikipedia.org/wiki/Chaos_Communication_Camp).
- A 2027 deployment would serve as a high-visibility European proving ground and major rehearsal ahead of ToorCamp 2028.
- It exercises the multi-event network vision (H8 roadmap), historical record keeping, recurring deployments, and partner nodes.
- Validates the system under different scale, logistics, power, interconnect (local telco or camp-provided), and participant demographics assumptions.
- Opportunity for broader opt-in services across a very large attendee base, plus cross-pollination with European hacker culture and villages.
- Can run in "full" or "field-office lite" mode depending on approvals and hardware readiness in 2027.

Even without a full interconnect, OMNIDAT is designed to deliver value using event LAN, radio PAD transports, hosted nodes, or POTS. Smaller 2027 pilots and the 2027 rehearsal circuit feed directly into ToorCamp 2028 readiness.

See [Roadmap](docs/roadmap.md) (H6 Rehearsals and Pilot Events, H7 ToorCamp 2028 Buildout, H8 Multi-Event Network) and related plans in `docs/plans/`.

## North Star & Operating Principles

From the [Roadmap](docs/roadmap.md):

- X.25 / Packet Clearing = network authority.
- Printed receipts, forms, ledgers, and directories = human-visible truth.
- Event active + field kit online → field authoritative, cloud follows.
- Access is many (POTS, radio, mesh, telnet, XOT, Wi-Fi); identity is few (X.121 + Exchange 88).

Protocol fidelity, honest X.25 cause codes, deterministic session replay, and evidence export are non-negotiable.

## Repository Map

```
.
├── README.md                 # You are here (detailed overview)
├── data/                     # Canonical seed data (validate + build-db + render)
├── docs/                     # Design, architecture, plans, runbooks
│   ├── architecture.md
│   ├── data-model.md
│   ├── service-index.md
│   ├── packet-clearing.md
│   ├── operator-model.md
│   ├── roadmap.md
│   └── plans/                # Active workstream plans (H-series)
├── scripts/                  # Operator and dev CLI surface (see below)
├── tools/                    # Python implementation of simulators & generators
├── tests/                    # Python + worker tests
├── build/                    # Generated artifacts, DB, sim outputs (gitignored)
├── gmacko/                   # Operator console, APIs, pad-telnet, shared packages
│   ├── apps/nextjs/          # console.omnidat.cc + public surfaces
│   ├── packages/operator-core/  # Deterministic VT100 + service renderers
│   ├── packages/pad-telnet/  # Real telnet PAD server
│   └── ...
├── worker/                   # Cloudflare Worker for omnidat.cc
├── configs/asterisk/         # PBX config scaffolds
├── forms/                    # Printable form masters
├── runbooks/
└── package.json              # Root npm scripts (delegates v1:* to gmacko)
```

See also `gmacko/AGENTS.md`, `gmacko/CLAUDE.md` (via gstack), and `gmacko/docs/`.

## Getting Started

### Prerequisites

- Python 3 + standard library modules used by the tools.
- Node 24 + pnpm 10.32.1 (for gmacko V1).
- (Optional but recommended) Postgres for full gmacko operator surface; SQLite for sims.

### Simulation Layer (root)

Validate seeds, build the local DB, and render artifacts:

```sh
./scripts/validate-data
./scripts/build-db
./scripts/render-artifacts
./scripts/status
```

Run the big weekend simulation (produces reports, ledgers, statements, events). Supports load/saturation testing:

```sh
./scripts/weekend-sim
OMNIDAT_WEEKEND_LOAD_FACTOR=2.5 ./scripts/weekend-sim  # triggers congestion in terminals/radio
# See packet-clearing.md for X.25 etiquette (anti-saturation) and sim metrics (congested_sessions).
```

Other simulators:

```sh
# Media Vault
./scripts/media-vault init
./scripts/media-vault request PUB-0001 --source pad --requested-by ACCT-000001
./scripts/media-vault approve-next --operator MG
./scripts/media-vault start
./scripts/media-vault complete

# Packet Clearing
./scripts/packet directory
./scripts/packet --account ACCT-000001 call 000002

# Field office / radio pad / queue (Miliways example)
./scripts/activity badges
./scripts/queue menu miliways
./scripts/queue order miliways PASS-04271 tea
./scripts/radio-pad DIR
./scripts/radio-pad REQ 020501 ORDER tea PASS-04271

# FryOS bridge (when a real FryOS is reachable)
export FRYOS_BASE_URL=... FRYOS_OPERATOR_TOKEN=...
./scripts/radio-pad REQ ...

# Verifone / document services / events
./scripts/verifone-sim
./scripts/documents print ...
./scripts/events append ...
./scripts/events summary
```

Serve the lightweight Field Office UI (FryOS-compatible health endpoints):

```sh
./scripts/ui --port 8828
# or
npm run dev
curl http://127.0.0.1:8828/api/health/ready
```

Run full test suite:

```sh
npm test
```

### Operator Console & Live Services (gmacko V1)

From repo root:

```sh
# One-time setup (installs, lefthook, etc.)
cd gmacko
pnpm setup
pnpm bootstrap:local   # guided local Postgres + seed path recommended

# Auth schema generation (better-auth)
pnpm auth:generate

# Run the Next.js operator app (includes console, VT100, NOC, admin)
pnpm dev:next
# or from root:
npm run v1:dev
```

Useful gmacko commands (from `gmacko/`):

- `pnpm check:fast`, `pnpm test`, `pnpm build`
- `pnpm db:push`, `pnpm db:studio`
- `pnpm forge:...` for ForgeGraph deployment
- `pnpm trpc:ops -- --help` (operator CLI over tRPC)
- `pnpm mcp:app` (MCP server)

The pad-telnet bridge (standalone, read-only for demo safety):

```sh
pnpm --filter @omnidat/pad-telnet build
PORT=2525 HOST=0.0.0.0 node packages/pad-telnet/dist/index.js
telnet localhost 2525
```

See `gmacko/packages/pad-telnet/README.md` and `gmacko/deploy/`.

### Database Notes

- **Simulation**: `build/omnidat.db` (SQLite) built from seeds via `./scripts/build-db`.
- **gmacko / live operator**: Postgres. Use `DATABASE_URL_LOCAL` (Tailscale) for dev, Hyperdrive in production per ForgeGraph conventions. OMNIDAT records live in the `omnidat` schema.
- Shared Postgres checks: `npm run db:shared:check`.
- Migrations for the gmacko app use the standard `@omnidat/db` tooling.

## Key Scripts (root)

| Command | Description |
|---------|-------------|
| `./scripts/validate-data` | Validate all JSON seeds |
| `./scripts/build-db` | Build `build/omnidat.db` from seeds |
| `./scripts/render-artifacts` | Generate directories, asterisk routes, teletext, etc. |
| `./scripts/status` | Current operator status snapshot |
| `./scripts/ui` | Serve lightweight Field Office UI |
| `./scripts/events ...` | Append & summarize operational events |
| `./scripts/queue ...` / `./scripts/radio-pad ...` | Dispatch & field office tickets |
| `./scripts/activity ...` | Passport & badge stamping |
| `./scripts/packet ...` | Packet Clearing directory & sessions |
| `./scripts/media-vault ...` | Media vault request/approve/playback |
| `./scripts/documents ...` | Print & fax simulation |
| `./scripts/verifone-*` | Verifone/ISO terminal sims |
| `./scripts/weekend-sim` | Full multi-day camp simulation |
| `./scripts/e2e-omnibank` | End-to-end bank/terminal flows |
| `npm run v1:*` | Delegate to gmacko (dev, build, test, db) |
| `npm test` | Python + worker tests |

All generated outputs default to `build/`.

## Data Seeds (`data/`)

See `data/README.md` for the full list and FryOS bridge notes. Core files:

- `services.json`, `endpoints.json` — Exchange 88 + routable endpoints.
- `packet-services.json`, `packet-namespaces.sample.json` — X.121 directory + namespace rules.
- `transport-profiles.sample.json`, `carrier-circuits.sample.json`, `terminals.sample.json` — access methods and hardware.
- `accounts.sample.json`, `vendors.sample.json`, `campsite-apps.sample.json` — identities.
- `queue-apps.sample.json`, `activity-passports.sample.json`, `badges.sample.json`.
- `media-catalog.sample.json`, `atv-stations.sample.json`.
- `verifone-simulator-profile.json`, `omnibank-fake-profile.json`.

Always run `./scripts/validate-data` after edits.

## Documentation

**Core design:**

- [Architecture](docs/architecture.md)
- [Identity](docs/identity.md)
- [Corporate History](docs/corporate-history.md)
- [Compliance Directive](docs/compliance-directive.md)
- [Assimilation Protocol](docs/assimilation-protocol.md)
- [Network Observation Directive](docs/network-observation-directive.md)
- [Assimilation Protocol](docs/assimilation-protocol.md)
- [Network Observation Directive](docs/network-observation-directive.md)
- [Data Model](docs/data-model.md)
- [Service Index](docs/service-index.md)
- [Integration Map](docs/integration-map.md)
- [System Requirements](docs/system-requirements.md)
- [Operator Model](docs/operator-model.md)

**Domain areas:**

- [Packet Clearing](docs/packet-clearing.md)
- [Shadybucks Carrier Network](docs/shadybucks-carrier-network.md)
- [Document Services](docs/document-services.md)
- [Media Vault](docs/media-vault.md)
- [Video Distribution / ATV](docs/video-distribution.md)
- [PBX Design](docs/pbx-design.md), [Dial Plan](docs/dial-plan.md)
- [Field Office Network Plan](docs/field-office-network-plan.md)
- [Shared Infrastructure with FryOS](docs/shared-infra-fryos.md)

**Operational:**

- [Lab Bring-Up](docs/lab-bringup.md)
- [Hardware BOM](docs/hardware-bom.md)
- [Runbooks](runbooks/README.md)
- [Forms](forms/README.md)
- [Asterisk Config](configs/asterisk/README.md)

**Governance & future:**

- [Roadmap](docs/roadmap.md)
- [Plans/](docs/plans/) — active slices (H1a operator core, H2 browser XOT, H2b adapters, H3 camp apps, H4 merchant, H5–H8 field/events, etc.)
- [Open Questions](docs/open-questions.md)
- [Acceptance Tests](docs/acceptance-tests.md)
- [Protocol Fidelity](docs/protocol-fidelity.md)
- [Leadership Pilot Package](docs/leadership-pilot-package.md)

## Recent Work (what "this" refers to)

- Deterministic interactive VT100 service sessions + attract screensaver + recording.
- Telnet PAD bridge package (`@omnidat/pad-telnet`) for physical / real terminals.
- Host networking deploy notes for k3s telnet PAD.
- Slowed attract typing + simulated X.25 latency.
- OmniAuth (Authentik OIDC) + better-auth wiring into the operator console.
- ATV Teletext support and loading into the OMNIDAT DB.
- Persistent operator workflows, CRUD slices, merchant rails, and field kit plans.
- Continued alignment between Python evidence layer and gmacko operator-core renderers.

See the last 20 commits and `docs/plans/` for the detailed current slice.

## Deployment & Infrastructure

- **gmacko / console**: ForgeGraph (primary), Nix, colocated Postgres early on. See `gmacko/deploy/forgegraph/` and `gmacko/docs/DEPLOYMENT.md`.
- **Public worker**: Cloudflare (omnidat.cc) with Hyperdrive to shared Postgres.
- **PAD / terminals**: Deploy `@omnidat/pad-telnet` as a service (systemd unit example in the package). Use real serial-to-telnet adapters for DEC/Televideo hardware.
- **PBX**: Asterisk scaffolds under `configs/asterisk/`.
- Secrets, stages, and DB provisioning follow ForgeGraph conventions (see top-level system reminders in this workspace).

Runbooks live in `runbooks/`.

## Testing & Quality

- Python unittests + worker tests: `npm test`
- gmacko: `pnpm check:fast`, `pnpm test`, `pnpm build`
- Data: `./scripts/validate-data`
- E2E simulations exercise the full evidence path (events → reports → printed artifacts).
- Session renderers are pure functions — recordings are byte-exact replays.

## How to Keep Working on It in Detail

1. Pick or create a plan under `docs/plans/`.
2. Align changes across layers when possible (seed data + Python tools + operator-core renderers + tRPC APIs + UI).
3. Generate or update printable evidence and run the relevant simulator or e2e script.
4. Exercise the change from the operator console (web VT100 or telnet PAD).
5. Update the relevant doc + this README if the mental model or onboarding changes.
6. Land via the normal git / ForgeGraph flow.

The project values protocol fidelity, evidence you can print and hand to a human, and systems that remain operable by trained operators during an event.

## References & Credits

- Built on the gmacko / create-gmacko-app stack (Turborepo, Next.js, tRPC, Drizzle, better-auth, ForgeGraph).
- Retro fidelity references: X.25, X.121, PAD, Verifone/Tranz/Omni terminals, 1980s corporate forms, VHS robotics, C*NET/ShadyTel aesthetic.
- Internal partners: ShadyTel, FryOS, Shadybucks, NiteMarkt, OmniBank.

---

*OMNIDAT. The permanent record. Exchange 88.*

For the absolute latest operational snapshot, run `./scripts/status` and `./scripts/validate-data`.
