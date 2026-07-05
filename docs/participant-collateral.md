# OMNIDAT Participant Collateral

Date: 2026-07-04

## Purpose

This spec implements Workstream E of
[Roadmap Expansion](plans/2026-07-04-roadmap-expansion.md) and the
"Participant collateral" item in roadmap H3. The bar is the H3 exit gate: a
first-time user completes a directory lookup and one service call using only
printed material, with zero coaching.

It covers the printed camp phone book / directory zine, the PAD cheat-sheet
card, `HELP` behavior at network and service level, terminal idle attract
mode, and the "get an X.121 address for your campsite" signage and form.

## Design rules

- All printed material follows Document Services tone: plain, bureaucratic,
  all-caps labels, fixed-width fields, timestamps, operator initials, and
  form/sequence numbers ([Document Services](document-services.md)).
- Service names sound like corporate service labels, not jokes
  ([Service Index](service-index.md) naming rule).
- Every artifact is generated from the live service directory, never
  hand-maintained copy (Workstream E exit gate).
- Every artifact carries a `DATA AS OF <timestamp>` line. Stale data is never
  presented as live (Offline and Split Authority track).
- No secrets, credentials, or participant legal names appear in print
  (Security and Privacy tracks).
- Every artifact carries the opt-in boundary line: "OPT-IN ART NETWORK. NOT
  FOR EMERGENCIES." (H0 exit gate wording).

## Printed camp phone book / directory zine

### Generation pipeline

The zine extends the existing artifact renderer rather than inventing a new
print path:

- `./scripts/render-artifacts` runs `tools/omnidat_artifacts.py`, which
  already renders `build/artifacts/service-directory.txt` (dial plan, from
  `data/services.json`) and `build/artifacts/packet-directory.txt` (from
  `data/packet-services.json`).
- A new zine renderer (`tools/omnidat_zine.py`, same shape as
  `render_all()` in `tools/omnidat_artifacts.py`) assembles the full book.
- Data source is the live directory, not the seed files: the field kit store
  during an active event, the cloud directory API otherwise (authority
  model). One source per print run; the source and epoch are stamped in the
  colophon.
- Output is a fixed-width text master spooled through the existing Document
  Services path (`./scripts/documents print forms ...`, queues under
  `build/spool/`), plus a PDF sibling once H1 printed/PDF artifacts land.

```text
live directory (field kit during event, cloud otherwise)
  -> tools/omnidat_zine.py
  -> build/artifacts/phone-book-<edition>.txt (+ .pdf)
  -> Document Services spool (forms queue) -> printer
```

Editions:

- reprint at daily open (operator daily ritual), edition number increments.
- entries added or changed since the prior edition are flagged `NEW` /
  `CHG`.
- delisted or suspended services are dropped or marked per the
  [moderation policy](moderation-policy.md); the zine never advertises a
  service that will fail `CALL` without saying so.

### Page structure

| Page | Section | Source |
| --- | --- | --- |
| cover | event name, edition, `DATA AS OF`, opt-in boundary line | generator |
| 2 | how to use a terminal (cheat-sheet copy, verbatim) | this spec |
| 3 | dial plan: `8800-8823` public numbers and behavior | live `services` records (design source: [Service Index](service-index.md)) |
| 4+ | packet directory, official namespaces first: core `000xxx`, carrier `001xxx`, approved village `010xxx`, event ops `030xxx` | live directory |
| next | open campsite `020xxx`, clearly headed `PROVISIONAL — SELF-SERVICE NAMESPACE` | live directory |
| next | diagnostics `090xxx` and the `000099` test loop, labeled for training | live directory |
| next | per-service detail: verbs with inputs, access class, hours | live directory verb records |
| next | classifieds pages from open-namespace classifieds apps | live app content |
| next | fair-play digest: rules of engagement summary, disclosure desk, hall of fame pointer | `docs/rules-of-engagement.md` |
| next | open-namespace moderation digest and how to report | [Moderation Policy](moderation-policy.md) |
| back | tear-out form PC-201: campsite X.121 service order | this spec |

