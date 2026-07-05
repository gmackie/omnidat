import { eq } from "@omnidat/db";
import {
  omnidatAddressAllocation,
  omnidatAuditEvent,
  omnidatBillingAccount,
  omnidatBillingLedgerEntry,
  omnidatCampsite,
  omnidatCampsiteApp,
  omnidatEvent,
  omnidatEvidenceArtifact,
  omnidatFoodOrder,
  omnidatInfraEndpoint,
  omnidatNocIncident,
  omnidatOperatorRole,
  omnidatPacketSession,
  omnidatPadConfig,
  omnidatPassportStamp,
  omnidatProvisioningRequest,
  omnidatService,
  omnidatServiceVerb,
  omnidatShadyBucksAtm,
} from "@omnidat/db/schema";
import type {
  configurePad,
  createFoodOrder,
  executeXotCommand,
  OmnidatBillingAccount,
  OmnidatBillingLedgerEntry,
  OmnidatCircuitMetric,
  OmnidatFoodOrder,
  OmnidatPadConfig,
  OmnidatPassportStamp,
  OmnidatProvisioningRequest,
  OmnidatServiceDefinition,
  provisionCampsiteService,
  setupAtmTerminal,
  stampActivityPassport,
} from "@omnidat/operator-core/omnidat";
import { createHash } from "node:crypto";

import type { OmnidatRole } from "./omnidat-roles";

type ProvisioningResult = ReturnType<typeof provisionCampsiteService>;
type PadResult = ReturnType<typeof configurePad>;
type AtmResult = ReturnType<typeof setupAtmTerminal>;
type XotResult = ReturnType<typeof executeXotCommand>;
type FoodOrderResult = ReturnType<typeof createFoodOrder>;
type PassportStampResult = ReturnType<typeof stampActivityPassport>;
type OmnidatOperationalSnapshot = {
  services: OmnidatServiceDefinition[];
  circuits: OmnidatCircuitMetric[];
  provisioningRequests: OmnidatProvisioningRequest[];
  billingAccounts: OmnidatBillingAccount[];
  ledger: OmnidatBillingLedgerEntry[];
  pads: OmnidatPadConfig[];
  foodOrders: OmnidatFoodOrder[];
  passportStamps: OmnidatPassportStamp[];
  auditEvents: Array<{
    id: string;
    eventType: string;
    subjectKind: string;
    subjectId: string;
    details: Record<string, string | number | boolean>;
  }>;
  incidents?: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
  }>;
  evidenceArtifacts?: Array<{
    id: string;
    artifactKind: string;
    label: string;
    url: string;
    recordCount: number | null;
    contentType: string;
  }>;
  infraEndpoints?: Array<{
    id: string;
    endpointKind: string;
    label: string;
    url: string | null;
    healthStatus: string;
    owner: string;
  }>;
};

type InsertValue<T> = T extends { $inferInsert: infer U } ? U : never;

export type OmnidatAuditActor = {
  userId: string;
  roles: OmnidatRole[];
  ipAddress?: string;
};

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

