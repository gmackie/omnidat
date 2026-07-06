# Authentik Setup For OMNIDAT OmniAuth

Date: 2026-07-05

OmniAuth (OMNIDAT's identity provider) is backed by Authentik at
`auth.omnidat.cc`. The OMNIDAT operator app (`console.omnidat.cc`) authenticates
against it over OIDC via better-auth's generic-OAuth provider (already wired in
`gmacko/packages/auth/src/index.ts`). This runbook stands Authentik up and
connects it.

## 1. Deploy Authentik at auth.omnidat.cc

Authentik runs as `server + worker + postgres + redis`
(`deploy/authentik/docker-compose.yml`). It uses its **own** Postgres, not the
shared FryOS database.

```sh
cd deploy/authentik
cp .env.example .env
# fill PG_PASS and AUTHENTIK_SECRET_KEY:
#   openssl rand -base64 36                     # PG_PASS
#   openssl rand -base64 60 | tr -d '\n'        # AUTHENTIK_SECRET_KEY
docker compose --env-file .env up -d
```

Expose `auth.omnidat.cc` to the server's port 9000. Two options:

- **Cloudflare Tunnel** (recommended, no open ports): run `cloudflared` on the
  host with an ingress rule `auth.omnidat.cc -> http://localhost:9000`, and a
  CNAME `auth.omnidat.cc -> <tunnel>.cfargotunnel.com` in the `omnidat.cc`
  zone.
- **Reverse proxy + DNS**: point `auth.omnidat.cc` at the host and proxy 443 to
  9000.

First-run: browse `https://auth.omnidat.cc/if/flow/initial-setup/` to set the
`akadmin` password.

## 2. Create the OMNIDAT OIDC provider + application

In the Authentik admin (`/if/admin/`):

1. **Providers -> Create -> OAuth2/OpenID Provider**:
   - Name: `OMNIDAT Console`.
   - Authorization flow: `default-provider-authorization-explicit-consent`
     (or implicit consent for less friction).
   - Client type: `Confidential`.
   - **Redirect URIs** (exact match):
     `https://console.omnidat.cc/api/auth/oauth2/callback/omniauth`
   - Scopes: `openid`, `profile`, `email`.
   - Signing key: the default self-signed cert is fine.
   - Save, then copy the generated **Client ID** and **Client Secret**.
2. **Applications -> Create**:
   - Name: `OMNIDAT Console`, Slug: `omnidat` (this slug is in the discovery
     URL below).
   - Provider: the provider from step 1.

The OIDC discovery URL is then:

```
https://auth.omnidat.cc/application/o/omnidat/.well-known/openid-configuration
```

## 3. Set the operator-app secrets

Set these three (plus `AUTH_SECRET`) on the `omnidat-console` Cloudflare Worker.
The operator app's better-auth config activates the `omniauth` provider only
when all three are present.

```sh
cd gmacko/apps/nextjs
# via wrangler (per-worker secrets):
echo "https://auth.omnidat.cc/application/o/omnidat/.well-known/openid-configuration" \
  | npx wrangler secret put OMNIAUTH_DISCOVERY_URL --name omnidat-console
echo "<client-id>"     | npx wrangler secret put OMNIAUTH_CLIENT_ID --name omnidat-console
echo "<client-secret>" | npx wrangler secret put OMNIAUTH_CLIENT_SECRET --name omnidat-console
openssl rand -base64 48 | npx wrangler secret put AUTH_SECRET --name omnidat-console
```

(Or store them in ForgeGraph with `forge secret set <KEY> <VALUE> --stage
production` and sync to the worker.)

## 4. Deploy and smoke

```sh
cd gmacko/apps/nextjs
corepack pnpm@10.32.1 deploy:cloudflare:production   # build:vinext + wrangler deploy
```

- `curl -fsS https://console.omnidat.cc/api/health` -> healthy.
- Browse `https://console.omnidat.cc/login`, click OmniAuth, complete the
  Authentik flow, and confirm you land back signed in.
- The callback that must succeed is
  `https://console.omnidat.cc/api/auth/oauth2/callback/omniauth`.

## Notes

- Role mapping: Authentik groups/claims can drive OMNIDAT operator roles later;
  for now a signed-in OmniAuth user has no operator capability until an admin
  grants one (`grantOperatorRole`) or `OMNIDAT_BOOTSTRAP_ADMINS` lists them.
- The public Worker (`omnidat.cc`) still uses a demo OmniAuth flow; repointing
  it at Authentik is optional and separate from the operator-app login.
