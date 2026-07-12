# OMNIDAT Network E2E Walkthrough

Date: 2026-07-13

Full setup and onboarding paths for **public users**, **operators**, and **admins**,
including **VeriFone dial POS** and **VT100 / XOT** terminals.

## Automated suite

```sh
# Persona + terminal onboarding (Vitest / tRPC)
cd gmacko && corepack pnpm --filter @omnidat/api exec vitest run src/router/omnidat-network-e2e.test.ts

# Or from repo root
./scripts/e2e-network

# Python sim layer (Verifone + bank)
./scripts/e2e-omnibank
./scripts/verifone-sim
```

## Live dogfood (2026-07-13 — agent-executed)

Full browser walkthrough completed against production. Report:
`build/live-e2e/REPORT.md` + screenshots.

| Check | Live result |
|---|---|
| OmniAuth → console as gmacko | PASS (admin · bootstrap-admin) |
| Verifone Dial POS Sale | PASS (`RCPT-POS-000019` APPROVED) |
| Verifone TCL package | PASS (`OMNISALE.TCL`, dial 8810) |
| VT100 `CALL 311088020501` | PASS (evidence + session ids on CRT) |
| NOC lists session + evidence | PASS after `listEvidenceArtifacts` null-input fix |
| OmniBank SSO | PASS (account **OMNIDAT Operator**) |

Suite file: `gmacko/packages/api/src/router/omnidat-network-e2e.test.ts`

| Persona | Covered |
|---|---|
| Public user | network, services directory, dashboard, NOC board, Verifone program pack, terminal banner; mutations forbidden |
| Vendor operator | TCL package build → dial POS sale |
| Bank operator | ATM setup → ISO 8583 purchase |
| Packet operator | VT100 CALL → evidence → MENU verb → XOT packetCall → PAD configure → session record |
| NOC operator | list packet sessions + evidence |
| Admin | provision campsite, grant roles, export evidence |
| Auditor | read OK; POS + CALL forbidden |

## Live surfaces

| Surface | URL |
|---|---|
| Public | https://omnidat.cc |
| Console | https://console.omnidat.cc |
| Login | https://console.omnidat.cc/login |
| VT100 | https://console.omnidat.cc/console/terminal |
| NOC | https://console.omnidat.cc/noc |
| Admin | https://console.omnidat.cc/operator-admin |
| IdP | https://auth.omnidat.cc |
| Bank | https://bucks.omnidat.cc |

Bootstrap admins: list emails/ids in Worker secret `OMNIDAT_BOOTSTRAP_ADMINS`
(e.g. `gmacko@omnidat.cc`).

---

## A. Public user (no login)

1. Open https://console.omnidat.cc — directory metrics and service list.
2. Open /noc — circuit board visible; sessions/evidence say AUTH/ROLE REQUIRED.
3. Open /console — **Authorized access required** (mutations gated).
4. Open /console/terminal — banner paints; CALL without role shows operator-role clear.

Expect: read-only network identity; no write path.

---

## B. Operator sign-in (OmniAuth)

1. https://console.omnidat.cc/login → **Sign in with OmniAuth**.
2. auth.omnidat.cc — passkey preferred, password fallback.
3. Land on console with strip: `ROLES: admin · bootstrap-admin` (or granted roles).
4. If "Operator role required": add email to `OMNIDAT_BOOTSTRAP_ADMINS` or grant via Admin → Operator Roles.

---

## C. VT100 terminal onboarding (packet operator)

Goal: attach a PAD, place a CALL, leave NOC evidence.

1. **Attach** — /console/terminal  
   - Banner + prompt for DTE (e.g. `311088000001`).
2. **Directory** — type `DIR` (client-side from public services).
3. **Call service** — `CALL 311088020501` (Miliways)  
   - Interactive service screen loads.  
   - CRT shows `EVIDENCE <id> SESSION <id>`.  
   - Server: `serviceConnect` opens packet session + `packet-call-receipt`.
4. **Operate** — `MENU`, service verbs, then leave session (recording on exit).
5. **Alternate bridge** — use XOT terminal panel on console (if shown) or API `packetCall`.
6. **NOC verify** — /noc → Packet Sessions + Evidence Artifacts list the CALL.
7. **Configure PAD** (console form or API `configurePad`):  
   - x121, transport (`wifi` / `xot` / radio), padKind `xot-terminal`.

