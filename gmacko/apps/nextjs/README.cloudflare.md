# Cloudflare Workers Lane

This app includes an experimental `vinext` lane for Cloudflare Workers.

## Commands

```bash
pnpm --filter @omnidat/nextjs dev:vinext
pnpm --filter @omnidat/nextjs build:vinext
pnpm --filter @omnidat/nextjs deploy:cloudflare:staging
pnpm --filter @omnidat/nextjs deploy:cloudflare:production
```

## Required Env

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- production auth and database secrets in Cloudflare
- Default rail is **OmniBucks testnet** (`MERCHANT_RAIL=omnibucks`).
- `OMNIBANK_API_URL` / `SHADYBANK_API_URL` (alias) → **`https://bucks.omnidat.cc`**
  (set in `wrangler.jsonc` vars).
- Merchant token secrets: `OMNIBANK_MERCHANT_TOKEN` (preferred) and/or
  `SHADYBANK_MERCHANT_TOKEN`. Mint via OmniAuth merchant session on the bank
  host (`/opt/omnibank/merchant-token.txt` on hetzner-bob).

```bash
pnpm --filter @omnidat/nextjs exec wrangler secret put OMNIBANK_MERCHANT_TOKEN --env=\"\"
# legacy alias still accepted by the Worker:
pnpm --filter @omnidat/nextjs exec wrangler secret put SHADYBANK_MERCHANT_TOKEN --env=\"\"
```

After deploy, verify the integration state:

```bash
curl -fsS 'https://console.omnidat.cc/api/trpc/omnidat.shadyBankStatus?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D'
```

The status is production-ready for settlement when `configured` is `true`,
`rail` is `omnibucks`, and `merchantLinkStatus` is `ready`.

## Notes

- This lane is the OMNIDAT Workers deployment path for `omnidat.cc`.
- The app-local Worker config lives in `apps/nextjs/wrangler.jsonc`.
- The root Worker is legacy and should not be used for the create-gmacko app UI.
