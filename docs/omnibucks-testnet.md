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

## Policy

- Pilot and RoE bounties settle in OmniBucks only.
- OmniBucks are not cash and not redeemable unless a separate posted conversion
  policy says otherwise.
- Never share Postgres/Redis between OmniBank and production ShadyBucks.
- Never use OmniBank merchant tokens against `bucks.shady.tel` (or the reverse).