Honest clear codes: unknown address → `CLR NP C:13 D:67`; no role → `CLR NA C:11 D:70`.

### Physical VT100 / telnet PAD

```sh
cd gmacko
pnpm --filter @omnidat/pad-telnet build
PORT=2525 HOST=0.0.0.0 node packages/pad-telnet/dist/index.js
telnet localhost 2525
```

Same verbs as web VT100 (`DIR`, `CALL`, `HELP`, …).

---

## D. VeriFone dial POS onboarding (vendor + bank)

Goal: program pack → TCLOAD package → first sale → optional ATM.

### D1. Field preview (public)

1. Console (signed in as vendor/admin) or public pack API:  
   `vintageTerminalProgramPack`
2. Confirm:
   - Dial **8810** sale path  
   - X.121 **311088002010** POS authorization  
   - TCL primitives `+D`, `+I`, `E`, `P`  
   - Status may be `bench-validation-required` until hardware cert

### D2. Build terminal package (vendor.write)

1. Console → **VeriFone TCL Program Pack** → set terminal id + merchant account  
2. **Build Terminal Package** (`vintageTerminalDownloadPackage`)  
3. Expect files: `OMNISALE.TCL`, config, port profiles:
   - pots-sale: dial 8810 → 311088002010  
   - zontalk-update: dial 8811 → 311088002020  
4. Load via TCLOAD (TRANZ 330/380) or ZONTALK (Omni 3200) per pack runbook.

### D3. First live sale (vendor.write)

1. Console → **Vintage Dial POS**  
2. Model: `VERIFONE_TRANZ_330` (or 380 / Omni)  
3. **Dial POS Sale**  
4. Transcript: `DIAL 8810` → `CONNECT` → `CALL 311088002010` → APPROVED  
5. Receipt: `OMNIDAT POS RECEIPT`

Architecture:

```text
TRANZ 330  --POTS 8810-->  OMNIDAT FEP 311088002010  -->  OmniBank /api/authorize+/capture
```

Terminals never hold merchant bearer tokens; FEP does.

### D4. ATM activation (bank.write)

1. Console / API `setupAtmTerminal` with settlement account  
2. ISO 8583 purchase sim (`iso8583Transaction`) response code `00`  
3. Optional live OmniBank: `iso8583ShadyBankPurchase` with merchant token

### D5. Python sim bench (offline)

```sh
./scripts/verifone-sim
./scripts/e2e-omnibank
```

Sim dials 8810–8814 for sale, update, directory, food, passport scenarios.

---

## E. Admin onboarding

1. Sign in as bootstrap admin.  
2. **/operator-admin** → **Operator Roles**  
   - Copy your user id from the panel  
   - Grant `packet-operator` / `vendor-operator` / `bank-operator` to others  
3. **Provision campsite** (console form or `provisionCampsiteService`)  
4. **Verify provisioning** transcript  
5. **Export evidence** for the event window  
6. NOC: confirm incidents/sessions after operators run traffic  

---

## F. Acceptance checklist

| # | Check | Pass |
|---|---|---|
| 1 | Public directory + program pack readable without login | |
| 2 | Guest cannot CALL or Dial POS | |
| 3 | OmniAuth login grants operatorMe / bootstrap admin | |
| 4 | VT100 CALL leaves session + packet-call-receipt | |
| 5 | NOC lists sessions/evidence for signed-in operator | |
| 6 | Verifone package contains OMNISALE.TCL + dial 8810 | |
| 7 | Dial POS sale APPROVED + receipt | |
| 8 | ATM setup + ISO 00 | |
| 9 | Admin grant role appears in list | |
| 10 | Auditor cannot sell or call | |
| 11 | `./scripts/e2e-network` green | |

---

## Related docs

- [verifone-terminal-programming.md](verifone-terminal-programming.md)  
- [authentik-setup.md](authentik-setup.md)  
- [cloud-e2e-status.md](cloud-e2e-status.md)  
- [agent-handoff.md](agent-handoff.md)  
- Plans: H2 browser XOT, H4 merchant rails  
