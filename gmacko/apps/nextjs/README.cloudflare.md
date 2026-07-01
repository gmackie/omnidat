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

## Notes

- This lane is the OMNIDAT Workers deployment path for `omnidat.gmac.io`.
- The app-local Worker config lives in `apps/nextjs/wrangler.jsonc`.
- The root Worker is legacy and should not be used for the create-gmacko app UI.
