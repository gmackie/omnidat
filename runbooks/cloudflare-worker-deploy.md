# Cloudflare Worker Deploy

This is the canonical public web UI deploy for `https://omnidat.cc`.

The Worker serves the lightweight OMNIDAT Field Office shell, health endpoints,
the terminal directory endpoint at `/radio?command=DIR`, campsite app metadata at
`/api/campsite-apps`, and campsite signup queue receipts at `/api/signup`.

The create-gmacko-app workspace remains the source for domain contracts, package
boundaries, and the shared FryOS Postgres schema. For v1, the public web runtime
is Cloudflare Workers.

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
curl -fsS https://omnidat.cc/api/health
curl -fsS https://omnidat.cc/ | rg 'OMNIDAT Field Office'
curl -fsS https://omnidat.cc/api/auth/providers | rg 'omniauth|forgegraph|github'
curl -fsSI https://omnidat.cc/console | rg 'location: /login\\?returnTo=%2Fconsole'
curl -sS -i https://omnidat.cc/api/admin/overview | rg '401|authentication required'
curl -fsS 'https://omnidat.cc/radio?command=DIR' | rg 'MILIWAYS ORDER ENTRY'
curl -fsS https://omnidat.cc/api/campsite-apps | rg 'MILIWAYS|PASSPORT'
curl -fsS -X POST https://omnidat.cc/api/signup \
  -H 'content-type: application/json' \
  --data '{"campsiteName":"Camp Laminar","contact":"operator@example.test","namespace":"camp","transport":"meshcore"}' \
  | rg 'queued|omnidat-v1-worker'
```

Manual signup smoke target: `POST https://omnidat.cc/api/signup`.
