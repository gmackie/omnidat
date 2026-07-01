import {
  omnidatAuditEvent,
  omnidatBillingAccount,
  omnidatBillingLedgerEntry,
  omnidatPadConfig,
  omnidatProvisioningRequest,
  omnidatShadyBucksAtm,
} from "@omnidat/db/schema";
import {
  configurePad,
  executeXotCommand,
  provisionCampsiteService,
  resetOmnidatOperationalState,
  setupAtmTerminal,
} from "@omnidat/operator-core/omnidat";
import { beforeEach, describe, expect, it } from "vitest";

import {
  persistAtmResult,
  persistPadResult,
  persistProvisioningResult,
  persistXotCommandResult,
  projectAtmPersistenceRows,
  projectPadPersistenceRows,
  projectProvisioningPersistenceRows,
  projectXotCommandPersistenceRows,
} from "./omnidat-persistence";

function createFakeDb() {
  const writes: Array<{ table: unknown; value: unknown }> = [];
  let id = 0;
  const returning = async () => [{ id: `row-${++id}` }];
  return {
    writes,
    db: {
      insert: (table: unknown) => ({
        values: (value: unknown) => {
          writes.push({ table, value });
          return {
            onConflictDoUpdate: () => ({ returning }),
            returning,
          };
        },
      }),
    },
  };
}

describe("OMNIDAT persistence projections", () => {
  beforeEach(() => {
    resetOmnidatOperationalState();
  });

  it("projects campsite provisioning into durable DB rows", () => {
    const provisioned = provisionCampsiteService({
      campsiteName: "Camp Oscillator",
      namespace: "camp",
      contact: "oscillator@example.test",
      appName: "Oscillator Bulletin Board",
      appKind: "message-board",
      transport: "wifi",
    });
    const rows = projectProvisioningPersistenceRows(provisioned);

    expect(rows.billingAccount.externalAccountId).toBe(
      provisioned.billing.account.accountId,
    );
    expect(rows.provisioningRequest.assignedX121).toBe(
      provisioned.assignment.assignedX121,
    );
    expect(rows.provisioningRequest.verificationTranscript).toContain(
      "STATUS VERIFIED",
    );
    expect(rows.ledgerEntry.externalReceiptId).toBe(
      provisioned.billing.ledgerEntry.receiptId,
    );
    expect(rows.auditEvent.eventType).toBe("provisioning.verified");
  });

  it("projects PAD configuration into a durable XOT terminal profile", () => {
    const provisioned = provisionCampsiteService({
      campsiteName: "Camp Oscillator",
      namespace: "camp",
      contact: "oscillator@example.test",
      appName: "Oscillator Bulletin Board",
      appKind: "message-board",
      transport: "wifi",
    });
    const pad = configurePad({
      x121: provisioned.assignment.assignedX121,
      transport: "xot",
      padKind: "xot-terminal",
      endpointLabel: "Camp Oscillator terminal",
    });
    const rows = projectPadPersistenceRows(pad);

    expect(rows.padConfig.x121).toBe(provisioned.assignment.assignedX121);
    expect(rows.padConfig.padKind).toBe("xot-terminal");
    expect(rows.padConfig.profile).toContain("XOT HOST omnidat.gmac.io");
    expect(rows.auditEvent.eventType).toBe("pad.configured");
  });

  it("projects ATM activation and XOT commands into durable operations rows", () => {
    const atm = setupAtmTerminal({
      terminalId: "OSC-ATM-1",
      settlementAccountId: "SB-ATM-EX88-100",
      locationLabel: "Camp Oscillator cashier window",
    });
    const command = executeXotCommand({
      sourceX121: atm.terminalX121,
      command: `CALL ${atm.terminalX121}`,
    });
    const atmRows = projectAtmPersistenceRows(atm);
    const commandRows = projectXotCommandPersistenceRows({
      sourceX121: atm.terminalX121,
      command: `CALL ${atm.terminalX121}`,
      result: command,
    });

    expect(atmRows.billingAccount.externalAccountId).toBe("SB-ATM-EX88-100");
    expect(atmRows.atm.terminalX121).toBe(atm.terminalX121);
    expect(atmRows.atm.locationLabel).toBe("Camp Oscillator cashier window");
    expect(atmRows.ledgerEntry.externalReceiptId).toBe(atm.receiptId);
    expect(commandRows.auditEvent.eventType).toBe("xot.command");
    expect(commandRows.auditEvent.details.status).toBe("ok");
  });

  it("persists full operations rows when database persistence is enabled", async () => {
    process.env.OMNIDAT_PERSISTENCE = "database";
    const { db, writes } = createFakeDb();
    const provisioned = provisionCampsiteService({
      campsiteName: "Camp Durable",
      namespace: "camp",
      contact: "durable@example.test",
      appName: "Durable Bulletin",
      appKind: "message-board",
      transport: "wifi",
    });
    const pad = configurePad({
      x121: provisioned.assignment.assignedX121,
      transport: "xot",
      padKind: "xot-terminal",
      endpointLabel: "Camp Durable terminal",
    });
    const atm = setupAtmTerminal({
      terminalId: "DURABLE-ATM-1",
      settlementAccountId: "SB-ATM-EX88-100",
      locationLabel: "Camp Durable cashier",
    });
    const command = executeXotCommand({
      sourceX121: provisioned.assignment.assignedX121,
      command: `CALL ${provisioned.assignment.assignedX121}`,
    });

    await persistProvisioningResult(db, provisioned);
    await persistPadResult(db, pad);
    await persistAtmResult(db, atm);
    await persistXotCommandResult(db, {
      sourceX121: provisioned.assignment.assignedX121,
      command: `CALL ${provisioned.assignment.assignedX121}`,
      result: command,
    });

    expect(writes.map((write) => write.table)).toEqual(
      expect.arrayContaining([
        omnidatBillingAccount,
        omnidatProvisioningRequest,
        omnidatBillingLedgerEntry,
        omnidatPadConfig,
        omnidatShadyBucksAtm,
        omnidatAuditEvent,
      ]),
    );
    expect(
      writes.some(
        (write) =>
          write.table === omnidatPadConfig &&
          (write.value as { x121?: string }).x121 ===
            provisioned.assignment.assignedX121,
      ),
    ).toBe(true);
  });
});
