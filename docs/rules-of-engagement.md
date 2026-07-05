# OMNIDAT Rules Of Engagement

Date: 2026-07-04

## Purpose

Attacking OMNIDAT is sanctioned play. The audience is hackers, and the point of
a retro packet carrier at a hacker camp is for people to poke at it. This
document turns that into authorized security testing against OMNIDAT's own
systems, with published boundaries, a disclosure path, an OmniBucks bounty
schedule, and a hardening counterpart.

Scope of this policy is OMNIDAT's own services only. This is not authorization
to test ShadyTel, camp infrastructure, other participants, or any cloud
provider. See [Out Of Bounds](#out-of-bounds).

This doc has two registers:

- an operator-facing section (scope, triage, bounty administration, hardening
  obligations).
- a participant-facing section meant to be printed at camp — plain, friendly,
  and unambiguous.

It implements Workstream D of the
[Roadmap Expansion](plans/2026-07-04-roadmap-expansion.md) and the Adversarial
Play track in the [roadmap](roadmap.md). It feeds the risk register in the
[Leadership Pilot Package](leadership-pilot-package.md).

---

# Operator-Facing Section

## Sanctioned scope

OMNIDAT authorizes security testing against its own services only. "OMNIDAT's
own services" means the packet services OMNIDAT provisions and the transports it
operates:

- the packet service directory and provisioned X.121 services (see
  `data/packet-services.json`).
- OMNIDAT service verbs, inputs, and outputs.
- OMNIDAT-operated transports in `data/transport-profiles.sample.json`: PAD /
  terminal, POTS / ShadyTel modem, Wi-Fi / TCP, MeshCore Radio PAD, Meshtastic
  Radio PAD, hosted node, and remote-node adapters.
- the public Worker edge, the gmacko V1 operator surface, and the field kit,
  within the limits below.
- OmniBank / OmniBucks test ledgers and POS/ATM simulations.

Authority follows the split-authority model: during an active event the field
kit is authoritative for event-scoped data and the cloud follows; the cloud is
primary when the field kit is offline, has failed over, or no event is active
(see roadmap "Offline And Split Authority"). Adversarial play targets the same
surfaces regardless of which side is currently authoritative — a finding against
the field kit's write path is in scope even though the cloud is the public face.

## In-bounds testing

Operators should expect and welcome:

- **Protocol fuzzing against OMNIDAT services.** Malformed XOT framing,
  out-of-spec X.25 call setup and clear, odd X.3 PAD parameter values,
  unexpected X.29 sequences, and facility abuse against provisioned services.
  Correct behavior is an honest clear cause and diagnostic code per the interop
  profile, never a silent hang or a generic failure (see
  [protocol-fidelity.md](protocol-fidelity.md)).
- **Application-logic attacks against your own accounts and instruments.**
  Manipulating your own OmniBucks balance, replaying your own POS/ATM
  transactions, forging your own bearer instruments, race conditions on your own
  orders, passport-stamp abuse on your own passport. In-bounds only when the
  target account or instrument is the attacker's own.
- **Planted phreak and packet challenges.** Operator-seeded puzzles reachable on
  the packet network — dial-plan oddities on the `8800-8823` block
  ([dial-plan.md](dial-plan.md)), diagnostics/loopback services in the
  `diagnostics` namespace (`090000-090999`), and hidden verbs. Solving these is
  the intended path.
- **Cryptographic puzzles.** Operator-authored crypto challenges with a defined
  solution and reward. These are self-contained and do not require attacking
  production key material.

If a test looks in-bounds but the participant is unsure, the disclosure desk
answers scope questions before, not only after.

## Out of bounds

The following are never authorized and are not covered by safe harbor:

- **Denial of service and resource flooding.** Traffic floods, connection
  exhaustion, PAD/modem-pool starvation, radio-channel jamming, or anything
  whose mechanism is volume rather than a logic flaw. The transports are shared
  and rate-limited; deliberately exhausting them harms other participants.
- **Other participants' data or sessions.** Reading, hijacking, modifying, or
  denying another participant's packet sessions, accounts, instruments, orders,
  passports, or messages. Test your own only.
- **Physical theft or damage.** Touching, moving, opening, powering off, or
  cabling into field-kit hardware, terminals, printers, radios, or the NOC desk.
- **ShadyTel and camp infrastructure.** The PRI/handoff, ShadyTel switches and
  peers, camp LAN/uplink, camp power, and any camp-leadership system. OMNIDAT's
  authorization does not extend to a partner's or the venue's network. The
  `8800-8823` block is a routing request to ShadyTel, not a target.
- **Cloud-provider surface beyond OMNIDAT's own services.** The Worker runtime,
  Hyperdrive/tunnel plumbing, the DNS registrar, the git host, and any hosting
  account or control plane. Attack the OMNIDAT application, not the platform it
  runs on.
- **Social engineering of staff or participants**, and any test that requires
  impersonating an operator or the disclosure desk.

When in doubt it is out of bounds until the disclosure desk says otherwise.

## Triage

The disclosure desk runs a lightweight triage state machine, audited like any
other operator write (roadmap Security track):

1. **received** — logged with reporter handle, timestamp, and affected service.
2. **reproduced** — an operator reproduces against a test/sim target, never
   against another participant's live data.
3. **classified** — severity assigned (see bounty tiers) and in/out-of-bounds
   confirmed.
4. **fixed or accepted-risk** — hardening applied, or explicitly deferred with a
   reason.
5. **rewarded** — OmniBucks paid per schedule.
6. **published / hall-of-fame** — after the disclosure window, with reporter
   consent for attribution.

Triage notes reference evidence artifacts (transcripts, session records, NOC
signals) rather than reconstructing from memory, so a finding can be replayed.
Out-of-bounds reports are still logged and closed with a reason; a good-faith
out-of-bounds report is not punished (see safe harbor).

## Bounty administration

- bounties are paid in OmniBucks (the controlled play-money ledger unit; see
  roadmap H4 and the pilot package money policy). OmniBucks are not redeemable
  for cash unless a separate posted policy applies.
- the payout tiers below are defaults; the NOC lead may adjust a tier for a
  finding with unusual impact and must record the reason in the audit log.
- duplicate reports: first valid reproducer is rewarded; substantially better
  write-ups of a known issue may receive a partial award at operator
  discretion.
- self-reported findings from operators and red-team staff are logged for the
  hardening record but are not eligible for bounty.
- payouts post to the reporter's OmniBucks account via the same bank ledger path
  as any other credit, so they appear in fee/ledger reconciliation.

### Bounty schedule

| Tier | Example | OmniBucks | Disclosure window |
| --- | --- | --- | --- |
| Critical | Cross-participant data access; authority/epoch bypass; ledger tamper that survives hash-chain check | 500 | fix before publish; hold until operator clears |
| High | Auth/role bypass on operator surface; forge another party's instrument; NOC blind spot for a real attack | 250 | 7 days or fix, whichever first |
| Medium | Application-logic flaw on your own account with cross-account potential; protocol handler crash without honest clear cause | 100 | 7 days |
| Low | Honest-clear-cause gaps; minor info leak; spec-vs-behavior mismatch | 25 | publish anytime after report |
| Puzzle | Solving a planted phreak/packet or crypto challenge | per challenge | n/a |

OmniBucks amounts are placeholders pending the money-policy signoff (see Open
Questions); the tier structure is the decided part.

## Expected disclosure-before-publication window

- report to the disclosure desk before public write-up, talk, or social post.
- default window is 7 days from report, or until the fix ships, whichever comes
  first; criticals are held until an operator explicitly clears publication.
- the window is a request, not a gag: OMNIDAT will not pursue a good-faith
  reporter who honors it, and will credit reporters who do.
- planted challenges and low-severity spec gaps have no window — share freely.

## Fair play and safe harbor (operator obligations)

- OMNIDAT treats good-faith, in-bounds testing as authorized and will not seek
  removal from camp, report to camp leadership, or pursue any penalty for it.
- accidental scope crossings that are stopped and promptly reported in good
  faith are covered — the reporter is not punished for the mistake.
- safe harbor does not cover out-of-bounds targets, harm to other participants,
  physical damage, or bad-faith action.
- operators must staff the disclosure desk during published hours and answer
  scope questions promptly, so participants can stay in-bounds.

## Hall of fame

- a hall-of-fame service is published in the packet service directory (a `core`
  namespace entry, `000000-000999`), reachable from a PAD terminal like any
  other service.
- entries: reporter handle, finding class, and date, with consent for
  attribution captured at reward time.
- the scoreboard for planted challenges is a service reachable on the packet
  network itself, so solving and bragging both happen in-world.

## Hardening obligations (the counterpart)

Sanctioned attack only works if the system is hardened to match. These are
operator obligations, not optional:

- **Rate limits per transport.** Each transport in
  `data/transport-profiles.sample.json` carries its own limit profile. Radio is
  the tightest: Meshtastic guest ingress (`guest-field-access`) gets stricter
  size and rate limits than MeshCore managed access (`managed-field-access`),
  consistent with the field-office network plan. POTS/modem is bounded by pool
  size; Wi-Fi/TCP and hosted/remote nodes get per-identity request limits.
  Limits exist to make DoS out-of-bounds *and* ineffective.
- **Credential revocation drill.** Terminal and API credentials are revocable by
  an operator (roadmap Security track). Rehearse revoking a compromised terminal
  credential mid-event and confirm in-flight sessions clear with an honest
  cause.
- **Hash-chained ledgers.** OmniBank/fee/POS ledger entries are hash-chained so
  tampering is tamper-evident; a restore drill rebuilds the ledger from evidence
  artifacts with zero unexplained variance (shared with Workstream I). A ledger
  tamper that survives the hash-chain check is a critical finding.
- **NOC abuse signals.** The NOC surfaces rate-limit hits, repeated stale-epoch
  write rejections, revoked-credential use, failed-call spikes by clear cause,
  and disclosure-desk volume. These are the operator's live view of adversarial
  play and must be visible during any pilot.
- **Red-team rehearsal gate.** No public pilot ships until the invite-only
  red-team rehearsal (Rehearsal 2.5 in roadmap H6) runs against the full stack
  under these rules, findings are triaged, criticals are fixed, and NOC abuse /
  rate-limit signals are verified during the exercise.

---

# Participant-Facing Section

*Print this side for camp. Plain language, no jargon required.*

## Attacking OMNIDAT is allowed and encouraged

OMNIDAT is a retro packet-data network built for a hacker camp. Breaking it is
part of the fun. If you find a way to make it misbehave, we want to hear about
it — and we pay bounties in OmniBucks.

Please play inside these lines so everyone has a good time.

## You CAN

- **Fuzz the protocol.** Send malformed XOT, weird X.25 call/clear, strange PAD
  parameters. The network should answer with an honest error code, not hang. If
  it hangs or lies, that's a finding.
- **Break your own stuff.** Try to overdraw your own OmniBucks, replay your own
  receipts, forge your own paper instrument, race your own food order. Your
  accounts and instruments are fair game.
- **Solve the planted challenges.** There are hidden puzzles on the network —
  phreak/packet challenges and crypto puzzles. Find them, solve them, score
  them on the packet scoreboard.
- **Ask us.** Not sure if something's allowed? Ask the disclosure desk first.
  We'd rather answer than have you guess.

## You CANNOT

- **No flooding.** No traffic floods, no filling the modem or radio channels, no
  denial of service. It's shared with everyone else here.
- **Not other people's stuff.** Leave other participants' accounts, sessions,
  messages, orders, and passports alone. Only test what's yours.
- **No hands on the hardware.** Don't touch, move, unplug, or open the
  terminals, printers, radios, or the NOC desk.
- **Not ShadyTel or the camp.** The phone system, the camp network, camp power,
  and camp systems are off-limits. So is the cloud host, the domain, and the
  git server. Attack OMNIDAT the app, not the wires under it.
- **No social engineering.** Don't trick staff or pretend to be an operator or
  the disclosure desk.

When in doubt, it's off-limits until we say yes.

## How to report and get paid

- **In person:** the OMNIDAT disclosure desk at the TrustDesk / NOC, during
  posted hours.
- **On the network:** send it to the disclosure service on the packet network
  (reachable from any PAD terminal — ask for the address at the desk, or check
  the directory).
- **Tell us before you publish.** Give us a heads-up before your talk, blog, or
  post. Default is 7 days or until we fix it, whichever is first. Big ones we
  hold until we clear it. Puzzles and small stuff — share whenever.

## Bounties

| What you found | You get |
| --- | --- |
| Critical (someone else's data, money tampering, auth bypass) | up to 500 OmniBucks |
| High (breaking into operator tools, forging someone's instrument) | up to 250 OmniBucks |
| Medium (a real logic bug on your own account) | up to 100 OmniBucks |
| Low (honest bug, small leak, spec mismatch) | up to 25 OmniBucks |
| Solving a planted puzzle | reward posted with the puzzle |

OmniBucks are camp play-money. They're not cash unless a separate posted policy
says so.

## Safe harbor

If you play in good faith and inside these rules, you're authorized. We won't
report you or kick you out for testing OMNIDAT. Slip over a line by accident,
stop and tell us, and you're still fine. This only covers OMNIDAT's own systems
— not the camp, not ShadyTel, not other people.

## Hall of fame

Great findings get your handle on the OMNIDAT hall of fame, published in the
service directory and reachable right from a terminal. Puzzle solves land on the
packet scoreboard. Attribution is your choice.

---

## Open Questions

- **OmniBucks bounty amounts.** The tier structure is decided; the specific
  OmniBucks values (500/250/100/25) are placeholders until the H4 money-policy
  and ShadyBank/OmniBank signoff sets what an OmniBucks bounty is worth relative
  to other camp balances.
- **Disclosure-service X.121 address.** The disclosure/scoreboard service needs
  a provisioned address. It is not yet in `data/packet-services.json`; the
  `core` namespace (`000000-000999`) or `event-operations` (`030000-039999`) are
  the candidates. Owner: packet operator, at H1a provisioning time.
- **Disclosure desk staffing model.** Whether the disclosure desk is a dedicated
  role or folded into the NOC lead / privacy desk is unsettled; the operator
  pipeline (Workstream F) defines roles but has not assigned this one.
- **Per-transport rate-limit values.** The obligation and the tightest-first
  ordering (Meshtastic < MeshCore < wired) are decided, but concrete numeric
  limits per transport are not set and belong in the H2 hardening pass.
- **Cross-event reporter reputation.** Whether hall-of-fame standing and reporter
  trust carry across events (feeding the H8 multi-event network) is deferred.
