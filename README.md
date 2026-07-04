# OMNIDAT

**OMNIDAT** is a gmacko corporation.

OMNIDAT is a ShadyTel-adjacent financial data services installation for
ToorCamp 2028. It combines a real PBX interconnect, dialable business services,
packet networking, terminals, fax, print, and a robotic VHS media vault into one
in-world corporate network.

OMNIDAT also acts as the private carrier/access network for Shadybucks commerce:
ATMs, POS terminals, merchant proxy hosts, back-office WMS systems for
NiteMarkt, and miscellaneous vendor terminals attach to OMNIDAT rather than
directly to the general camp network.

Tagline candidates:

- Financial Data Services
- Account, Terminal, Settlement, Media
- Your business is already in our system.

## Concept

OMNIDAT requests an ISDN PRI T1 from ShadyTel and receives the `8800-8823`
number block. ShadyTel owns the camp telephone network and C*NET-facing
interconnect; OMNIDAT operates the services behind Exchange 88.

```text
ShadyTel / C*NET
      |
ISDN PRI T1
      |
OMNIDAT PBX
      |
      +--> OMNIDAT Online
      +--> OMNIDAT Packet Clearing
      +--> OMNIDAT Document Services
      +--> OMNIDAT Media Vault
      +--> ShadyRoulette
      +--> operator, diagnostics, and direct lines
```

## Service Families

- **OMNIDAT Exchange 88**: PBX number block and dial-in front door.
- **OMNIDAT Financial Network**: the overall business data network identity.
- **OMNIDAT Packet Clearing**: X.25, PAD, and terminal services.
- **OMNIDAT Merchant Carrier**: private access network for Shadybucks ATMs,
  POS terminals, merchant proxies, NiteMarkt BOH/WMS, and vendor back-office
  systems.
- **OMNIDAT Online**: BBS, shell, file drop, and store-and-forward services.
- **OMNIDAT Document Services**: fax machine, fax server, print desk, and dot
  matrix output.
- **OMNIDAT Media Vault**: robotic VHS library, playback queue, analog TV,
  local IP stream, and amateur television experiment feed.
- **OMNIDAT TrustDesk**: operator, directory, and trouble line.

## Repository Map

### Design Docs

- [Architecture](docs/architecture.md)
- [Identity](docs/identity.md)
- [Service Index](docs/service-index.md)
- [System Requirements](docs/system-requirements.md)
- [Data Model](docs/data-model.md)
- [Integration Map](docs/integration-map.md)
- [Field Office Network Plan](docs/field-office-network-plan.md)
- [Leadership Pilot Package](docs/leadership-pilot-package.md)
- [Shared Infrastructure with FryOS](docs/shared-infra-fryos.md)
- [Lab Bring-Up Plan](docs/lab-bringup.md)
- [Acceptance Tests](docs/acceptance-tests.md)
- [Dial Plan](docs/dial-plan.md)
- [PBX Design](docs/pbx-design.md)
- [Hardware BOM](docs/hardware-bom.md)
- [Packet Clearing](docs/packet-clearing.md)
- [Shadybucks Carrier Network](docs/shadybucks-carrier-network.md)
- [Document Services](docs/document-services.md)
- [ShadyTel Interconnect Request](docs/shadytel-interconnect-request.md)
- [Media Vault](docs/media-vault.md)
- [Video Distribution](docs/video-distribution.md)
- [Operator Model](docs/operator-model.md)
- [Roadmap](docs/roadmap.md)
- [Open Questions](docs/open-questions.md)
- [Field Office X.25 App Platform Plan](docs/plans/2026-06-29-omnidat-field-office-x25-app-platform.md)
- [Persistent Operator Workflows Implementation Plan](docs/plans/2026-07-04-persistent-operator-workflows.md)

### Operational Artifacts

- [Data Seeds](data/README.md)
- [Runbooks](runbooks/README.md)
- [Asterisk Config Scaffold](configs/asterisk/README.md)
- [Printable Forms](forms/README.md)

## Tooling

Validate seed data:

```sh
./scripts/validate-data
```

Build a local SQLite database from seed data:

```sh
./scripts/build-db
```

Render printable/generated artifacts from seed data:

```sh
./scripts/render-artifacts
```

Append and summarize operational events:

```sh
./scripts/events append call.ended pbx --payload '{"called":"8800","disposition":"answered"}'
./scripts/events summary --output build/daily-summary.txt
```

Run the Media Vault simulator:

```sh
./scripts/media-vault init
./scripts/media-vault request PUB-0001 --source pad --requested-by ACCT-000001
./scripts/media-vault approve-next --operator MG
./scripts/media-vault start
./scripts/media-vault complete
```

Run the Packet Clearing simulator:

```sh
./scripts/packet directory
./scripts/packet --account ACCT-000001 call 000002
```

Run the Field Office app platform:

```sh
./scripts/activity badges
./scripts/activity log PASS-04271 020184 WORKSHOP-COMPLETE
./scripts/queue menu miliways
./scripts/queue order miliways PASS-04271 tea
./scripts/radio-pad DIR
./scripts/radio-pad REQ 020501 ORDER tea PASS-04271
```

Bridge Miliways orders into a live FryOS Pi or web runtime:

```sh
export FRYOS_BASE_URL=http://127.0.0.1:3000
export FRYOS_OPERATOR_TOKEN=<same value as FryOS OPERATOR_TOKEN>

./scripts/radio-pad REQ 020501 ORDER tea PASS-04271
./scripts/queue status MLY-000001
```

The bridge calls FryOS tRPC procedures directly:

- `POST /api/trpc/order.create` with `Authorization: Bearer <token>`
- `POST /api/trpc/order.getById` with `Authorization: Bearer <token>`

Only queue items with `fryos_menu_item_id` are bridged. Other OMNIDAT queue
items remain local field-office tickets.

Serve the lightweight Field Office UI:

```sh
./scripts/ui --port 8828
```

The UI exposes FryOS-compatible health endpoints for shared local routing and
operator readiness:

```sh
curl -fsS http://127.0.0.1:8828/api/health
curl -fsS http://127.0.0.1:8828/api/health/live
curl -fsS http://127.0.0.1:8828/api/health/ready
```

The same commands are available through `package.json`:

```sh
npm run dev
npm run health
npm test
```

Prepare the create-gmacko-app V1 shell and shared FryOS Postgres schema:

```sh
npm run scaffold:gmacko
npm run db:shared:check
```

The scaffold preview is written under `build/create-gmacko-app-preview/` so it
does not overwrite the current OMNIDAT docs and Python behavior harness.

Run Document Services:

```sh
./scripts/documents print receipts "PAD SESSION RECEIPT" --body "SESSION COMPLETE"
./scripts/documents fax --pages 2 --caller ShadyTel:1234 --operator MG
./scripts/documents list
```

Render operator status:

```sh
./scripts/status
```

By default, generated outputs are written under `build/`.
