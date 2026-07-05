import {
  omnidatAuditEvent,
  omnidatEventAuthority,
  omnidatFoodOrder,
  omnidatJournalEntry,
  omnidatSyncSource,
} from "@omnidat/db/schema";
import { beforeEach, describe, expect, it } from "vitest";

import {
  applyJournalBatch,
  appendCloudJournalEntry,
  getCurrentAuthority,
  journalPayloadChecksum,
} from "./omnidat-sync";

type Row = Record<string, unknown>;

function createSyncFakeDb(seedRows?: Map<unknown, Row[]>) {
  const tables = new Map<unknown, Row[]>(seedRows ?? []);
  const writes: Array<{ table: unknown; value: Row }> = [];
  let id = 0;
  const rowsFor = (table: unknown) => {
    const existing = tables.get(table);
    if (existing) return existing;
    const created: Row[] = [];
    tables.set(table, created);
    return created;
  };
  const returning = async () => [{ id: `row-${++id}` }];
  return {
    tables,
    writes,
    rowsFor,
    db: {
      insert: (table: unknown) => ({
        values: (value: unknown) => {
          writes.push({ table, value: value as Row });
          rowsFor(table).push(value as Row);
          return {
            onConflictDoUpdate: () => ({ returning }),
            returning,
          };
        },
      }),
      select: () => ({
        from: async (table: unknown) => rowsFor(table),
      }),
      update: (table: unknown) => ({
        set: (value: unknown) => ({
          where: () => {
            for (const row of rowsFor(table)) {
              Object.assign(row, value as Row);
            }
            return Promise.resolve();
          },
        }),
      }),
    },
  };
}

const EVENT_ID = "event-db-1";

function fieldAuthoritySeed(): Map<unknown, Row[]> {
  return new Map<unknown, Row[]>([
    [
      omnidatEventAuthority,
      [
        {
          id: "auth-1",
          eventId: EVENT_ID,
          epoch: 1,
          holder: "field",
          holderSourceId: "field-kit-01",
          fenceSeq: null,
        },
      ],
    ],
    [
      omnidatSyncSource,
      [
        {
          id: "sync-1",
          sourceId: "field-kit-01",
          sourceKind: "field-kit",
          tokenHash: "hash",
          lastPushedSeq: 0,
          lastSyncAt: null,
          active: true,
        },
      ],
    ],
  ]);
}

function makeEntry(overrides: Partial<Record<string, unknown>> & { seq: number }) {
  const payload = (overrides.payload as Record<string, unknown>) ?? {
    note: "field op",
  };
  return {
    seq: overrides.seq,
    eventId: (overrides.eventId as string | null | undefined) ?? EVENT_ID,
    epoch: (overrides.epoch as number | undefined) ?? 1,
    opType: (overrides.opType as string | undefined) ?? "campsite.note.filed",
    payload,
    idempotencyKey:
      (overrides.idempotencyKey as string | undefined) ??
      `field-kit-01:${overrides.seq}`,
    payloadChecksum: journalPayloadChecksum(payload),
    recordedAt: "2026-07-04T18:00:00Z",
  };
}

function foodOrderPayload() {
  return {
    id: "ORDER-JRNL-1",
    lineTicket: "MILIWAYS-9001",
    pickupName: "Journal Pickup",
    itemIds: ["stew"],
    total: 12,
    currency: "SHDY",
    status: "received",
    estimatedWaitMinutes: 9,
    receiptId: "RCPT-FOOD-9001",
    billingAccount: {
      provider: "ShadyBucks",
      accountId: "SB-CAMP-EX88-9001",
      type: "camp-operating",
      owner: "Journal Pickup",
      status: "linked-demo",
      balance: 88,
      currency: "SHDY",
    },
    ledgerEntry: {
      entryKind: "food-order",
      amount: -12,
      currency: "SHDY",
      memo: "Miliways order MILIWAYS-9001",
      receiptId: "RCPT-FOOD-9001",
    },
  };
}

