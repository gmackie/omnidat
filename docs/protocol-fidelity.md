# OMNIDAT Protocol Fidelity And Interop

Date: 2026-07-04

## Purpose

This is the Workstream C spec from
[Roadmap Expansion](plans/2026-07-04-roadmap-expansion.md). It implements the
locked protocol-fidelity decision: interoperable where practical — real XOT
framing per RFC 1613, honest X.25 clear cause and diagnostic codes, a
documented X.3/X.29 subset, and a published interop profile third-party
experimenters can peer against.

The audience is two-fold:

- OMNIDAT builders implementing the H2 packet bridge, so protocol behavior is
  specified before it is coded, not retrofitted.
- third-party X.25/XOT experimenters (H8 partner nodes) who want to complete
  calls against OMNIDAT with their own equipment.

Normative language: "must" is required for the H2 exit gate ("a third-party
XOT client completes CALL, data, and CLR against a provisioned service with
correct cause/diagnostic codes"); "should" is targeted for the first pilot.

## Fidelity Posture

[Packet Clearing](packet-clearing.md) defines three implementation tiers:
real hardware, XOT/IP-backed X.25, and terminal-faithful emulation. This spec
pins the fidelity contract that all three tiers must satisfy:

- addresses are real X.121 addresses, not X.121-shaped strings.
- every failed call clears with a real X.25 cause and diagnostic code.
- the PAD behaves like a documented X.3 subset, not an ad hoc REPL.
- XOT (RFC 1613) is the interop boundary for anything arriving over TCP.
- facilities are parsed correctly even when politely refused.

Behavior that is theatrical (fee ledgers, charging signals, service copy)
must still be protocol-honest: a theatrical charge rides a correctly coded
facility, and a theatrical outage clears with the correct cause.

## Current State

What exists today, so nobody mistakes this spec for shipped behavior:

- addresses: seed data uses 6-digit local addresses
  (`data/packet-services.json`, e.g. `000001 OMNIDAT DIRECTORY`); the Worker
  and gmacko V1 use full 12-digit international addresses
  (`worker/omnidat-worker.mjs:236-239`, e.g. `311088010110`;
  `gmacko/packages/operator-core/src/omnidat.ts:481`). Self-service
  allocation mints `31108802` + 4 digits
  (`gmacko/packages/operator-core/src/omnidat.ts:846-851`).
- PAD/XOT: `xotCommand` is a tRPC mutation carrying verb strings
  (`gmacko/packages/api/src/router/omnidat.ts:393-407`); it is a simulator,
  not RFC 1613 framing. It already emits one honest clear —
  `CLEAR 13 UNKNOWN ADDRESS` for an unallocated address
  (`gmacko/packages/operator-core/src/omnidat.ts:1974`).
- PAD profiles: `configurePad` knows five PAD kinds (`meshcore-pad`,
  `meshtastic-pad`, `wifi-terminal`, `pots-pad`, `xot-terminal`;
  `gmacko/packages/api/src/router/omnidat.ts:253-259`) and advertises
  `XOT HOST omnidat.cc / XOT PORT 1998 / WINDOW 2 / PACKET-SIZE 128`
  (`gmacko/packages/operator-core/src/omnidat.ts:1680-1689`). No TCP listener
  exists yet; a Cloudflare Worker cannot accept raw TCP, so the real XOT
  listener lands on the field kit or a VPS node (see Open Questions).
- transports: terminal classes are seeded in
  `data/transport-profiles.sample.json` (pad-terminal, pots-modem, wifi-tcp,
  meshcore-radio-pad, meshtastic-radio-pad, hosted-node, remote-node).
- namespaces: address ranges and provisioning classes are seeded in
  `data/packet-namespaces.sample.json`.

Everything below is the contract the H2 bridge implements.

## X.121 Numbering Plan

### Address structure

OMNIDAT addresses are 12-digit X.121 international data numbers:

```text
3110  88  020501
DNIC  NN  local address
```

- DNIC (4 digits): data network identification code, `3110` today.
- NN (2 digits): OMNIDAT network number, `88`, matching the Exchange 88 PBX
  identity ([Dial Plan](dial-plan.md)).
- local address (6 digits): service address within the namespace plan below.

X.121 permits 14 digits total. OMNIDAT reserves the two unused trailing
digits as an optional subaddress passed uninterpreted to the called service
(e.g. `31108802050101` reaches `311088020501` with subaddress `01`).

Two written forms are normative:

- international form: full 12 digits (`311088020501`). Canonical in records,
  directories, journal entries, and evidence artifacts.
- local form: 6 digits (`020501`), valid only at an OMNIDAT PAD prompt and in
  camp-facing print. The PAD expands local form by prefixing `311088`.

The seed data (`data/packet-services.json`) and the packet simulator
(`scripts/packet`) currently speak local form while the Worker and gmacko
speak international form; the H2 bridge must accept both and store
international form only.

### DNIC choice

DNIC `3110` was historically Telenet's United States assignment (later
Sprint/SprintNet). OMNIDAT currently squats it in all seeded addresses. The
options:

