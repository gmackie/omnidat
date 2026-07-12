# Agent Handoff — OMNIDAT

**Last updated:** 2026-07-13  
**Branch tip:** working copy (jj-colocated; see `jj log` / `git log`)  
**Remotes:** `forge` → `git.forgegraf.com/gmackie/omnidat-app.git`, `github` → `github.com/gmackie/omnidat.git`

Read this first. Then skim root `README.md`, the current implementation, and
the plan for the horizon you are touching under `docs/plans/`.

> **Status warning:** do not use `docs/roadmap.md` alone as a current status
> report. Its `Current State`, `Known hard gaps`, and `Near-Term Build Order`
> sections predate H1-H4 code already present in the live tree. The July 5
> plans, implementation, and tests are newer.

---

## What this project is

**OMNIDAT** is a retro packet-data carrier for hacker camps — X.25-style Packet Clearing, Exchange 88 PBX services, terminals, merchant rails (OmniBank/Shadybucks), document services, media vault, and operator/NOC tooling.

It is **not** a generic SaaS app. It is a dual-layer system:

1. **Simulation & evidence layer** (repo root) — Python tools, JSON seeds, SQLite `build/omnidat.db`, weekend sims, printable artifacts.
2. **Live operator surface** (`gmacko/`) — customized `create-gmacko-app` monorepo (Next.js + tRPC + Drizzle + better-auth) for console, VT100/XOT terminal, NOC, CRUD, pad-telnet, Matrix bridge.

**Flagship target:** ToorCamp 2028. **Strong candidate rehearsal:** CC Camp 2027.  
**Public edge:** https://omnidat.cc (Cloudflare Worker).  
**Operator console:** https://console.omnidat.cc (gmacko V1).

### Product tone (lore)

Corporate Borg LARP: total observation, assimilation, compliance, the permanent record. Recent commits deliberately **purged gmacko branding from lore surfaces** and **removed dates** from in-world artifacts. Prefer ominous corporate language in forms, ATV teletext, media catalog, service help text, and terminal slogans — not scaffold/marketing language. Key lore docs:

- `docs/assimilation-protocol.md`
- `docs/total-observation-mandate.md`
- `docs/ledger-assimilation-protocol.md`
- `docs/network-observation-directive.md`
- `docs/corporate-history.md`
- `forms/`, `build/atv-teletext/`, media catalog seeds

Do **not** reintroduce “gmacko” into participant-facing or in-world copy.

---

## North star & non-negotiables

From `docs/roadmap.md`:

```text
X.25 / Packet Clearing = network authority
web / POTS / Wi-Fi / MeshCore / Meshtastic / hosted nodes = access transports
printed receipts / forms / ledgers = human-visible truth
```

**Authority model (decided):**

```text
event active + field kit online -> field kit authoritative, cloud follows
field kit offline or failed     -> cloud primary (operator failover)
no active event                 -> cloud authoritative
simulation                      -> sim field kit, same sync path
```

Non-negotiable: protocol fidelity, honest X.25 clear/cause codes, deterministic session replay, evidence export. See `docs/protocol-fidelity.md` and X.25 etiquette in `docs/packet-clearing.md` (anti-saturation, brief sessions, honest CLR).

**Access is many; identity is few:** transports (POTS, radio, telnet, XOT, Wi-Fi) are not service identity. **X.121 + Exchange 88 numbers** are.

---

## Repository map (where to edit)

| Path | Role |
|------|------|
| `data/` | Canonical seed JSON (validate before commit) |
| `tools/` + `scripts/` | Python simulators, generators, CLIs |
| `tests/` | Python unit tests + Worker tests |
| `build/` | Generated artifacts/sim output (**gitignored**; rebuildable) |
| `docs/` + `docs/plans/` | Architecture, roadmap, H-series implementation plans |
| `forms/` | Printable form masters |
| `worker/` + `wrangler.jsonc` | Public Worker (`omnidat.cc`) |
| `configs/asterisk/` | PBX scaffold, not production-complete |
| `gmacko/apps/nextjs/` | Operator + public Next app |
| `gmacko/packages/api/` | tRPC routers (`omnidat-*.ts`) |
| `gmacko/packages/operator-core/` | VT100, service screens, attract mode, deterministic renderers |
| `gmacko/packages/pad-telnet/` | Real TCP telnet PAD (byte-aligned with web terminal) |
| `gmacko/packages/matrix-bridge/` | MSG/MAIL/board backend for PAD |
| `gmacko/packages/db/` | Drizzle schema / migrations surface |
| `gmacko/AGENTS.md` | gmacko monorepo agent conventions (pnpm, jj, emulate, ForgeGraph) |

