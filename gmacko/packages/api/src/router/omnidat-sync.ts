import {
  omnidatEventAuthority,
  omnidatJournalEntry,
  omnidatSyncSource,
} from "@omnidat/db/schema";
import { eq } from "@omnidat/db";
import { createHash } from "node:crypto";

import type { OmnidatPersistenceDb } from "./omnidat-persistence";
import {
  databasePersistenceEnabled,
  persistAtmResult,
  persistAuditEvent,
  persistFoodOrderResult,
  persistPadResult,
  persistPassportStampResult,
  persistProvisioningResult,
  persistXotCommandResult,
} from "./omnidat-persistence";

export type OmnidatSyncDb = OmnidatPersistenceDb & {
  update?: (table: unknown) => {
    set: (value: unknown) => {
      where: (condition: unknown) => Promise<unknown> | unknown;
    };
  };
};

export type JournalEntryInput = {
  seq: number;
  eventId?: string | null;
  epoch: number;
  opType: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  payloadChecksum: string;
  recordedAt: string | Date;
};

export type JournalAuthority = {
  holder: string;
  holderSourceId: string;
  epoch: number;
  fenceSeq: number | null;
};

export type ReconciliationReport = {
  applied: number;
  duplicate: number;
  rejectedStale: number;
  quarantined: number;
  highWatermark: number;
  authority: { holder: string; epoch: number };
};

type AuthorityRow = {
  eventId?: string | null;
  epoch?: number | null;
  holder?: string | null;
  holderSourceId?: string | null;
  fenceSeq?: number | null;
};

type JournalRow = {
  sourceId?: string | null;
  seq?: number | null;
  idempotencyKey?: string | null;
};

