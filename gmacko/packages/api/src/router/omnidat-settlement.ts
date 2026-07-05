// POS batch close and settlement report (H4). A batch aggregates a terminal's
// sale/refund/void transactions into a settlement report that reconciles
// against the terminal tape and the bank ledger. Pure aggregation; the gated
// procedure records the audit + evidence.

export type PosTransaction = {
  kind: "sale" | "refund" | "void";
  amount: number;
  reference: string;
};

export type SettlementReport = {
  terminalId: string;
  batchId: string;
  saleCount: number;
  refundCount: number;
  voidCount: number;
  grossSales: number;
  refunds: number;
  net: number;
  transactionCount: number;
};

// Voids remove a prior transaction from the batch by reference; they do not
// net as an amount. Net = gross sales - refunds over the un-voided set.
export function buildSettlementReport(
  terminalId: string,
  batchId: string,
  transactions: PosTransaction[],
): SettlementReport {
  const voided = new Set(
    transactions.filter((t) => t.kind === "void").map((t) => t.reference),
  );
  const live = transactions.filter(
    (t) => t.kind !== "void" && !voided.has(t.reference),
  );
  const sales = live.filter((t) => t.kind === "sale");
  const refunds = live.filter((t) => t.kind === "refund");
  const grossSales = sales.reduce((sum, t) => sum + t.amount, 0);
  const refundTotal = refunds.reduce((sum, t) => sum + t.amount, 0);
  return {
    terminalId,
    batchId,
    saleCount: sales.length,
    refundCount: refunds.length,
    voidCount: voided.size,
    grossSales,
    refunds: refundTotal,
    net: grossSales - refundTotal,
    transactionCount: transactions.length,
  };
}

export function renderSettlementReport(report: SettlementReport): string {
  return [
    "OMNIDAT SETTLEMENT REPORT",
    "A GMACKO CORPORATION",
    "",
    `TERMINAL: ${report.terminalId}`,
    `BATCH: ${report.batchId}`,
    "",
    `SALES: ${report.saleCount}  GROSS ${report.grossSales}`,
    `REFUNDS: ${report.refundCount}  ${report.refunds}`,
    `VOIDS: ${report.voidCount}`,
    `NET: ${report.net}`,
    "",
    "RECONCILE AGAINST TERMINAL TAPE AND BANK LEDGER",
    "",
  ].join("\n");
}