Directory listing format matches the terminal `DIR` output so print and
screen teach each other (see `render_packet_directory()` in
`tools/omnidat_artifacts.py`):

```text
ADDR    SERVICE                 CLASS       HOURS
000001  OMNIDAT DIRECTORY       PUBLIC      24H
020500  MILIWAYS MENU STATUS    PUBLIC      1100-0200
020501  MILIWAYS ORDER ENTRY    PASSPORT    1100-0100
```

Schema note: directory records need an optional `hours` field. Neither
`data/packet-services.json` nor `data/campsite-apps.sample.json` carries one
today; it must be added with the H1a service directory CRUD so the zine does
not hand-maintain hours.

## PAD cheat-sheet card

One card at every terminal, and reproduced as page 2 of the phone book.
Two-sided: terminal PAD side and Radio PAD side. The command set must match
the deployed surfaces exactly:

- terminal side matches the H2 browser PAD surface (`CALL`, `DIR`, `LOOKUP`,
  `CLR`, plus `HELP`).
- radio side matches the implemented Radio PAD grammar in
  `tools/omnidat_radio_pad.py` (`HELP`, `DIR`, `CALL`, `REQ`, `STAT`, `ACT`,
  `MSG`, `CLR`).

The card does not print until the terminal it sits at actually accepts every
command on it.

### Card copy — terminal side

```text
OMNIDAT PACKET CLEARING                       CARD PC-101 REV A
AUTHORIZED TERMINAL SERVICE

COMMANDS
  DIR              LIST SERVICES YOU CAN CALL
  DIR 020          LIST ONLY OPEN CAMPSITE SERVICES
  LOOKUP <ADDR>    SHOW ONE SERVICE, ITS VERBS, AND STATUS
  CALL <ADDR>      CONNECT TO A SERVICE
  HELP             LIST COMMANDS. ALSO WORKS INSIDE A CALL.
  CLR              END THE CALL

WORKED EXAMPLE — CHECK THE FOOD MENU
  PAD> DIR 020
  020500  MILIWAYS MENU STATUS     PUBLIC
  020501  MILIWAYS ORDER ENTRY     PASSPORT
  PAD> CALL 020500
  CONNECT 020500 MILIWAYS MENU STATUS
  (MENU PRINTS. FOLLOW THE PROMPTS.)
  PAD> CLR
  CLR DTE C:0

IF IT FAILS, THE NETWORK TELLS YOU WHY
  CLR DTE C:0        NORMAL END OF CALL
  CLR NP  C:13 D:0   NO SUCH ADDRESS
  CLR NA  C:11 D:70  SERVICE SUSPENDED OR BARRED
  CLR DER C:9        SERVICE OUT OF ORDER
  CLR OCC C:1        SERVICE BUSY
  CLR NC  C:5        NETWORK BUSY. TRY AGAIN.

STUCK? TYPE HELP, DIAL 8800 TRUSTDESK, OR ASK THE FIELD
OFFICE. OPT-IN ART NETWORK. NOT FOR EMERGENCIES.
```

Clear codes come from the cause and diagnostic tables in
[Protocol Fidelity](protocol-fidelity.md), the single source of truth,
rendered as `CLR <signal> C:<cause> D:<diag>`. The legacy `CLR 01/05/09/11`
lines in [Field Office Network Plan](field-office-network-plan.md) are
superseded by those tables. Honest cause codes are a locked
protocol-fidelity decision, so the card teaches users to read them instead
of hiding failure.

### Card copy — radio side