| Option | Fidelity | Risk |
| --- | --- | --- |
| Squat historic `3110` | High: real defunct-carrier theater, period-correct addresses | Collision with other retro X.25 networks that also squat famous DNICs; zero standing to resolve disputes |
| Unassigned/private DNIC | Low theater; X.121 has no formal private range, so any choice is still a squat, just an obscure one | Same standing as above, minus the recognition value |
| Dual-home | `3110 88` for camp theater plus a second DNIC for partner peering | Two routing tables, two directory identities, more interop surface |

Recommendation: keep `3110 88` as the single OMNIDAT identity. Telenet's
DNIC has been dead for two decades, the `88` network number is unlikely to
collide with other Telenet nostalgists, and dual-homing buys nothing until a
partner network actually objects. Adopt a written collision policy instead:
if a peer network demonstrates prior use of `3110 88`, OMNIDAT renumbers the
NN digits, not the camp-facing local addresses.

This remains an open decision point in [the roadmap](roadmap.md) (X.121
numbering plan governance) — see Open Questions.

### Local address namespaces

Local addresses follow the seeded namespace plan
(`data/packet-namespaces.sample.json`):

| Range | Class | Provisioning | Directory status |
| --- | --- | --- | --- |
| 000000-000999 | CORE | manual | official |
| 001000-001999 | CARRIER | operator-approved | official |
| 002000-002999 | MERCHANT | operator-approved | restricted |
| 010000-019999 | APPROVED | operator-promoted | official |
| 020000-029999 | OPEN | self-service | provisional |
| 030000-039999 | EVENT | template-or-operator | official |
| 090000-090999 | TEST | manual | technical |

Calls to unallocated addresses inside these ranges clear as not obtainable;
calls to addresses outside any range clear as not obtainable with the
invalid-address diagnostic (see clear-code table).

### Partner sub-allocation rules

Partner nodes (H8) receive blocks, never single addresses:

- partner services reachable through OMNIDAT are allocated a block of 100 in
  the CARRIER range (`0010xx`, `0011xx`, ...), recorded as an X.121 block
  allocation with an owner, a transport endpoint, and a routing rule.
- a partner running its own network under a different DNIC peers over XOT;
  OMNIDAT routes its full DNIC prefix to the partner gateway and expects the
  reverse route for `3110 88`.
- sub-allocation within a partner block is the partner's business; OMNIDAT
  routes on the block prefix and does not police the tail digits.
- partner blocks appear in the directory under the partner's name with
  `official` status only after the operator-approval step; before that they
  are reachable but unlisted.
- revocation: a suspended partner block clears calls with access barred, not
  not-obtainable, so the address visibly exists but is barred.

The peering contract stub (transport endpoint, block, rate limits, RoE
acknowledgment, revocation terms) feeds H8 and is out of scope here.

## X.3 PAD Parameter Subset

OMNIDAT PADs implement the following X.3 parameters. Anything not listed
reads as 0 and cannot be set; a SET on an unsupported or read-only parameter
returns an X.29 parameter indication marking that parameter invalid — it is
never silently accepted.

Terminal classes map to the seeded transports and `configurePad` kinds:

- browser XOT: `xot-terminal` / `wifi-tcp` (browser terminal speaking to the
  XOT bridge).
- POTS/modem: `pots-pad` (Exchange 88 modem pool, dumb terminal or vintage
  POS behind a modem).
- radio PAD: `meshcore-pad` and `meshtastic-pad` (transactional Radio PAD
  gateway per [Packet Clearing](packet-clearing.md); one radio frame is one
  complete command, so interactive editing parameters are forced off).

