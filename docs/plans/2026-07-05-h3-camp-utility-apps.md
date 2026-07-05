# H3 Camp Utility Apps Implementation Plan

Date: 2026-07-05

**Goal:** Make OMNIDAT useful enough that campsites want to interact with it
([roadmap](../roadmap.md) H3). The exit gate is that five useful service types
can be configured without code changes and campsite owners can create and
update their own open-namespace apps. Backends for food (queue), activity
passports, and document services already exist; this slice adds the
configurable campsite-app system that ties them together.

**Architecture:** A campsite app is a data row (`omnidatCampsiteApp`:
campsiteId, address, name, appKind, status), not a code path. `CAMP_APP_KINDS`
is a data list of the supported kinds; adding an app is a gated mutation, and
promoting/delisting is a status change. Operators promote or delist; campsite
owners manage their own open-namespace apps. Built on the H1a/H1b gated +
audited pattern.

## Delivered In This Slice (code)

- `CAMP_APP_KINDS`: `bulletin`, `message-desk`, `lost-property`, `classifieds`,
  `queue`, `form-intake`, `puzzle-node`, `remote-print` — configurable types,
  data not code (satisfies "five service types without code changes").
- `createCampsiteApp` (`campsite.write`): insert an app of any configured
  kind at an X.121 address, audit `campsite.app.created`.
- `updateCampsiteAppStatus` (`campsite.write` promote / `service.disable`
  delist): active → delisted, audit `campsite.app.status.changed`.
- `listCampsiteApps` (`operator.read`), filterable by campsite.
- Tests: create apps of several kinds; promote/delist; unknown kind rejected;
  capability boundaries.

## Remaining Work (content / config, later)

- per-app content models (bulletin posts, classifieds listings, lost-property
  items) — thin CRUD on top of the app row, added per kind as camps ask.
- the printed camp phone book generated from the app directory
  (participant-collateral.md, Workstream E).
- open-namespace moderation/takedown tooling (moderation-policy.md,
  Workstream H) — the delist status change is the enforcement primitive.

## Acceptance Criteria

- five+ campsite-app kinds can be created without code changes.
- an operator can promote or delist an app; every change is audited.
- campsite-app writes are gated; auditors cannot mutate.
