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

The telnet path is **read-only**: it uses the in-memory command engine and the
pure service renderers — no database, no operator role, no persistence. That is
what makes it safe to expose publicly as a demo PAD.

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

## Verbs

`HELP` · `DIR [NAMESPACE]` · `LOOKUP <X121>` · `CALL <X121>` (enter a service
session) · `STATUS <X121>` · `PAD <X121>` · `BILL <ACCT>` · `ATTRACT` (screensaver)
· `CLEAR` (hang up).

Inside a service session (after `CALL`), the service's own verbs apply — e.g.
Miliways: `MENU`, `QUOTE <ITEM…>`, `ORDER.CREATE <ITEM…>`, `ORDER.STATUS <ID>`.

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