UI entry points (gmacko Next):

- `apps/nextjs/src/app/console/` — operator console
- `apps/nextjs/src/app/_components/omnidat-*.tsx` — dashboards, XOT terminal, operator CRUD
- `apps/nextjs/src/app/pad/`, `noc/`, `operator-admin/`

---

## Current status (honest)

### Ready / proven

- Seed validation, service map `8800–8824`, packet namespaces, terminals, transports, media catalog.
- Weekend-scale sim (1000+ campers), OmniBank e2e, activity passports, network fees, load/saturation modes (`OMNIDAT_WEEKEND_LOAD_FACTOR`, congested sessions).
- The repo documents public Worker health/network/demo APIs on `omnidat.cc`.
  Their deployed commit and persistence path were not reverified while writing
  this handoff.
- gmacko operator console: VT100 interactive sessions, attract screensaver, session recording.
- Telnet PAD bridge for real terminals (`packages/pad-telnet`).
- Browser XOT terminal path with CALL/DIR/CAMP/EVIDENCE and receipt polish.
- H1a/H1b-oriented work: role-gated procedures, audit events, operator CRUD forms (events, campsites, allocations, provisioning, incidents, campsite apps, batch close).
- H3 campsite app kinds as data (`CAMP_APP_KINDS`), create/list/promote/delist.
- H4 merchant/sim rails largely coded (ISO 8583, Verifone, ATM setup, fee policy); **money policy sign-off still open**.
- Matrix bridge + PAD MSG/MAIL/board; RIOT Discord-mirror relay; directory integration (DIR + CALL).
- Heavy lore expansion (assimilation/observation/ledger protocols, ATV teletext, forms, slogans).
- Leadership pilot materials exist in markdown (`docs/leadership-pilot-package.md`, deck sources); PDF under `build/` may exist from renders.

### Not camp-critical yet (hard gaps)

- Full end-to-end production role enforcement + identity without developer intervention.
- One **deployed** real terminal/XOT path writing NOC + evidence end-to-end in production (lab/demo paths exist; ops gate not closed).
- Field kit journal / split-authority sync fully exercised in rehearsals (`docs/plans/2026-07-04-split-authority-sync.md`).
- Real hardware bench inventory + interconnect with ShadyTel still open questions.
- Bank/currency **policy** (not just code): mint/void/redeem/dispute, bearer paper legal sanity.
- Named rehearsal calendar (decision target ~2026-10-01 in roadmap expansion).
- `main` is **~33 commits ahead of `forge/main`** — may need push/deploy before production matches tip.

### Verdict (from readiness validation)

Ready for **leadership pilot conversation** and **credible live simulation**.  
**Not** ready as camp-critical infrastructure.

---

## Horizon / plan index (workstreams)

Plans live in `docs/plans/`. Prefer implementing against a named plan rather than inventing scope.

