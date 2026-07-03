# Acceptance Tests

These tests define when OMNIDAT is demo-ready, event-ready, and launch-ready.

## Demo-Ready

Demo-ready means the system can be shown locally without ShadyTel.

| Test | Expected Result |
|---|---|
| Call `8800` through simulator trunk | TrustDesk greeting or operator route answers |
| Call `8802` | BBS or BBS placeholder answers |
| Call `8810` | PAD prompt appears |
| Packet guest calls `000001` | Public directory connects |
| Packet guest calls `000002` | Registered-only access is rejected |
| Registered account calls `000002` | Session starts and clears |
| Registered carrier account calls `000011` | POS authorization service connects |
| NiteMarkt BOH terminal calls `000020` | WMS service connects |
| Call `8814` | Activity Passport terminal service answers |
| Packet call `000004` | Media Vault catalog/status answers |
| Submit Media Vault request from PAD | Request appears in queue |
| Approve request from operator console | Tape simulator enters PLAYING |
| Complete Media Vault playback | Tape returns to available and vault returns to IDLE |
| Fault Media Vault simulator | New playback is blocked until recovery |
| Print request receipt | Text reaches dot matrix or spool file |
| Receive fax metadata | Fax record is written and event is emitted |
| List document queue | Print jobs and faxes are visible |
| Trigger maintenance mode for `8810` | New calls receive maintenance intercept |
| Generate daily summary | Plain-text report is produced |
| Append operational event | Event appears in JSONL ledger with sequential event ID |

## Event-Ready

Event-ready means the physical installation can operate with staff present.

| Test | Expected Result |
|---|---|
| FXS phone test | Analog phone can call PBX service |
| Modem direct line | Caller reaches direct modem endpoint |
| BBS hunt group | Busy modem is skipped and free modem answers |
| PAD hunt group | Free PAD endpoint answers |
| Shadybucks terminal circuit | POS/ATM/proxy carrier path is visible in directory and event logs |
| NiteMarkt BOH circuit | WMS terminal path is visible in directory and event logs |
| Fax receive | Fax to `8818` prints or records received pages |
| Dot matrix print | Receipts and logs print legibly |
| Media Vault home | Robot homes and reports IDLE |
| Media Vault load cycle | Test tape loads, plays, ejects, returns |
| E-stop | Motion stops and requires deliberate recovery |
| OMNIDAT TV | Program output appears on analog display and IP preview |
| Operator console | Active calls, queues, faults, and media state are visible |

## ShadyTel-Ready

ShadyTel-ready means the OMNIDAT PBX can accept the real trunk.

| Test | Expected Result |
|---|---|
| PRI physical layer | Trunk comes up cleanly |
| Called digits | PBX receives enough digits to route `8800-8823` |
| Caller ID | Caller data is logged if ShadyTel provides it |
| Channel use | Multiple simultaneous calls stay within expected limits |
| Busy behavior | Exhausted hunt group returns busy/intercept |
| Trunk recovery | Calls resume after trunk down/up |
| Operator escalation | ShadyTel and OMNIDAT operators can reach each other |

## Launch-Ready

Launch-ready means the event can open to campers.

| Test | Expected Result |
|---|---|
| Startup checklist | Operators can bring up all systems from printed runbook |
| Shutdown checklist | Operators can close and park all systems safely |
| Incident drill | Operator logs and resolves one simulated failure |
| Printed directory | Current Exchange 88 directory is available on paper |
| Account cards | At least 20 account/access cards are printed |
| Spare hardware | Critical spares are labeled and reachable |
| Data backup | Configs, databases, and logs are backed up locally |
| Safety review | Power, RF, and robot safety checks are signed off |

## Regression Tests

Run these after every major config or hardware change:

- Dial every number in `8800-8823`.
- Confirm hunt groups skip busy endpoints.
- Confirm maintenance mode routes to intercept.
- Print one test page.
- Open and close one PAD session.
- Open and close one BBS/modem session.
- Submit and cancel one Media Vault request.
- Trigger and clear one Media Vault fault.
- Verify OMNIDAT TV overlay still updates.

## Evidence to Keep

Keep proof from each acceptance run:

- test date and operator initials
- call logs
- session logs
- printed receipt or scan/photo
- Media Vault state log
- video screenshot/photo
- incident record for any failure