| # | Parameter | Browser XOT | POTS/modem | Radio PAD |
| --- | --- | --- | --- | --- |
| 1 | PAD recall (escape) | 1 (DLE) | 1 (DLE) | 0 (none) |
| 2 | Echo | 0 (client echoes) | 1 (PAD echoes) | 0 |
| 3 | Data forwarding | 2 (on CR) | 2 (on CR) | 0 (frame boundary) |
| 4 | Idle timer | 0 | 0 | 0 |
| 7 | Break action | 21 (interrupt, discard, indicate) | 21 | 0 |
| 9 | Padding after CR | 1 | 0 | 0 |
| 10 | Line folding | 0 | 0 | 0 |
| 13 | LF insertion | 0 | 4 (LF after CR to terminal) | 0 |
| 15 | Editing | 0 (client edits) | 1 | 0 |
| 16 | Character delete | 127 (DEL) | 127 (DEL) | 0 |
| 17 | Line delete | 24 (CAN) | 24 (CAN) | 0 |
| 18 | Line display | 18 (DC2) | 18 (DC2) | 0 |
| 21 | Parity treatment | 0 (none) | 3 (check + generate) | 0 |
| 22 | Page wait | 0 | 0 | 0 |

Notes:

- Radio PAD parameters are fixed; SET is refused. The gateway forwards each
  complete radio frame as one call/data unit, matching the transactional
  model in [Packet Clearing](packet-clearing.md).
- browser XOT defaults match the seeded profile (`WINDOW 2`,
  `PACKET-SIZE 128`, local echo, CR padding 1;
  `gmacko/packages/operator-core/src/omnidat.ts:1680-1689`).
- parameters 5, 6, 8, 11, 12, 14, 19, 20 are unsupported in V1. Parameter 11
  (binary speed) should be added, read-only, when the modem pool reports line
  speed.
- the printed PAD cheat-sheet card (Workstream E) documents only `CALL`,
  `DIR`, `LOOKUP`, `HELP`, `CLR`; X.3 parameters are operator-facing.

## X.29 Control Procedures

Supported PAD-host control procedures:

- set (SET), read (READ), and set-and-read (SET?) of the X.3 subset above,
  with parameter indication in response. Invalid parameters are marked in
  the indication, per the rule above.
- indication of break, per parameter 7.
- error PAD message in response to an unrecognized X.29 message.
- invitation to clear: transactional services (Radio PAD one-shot verbs,
  receipt printers) send their final response followed by invitation to
  clear; the PAD flushes delivered data, then clears with cause 0 (DTE
  originated). This is the normative way a service ends a session — services
  must not just drop the connection.

Not supported, refused with an error PAD message:

- reselection (X.29 reselection PAD message).
- any national-use or nonstandard X.29 message.

## X.25 Clear Cause And Diagnostic Codes

Every clear OMNIDAT originates carries a real cause and diagnostic. There is
no generic failure. The PAD renders clears as the standard X.28 service
signal plus explicit codes:

```text
CLR NP C:13 D:67
```

Causes OMNIDAT emits, with the conditions that produce them:

| Cause | X.28 | Meaning | OMNIDAT condition |
| --- | --- | --- | --- |
| 0 | DTE | DTE originated | caller sent CLR; or service ended the session via invitation to clear |
| 1 | OCC | Number busy | destination at its concurrent-session limit |
| 3 | INV | Invalid facility request | refused facility that cannot be ignored (CUG, RPOA); D:65 or D:66 |
| 5 | NC | Network congestion | rate limit tripped, journal backpressure, gateway overload; D:71 when no channel is available |
| 9 | DER | Out of order | address allocated but its transport endpoint is down (circuit down/degraded-unreachable) |
| 11 | NA | Access barred | access-class violation (REGISTERED/OPERATOR service from an unentitled caller), suspended or revoked credential, revoked allocation, suspended or moderation-delisted service, suspended partner block; D:70 |
| 13 | NP | Not obtainable | address unallocated or fully withdrawn (D:0), or malformed/outside the plan (D:67) |
| 17 | RPE | Remote procedure error | service host crashed or violated the service contract mid-call |
| 19 | ERR | Local procedure error | caller protocol violation: data before call accepted, bad packet sequence; D:16, D:36, D:38, D:39 as applicable |
| 25 | RNA | Reverse charging not subscribed | reverse-charge call to a service whose fee policy does not accept it |
| 33 | ID | Incompatible destination | session kind the destination cannot carry (e.g. interactive call to a one-shot print spool) |
| 41 | — | Fast select not subscribed | fast select call to a service not flagged fast-select-capable |

Diagnostics OMNIDAT emits (X.25 Annex E values):