| Horizon | Plan | Intent | Rough state |
|---------|------|--------|-------------|
| H0 | leadership package + roadmap | Pilot story | Docs strong; keep public claims honest |
| H1a | `2026-07-04-h1a-operator-core-slice.md` | Role-gate, audit, bridge-critical CRUD | Largely landed in code |
| H1b | `2026-07-05-h1b-operator-crud.md` | Full operator CRUD UI | Forms + legal provisioning step-through (request/advance/suspend/revoke); full-path tests green |
| H2 | `2026-07-05-h2-browser-xot-bridge.md` | Browser XOT → evidence | `packetCall` persists linked `packet-call-receipt` evidence; terminal shows EVIDENCE id; unit tests green; production deploy e2e still open |
| H2b | `2026-07-05-h2b-transport-adapters.md` | Other transports | Telnet PAD + policy; POTS/radio → H5 |
| H3 | `2026-07-05-h3-camp-utility-apps.md` | Campsite apps | Kinds + CRUD; per-app content models later |
| H4 | `2026-07-05-h4-merchant-rails.md` | Merchant/bank rails | Code ready; **governance sign-off** blocking |
| H5–H8 | `2026-07-05-h5-h8-field-and-events.md` | Hardware, rehearsals, multi-event | Mostly ops/hardware |
| Authority | `2026-07-04-split-authority-sync.md` | Field kit journal / epochs | Journal, cloud apply/reconciliation, status, and failover drill code exist; human rehearsal remains |
| Validation | `2026-07-04-hackercamp-readiness-validation.md` | Evidence of readiness | Snapshot may lag tip; re-run gates |

Also useful: `docs/plans/2026-07-04-roadmap-expansion.md`, field office plan `2026-06-29-…`, Verifone/X.25 plan `2026-07-02-…`.

### Identity & cloud (as of 2026-07-13)

- Shared IdP: **https://auth.omnidat.cc** (Authentik). Passkey-primary, password fallback.
- Admins: `akadmin`, `gmacko` (Authentik superusers + omnidat/omnibank operator groups).
- OmniBank: `gmacko` and `akadmin` linked to bank account **9** (`omniauth_links`).
- Console secrets: `OMNIAUTH_*`, `AUTH_SECRET`, `OMNIDAT_BOOTSTRAP_ADMINS` (user ids **or emails**, e.g. `gmacko@omnidat.cc`).
- Operator shell: `/console`, `/noc`, `/operator-admin`, `/console/terminal` show session + roles; console/admin require sign-in + operator capability.
- `omnidat.operatorMe` returns roles for the signed-in user; `omnidat.dashboard` is **public** read (mutations stay gated).

### Highest-value next technical work (suggested priority)

1. **Human production bridge e2e:** signed-in as `gmacko`, CALL on `/console/terminal` → NOC Packet Sessions + Evidence list. Automated: `./scripts/e2e-network` + `docs/e2e-network-walkthrough.md` (personas, Verifone pack→sale, VT100 CALL→evidence). **Status:** lab/console paths proven; keep re-verifying after deploys.
2. **H1b polish (landed in UI):** event lifecycle status buttons, campsite pending/active/suspend, live incident list + open/resolve, role grant/list/revoke on Admin. POS → `pos-sale-receipt`; VT100 CALL links evidence.
3. **Split-authority drill UI (landed):** NOC panel: `authorityStatus`, `transferAuthority`, **`registerSyncSource`** (one-time token), event UUID picker. CLI: `./scripts/authority-drill`. Human multi-day field journal rehearsal still open.
4. **Evidence export + documents + audit trail (landed):** Operator CRUD export/render; Admin **Audit Trail** (`listRecentAuditEvents`).
5. **Public honesty:** `/what-is-real` on console (H0 claim matrix). Passkey soft-enroll nudge after login (Authentik owns WebAuthn).
6. **Do not invent redeemable money** without policy sign-off (H4 remaining work is governance, not more ISO demos).
7. Hardware / ShadyTel questions stay in `docs/open-questions.md` — track decisions, don’t block pure software slices.

---

## Commands the next agent will actually run

### Simulation layer (repo root)

```sh
./scripts/validate-data
./scripts/build-db
./scripts/render-artifacts
npm test                          # Python + Worker
./scripts/weekend-sim
OMNIDAT_WEEKEND_LOAD_FACTOR=2.5 ./scripts/weekend-sim   # congestion / etiquette stress
./scripts/e2e-omnibank
./scripts/status
./scripts/ui --port 8828          # lightweight field office UI
```

### gmacko V1 (operator)

```sh
cd gmacko
pnpm setup                        # first time
pnpm bootstrap:local              # local DB path
pnpm dev:next                     # or from root: npm run v1:dev
pnpm test
pnpm check:fast
pnpm db:push
```

Pad telnet:

