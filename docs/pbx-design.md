# PBX Design

## Goal

The PBX is the access switch for OMNIDAT. It receives ShadyTel calls over PRI,
routes `8800-8823`, manages hunt groups, exposes operator functions, and hands
call legs to modems, PADs, IVRs, fax, ShadyRoulette, and Media Vault services.

## Recommended V1 Approach

Use Asterisk or FreeSWITCH as the primary PBX with either:

1. A PRI-to-SIP gateway in front of the PBX.
2. A native PRI card in a small server.

The PRI-to-SIP gateway is the least risky first build because it keeps T1/PRI
hardware timing and signaling outside the application host. A native PRI card is
reasonable later if OMNIDAT needs tighter DAHDI/libpri control or wants the PBX
server to be the physical trunk endpoint.

## Call Flow

```text
ShadyTel caller dials 8810
      |
ShadyTel routes call over PRI
      |
PRI gateway or native PRI receives setup
      |
PBX normalizes called number
      |
PBX dispatches to Packet Clearing PAD hunt group
      |
free PAD/modem/session answers
```

## Ingress Requirements

- Preserve called number, preferably full `8800-8823`.
- Preserve caller ID where ShadyTel can provide it.
- Apply channel limits per service so one busy system does not consume all PRI
  channels.
- Provide intercept announcements for unavailable services.
- Provide operator break-glass routing for stuck hunt groups.

## Trunk Capacity

A full PRI T1 usually provides 23 simultaneous B channels. The PBX should expose
24 numbers but treat 23 as the shared call-leg ceiling.

Capacity pools should be tracked separately:

```text
PRI trunk channels     shared across all inbound/outbound call legs
modem ports            limited by hardware modems or softmodem sessions
PAD sessions           limited by terminal servers/PAD software
fax lines              usually one or two
ShadyRoulette calls    two legs per active pair
operator positions     limited by staffed handsets/consoles
```

## Dial Plan Structure

Use a small set of route classes:

- `service`: direct IVR or application.
- `hunt`: hunt group across physical or logical ports.
- `direct`: fixed modem/PAD/fax/test port.
- `operator`: TrustDesk or escalation.
- `intercept`: unavailable, busy, maintenance, and after-hours messages.

The first dialplan sketch lives in
[`configs/asterisk/extensions-omnidat.conf`](../configs/asterisk/extensions-omnidat.conf).
It is a planning scaffold, not a production-ready PBX config.

## Logging

The PBX should emit call records to a local event stream. At minimum, capture:

- call start/end time
- caller ID if available
- called number
- route class
- endpoint selected
- disposition: answered, busy, no-answer, failed, operator
- channel identifier

These records should feed operator status screens and dot matrix daily logs.

## Failure Modes

- PRI down: TrustDesk should have a local status procedure and visible signage.
- Called digits missing: route to operator/intercept and log the raw setup data.
- Hunt group exhausted: return busy or announcement, not a silent failure.
- Endpoint stuck off-hook: remove from hunt group until operator clears it.
- Media Vault fault: route `8815` to status announcement and operator.
