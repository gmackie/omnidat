# Roadmap

## Phase 0: Paper Design

- Finalize OMNIDAT identity and service names.
- Confirm whether the 8800-8823 block is plausible with ShadyTel.
- Draft the ShadyTel PRI request.
- Freeze the first-pass system requirements.
- Freeze the first-pass service index and data model.
- Choose initial PBX approach: native PRI, PRI-to-SIP gateway, or vintage PBX.
- Pick V1 service set.
- Approve hardware BOM tiers and first purchase/build order.
- Decide real X.25, XOT, or terminal-faithful emulation for V1.
- Decide physical fax-only vs fax server plus physical fax.
- Decide Media Vault slot count and VCR control approach.

## Phase 1: Local PBX and Dial Plan

- Seed the service map and records from the data model.
- Build an Asterisk or FreeSWITCH development PBX.
- Model `8800-8823` locally.
- Implement hunt groups, direct lines, operator line, and intercept behavior.
- Create fake ShadyTel ingress trunk for testing.
- Add test calls for called-number routing.
- Emit call records to a local event stream or log file.
- Print one daily call summary through Document Services.

## Phase 2: Terminal and Document Services

- Stand up OMNIDAT Online BBS.
- Stand up Packet Clearing prototype with terminal UI.
- Attach one modem or modem-emulated gateway.
- Attach one fax path.
- Attach one dot matrix printer path.
- Print call slips, queue receipts, and network logs.
- Implement at least one shared account or access-card concept.
- Make Media Vault catalog visible from BBS and Packet Clearing.
- Run Demo-Ready acceptance tests.

## Phase 2A: Field Office and Campsite App Platform

- Define packet address namespaces for OMNIDAT core, trusted carriers,
  merchant services, approved villages, open campsites, event operations, and
  diagnostics.
- Build a web-backed service-order intake for campsite packet applications.
- Issue provisional `020xxx` open campsite addresses.
- Render printable address assignment letters and campsite service
  certificates.
- Add hosted campsite app templates: bulletin, message desk, queue,
  classifieds, inventory, schedule, form, telegram, status board, remote print,
  and puzzle node.
- Build a Radio PAD command grammar for MeshCore and Meshtastic access.
- Keep MeshCore as the managed loaner infrastructure path and Meshtastic as
  guest/BYO ingress.
- Add explicit activity-passport and merit-badge logging tied to named accounts
  or handle/passport IDs.
- Build one Miliways-style food order and line-management sample app.
- Prove the portable Field Office kit before relying on the full ToorCamp PRI
  buildout.

## Phase 3: Media Vault Prototype

- Build a 3-5 slot benchtop gantry prototype.
- Define inventory schema and request queue.
- Implement operator console.
- Drive a VCR and one CRT locally.
- Prove load, play, eject, return, and fault recovery.
- Generate overlay/slate metadata from the Media Vault queue.
- Print a Media Vault load ticket from the operator console.
- Run Event-Ready acceptance tests for the hardware in scope.

## Phase 4: ShadyTel Interop Test

- Test PRI or simulated PRI handoff.
- Verify called-number delivery.
- Verify channel limits and busy behavior.
- Verify caller ID behavior.
- Verify operator escalation and failure modes.
- Verify direct numbers and hunt groups separately.
- Verify maintenance/intercept announcements.
- Run ShadyTel-Ready acceptance tests.

## Phase 5: ToorCamp Buildout

- Promote proven Field Office services into the official ToorCamp village
  Packet Clearing directory.
- Expand modem/PAD capacity.
- Expand Media Vault slots.
- Deploy analog RF/coax and IP stream.
- Coordinate amateur television station operations.
- Prepare signage, printed directories, fax forms, account cards, and operator
  runbooks.
- Run Launch-Ready acceptance tests.
