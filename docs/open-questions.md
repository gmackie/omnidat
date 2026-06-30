# Open Questions

## ShadyTel

- Is `8800-8823` available as an assigned block?
- Can ShadyTel provide a full ISDN PRI T1 to OMNIDAT?
- Which PRI switch type, framing, line coding, and clocking should OMNIDAT use?
- Will ShadyTel deliver full called digits or trailing digits?
- Can ShadyTel provide caller ID/calling party data?
- What demarc, cable, grounding, and power expectations apply?

## PBX

- Asterisk or FreeSWITCH for V1?
- PRI-to-SIP gateway or native PRI card?
- Which PRI gateway/card should be the primary target?
- Should a vintage PBX be part of V1 or staged later?
- How many modem/PAD ports should V1 expose?
- Should ShadyRoulette stay in the existing repo and integrate by trunk, or move
  into the OMNIDAT PBX app layer later?
- What format should PBX call records use before the final database exists?

## Hardware

- What is the transport budget and maximum rack/case size?
- What can be borrowed from ShadyTel or other villages?
- Which hardware must be acquired early for bench testing?
- Which hardware needs a cold spare at camp?
- Who owns RF, electrical, and mechanical safety signoff?

## Packet Clearing

- Real X.25 hardware, XOT, or terminal-faithful emulation for V1?
- What address format should OMNIDAT expose publicly?
- How many physical terminal stations should be deployed?
- Should BBS accounts and Packet Clearing accounts share identity?
- Should Packet Clearing use SQLite directly, append-only JSONL, or both?

## Document Services

- Physical fax only, or fax server plus physical fax?
- Which dot matrix printer model?
- Parallel, serial, USB adapter, or network print server?
- What forms should be printed before camp?

## Media Vault

- Linear shelf or carousel for V1?
- How many tape slots?
- Which VCR model?
- How will VCR control work: IR, front-panel actuator, serial/control-L, or
  operator-assisted?
- What sensors are mandatory for safe unattended operation?

## Video

- Which closed-circuit analog channel plan?
- Which local IP stream protocol?
- Analog ATV, digital ATV, or both?
- Who will be the amateur TV control operator?
