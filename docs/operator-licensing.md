# OMNIDAT Operator Licensing

Date: 2026-07-05

Workstream F of the [roadmap expansion](plans/2026-07-04-roadmap-expansion.md).
Every H7 staffing role must have a licensed primary and a backup before the
pilot. The practical exam below doubles as the Rehearsal 2 operator tabletop
script. A passed exam prints an operator license card
(`renderDocument` kind `operator-license`).

These API roles map to the gmacko capability matrix
(`gmacko/packages/api/src/router/omnidat-roles.ts`); the field-desk staffing
roles in `docs/operator-model.md` (TrustDesk, Document Clerk, Media Vault, ATV)
map onto them.

## Roles And What They Own

| License | API role | Owns |
| --- | --- | --- |
| Packet Operator | `packet-operator` | services, verbs, X.121 allocations, PADs, provisioning, packet sessions, evidence, campsite apps. |
| NOC Operator | `noc-operator` | packet sessions, incidents, service disable, evidence, authority failover. |
| Bank Operator | `bank-operator` | ATM setup, ISO 8583, POS sale/batch-close, billing accounts, fee policy. |
| Vendor Liaison | `vendor-operator` | vendor services, food orders, POS sale, passport stamps, terminal packages. |
| Admin | `admin` | everything, including operator role grants. |
| Auditor | `auditor` | read-only across all operator views. |

## Training (per role)

Trainees must review core materials:
- `docs/identity.md`
- `docs/corporate-history.md`
- `docs/compliance-directive.md`
- `docs/assimilation-protocol.md`
- `docs/network-observation-directive.md`
- `docs/packet-clearing.md#x25-network-etiquette`

Each trainee reads and can explain:

- **All roles:** the authority model (field kit authoritative during an event,
  cloud primary otherwise), the honest-clear-code rule (every packet call
  clears with an X.25 cause, never a silent error), and the rule that every
  write records an audit event with the acting operator.
- **Packet Operator:** the service directory and X.121 numbering
  (`docs/protocol-fidelity.md`); the allocation lifecycle (reserved → assigned
  → verified → suspended → revoked); the provisioning lifecycle
  (requested → … → active); how to configure a PAD and read a packet session.
- **NOC Operator:** the NOC dashboard (sessions, evidence, sync staleness);
  incident open/mitigate/resolve; the authority failover runbook
  (`runbooks/authority-failover.md`) and the uplink-pull drill.
- **Bank Operator:** the money policy (OmniBucks are controlled play money);
  POS sale/refund/void and `posBatchClose`; reading a settlement report; the
  rule that no redeemable value is exposed without written sign-off.
- **Vendor Liaison:** onboarding a vendor as a campsite in the `vendor`
  namespace; food-order and passport-stamp flows; terminal download packages.

## Practical Exam (doubles as Rehearsal 2 tabletop)

Run against a staging gmacko target with the examinee holding only their
role's API key. Each step must succeed for that role and be refused for a role
that lacks the capability (the role-matrix test proves the boundaries; the exam
confirms the human can drive them).

1. **Admin:** create an event (`createEvent`), then grant the examinee their
   role (`grantOperatorRole`). Confirm an auditor is refused both.
2. **Packet Operator:** create a campsite (`createCampsite`), allocate an
   X.121 (`allocateAddress`), advance it to `verified`
   (`updateAllocationStatus`), configure a campsite app (`createCampsiteApp`),
   and run a packet call (`packetCall`) that clears cause 0. Then call an
   unknown address and read back `CLR NP C:13 D:67`.
3. **NOC Operator:** open an incident (`openIncident`), find the packet
   sessions in the NOC view (`listPacketSessions`), resolve the incident with a
   time-to-clear, and run the authority failover drill
   (`./scripts/authority-drill`) confirming `RESULT: PASS` both directions.
4. **Bank Operator:** create a billing account (`createBillingAccount`), set a
   fee policy (`setFeePolicy`), and close a POS batch (`posBatchClose`) reading
   back a settlement report where gross − refunds = net.
5. **Vendor Liaison:** onboard a vendor campsite, take a food order, and stamp
   an activity passport.
6. **All:** export the event evidence (`exportEventEvidence`) and print the
   daily NOC summary (`renderDocument` kind `daily-noc-summary`).

Pass criteria: every assigned step completes, every out-of-role step is
refused, and each write shows up as an audit event attributed to the examinee.

## License Card

On pass, print the operator's license:

```sh
# via renderDocument (operator.read), kind operator-license, data:
# { operator, role, licenseNo, event, examDate, capabilities }
```

The card is presented at the NOC desk for operator access and is the printed
half of the H7 staffing gate.

## Staffing Gate (H7)

Before the pilot: NOC lead, packet operator, bank operator, vendor liaison,
ShadyTel liaison, and privacy/contact desk each have a licensed primary and a
backup. Track them in the event's operator role grants (`listOperatorRoles`).
