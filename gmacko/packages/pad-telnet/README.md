# @omnidat/pad-telnet

A raw-TCP **telnet PAD bridge** to the OMNIDAT X.25 network. Point a physical
VT100 (via a serial-to-telnet adapter) or any telnet client at it and you land
on the PAD prompt, drive verbs, open interactive service sessions, and — after a
spell of inactivity — watch the attract screensaver.

It reuses the exact renderers as the web CRT (`@omnidat/operator-core`), so the
banner, verbs, service screens, and screensaver are byte-identical on the wire
and in the browser. The command surface (`PadSession`) is pure and unit-tested;
the server layer (`createPadServer`) owns sockets, telnet negotiation, and
pacing the screensaver.

The telnet path is **read-only** (demo safety): it uses the in-memory command engine and the
pure service renderers from @omnidat/operator-core — no database, no operator role, no persistence in this bridge. 

This is one of the H2b transport adapters (telnet/TCP) behind the unified packetCall interface. See H2b plan and omnidat-transports.ts for policy (budget, access class). Real authenticated sessions use the gmacko packetCall tRPC surface. Suitable for ToorCamp 2028 and CC Camp 2027 field terminals (e.g. serial-to-telnet for vintage hardware at rehearsals). Supports camp-scale with low latency simulation.

## X.25 Etiquette on Real Terminals
Follow the guidelines in docs/packet-clearing.md#x25-network-etiquette:
- Short sessions, honest CLR codes
- Respect 020xxx open namespace but don't spam
- Use documented verbs
- Operator help is last resort

The attract screen and HELP should remind users of these rules.

## Run

```sh
pnpm --filter @omnidat/pad-telnet build
PORT=2525 HOST=0.0.0.0 PAD_IDLE=45 node packages/pad-telnet/dist/index.js
# then, from anywhere:
telnet <host> 2525
```

Environment:

- `PORT` (default `2525`)
- `HOST` (default `0.0.0.0`)
- `PAD_DTE` — DTE address shown to terminals (default `311088000001`)
- `PAD_IDLE` — idle seconds before the screensaver starts, `0` disables (default `45`)
- `PAD_TERM` — default terminal personality: `vt100` (default), `adm3a`, `tty33`

## Verbs

`HELP` · `DIR [NAMESPACE]` · `LOOKUP <X121>` · `CALL <X121>` (enter a service
session) · `STATUS <X121>` · `PAD <X121>` · `BILL <ACCT>` · `MSG <TO> <TEXT>` ·
`MAIL` · `ATTRACT` (screensaver, VT100 only) · `TERM <VT100|ADM3A|TTY33>` (switch
personality) · `CLEAR` (hang up).

Inside a service session (after `CALL`), the service's own verbs apply — e.g.
Miliways: `MENU`, `QUOTE <ITEM…>`, `ORDER.CREATE <ITEM…>`, `ORDER.STATUS <ID>`.

## Messaging (Matrix bridge)

`MSG`, `MAIL`, and message boards ride the OMNIDAT Matrix bridge — a small HTTP
service (`OMNIDAT_BRIDGE_URL`, default `http://127.0.0.1:8090`, header
`x-omnidat-secret` from `OMNIDAT_BRIDGE_SECRET`) that fronts a Matrix homeserver.
The TS client (`bridge.ts`) mirrors the Python one (`tools/omnidat_bridge.py`)
byte-for-byte, so both PADs speak to one backend, and every failure maps to an
honest X.25 clear (`CLR DER C:9 D:0` when the bridge is offline).

- `MSG <to-x121> <text>` — store-and-forward subscriber message.
- `MAIL` — read (and mark) this DTE's subscriber mailbox.
- `CALL <board-x121>` — enter a public board (e.g. `000401` = `/GEN/`); then
  `READ [after]` and `POST <text>`. A PUBLIC-post board never receives
  passport-linkable context (only `{transport: "pad"}`).

The bridge **server** is not part of this package — deploy it separately and the
verbs light up. Until then they clear honestly as offline.

## RIOT Discord-mirror gateway

`RIOT` relays the terminal into the riot Packet Clearing daemon (a sibling repo)
— read-only Discord guild channels exposed as X.121 packet services. Set
`RIOT_GATEWAY=<host>:<port>` (riot's daemon, default port `2625`) to enable it;
without it, `RIOT` reports `NOT CONFIGURED`.

Once relayed, riot's own verbs take over (`DIRECTORY`, `CALL <x121>`,
`CHANNELS`, `READ <channel>`, `MORE`, `INFO`, `QUIT`); riot's output is rendered
through the active terminal personality. `QUIT` (or Ctrl-]) returns to the
OMNIDAT PAD. The relay is transparent — OMNIDAT does not interpret riot's
protocol, so riot evolves independently.

## Terminal personalities

Screens are authored once as VT100 and translated to the connected terminal's
dialect on the way out (`@omnidat/operator-core/profiles`), switchable live with
`TERM`:

- **`vt100`** — DEC VT100. ANSI cursor addressing, SGR attributes, DEC line
  drawing. The authoring dialect.
- **`adm3a`** — Lear Siegler ADM-3A. A glass terminal with cursor addressing but
  no video attributes: `ESC = <row+32> <col+32>` to position, `Ctrl-Z` to clear.
  The rendered grid is re-emitted in that dialect; ANSI escapes never reach it.
- **`tty33`** — Teletype ASR-33. A *printing* terminal: no cursor addressing,
  upper-case only, 72 columns. Full-screen pages linearize to a scrolling
  transcript; there is no clear (it's paper), and the screensaver is disabled.

## Deploy (hetzner node)

Raw telnet is TCP, so it can't ride the HTTP edge (Caddy/Cloudflare) — expose a
node's port directly. The bundled `dist/index.js` is self-contained, so the
node needs no workspace checkout: copy the one file and run it under `node`
inside a stock `node:22-alpine` container.

```sh
# Build the standalone bundle:
pnpm --filter @omnidat/pad-telnet build
scp packages/pad-telnet/dist/index.js root@<node>:/opt/omnidat-pad/index.js

# On the node (podman + systemd):
cp packages/pad-telnet/deploy/omnidat-pad.service /etc/systemd/system/
systemctl enable --now omnidat-pad
ufw allow 2525/tcp        # or: firewall-cmd --add-port=2525/tcp --permanent
# DNS: pad.omnidat.cc  A  <node public IP>   (grey-cloud / unproxied)
```

**On a k3s node**, use `--network=host` (the unit already does) — podman's `-p`
port publishing goes through DNAT/FORWARD, which kube-proxy and ufw's
default-DROP FORWARD policy swallow, so the port answers locally but not from the
internet. Host networking sidesteps that. There must also be **no restrictive
Hetzner Cloud firewall** on the server (or add a 2525/tcp allow rule to it).

Test: `telnet pad.omnidat.cc 2525`.

Live: `pad.omnidat.cc:2525` (hetzner-worker / `k3s-worker-1`, `5.78.125.172`).
