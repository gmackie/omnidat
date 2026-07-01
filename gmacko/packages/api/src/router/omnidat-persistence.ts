import {
  omnidatAuditEvent,
  omnidatBillingAccount,
  omnidatBillingLedgerEntry,
  omnidatPadConfig,
  omnidatProvisioningRequest,
  omnidatShadyBucksAtm,
} from "@omnidat/db/schema";
import type {
  configurePad,
  executeXotCommand,
  OmnidatBillingAccount,
  OmnidatBillingLedgerEntry,
  OmnidatCircuitMetric,
  OmnidatPadConfig,
  OmnidatProvisioningRequest,
  OmnidatServiceDefinition,
  provisionCampsiteService,
  setupAtmTerminal,
} from "@omnidat/operator-core/omnidat";
import { createHash } from "node:crypto";

type ProvisioningResult = ReturnType<typeof provisionCampsiteService>;
type PadResult = ReturnType<typeof configurePad>;
type AtmResult = ReturnType<typeof setupAtmTerminal>;
type XotResult = ReturnType<typeof executeXotCommand>;
type OmnidatOperationalSnapshot = {
  services: OmnidatServiceDefinition[];
  circuits: OmnidatCircuitMetric[];
  provisioningRequests: OmnidatProvisioningRequest[];
  billingAccounts: OmnidatBillingAccount[];
  ledger: OmnidatBillingLedgerEntry[];
  pads: OmnidatPadConfig[];
  auditEvents: Array<{
    id: string;
    eventType: string;
    subjectKind: string;
    subjectId: string;
    details: Record<string, string | number | boolean>;
  }>;
};

type InsertValue<T> = T extends { $inferInsert: infer U } ? U : never;

export type OmnidatPersistenceDb = {
  insert: (table: unknown) => {
    values: (value: unknown) => {
      onConflictDoUpdate?: (config: unknown) => unknown;
      returning?: (fields?: unknown) => Promise<unknown[]>;
    };
  };
  select?: () => {
    from: (table: unknown) => Promise<unknown[]>;
  };
};

function activationHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function projectProvisioningPersistenceRows(result: ProvisioningResult) {
  const account = result.billing.account;
  return {
    billingAccount: {
      provider: account.provider,
      externalAccountId: account.accountId,
      accountType: account.type,
      displayName: account.owner,
      status: account.status,
      balanceAmount: account.balance,
      currency: account.currency,
    } satisfies InsertValue<typeof omnidatBillingAccount>,
    provisioningRequest: {
      assignedX121: result.assignment.assignedX121,
      transport: result.assignment.transport,
      status: result.assignment.status,
      verificationTranscript: result.transcript,
      verifiedAt: new Date(),
    } satisfies InsertValue<typeof omnidatProvisioningRequest>,
    ledgerEntry: {
      entryKind: result.billing.ledgerEntry.entryKind,
      amount: result.billing.ledgerEntry.amount,
      currency: result.billing.ledgerEntry.currency,
      memo: result.billing.ledgerEntry.memo,
      externalReceiptId: result.billing.ledgerEntry.receiptId,
    } satisfies Omit<InsertValue<typeof omnidatBillingLedgerEntry>, "accountId">,
    auditEvent: {
      eventType: "provisioning.verified",
      subjectKind: "x121",
      subjectId: result.assignment.assignedX121,
      details: {
        campsiteName: result.assignment.campsiteName,
        namespace: result.assignment.namespace,
        serviceSlug: result.service.slug,
      },
    } satisfies InsertValue<typeof omnidatAuditEvent>,
  };
}

export function projectPadPersistenceRows(result: PadResult) {
  return {
    padConfig: {
      x121: result.x121,
      transport: result.transport,
      padKind: result.padKind,
      endpointLabel: result.endpointLabel,
      status: result.status,
      profile: result.profile,
    } satisfies InsertValue<typeof omnidatPadConfig>,
    auditEvent: {
      eventType: "pad.configured",
      subjectKind: "x121",
      subjectId: result.x121,
      details: {
        transport: result.transport,
        padKind: result.padKind,
      },
    } satisfies InsertValue<typeof omnidatAuditEvent>,
  };
}

