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
  provisionCampsiteService,
  setupAtmTerminal,
} from "@omnidat/operator-core/omnidat";
import { createHash } from "node:crypto";

type ProvisioningResult = ReturnType<typeof provisionCampsiteService>;
type PadResult = ReturnType<typeof configurePad>;
type AtmResult = ReturnType<typeof setupAtmTerminal>;
type XotResult = ReturnType<typeof executeXotCommand>;

type InsertValue<T> = T extends { $inferInsert: infer U } ? U : never;

export type OmnidatPersistenceDb = {
  insert: (table: unknown) => {
    values: (value: unknown) => {
      onConflictDoUpdate?: (config: unknown) => unknown;
      returning?: (fields?: unknown) => Promise<unknown[]>;
    };
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

export async function persistAuditEvent(
  db: OmnidatPersistenceDb | undefined,
  auditEvent: InsertValue<typeof omnidatAuditEvent>,
) {
  if (!db || !databasePersistenceEnabled()) return;
  await db.insert(omnidatAuditEvent).values(auditEvent);
}
