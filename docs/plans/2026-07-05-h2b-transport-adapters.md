# H2b Transport Adapters Implementation Plan

Date: 2026-07-05

**Goal:** Add the remaining access transports from the [roadmap](../roadmap.md)
H2 behind the one packet-call interface built in
[H2 browser XOT](2026-07-05-h2-browser-xot-bridge.md): POTS/modem, MeshCore
managed radio, Meshtastic guest radio, and Wi-Fi/TCP — each with its own
call-user-data budget and access class, guest radio strictest.

**Architecture:** A transport carries a policy, not a code path. `packetCall`
consults `TRANSPORT_POLICIES` (`omnidat-transports.ts`), enforces the budget
before opening a session, and clears an over-budget or unknown-transport call
with an honest X.25 cause (3 facility-refused / 19 packet-too-long). The
application flow (directory lookup → session → verb → clear → evidence) is
identical across transports; only the policy differs.

## Delivered In This Slice (code)

- `omnidat-transports.ts`: `TRANSPORT_POLICIES` for `xot`, `pots-modem`,
  `wifi-terminal`, `meshcore`, `meshtastic` with `maxUserDataBytes`
  (128/128/128/64/32), access class, and `fastSelectAllowed`.
- `checkTransport(transport, bytes)` → admit, or refuse with an honest clear
  code. Wired into `packetCall`: budget enforced before session open; an
  over-budget guest-radio call clears cause 19, an unknown transport cause 3.
- Tests: budget ladder, unknown-transport refusal, over-budget refusal, and a
  `packetCall` guest-radio budget rejection.

## Remaining Work (hardware / integration, later)

These need real gateways and are not application code:

- **POTS/modem** — Asterisk/SIP + USB modem answering `8800-8823`, bridging a
  dial-in PAD session to `packetCall`. Needs the H5 PBX lab.
- **MeshCore managed gateway** — a loaner-radio bridge that authenticates a
  registered node and forwards bounded packets to `packetCall`.
- **Meshtastic guest ingress** — a stricter public bridge with the 32-byte
  budget and no fast-select, rate-limited per node.
- **Wi-Fi/TCP campsite remote node** — a hosted adapter over TCP.

Each is a thin process that terminates its wire protocol and calls
`packetCall` with the right `sourceTransport`; the budget and clear-cause
behavior are already enforced server-side.

## Acceptance Criteria

- every transport has an explicit budget and access class in one policy table.
- an over-budget or unknown-transport call clears with an honest cause, never
  a silent truncation.
- adding a transport is a policy entry plus a wire-terminating bridge, not a
  change to the packet-call flow.

**Status (parallel work):** Policy + checkTransport + telnet PAD adapter implemented and documented. Hardware paths (POTS, radio) tracked in BOM and H5-H8 for ToorCamp 2028 / CC Camp 2027.
