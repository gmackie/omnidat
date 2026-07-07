# @omnidat/matrix-bridge

The backend both OMNIDAT PADs talk to for **subscriber mail** (store-and-forward
DMs) and **message boards**. It presents the internal HTTP API the PAD clients
speak — `tools/omnidat_bridge.py` (Python) and
`gmacko/packages/pad-telnet/src/bridge.ts` (TS) — so `MSG` / `MAIL` / board
`CALL`/`READ`/`POST` work identically from either PAD.

It is **self-contained**: a durable append-only JSONL store (the
field-kit-journal-first model, docs/protocol-fidelity.md) with no external
database, so it runs at camp with no homeserver. A real Matrix homeserver can be
layered behind the same store interface later without changing the wire contract.

## API

Authenticated by a shared secret (`x-omnidat-secret`; set `OMNIDAT_BRIDGE_SECRET`).

| Method + path | Body | Returns |
|---|---|---|
| `POST /dm/send` | `{from, to, body}` | `{rcpt, eventId}` |
| `GET  /dm/mailbox/{addr}` | — | `{items: [{no, from, ts:"HH:MM", body}]}` (unread) |
| `POST /dm/read` | `{addr}` | `{ok}` |
| `GET  /board/{id}/page[?after=N]` | — | `{items: [{no, poster, ts:ms, body, eventId}]}` |
| `POST /board/{id}/post` | `{body, name?, thread?, ctx}` | `{no, eventId}` |

Failures map to X.25 clears at the client: 400→`ERR`, 401/5xx→`RPE`, 403→`NA`,
404→`NP`, offline→`DER`.

## Run

```sh
pnpm --filter @omnidat/matrix-bridge build
OMNIDAT_BRIDGE_SECRET=... PORT=8090 HOST=127.0.0.1 \
  BRIDGE_STORE=/opt/omnidat-bridge/data/journal.jsonl \
  node packages/matrix-bridge/dist/index.js
```

Environment: `PORT` (8090) · `HOST` (127.0.0.1) · `OMNIDAT_BRIDGE_SECRET`
(shared with the PADs; empty disables auth) · `BRIDGE_STORE` (JSONL path;
omit for an ephemeral in-memory store).

## Deploy (hetzner node, alongside the PAD)

Localhost-only, next to the telnet PAD. The bundle is self-contained; copy the
one file and run it in a stock `node:22-alpine` container.

```sh
pnpm --filter @omnidat/matrix-bridge build
scp packages/matrix-bridge/dist/index.js root@<node>:/opt/omnidat-bridge/index.js
cp packages/matrix-bridge/deploy/omnidat-bridge.service /etc/systemd/system/
# set OMNIDAT_BRIDGE_SECRET (same value the PAD unit uses), then:
systemctl enable --now omnidat-bridge
```

The PAD reaches it at `http://127.0.0.1:8090` (both run `--network=host`).
