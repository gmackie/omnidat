# ShadyTel Interconnect Request

## Summary

OMNIDAT requests an ISDN PRI T1 handoff from ShadyTel to the OMNIDAT PBX for
ToorCamp 2028. ShadyTel should route the `8800-8823` number block to OMNIDAT
over that trunk.

OMNIDAT does not require outside PSTN access for this concept. The trunk is for
ShadyTel/C*NET/camp-network interconnect.

## Requested Service

- ISDN PRI T1 handoff from ShadyTel to OMNIDAT.
- Route `8800-8823` to OMNIDAT.
- Full PRI preferred: 23 B channels plus D channel.
- Fractional PRI acceptable for early testing if full PRI is unavailable.

## Technical Details to Confirm

- Framing and line coding, likely ESF/B8ZS.
- Switch type: NI2, 5ESS, DMS, or ShadyTel-specific preference.
- Clocking: ShadyTel should normally provide network clock; OMNIDAT recovers.
- Called-number digit delivery: full `8800-8823` preferred.
- Caller ID / calling party behavior.
- Channel count and channel selection behavior.
- Physical demarc: jack type, cabling, location, grounding, and power.
- Test procedure before event opening.

## OMNIDAT Side

OMNIDAT will provide one of:

- PBX with native PRI interface.
- PRI-to-SIP gateway feeding Asterisk/FreeSWITCH.
- Vintage PBX island with modern gateway/application support.

OMNIDAT will own all downstream routing, service queues, modems, PADs, fax,
print, media vault, and operator behavior.

## Services Behind the Trunk

- `8800`: directory and operator.
- `8802`: BBS.
- `8805`: modem pool.
- `8810`: X.25/PAD services.
- `8811-8814`: terminal update, directory, food, and activity passport PAD services.
- `8815`: Media Vault request line.
- `8818`: fax receive.
- `8819`: print desk and trouble line.
- `8820-8823`: direct modem/PAD lines.
