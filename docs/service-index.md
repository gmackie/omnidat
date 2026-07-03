# Service Index

This index keeps the public-facing services, phone numbers, and owning systems
aligned as the design changes.

| Number | Public Name | System Owner | Behavior |
|---:|---|---|---|
| 8800 | OMNIDAT TrustDesk | PBX/operator | Directory and human assistance |
| 8801 | Network Status | PBX/ops | Recorded announcements |
| 8802 | OMNIDAT Online | BBS/modem | Main BBS hunt group |
| 8803 | Experimental BBS | BBS/modem | Secondary BBS |
| 8804 | Sysop Access | BBS/operator | Private/sysop access |
| 8805 | Modem Pool | PBX/modem | Main modem hunt group |
| 8806 | Terminal Login | host/modem | Shell or terminal login |
| 8807 | Store-and-Forward | host/modem | UUCP-style service |
| 8808 | File Drop | host/modem | File transfer service |
| 8809 | Test Modem | PBX/modem | Echo and diagnostics |
| 8810 | Packet Clearing | PAD/X.25 | Main PAD hunt group |
| 8811 | Terminal Updates | PAD/X.25 | ZONTALK and TCLOAD terminal update access |
| 8812 | Nightmarkt Directory | PAD/X.25 | Vendor and camp packet directory terminal access |
| 8813 | Miliways Food | PAD/X.25 | Menu, order, and line status terminal access |
| 8814 | Activity Passport | PAD/X.25 | Activity passport and merit badge stamp terminal access |
| 8815 | Media Vault Request | media-vault | Playback request line |
| 8816 | ShadyRoulette | telephony app | Main roulette line |
| 8817 | ShadyRoulette Overflow | telephony app | Overflow/test room |
| 8818 | Fax Receive | Document Services | Physical fax/fax server |
| 8819 | Print Desk / Trouble | operator | Operator and print desk |
| 8820 | Direct Modem 1 | PBX/modem | Direct line |
| 8821 | Direct Modem 2 | PBX/modem | Direct line |
| 8822 | Direct PAD 1 | PAD/X.25 | Direct line |
| 8823 | Direct PAD 2 | PAD/X.25 | Direct line |

## Naming Rule

Public names should sound like corporate service labels, not jokes. The weirdness
comes from the system being real: dial tone, terminals, fax, print, robot, and
status boards.

## Related Records

The public number table should be seeded into the `Service` and `Endpoint`
records described in [Data Model](data-model.md). Any number assignment change
should update both this index and the PBX dial plan.
