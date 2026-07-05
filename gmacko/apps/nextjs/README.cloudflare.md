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
- `SHADYBANK_API_URL` is a non-secret Worker var and should point at `https://bucks.shady.tel`
- `SHADYBANK_MERCHANT_TOKEN` is a Cloudflare secret. Install it before live settlement:

```bash
pnpm --filter @omnidat/nextjs exec wrangler secret put SHADYBANK_MERCHANT_TOKEN
```

After deploy, verify the integration state:

```bash
curl -fsS 'https://omnidat.cc/api/trpc/omnidat.shadyBankStatus?batch=1&input=%7B%7D'
```

The status is production-ready for settlement only when `configured` is `true`
and `merchantLinkStatus` is `ready`.

## Notes

- This lane is the OMNIDAT Workers deployment path for `omnidat.cc`.
- The app-local Worker config lives in `apps/nextjs/wrangler.jsonc`.
- The root Worker is legacy and should not be used for the create-gmacko app UI.
