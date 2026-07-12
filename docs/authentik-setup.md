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

### Admins (live)

| Username | Role | Groups |
|---|---|---|
| `akadmin` | bootstrap superuser | `authentik Admins`, `omnidat-operators`, `omnibank-operators` |
| `gmacko` | superuser (pk 12) | same as akadmin |

To promote another user via API on `hetzner-bob` (`/opt/authentik`):

```sh
TOKEN=$(docker exec authentik-server-1 printenv AUTHENTIK_BOOTSTRAP_TOKEN)
# create or PATCH /api/v3/core/users/ with groups including
# authentik Admins (527eaf25-6ac1-458a-a7db-08bc72a561a4)
# then POST /api/v3/core/users/<pk>/set_password/
```

### Auth policy: passkeys primary, password fallback

Login at `https://auth.omnidat.cc` is passkey-first:

| Path | How |
|---|---|
| **Primary** | Passkey autofill on the identification screen (WebAuthn conditional UI), or the **passwordless** link → flow `passwordless` |
| **Fallback** | Username/email + password (existing default authentication flow) |
| **New users** | After first password login, Authentik forces **Passkey** enrollment (`not_configured_action=configure`) |

Live pieces (on `hetzner-bob`):

- Stage `omnidat-passkey-validate` — WebAuthn-only authenticator validation, UV required
- Flow `passwordless` — passkey validate → user login
- Identification stage links `passwordless_flow` + `webauthn_stage` for autofill
- WebAuthn setup requires **resident keys** (`resident_key_requirement=required`) so credentials work as discoverable passkeys
- MFA validate stage only accepts `webauthn` and configures the default Passkey setup stage when none is enrolled

Password remains as bootstrap / recovery for new accounts and devices without a passkey yet. After enrollment, day-to-day login should use the passkey.

## 2. Create the OMNIDAT OIDC provider + application

In the Authentik admin (`/if/admin/`):

1. **Providers -> Create -> OAuth2/OpenID Provider**:
   - Name: `OMNIDAT Console`.
   - Authorization flow: `default-provider-authorization-explicit-consent`
     (or implicit consent for less friction).
   - Client type: `Confidential`.
   - **Redirect URIs** (exact match):
     `https://console.omnidat.cc/api/auth/callback/omniauth`
     (better-auth generic OAuth uses `/api/auth/callback/<providerId>`)
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
  `https://console.omnidat.cc/api/auth/callback/omniauth`.

## 5. OmniBank application (bucks.omnidat.cc) — **LIVE**

OmniBank uses the **same** Authentik IdP. Do not stand up a second identity
server. Bank detail: `/Volumes/dev/shady/shadybank/docs/omniauth.md`.

### Provisioned (2026-07-12)

| Item | Value |
|---|---|
| Application | **OmniBank** slug **`omnibank`** |
| Provider | OAuth2/OIDC confidential (pk 5) |
| Redirect URI | `https://bucks.omnidat.cc/app/omniauth/callback` |
| Discovery | https://auth.omnidat.cc/application/o/omnibank/.well-known/openid-configuration |
| Groups | `omnibank-operators`, `omnibank-partners` (akadmin + gmacko ∈ operators) |
| Bank mode | `OMNIAUTH_MODE=oidc` on hetzner-bob `/opt/omnibank` |
| Account link | `akadmin` → account **9**; `gmacko` → account **9** (operator admin) |

Re-run / document: `shadybank/scripts/setup-authentik-omnibank.sh` (uses
`AUTHENTIK_BOOTSTRAP_TOKEN` on the authentik host).

### Manual UI path (if re-creating)

1. **Providers → Create → OAuth2/OpenID Provider**
   - Name: `OmniBank`
   - Client type: Confidential
   - Redirect URI: `https://bucks.omnidat.cc/app/omniauth/callback`
   - Scopes: openid, profile, email
   - Sub mode: `user_username` (bank links by username)
2. **Applications → Create**
   - Name: `OmniBank`, Slug: **`omnibank`**
   - Provider: OmniBank OIDC
   - Launch URL: `https://bucks.omnidat.cc/app/omniauth/start`
3. Set on OmniBank containers (see `deploy/omnibank.env`):

```sh
OMNIAUTH_ENABLED=1
OMNIAUTH_MODE=oidc
OMNIAUTH_ISSUER=https://auth.omnidat.cc
OMNIAUTH_APP_SLUG=omnibank
OMNIAUTH_CLIENT_ID=<from provider>
OMNIAUTH_CLIENT_SECRET=<from provider>
OMNIAUTH_REDIRECT_URI=https://bucks.omnidat.cc/app/omniauth/callback
OMNIAUTH_BRIDGE_SECRET=<shared frontend+api>
BANK_PUBLIC_BASE_URL=https://bucks.omnidat.cc
```

4. Link users after first login (subject = Authentik username):

```sql
INSERT INTO omniauth_links (subject, account_id, email)
VALUES ('akadmin', 9, 'you@example.com')
ON CONFLICT (subject) DO UPDATE SET account_id = EXCLUDED.account_id;
```

### Future: SAML proxy / outpost

Optional later: Authentik **Proxy Provider** + outpost injecting
`X-OmniAuth-*` headers, with `OMNIAUTH_MODE=headers`. OIDC is the live path
without an outpost.

## Notes

- Role mapping: Authentik groups/claims can drive OMNIDAT operator roles later;
  for now a signed-in OmniAuth user has no operator capability until an admin
  grants one (`grantOperatorRole`) or `OMNIDAT_BOOTSTRAP_ADMINS` lists their
  better-auth user id **or email** (e.g. `gmacko@omnidat.cc`).
- The public Worker (`omnidat.cc`) still uses a demo OmniAuth flow; repointing
  it at Authentik is optional and separate from the operator-app login.
- OmniBank card/OTP instrument auth is unchanged; OmniAuth is for human web
  sessions on `bucks.omnidat.cc`.
