# Data Seeds

These JSON files are the machine-readable starting point for OMNIDAT. They are
not generated yet; update them alongside the docs until a real schema/migration
tool exists.

Files:

- `services.json`: Exchange 88 public service map.
- `endpoints.json`: routable PBX/data endpoints.
- `packet-services.json`: PAD/X.25-style host directory.
- `packet-namespaces.sample.json`: planned packet address namespaces for core,
  carrier, merchant, approved village, open campsite, event, and diagnostic
  services.
- `transport-profiles.sample.json`: planned access transports for terminal,
  modem, Wi-Fi/TCP, MeshCore, Meshtastic, hosted node, and remote node paths.
- `telephony-peers.sample.json`: ShadyTel and OmniTel lab interconnect peers.
- `verifone-simulator-profile.json`: terminal app dial numbers, X.121
  addresses, and Raspberry Pi USB modem lab assumptions.
- `campsite-apps.sample.json`: provisional and official campsite packet app
  records.
- `activity-passports.sample.json`: sample passport/handle identities for
  activity logging.
- `badges.sample.json`: sample merit badge requirement records.
- `queue-apps.sample.json`: queue/menu definitions for Miliways and dispatch.
- `accounts.sample.json`: seed identities for lab testing.
- `vendors.sample.json`: seed merchants and service tenants.
- `terminals.sample.json`: seed ATM/POS/proxy/BOH/vendor terminal inventory.
- `carrier-circuits.sample.json`: seed private carrier access circuits.
- `media-catalog.sample.json`: seed VHS inventory.
- `print-queues.json`: Document Services queue names.

Validation:

```sh
./scripts/validate-data
```

Database build:

```sh
./scripts/build-db
```

Rendering:

```sh
./scripts/render-artifacts
```

Rendered outputs:

- `service-directory.txt`: printable Exchange 88 directory.
- `packet-directory.txt`: printable PAD/Packet Clearing directory.
- `asterisk-routes.conf`: generated route map for PBX review.

The SQLite database defaults to `build/omnidat.db` and is intended for lab
inspection, local status tools, and early operator-console work.

## FryOS Queue Bridge

Miliways queue items may include `fryos_menu_item_id`. When `FRYOS_BASE_URL`
and `FRYOS_OPERATOR_TOKEN` are set, `./scripts/queue order` and
`./scripts/radio-pad REQ 020501 ORDER ...` create a real FryOS POS order for
mapped items through `order.create`.

Current sample mappings target the FryOS demo seed ids:

- `tea` -> `demo-menu-iced-tea`
- `coffee` -> `demo-menu-lemonade`
- `pancakes` -> `demo-menu-classic-fries` while still sold out locally

Keep these ids aligned with FryOS `packages/db/src/demo-scenario.ts` or the
live menu records for the target event runtime.