export function projectAtmPersistenceRows(result: AtmResult) {
  return {
    billingAccount: {
      provider: result.settlementAccount.provider,
      externalAccountId: result.settlementAccount.accountId,
      accountType: result.settlementAccount.type,
      displayName: result.settlementAccount.owner,
      status: result.settlementAccount.status,
      balanceAmount: result.settlementAccount.balance,
      currency: result.settlementAccount.currency,
    } satisfies InsertValue<typeof omnidatBillingAccount>,
    atm: {
      terminalId: result.terminalId,
      terminalX121: result.terminalX121,
      locationLabel: result.locationLabel,
      status: "active",
      activationCodeHash: activationHash(result.activationCode),
    } satisfies Omit<InsertValue<typeof omnidatShadyBucksAtm>, "settlementAccountId">,
    ledgerEntry: {
      entryKind: "atm-activation",
      amount: -10,
      currency: "SHDY",
      memo: `ATM activation for ${result.terminalId}`,
      externalReceiptId: result.receiptId,
    } satisfies Omit<InsertValue<typeof omnidatBillingLedgerEntry>, "accountId">,
    auditEvent: {
      eventType: "atm.activated",
      subjectKind: "x121",
      subjectId: result.terminalX121,
      details: {
        terminalId: result.terminalId,
        locationLabel: result.locationLabel,
      },
    } satisfies InsertValue<typeof omnidatAuditEvent>,
  };
}

export function projectXotCommandPersistenceRows(input: {
  sourceX121: string;
  command: string;
  result: XotResult;
}) {
  return {
    auditEvent: {
      eventType: "xot.command",
      subjectKind: "x121",
      subjectId: input.sourceX121,
      details: {
        command: input.command,
        status: input.result.status,
      },
    } satisfies InsertValue<typeof omnidatAuditEvent>,
  };
}

export function databasePersistenceEnabled() {
  return process.env.OMNIDAT_PERSISTENCE === "database";
}

async function selectRows<T>(db: OmnidatPersistenceDb, table: unknown) {
  if (!db.select) return [];
  return (await db.select().from(table)) as T[];
}

function provisioningStatus(value: unknown): OmnidatProvisioningRequest["status"] {
  return value === "verified" || value === "failed"
    ? value
    : "pending-network-install";
}

function billingType(value: unknown): OmnidatBillingAccount["type"] {
  return value === "atm-settlement" ? "atm-settlement" : "camp-operating";
}

function billingStatus(value: unknown): OmnidatBillingAccount["status"] {
  return value === "ready-for-terminal" ? "ready-for-terminal" : "linked-demo";
}

function ledgerKind(value: unknown): OmnidatBillingLedgerEntry["entryKind"] {
  return value === "provisioning-fee" ||
    value === "atm-activation" ||
    value === "food-order"
    ? value
    : "adjustment";
}

function padKind(value: unknown): OmnidatPadConfig["padKind"] {
  return value === "meshcore-pad" ||
    value === "meshtastic-pad" ||
    value === "wifi-terminal" ||
    value === "pots-pad" ||
    value === "xot-terminal"
    ? value
    : "xot-terminal";
}

function padStatus(value: unknown): OmnidatPadConfig["status"] {
  return value === "testing" || value === "disabled" ? value : "configured";
}

function circuitStatus(value: OmnidatPadConfig["status"] | string) {
  if (value === "disabled") return "down";
  if (value === "testing") return "degraded";
  return "up";
}

function latencyForTransport(transport: string) {
  if (transport.includes("mesh")) return 160;
  if (transport.includes("pots")) return 220;
  if (transport.includes("xot")) return 48;
  return 88;
}

type ProvisioningRow = {
  id?: string;
  assignedX121?: string | null;
  transport?: string | null;
  status?: string | null;
};

type BillingAccountRow = {
  externalAccountId?: string | null;
  provider?: string | null;
  accountType?: string | null;
  displayName?: string | null;
  status?: string | null;
  balanceAmount?: number | null;
  currency?: string | null;
};

type LedgerRow = {
  id?: string;
  accountId?: string | null;
  entryKind?: string | null;
  amount?: number | null;
  currency?: string | null;
  memo?: string | null;
  externalReceiptId?: string | null;
};

type PadRow = {
  id?: string;
  x121?: string | null;
  transport?: string | null;
  padKind?: string | null;
  endpointLabel?: string | null;
  status?: string | null;
  profile?: string | null;
};

type AtmRow = {
  id?: string;
  terminalId?: string | null;
  terminalX121?: string | null;
  locationLabel?: string | null;
  status?: string | null;
};