describe("OMNIDAT journal apply engine", () => {
  beforeEach(() => {
    process.env.OMNIDAT_PERSISTENCE = "database";
  });

  it("applies a fresh entry and reports it", async () => {
    const { db } = createSyncFakeDb(fieldAuthoritySeed());
    const report = await applyJournalBatch(db, {
      sourceId: "field-kit-01",
      entries: [makeEntry({ seq: 1 })],
    });

    expect(report.applied).toBe(1);
    expect(report.duplicate).toBe(0);
    expect(report.rejectedStale).toBe(0);
    expect(report.quarantined).toBe(0);
    expect(report.highWatermark).toBe(1);
    expect(report.authority).toEqual({ holder: "field", epoch: 1 });
  });

  it("counts a repeated idempotency key as duplicate without reapplying", async () => {
    const fake = createSyncFakeDb(fieldAuthoritySeed());
    const entry = makeEntry({ seq: 1, opType: "food.order.created", payload: foodOrderPayload() });

    const first = await applyJournalBatch(fake.db, {
      sourceId: "field-kit-01",
      entries: [entry],
    });
    const second = await applyJournalBatch(fake.db, {
      sourceId: "field-kit-01",
      entries: [entry],
    });

    expect(first.applied).toBe(1);
    expect(second.applied).toBe(0);
    expect(second.duplicate).toBe(1);
    expect(
      fake.writes.filter((write) => write.table === omnidatFoodOrder),
    ).toHaveLength(1);
  });

  it("quarantines a stale-epoch entry past the fence", async () => {
    const seed = fieldAuthoritySeed();
    seed.set(omnidatEventAuthority, [
      {
        id: "auth-1",
        eventId: EVENT_ID,
        epoch: 1,
        holder: "field",
        holderSourceId: "field-kit-01",
        fenceSeq: null,
      },
      {
        id: "auth-2",
        eventId: EVENT_ID,
        epoch: 2,
        holder: "cloud",
        holderSourceId: "cloud",
        fenceSeq: 5,
      },
    ]);
    const fake = createSyncFakeDb(seed);

    const report = await applyJournalBatch(fake.db, {
      sourceId: "field-kit-01",
      entries: [makeEntry({ seq: 6, epoch: 1 })],
    });

    expect(report.rejectedStale).toBe(1);
    expect(report.quarantined).toBe(1);
    expect(report.applied).toBe(0);
    const journalRows = fake.rowsFor(omnidatJournalEntry);
    expect(journalRows).toHaveLength(1);
    expect(journalRows[0]?.applyStatus).toBe("quarantined");
  });

  it("applies a past-epoch entry at or below the fence", async () => {
    const seed = fieldAuthoritySeed();
    seed.set(omnidatEventAuthority, [
      {
        id: "auth-1",
        eventId: EVENT_ID,
        epoch: 1,
        holder: "field",
        holderSourceId: "field-kit-01",
        fenceSeq: null,
      },
      {
        id: "auth-2",
        eventId: EVENT_ID,
        epoch: 2,
        holder: "cloud",
        holderSourceId: "cloud",
        fenceSeq: 5,
      },
    ]);
    const fake = createSyncFakeDb(seed);

    const report = await applyJournalBatch(fake.db, {
      sourceId: "field-kit-01",
      entries: [makeEntry({ seq: 5, epoch: 1 })],
    });

    expect(report.applied).toBe(1);
    expect(report.rejectedStale).toBe(0);
  });

  it("refuses an entry from a future epoch without storing it", async () => {
    const fake = createSyncFakeDb(fieldAuthoritySeed());

    const report = await applyJournalBatch(fake.db, {
      sourceId: "field-kit-01",
      entries: [makeEntry({ seq: 1, epoch: 7 })],
    });

    expect(report.rejectedStale).toBe(1);
    expect(report.quarantined).toBe(0);
    expect(fake.rowsFor(omnidatJournalEntry)).toHaveLength(0);
  });

  it("maps food.order.created onto the food-order projection and unknown ops onto audit events", async () => {
    const fake = createSyncFakeDb(fieldAuthoritySeed());

    await applyJournalBatch(fake.db, {
      sourceId: "field-kit-01",
      entries: [
        makeEntry({ seq: 1, opType: "food.order.created", payload: foodOrderPayload() }),
        makeEntry({ seq: 2, opType: "campsite.note.filed" }),
      ],
    });

    const foodWrites = fake.writes.filter(
      (write) => write.table === omnidatFoodOrder,
    );
    expect(foodWrites).toHaveLength(1);
    expect(foodWrites[0]?.value.lineTicket).toBe("MILIWAYS-9001");

    const auditWrites = fake.writes.filter(
      (write) =>
        write.table === omnidatAuditEvent &&
        write.value.eventType === "campsite.note.filed",
    );
    expect(auditWrites).toHaveLength(1);
  });

  it("updates the sync source watermark after a batch", async () => {
    const fake = createSyncFakeDb(fieldAuthoritySeed());

    await applyJournalBatch(fake.db, {
      sourceId: "field-kit-01",
      entries: [makeEntry({ seq: 1 }), makeEntry({ seq: 2 })],
    });

    const sourceRow = fake.rowsFor(omnidatSyncSource)[0];
    expect(sourceRow?.lastPushedSeq).toBe(2);
    expect(sourceRow?.lastSyncAt).toBeInstanceOf(Date);
  });

  it("appends cloud journal entries only while the cloud holds authority", async () => {
    const cloudSeed = new Map<unknown, Row[]>([
      [
        omnidatEventAuthority,
        [
          {
            id: "auth-1",
            eventId: EVENT_ID,
            epoch: 2,
            holder: "cloud",
            holderSourceId: "cloud",
            fenceSeq: 5,
          },
        ],
      ],
    ]);
    const fake = createSyncFakeDb(cloudSeed);

    const entry = await appendCloudJournalEntry(fake.db, {
      eventId: EVENT_ID,
      opType: "food.order.created",
      payload: foodOrderPayload(),
    });

    expect(entry?.sourceId).toBe("cloud");
    expect(entry?.seq).toBe(1);
    expect(entry?.epoch).toBe(2);
    expect(entry?.idempotencyKey).toBe("cloud:1");

    const fieldFake = createSyncFakeDb(fieldAuthoritySeed());
    await expect(
      appendCloudJournalEntry(fieldFake.db, {
        eventId: EVENT_ID,
        opType: "food.order.created",
        payload: foodOrderPayload(),
      }),
    ).rejects.toThrow(/authority/i);
  });

  it("defaults authority to cloud epoch 0 when no record exists", async () => {
    const fake = createSyncFakeDb();
    const authority = await getCurrentAuthority(fake.db, EVENT_ID);
    expect(authority).toMatchObject({ holder: "cloud", epoch: 0 });
  });
});
