import { describe, expect, it } from "vitest";

import {
  buildSettlementReport,
  renderSettlementReport,
} from "./omnidat-settlement";

describe("OMNIDAT POS settlement", () => {
  it("nets gross sales minus refunds and excludes voided transactions", () => {
    const report = buildSettlementReport("VF-NITEMARKT-01", "BATCH-001", [
      { kind: "sale", amount: 1400, reference: "RRN-1" },
      { kind: "sale", amount: 600, reference: "RRN-2" },
      { kind: "refund", amount: 200, reference: "RRN-3" },
      { kind: "void", amount: 600, reference: "RRN-2" },
    ]);

    expect(report.saleCount).toBe(1);
    expect(report.grossSales).toBe(1400);
    expect(report.refundCount).toBe(1);
    expect(report.refunds).toBe(200);
    expect(report.voidCount).toBe(1);
    expect(report.net).toBe(1200);
    expect(report.transactionCount).toBe(4);
  });

  it("renders a printable settlement report", () => {
    const rendered = renderSettlementReport(
      buildSettlementReport("VF-TEA-02", "BATCH-002", [
        { kind: "sale", amount: 300, reference: "RRN-9" },
      ]),
    );
    expect(rendered).toContain("OMNIDAT SETTLEMENT REPORT");
    expect(rendered).toContain("TERMINAL: VF-TEA-02");
    expect(rendered).toContain("NET: 300");
  });
});
