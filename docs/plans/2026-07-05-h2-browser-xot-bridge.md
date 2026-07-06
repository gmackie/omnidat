# H2 Browser XOT Packet Bridge Implementation Plan

Date: 2026-07-05

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prove the first real terminal path from the [roadmap](../roadmap.md)
H2: a browser XOT terminal that calls a provisioned X.121 service through one
packet-call surface, executes a verb, clears with an honest X.25 cause code,
writes a NOC-visible packet session, and leaves an evidence receipt.

```text
browser XOT terminal (PAD> prompt)
  -> omnidat.packetCall
  -> service directory lookup
  -> packet session open
  -> service verb execution
  -> session clear (honest X.25 cause)
  -> evidence artifact / receipt
```

**Architecture:** Build on H1a/H1b. `packetCall` composes the existing
`executeXotCommand` (operator-core), `persistPacketSessionOpen`/
`persistPacketSessionClear` (honest clear codes from H1a), evidence export
(H1b), and the KPI choke point. Clear causes follow
[protocol-fidelity.md](../protocol-fidelity.md). The POTS/modem, MeshCore, and
Meshtastic adapters are later slices behind the same packet-call interface;
this plan ships only the browser XOT path plus a fallback simulator mode.

**Tech Stack:** TypeScript, tRPC, Drizzle, Vitest, Next.js/gmacko.

## Clear Cause Mapping (protocol-fidelity)

| Outcome | Signal | Cause | Diag |
| --- | --- | --- | --- |
| Verb executed, normal clear | DTE | 0 | 0 |
| Unknown / unallocated X.121 | NP | 13 | 67 |
| Service suspended / barred | NA | 11 | 70 |
| Service out of order | DER | 9 | 0 |
| Service busy | OCC | 1 | 0 |
| Network congestion | NC | 5 | 71 |

`clearCause`/`clearDiagnostic` are stored as integers on
`omnidatPacketSession` (H1a). The receipt renders the normative
`CLR <signal> C:<cause> D:<diag>` form.

## Task 1: Clear-Cause Helper

**Files:** `omnidat-clear-codes.ts` (new), test.

- `OMNIDAT_CLEAR_CODES` map of outcome → `{ signal, cause, diagnostic }`.
- `renderClearCode(outcome)` → `CLR <signal> C:<cause> D:<diag>`.
- `clearCodeFor(serviceStatus)` maps a directory status
  (`up`/`suspended`/`down`/missing) to the outcome.
- Test each mapping and the normative rendering.

## Task 2: packetCall Procedure

**Files:** `omnidat.ts`, `omnidat-persistence.ts` (reuse), `omnidat.test.ts`.

- `packetCall` (`session.write`): input
  `{ sourceIdentity, sourceTransport, destinationX121, verb?, sourceX121? }`.
  - look up the destination in the operational service directory.
  - open a packet session (`persistPacketSessionOpen`).
  - if found and reachable: run `executeXotCommand` for the verb (default
    `CALL`), clear with cause 0, build a receipt.
  - if missing: clear with cause 13; suspended: cause 11; down: cause 9. No
    silent errors — every failure has an explicit cause.
  - `persistPacketSessionClear` with the cause/diagnostic and a transcript
    hash; record the `packet.session.opened` /
    `packet.session.cleared.cause.<n>` KPIs (H1a choke point).
  - return `{ session, clearCode, transcript, receipt }`.
- `packetCallReceipt(session, transcript)` renders a printable receipt
  (reuse the document builder style).
- Tests: successful call clears cause 0 with a transcript; unknown address
  clears cause 13; suspended clears cause 11; NOC `listPacketSessions` shows
  the session; auditor forbidden.

## Task 3: Browser XOT Terminal

**Files:** `omnidat-xot-terminal.tsx` (new), operator page wiring, test/build.

- A `PAD>` prompt component: an input, a scrollback transcript, and a
  connected/cleared status line.
- Commands: `DIR [namespace]`, `LOOKUP <x121>`, `CALL <x121> [verb]`,
  `HELP`, `CLR`. `CALL` drives `omnidat.packetCall`; `DIR`/`LOOKUP`/`HELP`
  drive the read side; `CLR` resets the prompt.
- Show the honest clear line (`CLR <signal> C:<cause> D:<diag>`) after each
  call and a link/label for the evidence receipt.
- Fallback simulator: when unauthenticated or offline, the terminal renders a
  labelled `SIMULATOR` banner and uses seed directory data so the demo path
  never dead-ends.
- Verify with `nextjs build` + `nextjs typecheck`.

**Status:** Terminal supports CAMP/EVIDENCE to render camp-deployment-summary for ToorCamp/CC Camp demos. Receipt display enhanced. Typecheck clean.

## Task 4: Full Verification

Run every release gate; commit the plan doc.

## Acceptance Criteria (roadmap H2 exit gates, browser slice)

- one browser terminal can call one provisioned X.121 service and the result
  is persisted.
- the NOC shows the session (via `listPacketSessions`).
- the operator can export/print a receipt.
- failure paths produce explicit X.25 clear causes, never silent errors.
- all release gates pass.

## Out Of Scope (later H2 slices / other workstreams)

- POTS/modem (Asterisk/SIP/USB), MeshCore, and Meshtastic adapters behind the
  same packet-call interface.
- third-party XOT interop over real TCP (protocol-fidelity test bench,
  Workstream C) — the browser slice proves the application path, not the wire.
- real X.25 framing; this slice is XOT-application-level.
