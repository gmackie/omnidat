# Exchange 88 Dial Plan

OMNIDAT should request that ShadyTel route `8800-8823` to the OMNIDAT PRI.

`8800-8823` is a number block, not a capacity promise. A full PRI T1 normally
provides 23 simultaneous B channels. The number block can expose 24 dialable
destinations, while concurrent usage is limited by the trunk, modem/PAD pools,
and service hardware.

## Draft Number Assignment

```text
8800  OMNIDAT TrustDesk / directory
8801  network status and announcements

8802  OMNIDAT Online main BBS hunt group
8803  secondary / experimental BBS
8804  sysop / private BBS access

8805  main modem pool hunt group
8806  shell / terminal login
8807  store-and-forward / UUCP-style service
8808  file drop / transfer service
8809  test modem / echo / diagnostics

8810  OMNIDAT Packet Clearing main PAD hunt group
8811  terminal updates / ZONTALK / TCLOAD
8812  Nightmarkt directory
8813  Miliways food orders and line status
8814  activity passport and merit badge stamps
8815  OMNIDAT Media Vault request line

8816  ShadyRoulette main
8817  ShadyRoulette overflow / test room
8818  OMNIDAT Document Services fax receive
8819  operator / print desk / trouble line

8820  direct modem line 1
8821  direct modem line 2
8822  direct PAD line 1
8823  direct PAD line 2
```

## Hunt Group Behavior

For services with tied-up lines, the PBX should expose both memorable hunt
numbers and direct line numbers.

Example:

```text
Caller dials 8802
  -> PBX hunts BBS modem ports
  -> free port connects
  -> all ports busy returns busy/intercept/announcement
```

Direct numbers are useful for diagnostics, operator instructions, and visible
line-based behavior. Hunt numbers are the user-facing defaults.

## Called Number Delivery

The PRI handoff should deliver enough called-number digits for the PBX to route
internally. Preferred behavior is full `8800-8823` delivery. If ShadyTel sends
only trailing digits, the PBX dial plan must normalize those digits at ingress.
