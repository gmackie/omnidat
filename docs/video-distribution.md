# Video Distribution

## Goal

OMNIDAT TV makes the Media Vault visible. The same program output should feed a
closed-circuit analog channel, a local IP stream, a recording path, and a
selected amateur television experimental station feed.

## Program Chain

```text
VCR playback
robot camera
operator camera
test pattern
title/slate generator
terminal/status screen
      |
video switcher
      |
overlay / keyer
      |
program output
      |
      +--> analog RF/coax
      +--> IP encoder
      +--> recorder/archive
      +--> ATV/DATV station chain
```

## Channel A: OMNIDAT TV

OMNIDAT TV is the camp-facing closed-circuit service.

Distribution paths:

- Analog RF/coax for CRTs and venue televisions.
- Local IP stream for laptops, phones, and operator screens.
- Recording/archive for later playback.

Content:

- VHS playback from licensed or public-domain material.
- Media Vault queue and now-playing slates.
- Robot camera.
- OMNIDAT announcements.
- BBS, Packet Clearing, fax, and print status.
- Test patterns and maintenance cards.

## Channel B: Amateur TV Experiment

The amateur television path is a licensed radio experiment, not general
entertainment broadcasting.

Content should emphasize:

- station ID and callsign overlay
- robot camera and technical operation
- test patterns
- signal reports
- operator narration
- cleared clips when appropriate

The ATV/DATV control operator owns station discipline, permitted content, ID
intervals, and shutdown authority.

## Overlay Fields

Recommended overlay fields:

```text
OMNIDAT TV
EXCHANGE 88
NOW PLAYING: <tape_id>
QUEUE: <count>
VAULT: <state>
TIME: <local time>
```

For ATV/DATV, add callsign and mode/frequency fields as required by the station
operator.

## Teletext

OMNIDAT can publish a Teletext-style data service alongside the amateur TV
station feed. The V1 software surface is intentionally conservative:

- station metadata and page content live in `data/atv-stations.sample.json`
- Packet Clearing advertises the service at X.25 `000040`
- Exchange 88 advertises dial service `8824`
- `python3 -m tools.omnidat_atv export OMNI-TV-1` writes fixed-width page
  files under `build/atv-teletext/`

This is an overlay/inserter input, not the transmitter. The licensed ATV/DATV
control operator owns RF enablement, callsign, mode, frequency, ID cadence,
and shutdown authority. The Teletext service should carry station identity,
network status, Media Vault status, bulletins, and safety pages that are safe
to display publicly.
