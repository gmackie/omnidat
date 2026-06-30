# Shared Infrastructure with FryOS

## Goal

OMNIDAT can share local development and V1 database infrastructure with FryOS
while it grows into a fuller service. The sharing boundary is infrastructure
only: app routing, health checks, local scripts, and the FryOS Postgres service.
OMNIDAT packet, activity, queue, and Radio PAD domain logic stays separate.

## Current Shared Contracts

OMNIDAT now exposes the same basic readiness surface expected by FryOS-style
local operations:

```text
/api/health
/api/health/live
/api/health/ready
```

The health response includes:

```json
{
  "service": "omnidat-field-office",
  "status": "healthy",
  "checks": {
    "seed_data": { "status": "pass" },
    "runtime_dirs": { "status": "pass" }
  }
}
```

OMNIDAT also includes:

```text
package.json
portless.json
gmacko.integrations.json
.env.example
```

These files let local app tooling treat OMNIDAT as a named service without
requiring a Next.js migration.

## create-gmacko-app Direction

V1 should move the web/operator surface into a create-gmacko-app scaffold. The
current Python service remains a behavior harness and CLI reference until the
generated app owns persistence and UI.

Generate a local preview scaffold:

```sh
npm run scaffold:gmacko
```

The preview script uses the local FryOS package:

```text
/Volumes/dev/fryos/packages/create-gmacko-app
```

It creates a web-only app with tRPC operator wrappers, no mobile app, and no
install step:

```text
build/create-gmacko-app-preview/omnidat-app
```

Do not overwrite the OMNIDAT root with the scaffold. Use the preview to port
domain models, routes, and UI intentionally.

## Shared Postgres V1

V1 should use the same local Postgres service and database as FryOS, with
OMNIDAT isolated by schema:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gmacko_dev
OMNIDAT_DB_SCHEMA=omnidat
```

Check the shared database:

```sh
npm run db:shared:check
```

The shared database is an infrastructure convenience, not a shared domain
schema. OMNIDAT tables should live under the `omnidat` schema. FryOS order/POS
tables should remain owned by FryOS.

## Local Commands

Run the Field Office UI:

```sh
npm run dev
```

or directly:

```sh
./scripts/ui --port 8828
```

Health checks:

```sh
npm run health
npm run live
npm run ready
```

Full local verification:

```sh
npm test
npm run validate
npm run render
npm run build:db
```

## Portless

The `portless.json` manifest names OMNIDAT as:

```text
omnidat
```

The app script is:

```text
npm run dev
```

This mirrors FryOS' local app routing shape. A developer can put OMNIDAT behind
the same local routing tooling used for FryOS without making OMNIDAT a package
inside the FryOS monorepo.

## What Can Be Shared Now

- local app routing conventions
- `/api/health` readiness checks
- operator habit: check health before demo or field run
- package-script naming
- future ForgeGraph/deploy handoff shape
- possible shared host for early demos
- FryOS local Postgres service for V1, isolated by `omnidat` schema

## What Should Stay Separate

- Packet Clearing address space
- activity passport ledger
- Miliways/dispatch queue state
- Radio PAD command handling
- Shadybucks/Shadybank authority
- FryOS order/POS production state
- FryOS realtime/SSE machinery
- FryOS production database and Hyperdrive bindings until there is an explicit
  deployment contract

OMNIDAT can use the FryOS local Postgres service for V1. It should not reuse
FryOS production databases, Hyperdrive bindings, or realtime infrastructure
until a specific integration contract exists. The first product integration
should be a small, explicit event bridge rather than a shared schema.

## Later Integration Options

1. **Shared Host Only**
   OMNIDAT and FryOS run on the same VPS or local operator machine with separate
   processes, ports, and data directories.

2. **Shared Event Bridge**
   FryOS can publish selected queue/order/kitchen events into OMNIDAT Packet
   Clearing as service records. OMNIDAT can publish activity/dispatch receipts
   back to FryOS if explicitly needed.

3. **Shared Web Shell**
   A future create-gmacko-app or Next.js shell can host OMNIDAT UI routes while
   the Packet Clearing core remains a separate service.

Recommended next step: scaffold the create-gmacko-app preview, port the Packet
Clearing/Radio PAD/queue/activity model into a Postgres-backed app under the
`omnidat` schema, and only design a FryOS event bridge when there is a concrete
Miliways/FryOS operations use case.
