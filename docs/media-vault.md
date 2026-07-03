# OMNIDAT Media Vault

## Concept

The OMNIDAT Media Vault is a robotic VHS library inspired by 1980s tape
automation and cinematic network-operations rooms. It should be a real visible
machine, not just a UI: users request tapes through dial-up, BBS, X.25, IVR, or
operator console, and the machine loads tapes into a VCR for playback.

All VHS material should be licensed, public domain, or otherwise cleared for the
intended distribution path.

## Mechanical Direction

Use a linear shelf or slot carousel with gantry.

```text
[ slot 01 ][ slot 02 ][ slot 03 ] ... [ slot N ]
      ^
      |
 X-axis gantry carriage
      |
 gripper / pusher
      |
[ fixed VCR load bay ]
```

V1 target:

- 12-24 tape slots.
- One VCR.
- One visible CRT or monitor stack.
- One operator kill switch.
- One request path through BBS or terminal.
- Physical slot numbering for recovery and show value.

## State Machine

```text
IDLE
HOMING
FETCHING_TAPE
VERIFYING_TAPE
LOADING_VCR
PLAYING
EJECTING
RETURNING_TAPE
FAULT
```

The current simulator implements the lab subset:

```text
IDLE -> submitted request -> approved request -> PLAYING -> IDLE
IDLE/PLAYING -> FAULT
```

Run it with:

```sh
./scripts/media-vault init
./scripts/media-vault request PUB-0001 --source pad --requested-by ACCT-000001
./scripts/media-vault approve-next --operator MG
./scripts/media-vault start
./scripts/media-vault complete
```

## Control Stack

```text
PBX IVR / BBS / X.25 / operator console
      |
media-vault service
      |
job queue + inventory database
      |
robot controller
      |
stepper drivers / sensors / VCR control
```

The simulator stores state in `build/media-vault-state.json` and emits events to
`build/events.jsonl` by default.

Inventory records should map human catalog IDs to physical slots:

```json
{
  "tape_id": "HACK-1995-A",
  "title": "Example Tape",
  "slot": 12,
  "status": "available",
  "runtime_minutes": 107
}
```

## Video Distribution

The Media Vault produces one program output that is split to multiple
distribution paths.

```text
VCR / robot camera / slates / test pattern
      |
TBC / frame sync
      |
video switcher + overlay
      |
program output
      |
      +--> analog RF/coax closed-circuit channel
      +--> local IP stream
      +--> recording/archive
      +--> selected amateur TV experimental feed
```

Channel A is OMNIDAT TV: closed-circuit analog RF plus local IP simulcast.

Channel B is the amateur TV experiment: callsign overlay, station ID discipline,
technical content, signal reports, robot camera, and cleared material under
licensed operator control.

## Integrations

- Packet address `000004`: catalog and queue status from PAD/Packet Clearing.
- `8815`: request line by phone.
- BBS: browse catalog, queue tape, check now-playing.
- X.25 terminal UI: catalog, queue, and service status.
- Fax: formal tape request form.
- Dot matrix printer: load tickets, daily log, and fault printouts.
