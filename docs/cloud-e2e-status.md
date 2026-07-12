# OMNIDAT / OmniBank cloud E2E status

Last verified: 2026-07-13

## Topology (live)

```text
Browser / console.omnidat.cc
        │
        │  MERCHANT_RAIL=omnibucks
        │  OMNIBANK_API_URL=https://bucks.omnidat.cc
        │  OMNIBANK_MERCHANT_TOKEN (CF secret)
        v
https://bucks.omnidat.cc          OmniBank (hetzner-bob :9110 docker)
        │
        ├─ /api/*  authorize · capture · balance · omniauth
        └─ /app/*  web UI + OIDC SSO
                │
                v
https://auth.omnidat.cc           Authentik (shared IdP)
  application slug: omnibank
```

## Verification matrix

| Check | Command / URL | Result |
|---|---|---|
| Bank identity | `GET https://bucks.omnidat.cc/api/network` | `omnibucks` testnet |
| OmniAuth status | `GET …/api/omniauth/status` | `mode=oidc`, issuer auth.omnidat.cc |
| Login UI | `https://bucks.omnidat.cc/app/login` | 200 + Continue with OmniAuth |
| SSO start | `…/app/omniauth/start` | 302 → Authentik authorize |
| OIDC discovery | `…/application/o/omnibank/.well-known/…` | 200 |
| Bridge session | akadmin / merchant subjects | 201 tokens |
| POS authorize+capture | test PAN + TOTP fixture | 200 + 204 |
| Console bank profile | `omnidat.shadyBankStatus` | `configured:true`, `rail:omnibucks`, `ready` |
| OIDC akadmin e2e | `/opt/omnibank/oidc_e2e2.py` on bob | `OIDC_E2E_OK` → account 9 |
| Fund desk | `GET /app/fund` | 302 → login (auth); credits via `/api/credit` |
| Merchant credit smoke | service token → PAN `4242…` | 204 |
| AGI merchant token | master `/etc/asterisk/shadyroulette-merchant-token` | balance 200 for account 10 |
| Token rotation timer | bob `omnibank-token-rotate.timer` | monthly 01 06:00 UTC |
| omnidat.cc / console health | `/api/health` | 200 |
| steak / tv | public | 200 |

Automated:

```bash
# full OMNIDAT network personas + Verifone/VT100 onboarding
./scripts/e2e-network
# walkthrough: docs/e2e-network-walkthrough.md

# public surfaces (OmniBank cloud)
/Volumes/dev/shady/shadybank/scripts/verify-cloud.sh

# + live ledger authorize/capture (needs forge CLI)
/Volumes/dev/shady/shadybank/scripts/verify-cloud-e2e.sh
```

## Credentials / lab fixtures

| Item | Value |
|---|---|
| Test payer PAN | `4242424242424242` (account 8) |
| TOTP secret | `JBSWY3DPEHPK3PXP` (interval 30) |
| Merchant subject | `omniauth\|omnibank-merchant` → account 10 |
| Operator OIDC user | `akadmin` → account 9; `gmacko` → account 9 |
| Merchant token file | `/opt/omnibank/merchant-token.txt` on hetzner-bob |

## Ops paths on hetzner-bob

```bash
/opt/omnibank/src                          # compose project
/opt/omnibank/src/deploy/omnibank.env      # secrets (mode=oidc)
/opt/authentik/                            # shared IdP
/etc/nginx/sites-enabled/bucks.omnidat.cc  # TLS edge
```

Ops scripts (shadybank branch `omnibank`):

```bash
./scripts/deploy-to-bob.sh           # redeploy stack
./scripts/mint-service-token.sh      # mint durable merchant token
./scripts/rotate-service-token.sh    # mint + push Workers + AGI token file
./scripts/verify-cloud-e2e.sh        # full smoke
```

Redeploy bank:

```bash
cd /opt/omnibank/src
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/omnibank.env up -d --build
```

### Fund desk (demo credits)

Logged-in merchant/partner/admin: `https://bucks.omnidat.cc/app/fund`  
Credits fixture PAN `4242424242424242` (or any known PAN) via `POST /api/credit`.

### Token rotation

| Surface | How |
|---|---|
| Node mint (bob) | `omnibank-token-rotate.timer` → monthly `mint-service-token.sh 10` |
| Full push (ops host) | `./scripts/rotate-service-token.sh` (Workers secrets + AGI file on master) |

## Durable merchant tokens

OmniBank supports `service_tokens` (never-expire machine credentials):

```http
POST /api/service-tokens
Authorization: Bearer <admin-session>
{"account_id": 10, "label": "console-and-chat-production"}
```

Live Nightmarkt token is stored on hetzner-bob as
`/opt/omnibank/merchant-service-token.txt`, on master as
`/etc/asterisk/shadyroulette-merchant-token`, and installed as
`OMNIBANK_MERCHANT_TOKEN` on `omnidat-console` and
`SHADYBUCKS_MERCHANT_TOKEN` on `chat`.

### ShadyRoulette AGI (hetzner-master)

```text
/opt/shadyroulette/                 package + dialplan samples
/var/lib/asterisk/agi-bin/shadyroulette-agi
/etc/asterisk/shadyroulette-merchant-token
/etc/asterisk/shadyroulette-omnibank.env   # bucks.omnidat.cc + chat.gmac.io
```

Asterisk service was inactive on last check — dialplan sample installed;
enable when phone trunk is ready. Missing prompt audio is expected until
sound assets are generated.

## Console surfaces shipped (2026-07-13)

| Surface | Path | Notes |
|---|---|---|
| Event status lifecycle | `/console` Operator CRUD | planning → active → closed → archived |
| Campsite suspend | `/console` Operator CRUD | pending / active / suspended + Suspend/Reactivate |
| Evidence export + documents | `/console` Operator CRUD | exportEventEvidence + renderDocument preview |
| Authority drill | `/noc` | status, register field kit token, transfer |
| Audit trail | `/operator-admin` | listRecentAuditEvents |
| Honesty page | `/what-is-real` | H0 public claim matrix |
| Passkey soft-enroll | `/login` when signed in | dismissible → Authentik WebAuthn setup |

## Remaining (optional)

- Human browser walkthrough of OIDC as akadmin (password may be lab-reset).
- Production ShadyBucks rail still policy-gated (`MERCHANT_RAIL=shadybucks` + bucks.shady.tel).
- Authentik outpost/SAML headers path (OIDC is live without outpost).
- Generate ShadyRoulette prompt audio; start Asterisk when DECT/SIP ready.
- After full `rotate-service-token.sh`, re-verify console + chat Workers secrets.
- Field-kit journal sync human rehearsal (UI drill is ready on NOC).