const DEFAULT_AUTHORITY: JournalAuthority = {
  holder: "cloud",
  holderSourceId: "cloud",
  epoch: 0,
  fenceSeq: null,
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function journalPayloadChecksum(payload: Record<string, unknown>) {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

async function selectRows<T>(db: OmnidatSyncDb, table: unknown) {
  if (!db.select) return [] as T[];
  return (await db.select().from(table)) as T[];
}

async function loadAuthorityRows(db: OmnidatSyncDb) {
  return selectRows<AuthorityRow>(db, omnidatEventAuthority);
}

function authorityFromRows(
  rows: AuthorityRow[],
  eventId: string | null | undefined,
): JournalAuthority {
  const eventRows = rows.filter((row) => (row.eventId ?? null) === (eventId ?? null));
  const current = eventRows.reduce<AuthorityRow | undefined>(
    (best, row) =>
      (row.epoch ?? 0) > (best?.epoch ?? Number.NEGATIVE_INFINITY) ? row : best,
    undefined,
  );
  if (!current) return DEFAULT_AUTHORITY;
  return {
    holder: current.holder ?? "cloud",
    holderSourceId: current.holderSourceId ?? "cloud",
    epoch: current.epoch ?? 0,
    fenceSeq: current.fenceSeq ?? null,
  };
}

function epochHolderRow(
  rows: AuthorityRow[],
  eventId: string | null | undefined,
  epoch: number,
) {
  return rows.find(
    (row) => (row.eventId ?? null) === (eventId ?? null) && row.epoch === epoch,
  );
}

function fenceForEpoch(
  rows: AuthorityRow[],
  eventId: string | null | undefined,
  epoch: number,
) {
  // The fence for epoch N is recorded on the epoch N+1 authority row at
  // transfer time: the highest sequence received from the outgoing holder.
  return (
    epochHolderRow(rows, eventId, epoch + 1)?.fenceSeq ?? null
  );
}

export async function getCurrentAuthority(
  db: OmnidatSyncDb | undefined,
  eventId: string | null | undefined,
): Promise<JournalAuthority> {
  if (!db) return DEFAULT_AUTHORITY;
  return authorityFromRows(await loadAuthorityRows(db), eventId);
}

type OpApplier = (
  db: OmnidatPersistenceDb,
  payload: Record<string, unknown>,
) => Promise<void>;

const OP_APPLIERS: Record<string, OpApplier> = {
  "food.order.created": (db, payload) =>
    persistFoodOrderResult(
      db,
      payload as unknown as Parameters<typeof persistFoodOrderResult>[1],
    ),
  "passport.stamped": (db, payload) =>
    persistPassportStampResult(
      db,
      payload as unknown as Parameters<typeof persistPassportStampResult>[1],
    ),
  "provisioning.verified": (db, payload) =>
    persistProvisioningResult(
      db,
      payload as unknown as Parameters<typeof persistProvisioningResult>[1],
    ),
  "pad.configured": (db, payload) =>
    persistPadResult(
      db,
      payload as unknown as Parameters<typeof persistPadResult>[1],
    ),
  "atm.activated": (db, payload) =>
    persistAtmResult(
      db,
      payload as unknown as Parameters<typeof persistAtmResult>[1],
    ),
  "xot.command": (db, payload) =>
    persistXotCommandResult(
      db,
      payload as unknown as Parameters<typeof persistXotCommandResult>[1],
    ),
};

async function dispatchOp(
  db: OmnidatSyncDb,
  sourceId: string,
  entry: JournalEntryInput,
) {
  const applier = OP_APPLIERS[entry.opType];
  if (applier) {
    await applier(db, entry.payload);
    return;
  }
  // Unknown op types are never lost: they land as audit events for operator
  // review while remaining replayable from the journal row.
  await persistAuditEvent(db, {
    eventType: entry.opType,
    subjectKind: "journal-op",
    subjectId: entry.idempotencyKey,
    details: {
      sourceId,
      seq: entry.seq,
      eventId: entry.eventId ?? null,
      payload: entry.payload,
    },
  });
}

function insertJournalRow(
  db: OmnidatSyncDb,
  sourceId: string,
  entry: JournalEntryInput,
  applyStatus: "applied" | "quarantined",
) {
  db.insert(omnidatJournalEntry).values({
    sourceId,
    seq: entry.seq,
    eventId: entry.eventId ?? null,
    epoch: entry.epoch,
    opType: entry.opType,
    payload: entry.payload,
    idempotencyKey: entry.idempotencyKey,
    payloadChecksum: entry.payloadChecksum,
    recordedAt: new Date(entry.recordedAt),
    applyStatus,
    appliedAt: applyStatus === "applied" ? new Date() : null,
  });
}

async function touchSyncSource(
  db: OmnidatSyncDb,
  sourceId: string,
  lastPushedSeq: number,
) {
  if (!db.update) return;
  await db
    .update(omnidatSyncSource)
    .set({ lastPushedSeq, lastSyncAt: new Date() })
    .where(eq(omnidatSyncSource.sourceId, sourceId));
}

export async function applyJournalBatch(
  db: OmnidatSyncDb | undefined,
  batch: { sourceId: string; entries: JournalEntryInput[] },
): Promise<ReconciliationReport> {
  const report: ReconciliationReport = {
    applied: 0,
    duplicate: 0,
    rejectedStale: 0,
    quarantined: 0,
    highWatermark: 0,
    authority: { holder: DEFAULT_AUTHORITY.holder, epoch: DEFAULT_AUTHORITY.epoch },
  };
  if (!db || !databasePersistenceEnabled()) return report;

  const journalRows = await selectRows<JournalRow>(db, omnidatJournalEntry);
  const authorityRows = await loadAuthorityRows(db);
  const seenKeys = new Set(
    journalRows
      .map((row) => row.idempotencyKey)
      .filter((key): key is string => Boolean(key)),
  );
  let highWatermark = journalRows
    .filter((row) => row.sourceId === batch.sourceId)
    .reduce((max, row) => Math.max(max, row.seq ?? 0), 0);

  const entries = [...batch.entries].sort((left, right) => left.seq - right.seq);

  for (const entry of entries) {
    const authority = authorityFromRows(authorityRows, entry.eventId);
    report.authority = { holder: authority.holder, epoch: authority.epoch };

    if (seenKeys.has(entry.idempotencyKey)) {
      report.duplicate += 1;
      continue;
    }

    if (entry.epoch > authority.epoch) {
      report.rejectedStale += 1;
      continue;
    }

    const isCurrentHolder =
      entry.epoch === authority.epoch &&
      batch.sourceId === authority.holderSourceId;
    const pastHolder = epochHolderRow(authorityRows, entry.eventId, entry.epoch);
    const fence = fenceForEpoch(authorityRows, entry.eventId, entry.epoch);
    const isFencedHistory =
      entry.epoch < authority.epoch &&
      pastHolder?.holderSourceId === batch.sourceId &&
      fence !== null &&
      entry.seq <= fence;

    if (isCurrentHolder || isFencedHistory) {
      await dispatchOp(db, batch.sourceId, entry);
      insertJournalRow(db, batch.sourceId, entry, "applied");
      seenKeys.add(entry.idempotencyKey);
      highWatermark = Math.max(highWatermark, entry.seq);
      report.applied += 1;
      continue;
    }

    insertJournalRow(db, batch.sourceId, entry, "quarantined");
    seenKeys.add(entry.idempotencyKey);
    highWatermark = Math.max(highWatermark, entry.seq);
    report.rejectedStale += 1;
    report.quarantined += 1;
  }

  report.highWatermark = highWatermark;
  await touchSyncSource(db, batch.sourceId, highWatermark);
  return report;
}

export async function appendCloudJournalEntry(
  db: OmnidatSyncDb | undefined,
  input: {
    eventId?: string | null;
    opType: string;
    payload: Record<string, unknown>;
  },
) {
  if (!db || !databasePersistenceEnabled()) return undefined;

  const authority = await getCurrentAuthority(db, input.eventId ?? null);
  if (authority.holder !== "cloud") {
    throw new Error(
      `cloud is not the authority holder for event ${input.eventId ?? "(none)"}; ` +
        `current holder is ${authority.holder} (epoch ${authority.epoch})`,
    );
  }

  const journalRows = await selectRows<JournalRow>(db, omnidatJournalEntry);
  const seq =
    journalRows
      .filter((row) => row.sourceId === "cloud")
      .reduce((max, row) => Math.max(max, row.seq ?? 0), 0) + 1;

  const entry = {
    sourceId: "cloud",
    seq,
    eventId: input.eventId ?? null,
    epoch: authority.epoch,
    opType: input.opType,
    payload: input.payload,
    idempotencyKey: `cloud:${seq}`,
    payloadChecksum: journalPayloadChecksum(input.payload),
    recordedAt: new Date(),
    applyStatus: "applied" as const,
    appliedAt: new Date(),
  };
  db.insert(omnidatJournalEntry).values(entry);
  return entry;
}
