# OmniBucks Testnet

OmniBucks is the OMNIDAT **testnet** currency. OmniBank is the bank process
(fork/branch of shadybank). ShadyBucks remains the production rail.

## Quick facts

| | |
|---|---|
| Network id | `omnibucks` |
| Bank | OmniBank |
| Currency | OmniBucks (`OMNI`) |
| Public API | **https://bucks.omnidat.cc** |
| Source | `/Volumes/dev/shady/shadybank` branch `omnibank` |
| Env | `MERCHANT_RAIL=omnibucks` (default) |
| Contract | Same as ShadyBank: `/api/authorize`, `/api/capture`, … + `/api/network` |

## Client configuration

```bash
export MERCHANT_RAIL=omnibucks
export OMNIBANK_API_URL=https://bucks.omnidat.cc
export OMNIBANK_MERCHANT_TOKEN=…   # OmniBank-issued only
# Legacy aliases still accepted:
# export SHADYBANK_API_URL=https://bucks.omnidat.cc
# export SHADYBANK_MERCHANT_TOKEN=…
```

Production ShadyBucks (only with written policy):

```bash
export MERCHANT_RAIL=shadybucks
export SHADYBANK_API_URL=https://bucks.shady.tel
export SHADYBANK_MERCHANT_TOKEN=…
```

## Cloud (live)

| Surface | URL | Status |
|---|---|---|
| OmniBank API + UI | **https://bucks.omnidat.cc** | Live on `hetzner-bob:9110` (docker compose) |
| Network identity | `GET /api/network` | `omnibucks` / testnet |
| OmniAuth status | `GET /api/omniauth/status` | issuer `auth.omnidat.cc` |
| Shared IdP | **https://auth.omnidat.cc** | Live (Authentik) |
| Verify | `shadybank/scripts/verify-cloud.sh` | public smokes |

Production path on the node:

```bash
# on hetzner-bob
cd /opt/omnibank/src
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/omnibank.env up -d --build
# nginx: deploy/nginx.bucks.omnidat.cc.conf → sites-enabled
```

Still operator-side: create Authentik application slug **`omnibank`** (SAML proxy or OIDC) and link real subjects; set console `MERCHANT_RAIL=omnibucks` + `OMNIBANK_API_URL=https://bucks.omnidat.cc`.

## Local OmniBank

```bash
cd /Volumes/dev/shady/shadybank
git checkout omnibank
docker compose -f docker-compose.omnibank.yml up --build
curl -s http://127.0.0.1:8121/api/network
```

See `shadybank/README.omnibank.md`.

## Layers

1. **shadybank `omnibank` branch** — deployable OmniBank (`BANK_NETWORK=omnibucks`).
2. **shadypay** — `resolveBankNetwork("omnibucks")`, `gatewayForNetwork`, `formatNetworkAmount`.
3. **omnidat FEP / console** — `MERCHANT_RAIL`, `getShadyBankIntegrationProfile`.
4. **OmniBankFake** — offline contract mock for e2e without HTTP (still rail=omnibucks).
5. **OmniAuth** — human web login for OmniBank via shared IdP **auth.omnidat.cc**
   (SAML proxy headers or OIDC). See shadybank `docs/omniauth.md` and
   [authentik-setup.md](authentik-setup.md) §5.

Card/OTP and merchant-token APIs stay bank-native; they do not go through SAML.

## Policy

- Pilot and RoE bounties settle in OmniBucks only.
- OmniBucks are not cash and not redeemable unless a separate posted conversion
  policy says otherwise.
- Never share Postgres/Redis between OmniBank and production ShadyBucks.
- Never use OmniBank merchant tokens against `bucks.shady.tel` (or the reverse).
