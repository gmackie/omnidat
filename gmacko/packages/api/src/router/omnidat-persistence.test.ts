import {
  configurePad,
  executeXotCommand,
  provisionCampsiteService,
  resetOmnidatOperationalState,
  setupAtmTerminal,
} from "@omnidat/operator-core/omnidat";
import { beforeEach, describe, expect, it } from "vitest";

import {
  projectAtmPersistenceRows,
  projectPadPersistenceRows,
  projectProvisioningPersistenceRows,
  projectXotCommandPersistenceRows,
} from "./omnidat-persistence";

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
});
