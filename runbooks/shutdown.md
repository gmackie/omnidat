# Shutdown Runbook

## Soft Close

- Announce closing state on `8801`.
- Disable new Media Vault requests.
- Disable new print jobs except operator logs.
- Let active modem/PAD sessions finish or give a clear warning.
- Stop ATV transmission path under control operator procedure.

## Logs and Paper

- Print daily call summary.
- Print session summary.
- Print Media Vault queue/fault summary.
- Print incident log.
- Back up databases, JSONL logs, configs, and media inventory.

## Hardware Park

- Return any loaded VHS tape to its slot.
- Park Media Vault gantry.
- Disable robot motion.
- Eject or secure VCR tape if automated return failed.
- Mark any failed slot/tape in inventory.

## Power Down

1. Media Vault controller.
2. Video switcher, displays, and encoder.
3. Document Services workstation.
4. BBS and Packet Clearing hosts.
5. Gateways: PRI, FXS, terminal server.
6. PBX server.
7. Network switch and router.
8. UPS units.

## Closeout

- Operator signs shutdown sheet.
- Store printed logs in binder.
- Flag broken hardware with tape and written fault note.