function withAuditActor(
  auditEvent: InsertValue<typeof omnidatAuditEvent>,
  actor?: OmnidatAuditActor,
): InsertValue<typeof omnidatAuditEvent> {
  if (!actor) return auditEvent;
  return {
    ...auditEvent,
    actorUserId: actor.userId,
    ipAddress: actor.ipAddress,
    details: {
      ...(auditEvent.details ?? {}),
      actorRoles: actor.roles,
    },
  };
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

export function projectFoodOrderPersistenceRows(result: FoodOrderResult) {
  return {
    billingAccount: {
      provider: result.billingAccount.provider,
      externalAccountId: result.billingAccount.accountId,
      accountType: result.billingAccount.type,
      displayName: result.billingAccount.owner,
      status: result.billingAccount.status,
      balanceAmount: result.billingAccount.balance,
      currency: result.billingAccount.currency,
    } satisfies InsertValue<typeof omnidatBillingAccount>,
    foodOrder: {
      lineTicket: result.lineTicket,
      pickupName: result.pickupName,
      items: result.itemIds.map((itemId) => ({ itemCode: itemId, quantity: 1 })),
      totalAmount: result.total,
      status: result.status,
      estimatedWaitMinutes: result.estimatedWaitMinutes,
    } satisfies InsertValue<typeof omnidatFoodOrder>,
    ledgerEntry: {
      entryKind: result.ledgerEntry.entryKind,
      amount: result.ledgerEntry.amount,
      currency: result.ledgerEntry.currency,
      memo: result.ledgerEntry.memo,
      externalReceiptId: result.ledgerEntry.receiptId,
    } satisfies Omit<InsertValue<typeof omnidatBillingLedgerEntry>, "accountId">,
    auditEvent: {
      eventType: "food.order.created",
      subjectKind: "food-order",
      subjectId: result.lineTicket,
      details: {
        pickupName: result.pickupName,
        itemCount: result.itemIds.length,
        total: result.total,
        receiptId: result.receiptId,
      },
    } satisfies InsertValue<typeof omnidatAuditEvent>,
  };
}

export function projectPassportStampPersistenceRows(result: PassportStampResult) {
  return {
    passportStamp: {
      passportId: result.passportId,
      badgeId: result.badgeId,
      operatorId: result.operatorId,
      evidence: result.evidence,
      stampId: result.stampId,
      receiptId: result.receiptId,
      status: result.status,
    } satisfies InsertValue<typeof omnidatPassportStamp>,
    auditEvent: {
      eventType: "passport.stamped",
      subjectKind: "passport",
      subjectId: result.passportId,
      details: {
        badgeId: result.badgeId,
        operatorId: result.operatorId,
        stampId: result.stampId,
        receiptId: result.receiptId,
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

function serviceCategory(value: unknown): OmnidatServiceDefinition["category"] {
  if (value === "food") return "food";
  if (value === "billing" || value === "atm") return "billing";
  if (value === "passport") return "passport";
  if (value === "transport") return "transport";
  if (value === "directory") return "directory";
  return "transport";
}

type ProvisioningRow = {
  id?: string;
  campsiteId?: string | null;
  serviceId?: string | null;
  assignedX121?: string | null;
  transport?: string | null;
  status?: string | null;
};

type CampsiteRow = {
  id?: string;
  namespace?: string | null;
  slug?: string | null;
  displayName?: string | null;
  contactHandle?: string | null;
  status?: string | null;
};

type AddressAllocationRow = {
  id?: string;
  x121?: string | null;
  assignedToKind?: string | null;
  assignedToId?: string | null;
  namespace?: string | null;
  status?: string | null;
};

type ServiceRow = {
  id?: string;
  ownerCampsiteId?: string | null;
  slug?: string | null;
  displayName?: string | null;
  x121?: string | null;
  ownerKind?: string | null;
  serviceKind?: string | null;
  status?: string | null;
  reachable?: boolean | null;
  description?: string | null;
};

type ServiceVerbRow = {
  id?: string;
  serviceId?: string | null;
  verb?: string | null;
  description?: string | null;
  inputs?: string[] | null;
  outputs?: string[] | null;
  active?: boolean | null;
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

type FoodOrderRow = {
  id?: string;
  lineTicket?: string | null;
  pickupName?: string | null;
  items?: Array<{ itemCode?: string; quantity?: number }> | null;
  totalAmount?: number | null;
  status?: string | null;
  estimatedWaitMinutes?: number | null;
};

type PassportStampRow = {
  id?: string;
  passportId?: string | null;
  badgeId?: string | null;
  operatorId?: string | null;
  evidence?: string | null;
  stampId?: string | null;
  receiptId?: string | null;
  status?: string | null;
};

type AuditEventRow = {
  id?: string;
  eventType?: string | null;
  subjectKind?: string | null;
  subjectId?: string | null;
  details?: Record<string, string | number | boolean> | null;
};

type NocIncidentRow = {
  id?: string;
  title?: string | null;
  severity?: string | null;
  status?: string | null;
};

type EvidenceArtifactRow = {
  id?: string;
  artifactKind?: string | null;
  label?: string | null;
  url?: string | null;
  recordCount?: number | null;
  contentType?: string | null;
};

type InfraEndpointRow = {
  id?: string;
  endpointKind?: string | null;
  label?: string | null;
  url?: string | null;
  healthStatus?: string | null;
  owner?: string | null;
};

export async function loadPersistentOperationalState(
  db: OmnidatPersistenceDb | undefined,
  seed: OmnidatOperationalSnapshot,
): Promise<OmnidatOperationalSnapshot | undefined> {
  if (!db || !databasePersistenceEnabled()) return undefined;

  const [
    campsiteRows,
    addressRows,
    serviceRows,
    serviceVerbRows,
    provisioningRows,
    billingRows,
    ledgerRows,
    padRows,
    atmRows,
    foodOrderRows,
    passportStampRows,
    auditRows,
    incidentRows,
    evidenceRows,
    infraRows,
  ] = await Promise.all([
    selectRows<CampsiteRow>(db, omnidatCampsite),
    selectRows<AddressAllocationRow>(db, omnidatAddressAllocation),
    selectRows<ServiceRow>(db, omnidatService),
    selectRows<ServiceVerbRow>(db, omnidatServiceVerb),
    selectRows<ProvisioningRow>(db, omnidatProvisioningRequest),
    selectRows<BillingAccountRow>(db, omnidatBillingAccount),
    selectRows<LedgerRow>(db, omnidatBillingLedgerEntry),
    selectRows<PadRow>(db, omnidatPadConfig),
    selectRows<AtmRow>(db, omnidatShadyBucksAtm),
    selectRows<FoodOrderRow>(db, omnidatFoodOrder),
    selectRows<PassportStampRow>(db, omnidatPassportStamp),
    selectRows<AuditEventRow>(db, omnidatAuditEvent),
    selectRows<NocIncidentRow>(db, omnidatNocIncident),
    selectRows<EvidenceArtifactRow>(db, omnidatEvidenceArtifact),
    selectRows<InfraEndpointRow>(db, omnidatInfraEndpoint),
  ]);

  const campsitesById = new Map(
    campsiteRows
      .filter((row) => row.id)
      .map((row) => [row.id ?? "", row]),
  );
  const addressesByAssignedToId = new Map(
    addressRows
      .filter((row) => row.assignedToId && row.x121)
      .map((row) => [row.assignedToId ?? "", row]),
  );
  const verbsByServiceId = new Map<string, ServiceVerbRow[]>();
  for (const verb of serviceVerbRows) {
    if (!verb.serviceId || verb.active === false) continue;
    verbsByServiceId.set(verb.serviceId, [
      ...(verbsByServiceId.get(verb.serviceId) ?? []),
      verb,
    ]);
  }

  const provisioningRequests = provisioningRows
    .filter((row) => row.assignedX121)
    .map((row): OmnidatProvisioningRequest => ({
      id: row.id ?? `PV-${row.assignedX121}`,
      campsiteName:
        campsitesById.get(row.campsiteId ?? "")?.displayName ??
        `Persisted ${row.assignedX121}`,
      namespace:
        campsitesById.get(row.campsiteId ?? "")?.namespace ??
        addressesByAssignedToId.get(row.serviceId ?? "")?.namespace ??
        "camp",
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

  const foodOrders = foodOrderRows
    .filter((row) => row.lineTicket)
    .map((row): OmnidatFoodOrder => {
      const itemIds = (row.items ?? [])
        .map((item) => item.itemCode)
        .filter((itemId): itemId is string => Boolean(itemId));
      return {
        id: row.id ?? `ORDER-${row.lineTicket}`,
        lineTicket: row.lineTicket ?? "",
        pickupName: row.pickupName ?? "Persisted Pickup",
        itemIds,
        total: row.totalAmount ?? 0,
        currency: "SHDY",
        status: row.status === "ready" ||
          row.status === "preparing" ||
          row.status === "fulfilled" ||
          row.status === "cancelled"
          ? row.status
          : "received",
        estimatedWaitMinutes: row.estimatedWaitMinutes ?? 0,
        receiptId: `RCPT-FOOD-${(row.lineTicket ?? "").slice(-4)}`,
      };
    });

  const passportStamps = passportStampRows
    .filter((row) => row.stampId)
    .map((row): OmnidatPassportStamp => ({
      id: row.id ?? row.stampId ?? "STAMP-PERSISTED",
      passportId: row.passportId ?? "",
      badgeId: row.badgeId ?? "",
      operatorId: row.operatorId ?? "",
      evidence: row.evidence ?? "",
      stampId: row.stampId ?? "",
      receiptId: row.receiptId ?? `RCPT-PASS-${(row.stampId ?? "").slice(-5)}`,
      status: row.status === "under-review" ||
        row.status === "approved" ||
        row.status === "rejected"
        ? row.status
        : "filed",
    }));

  const persistentServices = serviceRows
    .filter((row) => row.slug && row.x121)
    .map((row): OmnidatServiceDefinition => {
      const campsite = campsitesById.get(row.ownerCampsiteId ?? "");
      const status =
        row.status === "degraded" || row.status === "down" ? row.status : "up";
      return {
        slug: row.slug ?? "",
        name: row.displayName ?? row.slug ?? "Persisted Service",
        x121: row.x121 ?? "",
        owner: campsite?.displayName ?? row.ownerKind ?? "OMNIDAT",
        category: serviceCategory(row.serviceKind),
        status,
        reachable: row.reachable ?? status === "up",
        verbs: (verbsByServiceId.get(row.id ?? "") ?? []).map((verb) => ({
          name: verb.verb ?? "",
          description: verb.description ?? "",
          inputs: verb.inputs ?? [],
          outputs: verb.outputs ?? [],
        })),
      };
    });

  const auditEvents = auditRows
    .filter((row) => row.eventType)
    .map((row) => ({
      id: row.id ?? `AUDIT-${row.eventType}`,
      eventType: row.eventType ?? "",
      subjectKind: row.subjectKind ?? "unknown",
      subjectId: row.subjectId ?? "",
      details: row.details ?? {},
    }));

  const incidents = incidentRows
    .filter((row) => row.title)
    .map((row) => ({
      id: row.id ?? `INC-${row.title}`,
      title: row.title ?? "",
      severity: row.severity ?? "minor",
      status: row.status ?? "open",
    }));

  const evidenceArtifacts = evidenceRows
    .filter((row) => row.url)
    .map((row) => ({
      id: row.id ?? `ART-${row.url}`,
      artifactKind: row.artifactKind ?? "artifact",
      label: row.label ?? row.url ?? "Evidence Artifact",
      url: row.url ?? "",
      recordCount: row.recordCount ?? null,
      contentType: row.contentType ?? "application/json",
    }));

  const infraEndpoints = infraRows
    .filter((row) => row.label)
    .map((row) => ({
      id: row.id ?? `INFRA-${row.label}`,
      endpointKind: row.endpointKind ?? "endpoint",
      label: row.label ?? "",
      url: row.url ?? null,
      healthStatus: row.healthStatus ?? "unknown",
      owner: row.owner ?? "OMNIDAT",
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
      persistentServices.length > 0 || derivedServices.length > 0
        ? [
            ...seed.services,
            ...[...persistentServices, ...derivedServices].filter(
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
    foodOrders: foodOrders.length > 0 ? foodOrders : seed.foodOrders,
    passportStamps:
      passportStamps.length > 0 ? passportStamps : seed.passportStamps,
    auditEvents: auditEvents.length > 0 ? auditEvents : seed.auditEvents,
    incidents,
    evidenceArtifacts,
    infraEndpoints,
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
  actor?: OmnidatAuditActor,
) {
  if (!db || !databasePersistenceEnabled()) return;
  const rows = projectProvisioningPersistenceRows(result);
  const accountId = await upsertBillingAccount(db, rows.billingAccount);

  await db.insert(omnidatProvisioningRequest).values(rows.provisioningRequest);
  await db.insert(omnidatBillingLedgerEntry).values({
    ...rows.ledgerEntry,
    accountId,
  });
  await db.insert(omnidatAuditEvent).values(withAuditActor(rows.auditEvent, actor));
}

export async function persistPadResult(
  db: OmnidatPersistenceDb | undefined,
  result: PadResult,
  actor?: OmnidatAuditActor,
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
  await db.insert(omnidatAuditEvent).values(withAuditActor(rows.auditEvent, actor));
}

export async function persistAtmResult(
  db: OmnidatPersistenceDb | undefined,
  result: AtmResult,
  actor?: OmnidatAuditActor,
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
  await db.insert(omnidatAuditEvent).values(withAuditActor(rows.auditEvent, actor));
}

export async function persistXotCommandResult(
  db: OmnidatPersistenceDb | undefined,
  input: {
    sourceX121: string;
    command: string;
    result: XotResult;
  },
  actor?: OmnidatAuditActor,
) {
  if (!db || !databasePersistenceEnabled()) return;
  await db
    .insert(omnidatAuditEvent)
    .values(withAuditActor(projectXotCommandPersistenceRows(input).auditEvent, actor));
}

export async function persistFoodOrderResult(
  db: OmnidatPersistenceDb | undefined,
  result: FoodOrderResult,
  actor?: OmnidatAuditActor,
) {
  if (!db || !databasePersistenceEnabled()) return;
  const rows = projectFoodOrderPersistenceRows(result);
  const accountId = await upsertBillingAccount(db, rows.billingAccount);

  await db.insert(omnidatFoodOrder).values(rows.foodOrder);
  await db.insert(omnidatBillingLedgerEntry).values({
    ...rows.ledgerEntry,
    accountId,
  });
  await db.insert(omnidatAuditEvent).values(withAuditActor(rows.auditEvent, actor));
}

export async function persistPassportStampResult(
  db: OmnidatPersistenceDb | undefined,
  result: PassportStampResult,
  actor?: OmnidatAuditActor,
) {
  if (!db || !databasePersistenceEnabled()) return;
  const rows = projectPassportStampPersistenceRows(result);

  await db.insert(omnidatPassportStamp).values(rows.passportStamp);
  await db.insert(omnidatAuditEvent).values(withAuditActor(rows.auditEvent, actor));
}

export async function persistAuditEvent(
  db: OmnidatPersistenceDb | undefined,
  auditEvent: InsertValue<typeof omnidatAuditEvent>,
  actor?: OmnidatAuditActor,
) {
  if (!db || !databasePersistenceEnabled()) return;
  await db.insert(omnidatAuditEvent).values(withAuditActor(auditEvent, actor));
}

type OmnidatSessionDb = OmnidatPersistenceDb & {
  update?: (table: unknown) => {
    set: (value: unknown) => { where: (condition: unknown) => unknown };
  };
};

export type PacketSessionOpenInput = {
  eventId?: string | null;
  serviceId?: string | null;
  sourceIdentity: string;
  sourceTransport: string;
  sourceX121?: string | null;
  destinationX121: string;
};

export type PacketSessionView = {
  id: string;
  eventId: string | null;
  serviceId: string | null;
  sourceIdentity: string;
  sourceTransport: string;
  sourceX121: string | null;
  destinationX121: string;
  status: string;
  clearCause: number | null;
  clearDiagnostic: number | null;
  transcriptHash: string | null;
  evidenceArtifactId: string | null;
};

export async function persistPacketSessionOpen(
  db: OmnidatSessionDb | undefined,
  input: PacketSessionOpenInput,
  actor?: OmnidatAuditActor,
): Promise<PacketSessionView> {
  const row = {
    eventId: input.eventId ?? null,
    serviceId: input.serviceId ?? null,
    sourceIdentity: input.sourceIdentity,
    sourceTransport: input.sourceTransport,
    sourceX121: input.sourceX121 ?? null,
    destinationX121: input.destinationX121,
    status: "connected" as const,
  };
  let id = `session-${input.destinationX121}`;
  if (db && databasePersistenceEnabled()) {
    const insert = db
      .insert(omnidatPacketSession)
      .values(row) as ReturningInsert;
    id = (await returningId(insert, { id: omnidatPacketSession.id })) ?? id;
    await persistAuditEvent(
      db,
      {
        eventType: "session.opened",
        subjectKind: "packet-session",
        subjectId: id,
        details: {
          destinationX121: input.destinationX121,
          sourceTransport: input.sourceTransport,
        },
      },
      actor,
    );
  }
  return { id, clearCause: null, clearDiagnostic: null, transcriptHash: null, evidenceArtifactId: null, ...row };
}

export async function persistPacketSessionClear(
  db: OmnidatSessionDb | undefined,
  input: {
    sessionId: string;
    clearCause: number;
    clearDiagnostic: number;
    transcript: string;
    evidenceArtifactId?: string | null;
  },
  actor?: OmnidatAuditActor,
) {
  const transcriptHash = activationHash(input.transcript);
  if (db && databasePersistenceEnabled() && db.update) {
    await db
      .update(omnidatPacketSession)
      .set({
        status: "cleared",
        clearedAt: new Date(),
        clearCause: input.clearCause,
        clearDiagnostic: input.clearDiagnostic,
        transcriptHash,
        evidenceArtifactId: input.evidenceArtifactId ?? null,
      })
      .where(eq(omnidatPacketSession.id, input.sessionId));
    await persistAuditEvent(
      db,
      {
        eventType: "session.cleared",
        subjectKind: "packet-session",
        subjectId: input.sessionId,
        details: {
          clearCause: input.clearCause,
          clearDiagnostic: input.clearDiagnostic,
        },
      },
      actor,
    );
  }
  return {
    id: input.sessionId,
    status: "cleared" as const,
    clearCause: input.clearCause,
    clearDiagnostic: input.clearDiagnostic,
    transcriptHash,
    evidenceArtifactId: input.evidenceArtifactId ?? null,
  };
}

export async function persistEvidenceArtifact(
  db: OmnidatSessionDb | undefined,
  input: {
    eventId?: string | null;
    artifactKind: string;
    label: string;
    url: string;
    recordCount?: number | null;
    contentType?: string;
    checksum?: string | null;
  },
  actor?: OmnidatAuditActor,
) {
  let id = `artifact-${input.label}`;
  if (db && databasePersistenceEnabled()) {
    const insert = db
      .insert(omnidatEvidenceArtifact)
      .values({
        eventId: input.eventId ?? null,
        artifactKind: input.artifactKind,
        label: input.label,
        url: input.url,
        recordCount: input.recordCount ?? null,
        contentType: input.contentType ?? "application/json",
        checksum: input.checksum ?? null,
      }) as ReturningInsert;
    id = (await returningId(insert, { id: omnidatEvidenceArtifact.id })) ?? id;
    await persistAuditEvent(
      db,
      {
        eventType: "evidence.created",
        subjectKind: "evidence-artifact",
        subjectId: id,
        details: { artifactKind: input.artifactKind, url: input.url },
      },
      actor,
    );
  }
  return { id, artifactKind: input.artifactKind, label: input.label, url: input.url };
}

type EvidenceArtifactRowFull = {
  id?: string;
  eventId?: string | null;
  artifactKind?: string | null;
  label?: string | null;
  url?: string | null;
  recordCount?: number | null;
  contentType?: string | null;
};

export async function loadEvidenceArtifacts(
  db: OmnidatSessionDb | undefined,
  artifactKind?: string,
) {
  if (!db || !databasePersistenceEnabled()) return [];
  const rows = await selectRows<EvidenceArtifactRowFull>(
    db,
    omnidatEvidenceArtifact,
  );
  return rows
    .filter((row) => row.url && (!artifactKind || row.artifactKind === artifactKind))
    .map((row) => ({
      id: row.id ?? `artifact-${row.label}`,
      eventId: row.eventId ?? null,
      artifactKind: row.artifactKind ?? "artifact",
      label: row.label ?? row.url ?? "",
      url: row.url ?? "",
      recordCount: row.recordCount ?? null,
      contentType: row.contentType ?? "application/json",
    }));
}

export async function persistServiceVerbUpsert(
  db: OmnidatSessionDb | undefined,
  input: {
    serviceId: string;
    verb: string;
    description?: string | null;
    inputs?: string[];
    outputs?: string[];
    securityPolicy?: Record<string, unknown>;
  },
  actor?: OmnidatAuditActor,
) {
  if (db && databasePersistenceEnabled()) {
    const insert = db.insert(omnidatServiceVerb).values({
      serviceId: input.serviceId,
      verb: input.verb,
      description: input.description ?? null,
      inputs: input.inputs ?? [],
      outputs: input.outputs ?? [],
      securityPolicy: input.securityPolicy ?? {},
      active: true,
    }) as ReturningInsert;
    await insert.onConflictDoUpdate?.({
      target: [omnidatServiceVerb.serviceId, omnidatServiceVerb.verb],
      set: {
        description: input.description ?? null,
        inputs: input.inputs ?? [],
        outputs: input.outputs ?? [],
        securityPolicy: input.securityPolicy ?? {},
        active: true,
      },
    });
    await persistAuditEvent(
      db,
      {
        eventType: "verb.upserted",
        subjectKind: "service-verb",
        subjectId: `${input.serviceId}:${input.verb}`,
        details: { verb: input.verb },
      },
      actor,
    );
  }
  return { serviceId: input.serviceId, verb: input.verb, active: true };
}

export async function persistServiceVerbDisable(
  db: OmnidatSessionDb | undefined,
  input: { serviceId: string; verb: string },
  actor?: OmnidatAuditActor,
) {
  if (db && databasePersistenceEnabled() && db.update) {
    await db
      .update(omnidatServiceVerb)
      .set({ active: false })
      .where(eq(omnidatServiceVerb.verb, input.verb));
    await persistAuditEvent(
      db,
      {
        eventType: "verb.disabled",
        subjectKind: "service-verb",
        subjectId: `${input.serviceId}:${input.verb}`,
        details: { verb: input.verb },
      },
      actor,
    );
  }
  return { serviceId: input.serviceId, verb: input.verb, active: false };
}

type PacketSessionRow = {
  id?: string;
  eventId?: string | null;
  serviceId?: string | null;
  sourceIdentity?: string | null;
  sourceTransport?: string | null;
  sourceX121?: string | null;
  destinationX121?: string | null;
  status?: string | null;
  clearCause?: number | null;
  clearDiagnostic?: number | null;
  transcriptHash?: string | null;
  evidenceArtifactId?: string | null;
};

export async function loadPacketSessions(
  db: OmnidatSessionDb | undefined,
): Promise<PacketSessionView[]> {
  if (!db || !databasePersistenceEnabled()) return [];
  const rows = await selectRows<PacketSessionRow>(db, omnidatPacketSession);
  return rows
    .filter((row) => row.destinationX121)
    .map((row) => ({
      id: row.id ?? `session-${row.destinationX121}`,
      eventId: row.eventId ?? null,
      serviceId: row.serviceId ?? null,
      sourceIdentity: row.sourceIdentity ?? "",
      sourceTransport: row.sourceTransport ?? "",
      sourceX121: row.sourceX121 ?? null,
      destinationX121: row.destinationX121 ?? "",
      status: row.status ?? "connected",
      clearCause: row.clearCause ?? null,
      clearDiagnostic: row.clearDiagnostic ?? null,
      transcriptHash: row.transcriptHash ?? null,
      evidenceArtifactId: row.evidenceArtifactId ?? null,
    }));
}

// --- H1b operator CRUD helpers ---------------------------------------------

async function auditedInsert(
  db: OmnidatSessionDb | undefined,
  table: unknown,
  idColumn: unknown,
  values: Record<string, unknown>,
  audit: { eventType: string; subjectKind: string; details?: Record<string, unknown> },
  actor?: OmnidatAuditActor,
  fallbackId = "row",
): Promise<string> {
  let id = fallbackId;
  if (db && databasePersistenceEnabled()) {
    const insert = db.insert(table).values(values) as ReturningInsert;
    id = (await returningId(insert, { id: idColumn })) ?? id;
    await persistAuditEvent(
      db,
      {
        eventType: audit.eventType,
        subjectKind: audit.subjectKind,
        subjectId: id,
        details: audit.details ?? {},
      },
      actor,
    );
  }
  return id;
}

async function auditedUpdate(
  db: OmnidatSessionDb | undefined,
  table: unknown,
  idColumn: unknown,
  id: string,
  values: Record<string, unknown>,
  audit: { eventType: string; subjectKind: string; details?: Record<string, unknown> },
  actor?: OmnidatAuditActor,
) {
  if (db && databasePersistenceEnabled() && db.update) {
    await db.update(table).set(values).where(eq(idColumn as never, id));
    await persistAuditEvent(
      db,
      {
        eventType: audit.eventType,
        subjectKind: audit.subjectKind,
        subjectId: id,
        details: audit.details ?? {},
      },
      actor,
    );
  }
  return { id, ...values };
}

export async function persistEventCreate(
  db: OmnidatSessionDb | undefined,
  input: {
    eventCode: string;
    displayName: string;
    eventKind?: string;
    startsAt?: string | null;
    endsAt?: string | null;
  },
  actor?: OmnidatAuditActor,
) {
  const id = await auditedInsert(
    db,
    omnidatEvent,
    omnidatEvent.id,
    {
      eventCode: input.eventCode,
      displayName: input.displayName,
      eventKind: input.eventKind ?? "hackercamp",
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
    },
    { eventType: "event.created", subjectKind: "event", details: { eventCode: input.eventCode } },
    actor,
    `event-${input.eventCode}`,
  );
  return { id, eventCode: input.eventCode, displayName: input.displayName, status: "planning" };
}

export async function persistEventStatus(
  db: OmnidatSessionDb | undefined,
  input: { eventId: string; status: string },
  actor?: OmnidatAuditActor,
) {
  return auditedUpdate(
    db,
    omnidatEvent,
    omnidatEvent.id,
    input.eventId,
    { status: input.status },
    { eventType: "event.status.changed", subjectKind: "event", details: { status: input.status } },
    actor,
  );
}

export async function persistCampsiteCreate(
  db: OmnidatSessionDb | undefined,
  input: {
    namespace?: string;
    slug: string;
    displayName: string;
    contactHandle: string;
  },
  actor?: OmnidatAuditActor,
) {
  const id = await auditedInsert(
    db,
    omnidatCampsite,
    omnidatCampsite.id,
    {
      namespace: input.namespace ?? "camp",
      slug: input.slug,
      displayName: input.displayName,
      contactHandle: input.contactHandle,
    },
    { eventType: "campsite.created", subjectKind: "campsite", details: { slug: input.slug } },
    actor,
    `campsite-${input.slug}`,
  );
  return { id, slug: input.slug, displayName: input.displayName, status: "pending" };
}

export async function persistCampsiteStatus(
  db: OmnidatSessionDb | undefined,
  input: { campsiteId: string; status: string },
  actor?: OmnidatAuditActor,
) {
  return auditedUpdate(
    db,
    omnidatCampsite,
    omnidatCampsite.id,
    input.campsiteId,
    { status: input.status },
    { eventType: "campsite.status.changed", subjectKind: "campsite", details: { status: input.status } },
    actor,
  );
}

export async function persistAllocationAssign(
  db: OmnidatSessionDb | undefined,
  input: {
    networkId?: string | null;
    x121: string;
    assignedToKind: string;
    assignedToId?: string | null;
    namespace?: string;
  },
  actor?: OmnidatAuditActor,
) {
  const id = await auditedInsert(
    db,
    omnidatAddressAllocation,
    omnidatAddressAllocation.id,
    {
      networkId: input.networkId ?? null,
      x121: input.x121,
      assignedToKind: input.assignedToKind,
      assignedToId: input.assignedToId ?? null,
      namespace: input.namespace ?? "camp",
      status: "reserved",
    },
    { eventType: "allocation.assigned", subjectKind: "x121", details: { x121: input.x121 } },
    actor,
    `allocation-${input.x121}`,
  );
  return { id, x121: input.x121, status: "reserved" };
}

export async function persistAllocationStatus(
  db: OmnidatSessionDb | undefined,
  input: { allocationId: string; x121: string; status: string },
  actor?: OmnidatAuditActor,
) {
  return auditedUpdate(
    db,
    omnidatAddressAllocation,
    omnidatAddressAllocation.id,
    input.allocationId,
    { status: input.status },
    { eventType: "allocation.status.changed", subjectKind: "x121", details: { x121: input.x121, status: input.status } },
    actor,
  );
}

async function loadRows(db: OmnidatSessionDb | undefined, table: unknown) {
  if (!db || !databasePersistenceEnabled()) return [];
  return selectRows<Record<string, unknown>>(db, table);
}

function str(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

export async function loadEvents(db: OmnidatSessionDb | undefined) {
  return (await loadRows(db, omnidatEvent)).map((row) => ({
    id: str(row.id, `event-${str(row.eventCode)}`),
    eventCode: str(row.eventCode),
    displayName: str(row.displayName),
    status: str(row.status, "planning"),
  }));
}

export async function loadCampsites(db: OmnidatSessionDb | undefined) {
  return (await loadRows(db, omnidatCampsite)).map((row) => ({
    id: str(row.id, `campsite-${str(row.slug)}`),
    namespace: str(row.namespace, "camp"),
    slug: str(row.slug),
    displayName: str(row.displayName),
    status: str(row.status, "pending"),
  }));
}

export async function loadAllocations(
  db: OmnidatSessionDb | undefined,
  status?: string,
) {
  return (await loadRows(db, omnidatAddressAllocation))
    .filter((row) => row.x121 && (!status || row.status === status))
    .map((row) => ({
      id: str(row.id, `allocation-${str(row.x121)}`),
      x121: str(row.x121),
      assignedToKind: str(row.assignedToKind),
      namespace: str(row.namespace, "camp"),
      status: str(row.status, "reserved"),
    }));
}

// --- H1b provisioning lifecycle, incidents, billing, roles, export ---------

export const PROVISIONING_STATES = [
  "requested",
  "reviewed",
  "approved",
  "assigned",
  "installed",
  "verified",
  "active",
] as const;

const TERMINAL_STATES = ["suspended", "revoked"] as const;

export function isLegalProvisioningTransition(from: string, to: string) {
  if (TERMINAL_STATES.includes(to as (typeof TERMINAL_STATES)[number])) {
    // Suspend/revoke is legal from any non-terminal state.
    return !TERMINAL_STATES.includes(from as (typeof TERMINAL_STATES)[number]);
  }
  const fromIndex = PROVISIONING_STATES.indexOf(from as (typeof PROVISIONING_STATES)[number]);
  const toIndex = PROVISIONING_STATES.indexOf(to as (typeof PROVISIONING_STATES)[number]);
  return fromIndex >= 0 && toIndex === fromIndex + 1;
}

export async function persistProvisioningRequest(
  db: OmnidatSessionDb | undefined,
  input: { campsiteId?: string | null; serviceId?: string | null; transport: string; requestedX121?: string | null },
  actor?: OmnidatAuditActor,
) {
  const id = await auditedInsert(
    db,
    omnidatProvisioningRequest,
    omnidatProvisioningRequest.id,
    {
      campsiteId: input.campsiteId ?? null,
      serviceId: input.serviceId ?? null,
      transport: input.transport,
      requestedX121: input.requestedX121 ?? null,
      status: "requested",
    },
    { eventType: "provisioning.requested", subjectKind: "provisioning", details: { transport: input.transport } },
    actor,
    "provisioning-request",
  );
  return { id, status: "requested" as const };
}

export async function loadProvisioningRow(
  db: OmnidatSessionDb | undefined,
  requestId: string,
) {
  const rows = await loadRows(db, omnidatProvisioningRequest);
  return rows.find((row) => (row.id ?? "") === requestId);
}

export class IllegalProvisioningTransition extends Error {}

export async function persistProvisioningAdvance(
  db: OmnidatSessionDb | undefined,
  input: { requestId: string; toStatus: string; verificationTranscript?: string | null },
  actor?: OmnidatAuditActor,
) {
  const row = await loadProvisioningRow(db, input.requestId);
  const from = (row?.status as string | undefined) ?? "requested";
  if (!isLegalProvisioningTransition(from, input.toStatus)) {
    throw new IllegalProvisioningTransition(
      `illegal provisioning transition ${from} -> ${input.toStatus}`,
    );
  }
  const values: Record<string, unknown> = { status: input.toStatus };
  if (input.toStatus === "verified") {
    values.verificationTranscript = input.verificationTranscript ?? null;
    values.verifiedAt = new Date();
  }
  await auditedUpdate(
    db,
    omnidatProvisioningRequest,
    omnidatProvisioningRequest.id,
    input.requestId,
    values,
    { eventType: `provisioning.${input.toStatus}`, subjectKind: "provisioning", details: { from, to: input.toStatus } },
    actor,
  );
  return { id: input.requestId, status: input.toStatus, from };
}

export async function loadProvisioning(db: OmnidatSessionDb | undefined) {
  return (await loadRows(db, omnidatProvisioningRequest)).map((row) => ({
    id: row.id ?? "provisioning",
    transport: row.transport ?? "",
    status: row.status ?? "requested",
    assignedX121: row.assignedX121 ?? null,
  }));
}

export async function persistIncidentOpen(
  db: OmnidatSessionDb | undefined,
  input: { networkId?: string | null; serviceId?: string | null; title: string; severity?: string },
  actor?: OmnidatAuditActor,
) {
  const id = await auditedInsert(
    db,
    omnidatNocIncident,
    omnidatNocIncident.id,
    {
      networkId: input.networkId ?? null,
      serviceId: input.serviceId ?? null,
      title: input.title,
      severity: input.severity ?? "minor",
      status: "open",
    },
    { eventType: "incident.opened", subjectKind: "incident", details: { title: input.title } },
    actor,
    "incident",
  );
  return { id, title: input.title, status: "open" as const };
}

export async function persistIncidentUpdate(
  db: OmnidatSessionDb | undefined,
  input: { incidentId: string; status: string },
  actor?: OmnidatAuditActor,
) {
  const values: Record<string, unknown> = { status: input.status };
  if (input.status === "resolved") values.resolvedAt = new Date();
  return auditedUpdate(
    db,
    omnidatNocIncident,
    omnidatNocIncident.id,
    input.incidentId,
    values,
    { eventType: `incident.${input.status}`, subjectKind: "incident", details: { status: input.status } },
    actor,
  );
}

export async function persistBillingAccountCreate(
  db: OmnidatSessionDb | undefined,
  input: { externalAccountId: string; accountType: string; displayName: string; provider?: string },
  actor?: OmnidatAuditActor,
) {
  const id = await auditedInsert(
    db,
    omnidatBillingAccount,
    omnidatBillingAccount.id,
    {
      provider: input.provider ?? "ShadyBucks",
      externalAccountId: input.externalAccountId,
      accountType: input.accountType,
      displayName: input.displayName,
      status: "pending",
    },
    { eventType: "billing.account.created", subjectKind: "billing-account", details: { externalAccountId: input.externalAccountId } },
    actor,
    "billing-account",
  );
  return { id, externalAccountId: input.externalAccountId };
}

export async function persistFeePolicy(
  db: OmnidatSessionDb | undefined,
  input: { accountId: string; policyKind: string; amount?: number; memo?: string },
  actor?: OmnidatAuditActor,
) {
  if (db && databasePersistenceEnabled()) {
    await db.insert(omnidatBillingLedgerEntry).values({
      accountId: input.accountId,
      entryKind: "fee-policy",
      amount: input.amount ?? 0,
      currency: "SHDY",
      memo: input.memo ?? `fee policy: ${input.policyKind}`,
    });
    await persistAuditEvent(
      db,
      {
        eventType: "fee.policy.set",
        subjectKind: "billing-account",
        subjectId: input.accountId,
        details: { policyKind: input.policyKind, amount: input.amount ?? 0 },
      },
      actor,
    );
  }
  return { accountId: input.accountId, policyKind: input.policyKind };
}

export async function loadOperatorRoleGrants(db: OmnidatSessionDb | undefined) {
  return (await loadRows(db, omnidatOperatorRole))
    .filter((row) => row.active !== false)
    .map((row) => ({
      userId: row.userId ?? "",
      role: row.role ?? "",
      eventId: row.eventId ?? null,
    }));
}

export async function persistEventEvidenceExport(
  db: OmnidatSessionDb | undefined,
  input: { eventId?: string | null; label: string; url: string; recordCount?: number },
  actor?: OmnidatAuditActor,
) {
  const artifact = await persistEvidenceArtifact(
    db,
    {
      eventId: input.eventId ?? null,
      artifactKind: "event-export",
      label: input.label,
      url: input.url,
      recordCount: input.recordCount ?? null,
      contentType: "application/json",
    },
    actor,
  );
  await persistAuditEvent(
    db,
    {
      eventType: "evidence.exported",
      subjectKind: "event",
      subjectId: input.eventId ?? artifact.id,
      details: { label: input.label },
    },
    actor,
  );
  return artifact;
}

// --- H3 camp utility apps --------------------------------------------------

export const CAMP_APP_KINDS = [
  "bulletin",
  "message-desk",
  "lost-property",
  "classifieds",
  "queue",
  "form-intake",
  "puzzle-node",
  "remote-print",
] as const;

export type CampAppKind = (typeof CAMP_APP_KINDS)[number];

export function isCampAppKind(value: string): value is CampAppKind {
  return (CAMP_APP_KINDS as readonly string[]).includes(value);
}

export async function persistCampsiteAppCreate(
  db: OmnidatSessionDb | undefined,
  input: { campsiteId: string; address: string; name: string; appKind: string },
  actor?: OmnidatAuditActor,
) {
  const id = await auditedInsert(
    db,
    omnidatCampsiteApp,
    omnidatCampsiteApp.id,
    {
      campsiteId: input.campsiteId,
      address: input.address,
      name: input.name,
      appKind: input.appKind,
      status: "active",
    },
    { eventType: "campsite.app.created", subjectKind: "campsite-app", details: { appKind: input.appKind, address: input.address } },
    actor,
    `campsite-app-${input.address}`,
  );
  return { id, address: input.address, appKind: input.appKind, status: "active" };
}

export async function persistCampsiteAppStatus(
  db: OmnidatSessionDb | undefined,
  input: { appId: string; status: string },
  actor?: OmnidatAuditActor,
) {
  return auditedUpdate(
    db,
    omnidatCampsiteApp,
    omnidatCampsiteApp.id,
    input.appId,
    { status: input.status },
    { eventType: "campsite.app.status.changed", subjectKind: "campsite-app", details: { status: input.status } },
    actor,
  );
}

export async function loadCampsiteApps(
  db: OmnidatSessionDb | undefined,
  campsiteId?: string,
) {
  return (await loadRows(db, omnidatCampsiteApp))
    .filter((row) => row.address && (!campsiteId || row.campsiteId === campsiteId))
    .map((row) => ({
      id: str(row.id, `campsite-app-${str(row.address)}`),
      campsiteId: str(row.campsiteId),
      address: str(row.address),
      name: str(row.name),
      appKind: str(row.appKind),
      status: str(row.status, "active"),
    }));
}
