# Cloudflare Worker Deploy

This is the temporary public edge deploy for `https://omnidat.gmac.io`.

The Worker serves a lightweight OMNIDAT Field Office shell, `/api/health`,
`/api/health/live`, `/api/health/ready`, and the terminal directory endpoint at
`/radio?command=DIR`. The full v1 application is still expected to move into the
create-gmacko-app/Postgres stack.

## Verify Locally

```sh
npm test --silent
npm run deploy:worker:dry-run --silent
```

## Deploy

```sh
npm run deploy:worker --silent
```

## Public Smoke Test

```sh
curl -fsS https://omnidat.gmac.io/api/health
curl -fsS https://omnidat.gmac.io/ | rg 'OMNIDAT Field Office'
curl -fsS 'https://omnidat.gmac.io/radio?command=DIR' | rg 'MILIWAYS ORDER ENTRY'
```
