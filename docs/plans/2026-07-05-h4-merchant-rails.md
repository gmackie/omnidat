# H4 Merchant And Bank Rails Implementation Plan

Date: 2026-07-05

**Goal:** Support the fun-money and terminal use cases without creating unclear
real-world obligations ([roadmap](../roadmap.md) H4). OmniBucks stay controlled
play money; network fees are theatrical unless separately agreed. This slice
adds POS batch close and settlement — the missing piece the roadmap exit gate
names — on top of the ISO 8583, vintage POS, ATM, and fee-policy surfaces that
already exist.

**Architecture:** `omnidat-settlement.ts` is a pure aggregator: sale/refund/void
transactions → a reconciled settlement report (voids remove by reference, net =
gross sales − refunds). `posBatchClose` (`bank.write`) runs it and records a
`pos.batch.closed` audit event with a printable settlement receipt. Built on
the H1a/H1b gated + audited pattern; the H1b `setFeePolicy` +
`createBillingAccount` already cover the fee-policy engine and account setup.

## Delivered In This Slice (code)

- `buildSettlementReport(terminalId, batchId, transactions)` → sale/refund/void
  aggregation with reference-based void removal and `net = gross − refunds`.
- `renderSettlementReport` — printable settlement source.
- `posBatchClose` (`bank.write`): closes a batch, audits `pos.batch.closed`,
  returns the report + receipt.
- Tests: net/void aggregation, printable report, batch-close audit, capability
  boundary.

## Already In Place (H1a/H1b + operator-core)

- ISO 8583 authorization/capture (`iso8583Transaction`,
  `iso8583ShadyBankPurchase`) and the Shady Bank HTTP contract.
- vintage Verifone POS sale (`vintagePosSale`) and terminal download package.
- ATM setup (`setupAtmTerminal`) and the OmniBank e2e (`scripts/e2e-omnibank`).
- fee policy (`setFeePolicy`) and billing accounts (`createBillingAccount`).
- network fee policy kinds (flat/percentage/per-message/waived/sponsored/
  merchant-pays/operator-pays) in the H1b fee-policy input.

## Remaining Work (policy / governance, gated on sign-off)

Per the roadmap exit gate, these need the ShadyBank/OmniBank team before any
redeemable value is exposed — they are decisions, not code:

- ATM/bearer-instrument issuance and cash-out simulation with limits.
- fee statements reconciled against terminal tape and bank ledger end to end.
- the written money policy (mint/void/redeem/dispute) and legal sanity pass
  on bearer paper (see roadmap H4 gates and rules-of-engagement.md).

## Acceptance Criteria (this slice)

- POS sale/refund/void batch-close produces a reconciled settlement report in
  simulation.
- batch close is gated on `bank.write` and audited.
- the settlement report is printable and reconciles gross − refunds = net.

**Parallel progress:** Core + UI demo button + CC Camp demo + report display added in operator CRUD. Full policy/reconciliation for camps tracked under H4 + ToorCamp/CC Camp prep.