export async function loadPersistentOperationalState(
  db: OmnidatPersistenceDb | undefined,
  seed: OmnidatOperationalSnapshot,
): Promise<OmnidatOperationalSnapshot | undefined> {
  if (!db || !databasePersistenceEnabled()) return undefined;

  const [
    provisioningRows,
    billingRows,
    ledgerRows,
    padRows,
    atmRows,
  ] = await Promise.all([
    selectRows<ProvisioningRow>(db, omnidatProvisioningRequest),
    selectRows<BillingAccountRow>(db, omnidatBillingAccount),
    selectRows<LedgerRow>(db, omnidatBillingLedgerEntry),
    selectRows<PadRow>(db, omnidatPadConfig),
    selectRows<AtmRow>(db, omnidatShadyBucksAtm),
  ]);

  const provisioningRequests = provisioningRows
    .filter((row) => row.assignedX121)
    .map((row): OmnidatProvisioningRequest => ({
      id: row.id ?? `PV-${row.assignedX121}`,
      campsiteName: `Persisted ${row.assignedX121}`,
      namespace: "camp",
      transport: row.transport ?? "xot",
      assignedX121: row.assignedX121 ?? "",
      status: provisioningStatus(row.status),
    }));

  const billingAccounts = billingRows
    .filter((row) => row.externalAccountId)
    .map((row): OmnidatBillingAccount => ({
      accountId: row.externalAccountId ?? "",
      provider: "ShadyBucks",
      type: billingType(row.accountType),
      owner: row.displayName ?? row.externalAccountId ?? "OMNIDAT Account",
      status: billingStatus(row.status),
      balance: row.balanceAmount ?? 0,
      currency: "SHDY",
    }));

  const ledger = ledgerRows.map((row): OmnidatBillingLedgerEntry => ({
    id: row.id ?? row.externalReceiptId ?? "ledger-persisted",
    accountId: row.accountId ?? "unknown",
    entryKind: ledgerKind(row.entryKind),
    amount: row.amount ?? 0,
    currency: "SHDY",
    memo: row.memo ?? "",
    receiptId: row.externalReceiptId ?? row.id ?? "RCPT-PERSISTED",
  }));

  const pads = padRows
    .filter((row) => row.x121)
    .map((row): OmnidatPadConfig => ({
      id: row.id ?? `PAD-${row.x121}`,
      x121: row.x121 ?? "",
      transport: row.transport ?? "xot",
      padKind: padKind(row.padKind),
      endpointLabel: row.endpointLabel ?? `PAD ${row.x121}`,
      status: padStatus(row.status),
      profile: row.profile ?? "",
    }));

  const padCircuits = pads.map((pad): OmnidatCircuitMetric => ({
    x121: pad.x121,
    service: pad.endpointLabel,
    status: circuitStatus(pad.status),
    latencyMs: latencyForTransport(pad.transport),
    transport: pad.transport,
    packetLoss: pad.status === "testing" ? 0.03 : 0,
  }));

  const atmCircuits = atmRows
    .filter((row) => row.terminalX121)
    .map((row): OmnidatCircuitMetric => ({
      x121: row.terminalX121 ?? "",
      service: `ATM ${row.terminalId ?? row.terminalX121}`,
      status: row.status === "active" ? "up" : "down",
      latencyMs: 74,
      transport: "shadybucks-x25",
      packetLoss: 0,
    }));

  const derivedServices = [
    ...pads.map((pad): OmnidatServiceDefinition => ({
      slug: `pad-${pad.x121}`,
      name: pad.endpointLabel,
      x121: pad.x121,
      owner: "Persisted campsite",
      category: "transport",
      status: circuitStatus(pad.status),
      reachable: pad.status !== "disabled",
      verbs: [
        {
          name: "CALL",
          description: "Open an XOT terminal call to this PAD.",
          inputs: ["sourceX121"],
          outputs: ["transcript", "status"],
        },
      ],
    })),
    ...atmRows
      .filter((row) => row.terminalX121)
      .map((row): OmnidatServiceDefinition => ({
        slug: `atm-${row.terminalId ?? row.terminalX121}`,
        name: `ATM ${row.terminalId ?? row.terminalX121}`,
        x121: row.terminalX121 ?? "",
        owner: "ShadyBucks Settlement Office",
        category: "billing",
        status: row.status === "active" ? "up" : "down",
        reachable: row.status === "active",
        verbs: [
          {
            name: "BALANCE",
            description: "Read ShadyBucks account balance.",
            inputs: ["shadybucksAccountId"],
            outputs: ["availableBalance", "currency"],
          },
        ],
      })),
  ];

  return {
    ...seed,
    services:
      derivedServices.length > 0
        ? [
            ...seed.services,
            ...derivedServices.filter(
              (service) =>
                !seed.services.some((seedService) => seedService.x121 === service.x121),
            ),
          ]
        : seed.services,
    circuits:
      padCircuits.length > 0 || atmCircuits.length > 0
        ? [
            ...seed.circuits,
            ...[...padCircuits, ...atmCircuits].filter(
              (circuit) =>
                !seed.circuits.some((seedCircuit) => seedCircuit.x121 === circuit.x121),
            ),
          ]
        : seed.circuits,
    provisioningRequests:
      provisioningRequests.length > 0
        ? provisioningRequests
        : seed.provisioningRequests,
    billingAccounts:
      billingAccounts.length > 0 ? billingAccounts : seed.billingAccounts,
    ledger: ledger.length > 0 ? ledger : seed.ledger,
    pads: pads.length > 0 ? pads : seed.pads,
  };
}