```sh
pnpm --filter @omnidat/pad-telnet build
PORT=2525 HOST=0.0.0.0 node packages/pad-telnet/dist/index.js
telnet localhost 2525
```

### Deploy notes

- Worker: `npm run deploy:worker` / dry-run via wrangler; production uses shared FryOS Postgres + Hyperdrive (`postgres-shared-fryos-v1` in validation notes).
- Console / gmacko: ForgeGraph conventions (`forge` CLI, secrets `DATABASE_URL_LOCAL` / Hyperdrive). See `gmacko/deploy/`, `runbooks/cloudflare-worker-deploy.md`.
- Pad-telnet on k3s: host-networking deploy documented in recent commits/README.
- ForgeGraph console deploy contract: run `npm run deploy:nix:check`. The
  previous production deploys failed because `gmacko/flake.nix` exposed only a
  dev shell and no `packages.x86_64-linux.default`. The flake now packages the
  standalone Next server as `$out/bin/omnidat-app`. The generated standalone
  server has been launched locally and `/api/health` returned healthy after
  replacing a computed telemetry import that the standalone tracer could not
  package. A fresh Linux deployment is still required to prove the ForgeGraph
  fix and H2 CALL → NOC → evidence path in production.

**VCS:** Prefer **jj** in ForgeGraph repos when colocated; this handoff saw plain git on `main`. Follow `jj-workflow` / `fg-jj` skills if the workspace is jj-colocated. Do not force-push; confirm before any push to `forge`.

---

## Domain language (quick glossary)

| Term | Meaning |
|------|---------|
| Exchange 88 | PBX number block (~8800–8823) from ShadyTel interconnect |
| Packet Clearing | X.25-style network authority, X.121 addresses, PAD sessions |
| X.121 | Packet address identity for services |
| PAD | Packet Assembler/Disassembler; `PAD>` UX in terminal/telnet |
| XOT | X.25 over TCP (RFC 1613); browser bridge path |
| Field kit | Event-local authority node; authoritative during active events |
| Merchant Carrier | Private rails for ATMs/POS/vendors/NiteMarkt |
| OmniBank / Shadybucks | Fun-money / settlement story (policy gated) |
| Media Vault | Robotic VHS + ATV propaganda feed |
| FryOS | Shared camp infra / food order bridge |
| TrustDesk | Operator / trouble (`8800`, `8819`) |

Boundaries: **OMNIDAT does not operate ShadyTel.** ShadyTel owns camp phone/C*NET; OMNIDAT operates services behind Exchange 88.

---

## Conventions & traps

1. **Keep sim and live aligned** on verbs, X.121 semantics, evidence shapes, and terminal renderers (`operator-core` is the shared screen brain).
2. **Always validate seeds** after editing `data/*.json`: `./scripts/validate-data`.
3. **Do not claim camp-critical readiness** in public copy; leadership package language must stay bounded.
4. **Etiquette is product policy**, not flavor text: short sessions, no saturation, honest clear causes — wire into DIR/help/attract when touching terminal UX.
5. **Lore vs scaffold:** in-world content = Borg/corporate; implementation docs may mention gmacko/ForgeGraph freely.
6. **`build/` is output** — regenerate; don’t hand-edit as source of truth.
7. **Money:** more settlement demos are fine; redeemable value and cash-out need explicit policy owners.
8. **Tests:** root `npm test` (Python + worker) and gmacko `pnpm test` are separate. Run the suite matching the layer you changed.
9. **gmacko is customized** create-gmacko-app — don’t “reset” the monorepo or re-scaffold over OMNIDAT packages.
10. **Parallel H-series work** has left plans with status notes mid-file; trust code + tests over stale “Immediate Next Build” bullets from early July when they conflict — then update the plan status when you finish a gate.
11. **The telnet PAD is intentionally read-only and in-memory** for demo safety.
    Shared renderers do not make it proof of authenticated `packetCall`
    persistence.
12. **Transport policy is ahead of hardware.** POTS/modem, MeshCore, and
    Meshtastic budgets exist server-side, but the real gateway and bench paths
    are still H5 work.