| Diag | Meaning | Used with |
| --- | --- | --- |
| 0 | No additional information | any cause |
| 16 | Packet type invalid | cause 19 |
| 36 | Packet on unassigned logical channel | cause 19 |
| 38 | Packet too short | cause 17, 19 |
| 39 | Packet too long | cause 17, 19 |
| 65 | Facility code not allowed | cause 3 |
| 66 | Facility parameter not allowed | cause 3 |
| 67 | Invalid called DTE address | cause 13 |
| 70 | Incoming call barred | cause 11 |
| 71 | No logical channel available | cause 5 |

Rules:

- revoked addresses: during an event, a revoked allocation clears with
  cause 11, D:70 (access barred) — the address visibly exists but is
  barred. Only a fully withdrawn/unallocated address clears with cause 13,
  D:0 (not obtainable). [Moderation Policy](moderation-policy.md) states
  the same rule from the policy side.
- the failed-call-rate-by-clear-cause KPI (Workstream G) consumes these
  codes from the field kit journal; a clear without a cause is a bug.
- the simulator today prints `CLEAR 13 UNKNOWN ADDRESS <x121>`
  (`gmacko/packages/operator-core/src/omnidat.ts:1974`); the bridge
  normalizes to the `CLR <signal> C:<cause> D:<diag>` form above and the
  simulator follows.
- theatrical outages (planted challenges, staged incidents) must use the
  code the real condition would produce, usually 9/DER.

## Facilities Handling

OMNIDAT parses every facility field correctly. Each facility is honored,
ignored-with-notice, or politely refused; a refusal is a clear with cause 3
and diagnostic 65/66, never a silent drop of the call or the facility.

| Facility | Handling |
| --- | --- |
| Reverse charging | Honored. Maps to the network fee policy engine (merchant-pays / operator-pays in [the roadmap](roadmap.md) H4). A reverse-charge call to a service whose fee policy does not accept it clears with cause 25. |
| Fast select | Honored for transactional services. Up to 128 octets of call user data carry a Radio PAD one-shot verb; the response rides the clear user data. Services not flagged fast-select-capable clear with cause 41. |
| Fast select with restriction | Honored; the response is delivered in the clear indication only. |
| Packet size negotiation | Honored. Default 128; negotiated down to 128 from any larger request. 256 should be offered once the field kit bridge is benched. |
| Window size negotiation | Honored. Clamped to window 2, matching the seeded PAD profile. |
| Throughput class | Parsed; honored by clamping to the transport profile's rate (radio PAD transports clamp lowest). |
| Closed user group | Politely refused (cause 3, D:65). OMNIDAT access classes (PUBLIC / REGISTERED / OPERATOR, `data/packet-services.json`) do this job instead. |
| NUI selection | Parsed, not honored in V1: the call proceeds with the caller's transport-level identity and the NUI is logged. Binding NUI to OMNIDAT accounts is an open question. |
| RPOA selection | Politely refused (cause 3, D:65). There is one carrier at camp. |
| Charging information | Honored where a fee policy applies: the clear confirmation carries charging information consistent with the fee ledger. Theatrical, but correctly coded. |
| Call redirection / deflection | Not supported; refused (cause 3, D:65). |

Modulo: packet sequence numbering is modulo 8 only. Modulo 128 requests are
refused at call setup with cause 3.

## XOT Per RFC 1613

XOT is the interop boundary for every TCP transport: browser XOT bridge,
partner peering, Wi-Fi campsite remote nodes, and the test bench.

- TCP port 1998, per RFC 1613 and the seeded PAD profile
  (`gmacko/packages/operator-core/src/omnidat.ts:1683`).
- framing: each X.25 packet is carried in one XOT message — a 4-octet header
  (version = 0, length = X.25 packet length in octets) followed by the
  packet. Messages with version != 0 or length outside 3..4103 terminate the
  TCP connection, per RFC 1613 section 5.
- one virtual circuit per TCP connection. A second CALL REQUEST on an open
  connection is a local procedure error (cause 19, D:16).
- SVCs only. PVC setup (RFC 1613 section 8) is not supported; a PVC setup
  packet terminates the connection.
- keepalive: TCP keepalives enabled on both sides. OMNIDAT additionally
  clears idle virtual circuits (no data either direction) after 15 minutes
  with cause 9 so half-dead partner links do not pin sessions open. Radio
  PAD-originated calls use shorter service-specific idle limits.
- connection close without CLEAR REQUEST is treated as a clear with cause 9
  and journaled as an abnormal termination.