type ReturningInsert = {
  onConflictDoUpdate?: (config: unknown) => ReturningInsert;
  returning?: (fields?: unknown) => Promise<Array<{ id?: string }>>;
};

async function returningId(
  insert: ReturningInsert,
  fields: Record<string, unknown>,
) {
  const [row] = (await insert.returning?.(fields)) ?? [];
  return row?.id;
}

async function upsertBillingAccount(
  db: OmnidatPersistenceDb,
  value: InsertValue<typeof omnidatBillingAccount>,
) {
  const insert = db.insert(omnidatBillingAccount).values(value) as ReturningInsert;
  const upsert = insert.onConflictDoUpdate?.({
    target: [
      omnidatBillingAccount.provider,
      omnidatBillingAccount.externalAccountId,
    ],
    set: {
      accountType: value.accountType,
      displayName: value.displayName,
      status: value.status,
      balanceAmount: value.balanceAmount,
      currency: value.currency,
    },
  }) ?? insert;

  const id = await returningId(upsert, { id: omnidatBillingAccount.id });
  if (!id) {
    throw new Error("OMNIDAT persistence could not resolve billing account id");
  }
  return id;
}

export async function persistProvisioningResult(
  db: OmnidatPersistenceDb | undefined,
  result: ProvisioningResult,
) {
  if (!db || !databasePersistenceEnabled()) return;
  const rows = projectProvisioningPersistenceRows(result);
  const accountId = await upsertBillingAccount(db, rows.billingAccount);

  await db.insert(omnidatProvisioningRequest).values(rows.provisioningRequest);
  await db.insert(omnidatBillingLedgerEntry).values({
    ...rows.ledgerEntry,
    accountId,
  });
  await db.insert(omnidatAuditEvent).values(rows.auditEvent);
}

export async function persistPadResult(
  db: OmnidatPersistenceDb | undefined,
  result: PadResult,
) {
  if (!db || !databasePersistenceEnabled()) return;
  const rows = projectPadPersistenceRows(result);
  const insert = db.insert(omnidatPadConfig).values(rows.padConfig) as ReturningInsert;
  await insert.onConflictDoUpdate?.({
    target: omnidatPadConfig.x121,
    set: {
      transport: rows.padConfig.transport,
      padKind: rows.padConfig.padKind,
      endpointLabel: rows.padConfig.endpointLabel,
      status: rows.padConfig.status,
      profile: rows.padConfig.profile,
    },
  });
  await db.insert(omnidatAuditEvent).values(rows.auditEvent);
}

export async function persistAtmResult(
  db: OmnidatPersistenceDb | undefined,
  result: AtmResult,
) {
  if (!db || !databasePersistenceEnabled()) return;
  const rows = projectAtmPersistenceRows(result);
  const accountId = await upsertBillingAccount(db, rows.billingAccount);
  const atmInsert = db.insert(omnidatShadyBucksAtm).values({
    ...rows.atm,
    settlementAccountId: accountId,
  }) as ReturningInsert;

  await atmInsert.onConflictDoUpdate?.({
    target: omnidatShadyBucksAtm.terminalX121,
    set: {
      terminalId: rows.atm.terminalId,
      locationLabel: rows.atm.locationLabel,
      status: rows.atm.status,
      activationCodeHash: rows.atm.activationCodeHash,
    },
  });
  await db.insert(omnidatBillingLedgerEntry).values({
    ...rows.ledgerEntry,
    accountId,
  });
  await db.insert(omnidatAuditEvent).values(rows.auditEvent);
}

export async function persistXotCommandResult(
  db: OmnidatPersistenceDb | undefined,
  input: {
    sourceX121: string;
    command: string;
    result: XotResult;
  },
) {
  if (!db || !databasePersistenceEnabled()) return;
  await db
    .insert(omnidatAuditEvent)
    .values(projectXotCommandPersistenceRows(input).auditEvent);
}

export async function persistAuditEvent(
  db: OmnidatPersistenceDb | undefined,
  auditEvent: InsertValue<typeof omnidatAuditEvent>,
) {
  if (!db || !databasePersistenceEnabled()) return;
  await db.insert(omnidatAuditEvent).values(auditEvent);
}
