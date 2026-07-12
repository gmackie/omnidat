# OMNIDAT Meshtastic gateway

`tools/omnidat_mesh_gateway.py` is the real Radio PAD transport: it attaches
to a Meshtastic node and serves PAD commands arriving as **direct messages**
(shared channels are never answered or echoed into). Messaging verbs ride the
OMNIDAT Matrix bridge (the omnichat repo's `@omnidat/bridge`, `:8090`) through
the same gating helpers as the wired PAD; everything else falls through to the
field PAD handler in `tools/omnidat_radio_pad.py`.

> Packet Clearing authorizes. Authentik identifies. The Bridge translates.
> Synapse stores. The mesh is only a transport.

## Verbs over the mesh

```
DIR [NS]                        directory (field PAD)
CALL <ADDR|BOARD>               board page for board addresses/ids, else field PAD
CALL <BOARD> <AFTER>            board page after post number
REQ / STAT / ACT                field PAD services (queues, activity passports)
MSG <ADDR> <TEXT>               subscriber store-and-forward mail (bridge)
MAIL                            fetch + drain your unread mail (bridge)
SENT <RCPT>                     delivery status of a sent telegram (bridge)
POST <BOARD> [NAME#TRIP] <TEXT> pseudo-anonymous board post (bridge)
HELP / CLR
```

Errors clear with real X.25 causes (`CLR NA C:11 D:70` access barred,
`CLR NP C:13 D:67` not a subscriber address, `CLR DER C:9 D:0` bridge down,
`CLR ERR C:19 D:0` malformed command).

## Identity: node registry

A mesh node id maps to a Packet Clearing account in
`data/mesh-nodes.sample.json`:

```json
{ "node_id": "!e2e30001", "account_id": "ACCT-000001", "label": "Field tester radio 1" }
```

Unregistered nodes act as `ACCT-GUEST` (PUBLIC): they can browse the
directory and read/post PUBLIC boards, but `MSG`/`MAIL` clear `NA C:11 D:70`.
Accounts need an active status and a `subscriber_address` (the unlisted
`040000`–`049999` namespace) to use subscriber mail.

Privacy invariant: the Bridge never learns mesh node ids. PUBLIC-post board
ctx carries only `{"transport": "mesh"}`; gated boards add passport and
session id per the design doc's two-gate rules.

## Running it

Config comes from `OMNIDAT_BRIDGE_URL` / `OMNIDAT_BRIDGE_SECRET`
(see `.env.example`); the secret matches the bridge's `INTERNAL_API_SECRET`.

```bash
# no radio needed — stdin/stdout fake node (defaults to !e2e30001):
python3 -m tools.omnidat_mesh_gateway --simulate

# real radio over USB serial (requires: python3 -m pip install meshtastic):
python3 -m tools.omnidat_mesh_gateway --serial /dev/ttyUSB0

# or a network-attached node:
python3 -m tools.omnidat_mesh_gateway --tcp meshtastic.local

# with "N NEW MSG" push notices to registered subscriber nodes every 60s:
python3 -m tools.omnidat_mesh_gateway --serial /dev/ttyUSB0 --notify-interval 60
```

The `meshtastic` package is imported lazily; tests and the simulator run
without radio dependencies.

## Radio realities

- Responses are chunked to ≤200-byte frames; multi-frame responses carry
  `i/n ` prefixes so a field operator can reassemble them.
- New-mail push polls mailboxes **without** advancing read markers and pings
  a node once per unread-count change — `MAIL` remains the only way to drain.
- Bridge outages stay quiet on the mesh (notices skip; commands clear
  `DER C:9 D:0`).

## Tests

```bash
python3 -m unittest tests.test_mesh_gateway
```