- listener placement: the XOT listener runs on the field kit (and on a VPS
  node for the cloud/no-event mode); the Cloudflare Worker never terminates
  XOT. All bridge writes land in the field kit journal first, per the
  authority model in [the roadmap](roadmap.md).

## OMNIDAT Interop Profile

What a third-party experimenter implements against. A conforming peer:

1. connects to the published XOT endpoint, TCP port 1998, RFC 1613 framing,
   version 0, one VC per connection.
2. places calls to 12-digit called addresses under `3110 88`; sends its own
   12-digit calling address from an allocated partner block (or a
   loaner address issued at the NOC desk).
3. uses modulo 8, window <= 2, packet size <= 128 (256 when negotiated).
4. sends and honors real clear causes; expects every OMNIDAT clear to carry
   cause + diagnostic per the tables above.
5. may request reverse charging and fast select; must tolerate refusal via
   cause 25 / 41 without retry storms.
6. does not need X.29: a bare X.25 DTE calling a service address and moving
   data is fully supported. X.29 applies only when the peer is a PAD serving
   OMNIDAT services to its own terminals.
7. rate limits: published per-transport call and data rates apply
   (rules-of-engagement hardening); exceeding them clears with cause 5 and
   is a NOC abuse signal, not a fault.
8. test targets: `311088000099 TEST LOOP` (echo, PUBLIC, seeded in
   `data/packet-services.json`) and the `090xxx` diagnostics namespace for
   PAD training and line tests.
9. directory: `CALL 311088000001` (Packet Clearing Directory, local form
   `000001`, CORE namespace, seeded in `data/packet-services.json`) or the
   printed phone book; `DIR`/`LOOKUP` verbs are documented on the PAD cheat
   sheet. TODO: the Worker demo currently answers at `311088010110`; that
   divergence is reconciled in code, not here.

Conformance is demonstrated by the H2 exit gate: complete CALL, bidirectional
data, and CLR against a provisioned service, observing correct cause and
diagnostic codes on at least the NP (13), NA (11), and OCC (1) failure paths.

## Interop Test Bench

The bench proves the profile against implementations OMNIDAT does not
control. Concrete targets:

- Cisco IOS XOT: the reference RFC 1613 implementation. A vintage
  2500/2600/3600-series router with an X.25 feature set, or dynamips/GNS3
  with the same IOS image, configured with `x25 route ^3110 xot <fieldkit>`
  and an async PAD line. Exercises call setup, window/packet negotiation,
  cause propagation, and XOT keepalive behavior.
- xotpad (open-source X.25 PAD over XOT): scriptable user-side PAD; covers
  the hobbyist-peer case and X.28-style user signals.
- xotd (open-source XOT daemon, used by the SIMH/retrocomputing community to
  front emulated machines with X.25): covers the partner-node case of a
  foreign host network behind an XOT gateway.
- a minimal in-repo RFC 1613 client in the test suite, asserting exact
  framing bytes, malformed-header teardown, and the cause/diagnostic tables
  — CI coverage for what the third-party tools prove manually.

Bench checklist (feeds the H2 exit gates and the lab health check in
[the roadmap](roadmap.md) H5):

- CALL / data / CLR from each third-party client against a provisioned
  service, transcript journaled and evidence artifact exported.
- forced failure per emitted cause code in the table above, observed from
  the third-party side with matching cause and diagnostic.
- fast select one-shot verb round trip.
- reverse-charge call against accepting and non-accepting fee policies.
- idle-circuit clear and TCP half-close handling observed from Cisco IOS.
- rate-limit trip produces cause 5 on the wire and an abuse signal in NOC.

## Open Questions

- DNIC governance: keeping `3110 88` is recommended above but not signed
  off; the roadmap decision point (owner, decide-by date, collision policy
  ratification) is still open.
- XOT listener placement for cloud-primary mode: field kit only, or also a
  VPS node so partners can peer between events? Constrained by the Worker's
  inability to terminate TCP.
- NUI facility: whether to bind NUI to OMNIDAT accounts for terminal
  identity, or keep identity at the transport layer permanently.
- packet size 256 and modulo 128: offer after field kit bench, or never;
  vintage gear rarely needs either.
- local-form dialing scope: whether 6-digit local form is accepted from
  partner XOT peers or only at OMNIDAT-operated PAD prompts.
- which exact IOS image/hardware and tool versions the bench pins, and
  whether the bench requires real serial hardware or dynamips is sufficient.
- partner peering contract terms (rate limits, revocation, RoE linkage) —
  stub deferred to H8 per Workstream C.
