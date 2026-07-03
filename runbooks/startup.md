# Startup Runbook

## Pre-Power

- Confirm rack is physically stable.
- Confirm emergency stop for Media Vault is reachable.
- Confirm RF/ATV transmitter path is disabled until the control operator signs
  on.
- Confirm printer paper and ribbon are installed.
- Confirm fax machine has paper.
- Confirm operator binder and printed dial plan are at TrustDesk.

## Power Order

1. UPS units.
2. Network switch and router.
3. PBX server.
4. Gateways: PRI, FXS, terminal server.
5. BBS and Packet Clearing hosts.
6. Document Services workstation.
7. Media Vault controller with motion disabled.
8. Video switcher, displays, and encoder.

## Service Checks

Place or simulate calls:

```text
8800  TrustDesk
8801  network status
8802  BBS hunt group
8805  modem pool
8810  Packet Clearing
8811  terminal updates
8812  Nightmarkt directory
8813  Miliways food
8814  activity passport
8815  Media Vault request
8818  fax receive
8819  print desk/trouble
8820  direct modem line 1
8822  direct PAD line 1
```

## Document Checks

- Print the daily status sheet.
- Print one blank Media Vault request form.
- Print one test receipt.
- Confirm fax receive path.

## Media Checks

- Home Media Vault.
- Load test/alignment tape if hardware is enabled.
- Confirm VCR output on OMNIDAT TV.
- Confirm local IP preview.
- Confirm ATV path remains disabled until explicitly enabled by the control
  operator.

## Open Status

- Set `8801` announcement to current operating state.
- Mark unavailable services in maintenance mode.
- Initial operator signs printed startup sheet.