```text
OMNIDAT FIELD PAD — RADIO ACCESS              CARD PC-102 REV A
SHORT TRANSACTIONS ONLY. EVERY REPLY ENDS WITH A CLR CODE.

  HELP                      LIST RADIO COMMANDS
  DIR [NS]                  LIST SERVICES (NS = 020, 030, ...)
  CALL <ADDR>               SHOW A SERVICE SUMMARY
  REQ <ADDR> <VERB> [ARGS]  RUN ONE SERVICE VERB
  STAT <ADDR> <TICKET>      CHECK A QUEUE TICKET
  ACT <PASS> <ADDR> <CODE>  FILE A PASSPORT ACTIVITY
  MSG <ADDR> <TEXT>         LEAVE A SHORT MESSAGE
  CLR                       DONE

WORKED EXAMPLE — FOOD BY RADIO
  > REQ 020500 MENU          (MENU LINES RETURN, CLR 00)
  > REQ 020501 ORDER NOODLE-CUP PASS-0184
  < TKT MLY-00482  STATUS QUEUED  POS 17  CLR 00
  > STAT 020502 MLY-00482
```

The radio worked example is the implemented `handle_request()` path in
`tools/omnidat_radio_pad.py` (`020500 MENU`, `020501 ORDER`).

## HELP behavior

### Network level

- `HELP` at the `PAD>` prompt returns the command list with one-line usage,
  exactly the set printed on the card, plus one pointer line: `DIAL 8800
  TRUSTDESK FOR A HUMAN`. The Radio PAD `render_help()` in
  `tools/omnidat_radio_pad.py` is the existing model; the browser PAD gets
  the terminal command set.
- `HELP` never fails and is never billed. The per-message network fee policy
  (`NF-X25-PAD-MSG` in `worker/omnidat-worker.mjs`) must exempt `HELP` so a
  participant with no balance can always learn the commands.
- output fits one 24-line screen and one radio transaction.

### Service level

- every directory-listed service must answer a `HELP` verb returning:
  service name, address, owner, one-line purpose, verb list with usage,
  hours, and how to report a problem (dial `8819`, see moderation policy).
- no service in `worker/omnidat-worker.mjs` `serviceDefinitions` or the seed
  data defines `HELP` today. Build requirement: the platform injects a
  synthetic `HELP` verb for every listing, generated from the directory
  record and verb catalog, so an owner cannot ship a service without help
  text. App templates (`MESSAGE_DESK`, `FORM`, `BULLETIN`, `QUEUE` in
  `data/campsite-apps.sample.json`) generate template-specific usage lines.
- `HELP` inside an open session returns the called service's help, not the
  network help.

## Terminal idle attract mode

- after 3 minutes idle (default, operator-configurable), the terminal clears
  any open session with an explicit `CLR` (so the next user never inherits a
  session — Privacy track) and enters the attract loop.
- attract loop cycles, roughly 10 seconds per frame:
  1. masthead: `OMNIDAT PACKET CLEARING / AUTHORIZED TERMINAL SERVICE`.
  2. five rotating directory entries drawn from the live directory,
     official namespaces weighted first, provisional entries marked.
  3. the card's worked example replayed keystroke by keystroke.
  4. fair-play one-liner and disclosure desk pointer.
  5. `PRESS ANY KEY. TYPE HELP IF LOST.`
- any keypress exits to a fresh `PAD>` prompt with a `TYPE HELP FOR
  COMMANDS` hint line.
- attract content generates from the same live directory as the zine; if the
  terminal cannot reach the directory it shows a maintenance frame, never a
  stale directory presented as live.

## Campsite X.121 signage and form

The paper flow mirrors the web intake provisioning flow in
[Field Office Network Plan](field-office-network-plan.md) (open campsite
app, steps 1-8): allocation of a `020xxx` address, provisional directory
record, owner credentials, printed address assignment letter, and quick-start
card.

### Signage copy

Posted at the field office, TrustDesk, and every terminal:

```text
GET AN X.121 ADDRESS FOR YOUR CAMPSITE        NOTICE PC-200

YOUR CAMP CAN RUN A REAL PACKET SERVICE: A BULLETIN, A
MESSAGE DESK, A QUEUE, A FORM, OR A CLASSIFIEDS PAGE.

1. TAKE FORM PC-201 FROM THE RACK, OR TEAR IT OFF THE BACK
   OF THE PHONE BOOK.
2. FILL IT IN. HANDLES ONLY. NO LEGAL NAMES REQUIRED.
3. HAND IT TO THE FIELD OFFICE, OR FILE IT YOURSELF AT ANY
   TERMINAL VIA THE CAMP APPLICATION EXCHANGE.
4. YOU RECEIVE A PROVISIONAL 020XXX ADDRESS, A DIRECTORY
   LISTING, AND A PRINTED ADDRESS ASSIGNMENT LETTER.

PROVISIONAL SERVICES ARE LIVE IMMEDIATELY AND APPEAR IN THE
NEXT PHONE BOOK EDITION. OPERATORS MAY PROMOTE GOOD SERVICES
TO THE APPROVED DIRECTORY.

OPEN NAMESPACE RULES APPLY. SEE POSTED NOTICE MOD-100.
OPT-IN ART NETWORK. NOT FOR EMERGENCIES.
```

### Form PC-201

Paper fields mirror the web intake one-for-one so an operator can type a
paper form into the same intake with no translation:

```text
OMNIDAT PACKET CLEARING                        FORM PC-201
CAMPSITE SERVICE ORDER — OPEN NAMESPACE (020XXX)

CAMPSITE / OWNER HANDLE: ______________________________
SERVICE NAME (CORPORATE LABEL, NOT A JOKE): ____________
TEMPLATE:   [ ] BULLETIN   [ ] MESSAGE_DESK   [ ] FORM
            [ ] QUEUE      [ ] CLASSIFIEDS
ACCESS:     [ ] PUBLIC     [ ] PASSPORT   [ ] REGISTERED
TRANSPORTS: [ ] HOSTED NODE      [ ] MESHCORE RADIO PAD
            [ ] MESHTASTIC       [ ] WI-FI TCP
HOURS (IF ANY): ________________________________________
CONTACT PATH (MSG ADDRESS OR DESK): ____________________

I HAVE READ THE OPEN NAMESPACE MODERATION POLICY (MOD-100).
SIGNED (HANDLE): ______________  DATE: _________________

OFFICE USE ONLY
ADDR ASSIGNED: ________  OPERATOR: ______  SEQ NO: ______
```

Template and transport values are the ones in
`data/campsite-apps.sample.json` (`BULLETIN`, `MESSAGE_DESK`, `FORM`,
`QUEUE`; `hosted-node`, `meshcore-radio-pad`, `meshtastic-radio-pad`,
`wifi-tcp`). `CLASSIFIEDS` is an H3 template that must exist before the form
prints with that box.

## Exit gate and test protocol

Run at Rehearsal 3 (human evening) at the latest:

- subject: a first-time user who has never seen OMNIDAT, no coaching.
- materials: current-edition phone book and the PC-101/PC-102 card only.
- pass: the subject completes a `DIR` or `LOOKUP` and one `CALL` with at
  least one service verb executed, and the session appears in NOC with an
  evidence artifact.
- the phone book used must have been generated from live directory data that
  day (edition stamp checked).
- the attempt is logged as an evidence artifact either way; failures feed
  card and HELP copy revisions.

## Open questions

- Printed address form: the worker demo uses full X.121 with a `311088`
  prefix (`worker/omnidat-worker.mjs` `serviceDefinitions`), while seed data
  and the Radio PAD use 6-digit local addresses. Default: print 6-digit
  local addresses everywhere participant-facing, with one appendix page
  explaining the full X.121 form for interop peers — but this cannot be
  final until the open X.121 numbering plan / DNIC governance decision in
  the roadmap lands.
- Directory address (decided): the canonical Packet Clearing Directory
  address is `000001` local, `311088000001` international, matching the
  CORE namespace and the `data/packet-services.json` seed. The Worker demo
  terminal preview still calls `311088010110`; that is a known code
  divergence to be fixed (TODO), not a documentation choice. The zine and
  card print the canonical address.
- Print form factor above Table Pilot tier: the dot matrix spool path covers
  small runs; whether larger events pre-print offset zine covers is a
  Workstream J budget question.
- Whether the zine PDF is generated on the field kit or only in the cloud
  surface (affects offline daily-open printing).
