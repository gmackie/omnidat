import {
  omnidatAddressAllocation,
  omnidatAuditEvent,
  omnidatBillingAccount,
  omnidatBillingLedgerEntry,
  omnidatCampsite,
  omnidatEvidenceArtifact,
  omnidatInfraEndpoint,
  omnidatNocIncident,
  omnidatPadConfig,
  omnidatProvisioningRequest,
  omnidatService,
  omnidatServiceVerb,
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
  loadPersistentOperationalState,
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

  it("attributes audit rows to the acting OMNIDAT operator", async () => {
    process.env.OMNIDAT_PERSISTENCE = "database";
    const { db, writes } = createFakeDb();
    const provisioned = provisionCampsiteService({
      campsiteName: "Camp Actor",
      namespace: "camp",
      contact: "actor@example.test",
      appName: "Actor Bulletin",
      appKind: "message-board",
      transport: "wifi",
    });

    await persistProvisioningResult(db, provisioned, {
      userId: "user-packet-1",
      roles: ["packet-operator"],
      ipAddress: "198.51.100.10",
    });

    expect(
      writes.find((write) => write.table === omnidatAuditEvent)?.value,
    ).toMatchObject({
      eventType: "provisioning.verified",
      actorUserId: "user-packet-1",
      ipAddress: "198.51.100.10",
      details: expect.objectContaining({
        actorRoles: ["packet-operator"],
      }),
    });
  });

  it("loads persistent registry, audit, incident, and evidence rows", async () => {
    process.env.OMNIDAT_PERSISTENCE = "database";
    const rowsByTable = new Map<unknown, unknown[]>([
      [
        omnidatCampsite,
        [
          {
            id: "camp-db-1",
            namespace: "camp",
            slug: "durable",
            displayName: "Camp Durable",
            contactHandle: "durable@example.test",
            status: "active",
          },
        ],
      ],
      [
        omnidatAddressAllocation,
        [
          {
            id: "addr-db-1",
            x121: "311088020777",
            assignedToKind: "service",
            assignedToId: "service-db-1",
            namespace: "camp",
            status: "assigned",
          },
        ],
      ],
      [
        omnidatProvisioningRequest,
        [
          {
            id: "pv-db-1",
            campsiteId: "camp-db-1",
            serviceId: "service-db-1",
            assignedX121: "311088020777",
            transport: "meshcore",
            status: "verified",
          },
        ],
      ],
      [
        omnidatService,
        [
          {
            id: "service-db-1",
            ownerCampsiteId: "camp-db-1",
            slug: "persisted-bulletin",
            displayName: "Persisted Bulletin",
            x121: "311088020777",
            ownerKind: "campsite",
            serviceKind: "message-board",
            status: "up",
            reachable: true,
          },
        ],
      ],
      [
        omnidatServiceVerb,
        [
          {
            id: "verb-db-1",
            serviceId: "service-db-1",
            verb: "POST",
            description: "Post a campsite message.",
            inputs: ["body", "operatorId"],
            outputs: ["messageId", "receiptId"],
            active: true,
          },
        ],
      ],
      [
        omnidatInfraEndpoint,
        [
          {
            id: "infra-db-1",
            endpointKind: "xot-gateway",
            label: "XOT Gateway",
            url: "https://omnidat.gmac.io/xot",
            healthStatus: "healthy",
            owner: "OMNIDAT",
          },
        ],
      ],
      [
        omnidatAuditEvent,
        [
          {
            id: "audit-db-1",
            eventType: "service.approved",
            subjectKind: "service",
            subjectId: "service-db-1",
            details: { x121: "311088020777" },
          },
        ],
      ],
      [
        omnidatNocIncident,
        [
          {
            id: "incident-db-1",
            title: "MeshCore gateway degraded",
            severity: "major",
            status: "open",
          },
        ],
      ],
      [
        omnidatEvidenceArtifact,
        [
          {
            id: "artifact-db-1",
            artifactKind: "event-log",
            label: "Weekend Event Log",
            url: "/api/weekend-simulation/weekend-events.jsonl",
            recordCount: 5888,
            contentType: "application/x-ndjson",
          },
        ],
      ],
    ]);
    const db = {
      insert: () => ({
        values: () => ({}),
      }),
      select: () => ({
        from: async (table: unknown) => rowsByTable.get(table) ?? [],
      }),
    };

    const state = await loadPersistentOperationalState(db, {
      services: [],
      circuits: [],
      provisioningRequests: [],
      billingAccounts: [],
      ledger: [],
      pads: [],
      foodOrders: [],
      passportStamps: [],
      auditEvents: [],
    });

    expect(state?.services.map((service) => service.slug)).toContain(
      "persisted-bulletin",
    );
    expect(state?.services[0]?.verbs.map((verb) => verb.name)).toContain("POST");
    expect(state?.provisioningRequests[0]?.campsiteName).toBe("Camp Durable");
    expect(state?.provisioningRequests[0]?.assignedX121).toBe("311088020777");
    expect(state?.auditEvents[0]?.eventType).toBe("service.approved");
    expect(state?.incidents?.[0]?.title).toBe("MeshCore gateway degraded");
    expect(state?.evidenceArtifacts?.[0]?.recordCount).toBe(5888);
    expect(state?.infraEndpoints?.[0]?.healthStatus).toBe("healthy");
  });
});
