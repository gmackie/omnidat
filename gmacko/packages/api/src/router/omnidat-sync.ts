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

type SyncSourceRow = {
  sourceId?: string | null;
  sourceKind?: string | null;
  tokenHash?: string | null;
  lastPushedSeq?: number | null;
  lastSyncAt?: Date | string | null;
  active?: boolean | null;
};

export async function verifySyncToken(
  db: OmnidatSyncDb | undefined,
  token: string,
  sourceId?: string,
) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const sources = db
    ? await selectRows<SyncSourceRow>(db, omnidatSyncSource)
    : [];
  const match = sources.find(
    (row) =>
      row.active !== false &&
      row.tokenHash === tokenHash &&
      (sourceId === undefined || row.sourceId === sourceId),
  );
  if (!match) {
    throw new Error(
      `invalid sync token${sourceId ? ` for source ${sourceId}` : ""}`,
    );
  }
  return match;
}

export type SyncStatus = {
  holder: string;
  epoch: number;
  sourceId: string | null;
  lastSyncAt: Date | null;
  stalenessSeconds: number | null;
};

/**
 * Server-computed sync status for dashboards. Staleness is measured against a
 * server-supplied `now`, never the browser clock, so stale field data is never
 * presented as live. Returns the freshest field-kit source while the field
 * holds authority; reports cloud authority otherwise.
 */
export async function computeSyncStatus(
  db: OmnidatSyncDb | undefined,
  eventId: string | null | undefined,
  now: Date = new Date(),
): Promise<SyncStatus> {
  const authority = await getCurrentAuthority(db, eventId);
  const sources = await listSyncSources(db);
  const holderSource =
    authority.holder === "field"
      ? sources
          .filter((source) => source.sourceId === authority.holderSourceId)
          .concat(sources.filter((source) => source.sourceKind === "field-kit"))[0]
      : undefined;

  const lastSyncAt = holderSource?.lastSyncAt
    ? new Date(holderSource.lastSyncAt)
    : null;
  const stalenessSeconds = lastSyncAt
    ? Math.max(0, Math.round((now.getTime() - lastSyncAt.getTime()) / 1000))
    : null;

  return {
    holder: authority.holder,
    epoch: authority.epoch,
    sourceId: holderSource?.sourceId ?? null,
    lastSyncAt,
    stalenessSeconds,
  };
}

export async function listSyncSources(db: OmnidatSyncDb | undefined) {
  if (!db) return [];
  const rows = await selectRows<SyncSourceRow>(db, omnidatSyncSource);
  return rows.map((row) => ({
    sourceId: row.sourceId ?? "",
    sourceKind: row.sourceKind ?? "field-kit",
    lastPushedSeq: row.lastPushedSeq ?? 0,
    lastSyncAt: row.lastSyncAt ?? null,
    active: row.active !== false,
  }));
}

/**
 * Register (or rotate) a field-kit / sim sync source. Returns the plaintext
 * sync token once — only the SHA-256 hash is stored. Gated by the caller
 * (authority.transfer / admin).
 */
export async function registerSyncSource(
  db: OmnidatSyncDb | undefined,
  input: {
    sourceId: string;
    sourceKind?: "field-kit" | "sim-field-kit" | "cloud";
    operatorId: string;
  },
) {
  if (!db || !databasePersistenceEnabled()) {
    throw new Error("sync source registration requires database persistence");
  }

  const sourceKind = input.sourceKind ?? "field-kit";
  const syncToken = createHash("sha256")
    .update(
      `omnidat-sync:${input.sourceId}:${input.operatorId}:${Date.now()}:${Math.random()}`,
    )
    .digest("hex");
  const tokenHash = createHash("sha256").update(syncToken).digest("hex");

  const existing = (await selectRows<SyncSourceRow>(db, omnidatSyncSource)).find(
    (row) => row.sourceId === input.sourceId,
  );

  if (existing && db.update) {
    await db
      .update(omnidatSyncSource)
      .set({
        tokenHash,
        sourceKind,
        active: true,
      })
      .where(eq(omnidatSyncSource.sourceId, input.sourceId));
  } else {
    db.insert(omnidatSyncSource).values({
      sourceId: input.sourceId,
      sourceKind,
      tokenHash,
      lastPushedSeq: 0,
      active: true,
    });
  }

  await persistAuditEvent(db, {
    eventType: existing
      ? "sync.source.rotated"
      : "sync.source.registered",
    subjectKind: "sync-source",
    subjectId: input.sourceId,
    details: {
      sourceKind,
      operatorId: input.operatorId,
      rotated: Boolean(existing),
    },
  });

  return {
    sourceId: input.sourceId,
    sourceKind,
    syncToken,
    rotated: Boolean(existing),
  };
}

