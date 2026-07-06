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
node's port directly.

```sh
# On a build host (context = monorepo root):
docker build -f packages/pad-telnet/Dockerfile -t omnidat-pad .

# On the node (podman + systemd — labnuc/hetzner convention):
cp packages/pad-telnet/deploy/omnidat-pad.service /etc/systemd/system/
systemctl enable --now omnidat-pad
# open the port:
ufw allow 2525/tcp        # or: firewall-cmd --add-port=2525/tcp --permanent
# DNS: pad.omnidat.cc  A  <node public IP>
```

Test: `telnet pad.omnidat.cc 2525`.