13. **`tools/omnidat_journal.py` defines `JournalWriter` twice.** The
    definitions are equivalent and tests pass, but consolidate them before
    evolving that adapter.
14. **Protocol address drift is recorded.** `docs/protocol-fidelity.md` calls
    `311088000001` normative and still has a TODO for the Worker claim at
    `311088010110`.

---

## Suggested first hour for a new agent

1. Read this file + root `README.md` Current Status section.  
2. `git log --oneline -30` and `git status`; note unpushed commits vs `forge/main`.  
3. `./scripts/validate-data && npm test` (sanity).  
4. Open the plan for the assigned horizon under `docs/plans/`.  
5. If UI/API work: inspect `gmacko/packages/api/src/router/omnidat-*.ts` and `omnidat-operator-crud.tsx` / `omnidat-xot-terminal.tsx`.  
6. If sim/evidence: `tools/omnidat_*.py` + matching `tests/test_*.py`.  
7. Before claiming done: re-run the layer’s tests and, for data/docs, `validate-data` / render if artifacts changed.

### Fresh verification baseline

The following passed on 2026-07-10 at
`2222cbae76ed67ff53725a22a4426d6da64dfb04`:

```sh
npm test
./scripts/validate-data
git diff --check
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/api test
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/operator-core test
corepack pnpm@10.32.1 --dir gmacko --filter @omnidat/pad-telnet test
```

Results: 148 Python tests, 35 Worker tests, 385 API tests, 51 operator-core
tests, and 36 pad-telnet tests passed. All 19 JSON seed files validated,
including Exchange 88 coverage through `8824` and cross-file packet/ATV
references. The API suite took about 88 seconds before printing results. The
Python suite emitted non-failing `ResourceWarning` messages while cleaning up
synthetic HTTP error objects.

For a broader gmacko change, also run `pnpm check:fast` and `pnpm build` from
`gmacko/`. Run `./scripts/weekend-sim` when evidence, congestion, money, queue,
or authority semantics change.

### Git caution

At this snapshot both remote main refs were at the same older commit:

```text
local main   2222cbae76ed67ff53725a22a4426d6da64dfb04
forge/main   328b1586d05b760beb016c29b85f38cc02d702b5
github/main  328b1586d05b760beb016c29b85f38cc02d702b5
```

The 33 local commits include functional PAD messaging, Matrix, camp status,
RIOT integration, and load/congestion behavior, not only lore or generated
files. Inspect `git log --oneline forge/main..HEAD` before any rebase, reset,
cleanup, or push. Neither remote was a backup of the current tree when this was
written.

The checkout may resolve through `/Volumes/dev/shady/omnidat` or
`/Users/mackieg/dev/shady/omnidat`; use `git rev-parse --show-toplevel` before
staging.

---

## Open decisions (do not silently invent)

Tracked in `docs/open-questions.md` and plan “cross-cutting” sections:

- ShadyTel block assignment, PRI vs SIP, digit delivery.
- Asterisk vs FreeSWITCH; real X.25 hardware vs XOT/emulation for V1.
- Production surface split: Worker stays public demo, gmacko is operator (current practical split) — document any change.
- Money policy and bearer instruments.
- X.121 DNIC governance.
- Second real bridge after browser XOT (POTS/modem natural).
- 2027/2028 event calendar and leadership opt-in form (village vs official).

If the user has not decided, implement behind flags/sim paths and record the assumption in the plan or open-questions — do not ship irreversible policy as if approved.

---

## Related runbooks & ops

- `runbooks/startup.md`, `shutdown.md`, `incident-response.md`
- `runbooks/authority-failover.md`
- `runbooks/omnitel-raspi-pbx.md`, `shadytel-interop-test.md`
- `docs/acceptance-tests.md` (Launch-Ready gates for H7)
- `docs/hardware-bom.md`, `docs/budget-sourcing.md`
- `docs/lab-bringup.md`

---

## One-sentence mission for the next agent

**Advance OMNIDAT from “credible pilot simulation” toward “operators can run a bounded camp packet service without shell access,” without overstating readiness, without breaking protocol honesty, and without redeemable money until policy is signed off.**