type PullRow = JournalRow & {
  eventId?: string | null;
  epoch?: number | null;
  opType?: string | null;
  payload?: Record<string, unknown> | null;
  payloadChecksum?: string | null;
  recordedAt?: Date | string | null;
  applyStatus?: string | null;
};

export async function pullJournalEntries(
  db: OmnidatSyncDb | undefined,
  input: { sourceId: string; watermarks: Record<string, number> },
) {
  if (!db) return [];
  const rows = await selectRows<PullRow>(db, omnidatJournalEntry);
  return rows
    .filter(
      (row) =>
        row.sourceId &&
        row.sourceId !== input.sourceId &&
        (row.seq ?? 0) > (input.watermarks[row.sourceId] ?? 0),
    )
    .sort((left, right) =>
      left.sourceId === right.sourceId
        ? (left.seq ?? 0) - (right.seq ?? 0)
        : String(left.sourceId).localeCompare(String(right.sourceId)),
    );
}

export async function transferEventAuthority(
  db: OmnidatSyncDb | undefined,
  input: {
    eventId: string;
    toHolder: "field" | "cloud";
    toSourceId: string;
    reason: string;
    operatorId: string;
    targetWatermarks?: Record<string, number>;
  },
) {
  if (!db || !databasePersistenceEnabled()) {
    throw new Error("authority transfers require database persistence");
  }

  const authorityRows = await loadAuthorityRows(db);
  const current = authorityFromRows(authorityRows, input.eventId);
  const journalRows = await selectRows<JournalRow>(db, omnidatJournalEntry);

  if (input.toHolder !== "cloud") {
    // A rejoining field kit must have pulled every other source's tail before
    // it can take authority back; otherwise it would write on top of history
    // it has never seen.
    const watermarks = input.targetWatermarks ?? {};
    const maxSeqBySource = new Map<string, number>();
    for (const row of journalRows) {
      if (!row.sourceId || row.sourceId === input.toSourceId) continue;
      maxSeqBySource.set(
        row.sourceId,
        Math.max(maxSeqBySource.get(row.sourceId) ?? 0, row.seq ?? 0),
      );
    }
    for (const [sourceId, maxSeq] of maxSeqBySource) {
      if ((watermarks[sourceId] ?? 0) < maxSeq) {
        throw new Error(
          `transfer refused: ${input.toSourceId} has not caught up to the ` +
            `${sourceId} watermark (${watermarks[sourceId] ?? 0} < ${maxSeq})`,
        );
      }
    }
  }

  const fenceSeq = journalRows
    .filter((row) => row.sourceId === current.holderSourceId)
    .reduce((max, row) => Math.max(max, row.seq ?? 0), 0);
  const epoch = current.epoch + 1;

  db.insert(omnidatEventAuthority).values({
    eventId: input.eventId,
    epoch,
    holder: input.toHolder,
    holderSourceId: input.toSourceId,
    fenceSeq,
    reason: input.reason,
  });
  await persistAuditEvent(db, {
    eventType: "authority.transferred",
    subjectKind: "event",
    subjectId: input.eventId,
    details: {
      fromHolder: current.holder,
      fromSourceId: current.holderSourceId,
      toHolder: input.toHolder,
      toSourceId: input.toSourceId,
      epoch,
      fenceSeq,
      reason: input.reason,
      operatorId: input.operatorId,
    },
  });

  return {
    eventId: input.eventId,
    epoch,
    holder: input.toHolder,
    holderSourceId: input.toSourceId,
    fenceSeq,
  };
}

export async function journalCloudWrite(
  db: OmnidatSyncDb | undefined,
  input: {
    eventId?: string | null;
    opType: string;
    payload: Record<string, unknown>;
  },
) {
  if (!db || !databasePersistenceEnabled()) return undefined;
  const authority = await getCurrentAuthority(db, input.eventId ?? null);
  if (authority.holder !== "cloud") return undefined;
  return appendCloudJournalEntry(db, input);
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
