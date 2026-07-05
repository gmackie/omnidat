import { omnidatAuditEvent, omnidatOperatorRole } from "@omnidat/db/schema";
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { appRouter } from "../root";
import { createTRPCRouter } from "../trpc";
import {
  omnidatOperatorProcedure,
  omnidatOperatorReadProcedure,
} from "./omnidat-operator-procedure";

function createFakeDb() {
  const tables = new Map<unknown, Array<Record<string, unknown>>>();
  let id = 0;
  const rowsFor = (table: unknown) => {
    const existing = tables.get(table);
    if (existing) return existing;
    const created: Array<Record<string, unknown>> = [];
    tables.set(table, created);
    return created;
  };
  const returning = async () => [{ id: `row-${++id}` }];
  return {
    rowsFor,
    db: {
      insert: (table: unknown) => ({
        values: (value: unknown) => {
          rowsFor(table).push(value as Record<string, unknown>);
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
              Object.assign(row, value as Record<string, unknown>);
            }
            return Promise.resolve();
          },
        }),
      }),
    },
  };
}

function session(userId: string) {
  return {
    user: {
      id: userId,
      name: "Operator",
      email: `${userId}@example.test`,
      emailVerified: true,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    },
    session: null,
  };
}

const testRouter = createTRPCRouter({
  read: omnidatOperatorReadProcedure.query(({ ctx }) => ({
    roles: ctx.operator.roles,
    userId: ctx.operator.userId,
  })),
  write: omnidatOperatorProcedure("service.write").mutation(({ ctx }) => ({
    roles: ctx.operator.roles,
    userId: ctx.operator.userId,
  })),
});

describe("OMNIDAT operator procedure", () => {
  it("rejects missing sessions before role checks", async () => {
    const { db } = createFakeDb();
    const caller = testRouter.createCaller({ db, session: null } as never);

    await expect(caller.write()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects sessions without active role grants", async () => {
    const { db } = createFakeDb();
    const caller = testRouter.createCaller({
      db,
      session: session("user-no-role"),
    } as never);

    await expect(caller.write()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows a matching active operator role", async () => {
    const { db, rowsFor } = createFakeDb();
    rowsFor(omnidatOperatorRole).push({
      userId: "user-packet",
      role: "packet-operator",
      active: true,
    });
    const caller = testRouter.createCaller({
      db,
      session: session("user-packet"),
    } as never);

    await expect(caller.write()).resolves.toMatchObject({
      roles: ["packet-operator"],
      userId: "user-packet",
    });
  });

  it("allows auditor reads and rejects auditor writes", async () => {
    const { db, rowsFor } = createFakeDb();
    rowsFor(omnidatOperatorRole).push({
      userId: "user-auditor",
      role: "auditor",
      active: true,
    });
    const caller = testRouter.createCaller({
      db,
      session: session("user-auditor"),
    } as never);

    await expect(caller.read()).resolves.toMatchObject({
      roles: ["auditor"],
    });
    await expect(caller.write()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ignores inactive role grants", async () => {
    const { db, rowsFor } = createFakeDb();
    rowsFor(omnidatOperatorRole).push({
      userId: "user-inactive",
      role: "packet-operator",
      active: false,
    });
    const caller = testRouter.createCaller({
      db,
      session: session("user-inactive"),
    } as never);

    await expect(caller.write()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("uses audited bootstrap admins before role rows exist", async () => {
    const previous = process.env.OMNIDAT_BOOTSTRAP_ADMINS;
    process.env.OMNIDAT_BOOTSTRAP_ADMINS = "user-bootstrap";
    const { db, rowsFor } = createFakeDb();
    const caller = testRouter.createCaller({
      db,
      session: session("user-bootstrap"),
    } as never);

    try {
      await expect(caller.write()).resolves.toMatchObject({
        roles: ["admin"],
      });
      expect(rowsFor(omnidatAuditEvent)).toEqual([
        expect.objectContaining({
          actorUserId: "user-bootstrap",
          eventType: "role.bootstrap-admin.used",
          subjectKind: "operator-role",
        }),
      ]);
    } finally {
      process.env.OMNIDAT_BOOTSTRAP_ADMINS = previous;
    }
  });

  it("gates grantOperatorRole to admins", async () => {
    const previous = process.env.OMNIDAT_BOOTSTRAP_ADMINS;
    process.env.OMNIDAT_BOOTSTRAP_ADMINS = "user-admin";
    const adminFake = createFakeDb();
    const adminCaller = appRouter.createCaller({
      db: adminFake.db,
      session: session("user-admin"),
    } as never);

    try {
      await expect(
        adminCaller.omnidat.grantOperatorRole({
          userId: "user-packet",
          role: "packet-operator",
        }),
      ).resolves.toMatchObject({
        userId: "user-packet",
        role: "packet-operator",
        active: true,
      });
      expect(adminFake.rowsFor(omnidatOperatorRole)).toEqual([
        expect.objectContaining({
          userId: "user-packet",
          role: "packet-operator",
          active: true,
        }),
      ]);
    } finally {
      process.env.OMNIDAT_BOOTSTRAP_ADMINS = previous;
    }

    const packetFake = createFakeDb();
    packetFake.rowsFor(omnidatOperatorRole).push({
      userId: "user-packet",
      role: "packet-operator",
      active: true,
    });
    const packetCaller = appRouter.createCaller({
      db: packetFake.db,
      session: session("user-packet"),
    } as never);

    await expect(
      packetCaller.omnidat.grantOperatorRole({
        userId: "user-other",
        role: "auditor",
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});
