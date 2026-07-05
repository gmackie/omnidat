import { omnidatOperatorRole } from "@omnidat/db/schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appRouter } from "../root";
import { omnidatRouter } from "./omnidat";
import { OMNIDAT_ROLES, type OmnidatRole, roleGrants } from "./omnidat-roles";

const originalPersistence = process.env.OMNIDAT_PERSISTENCE;

// Token-authenticated procedures (Split Authority Sync) are not operator
// mutations; they are covered by the sync token tests.
const SYNC_TOKEN_EXCEPTIONS = ["syncPush", "syncPull"];

function roleCaller(role: OmnidatRole) {
  const userId = `user-${role}`;
  return appRouter.createCaller({
    db: {
      select: () => ({
        from: async (table: unknown) =>
          table === omnidatOperatorRole
            ? [{ userId, role, active: true }]
            : [],
      }),
      insert: () => ({
        values: () => ({
          onConflictDoUpdate: () => ({ returning: async () => [{ id: "x" }] }),
          returning: async () => [{ id: "x" }],
        }),
      }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    },
    session: { user: { id: userId } },
  } as never);
}

type ProcDef = { _def?: { type?: string; meta?: unknown } };

function mutationCapabilities() {
  const out: Array<{ name: string; capability: string }> = [];
  for (const [name, procedure] of Object.entries(omnidatRouter)) {
    const def = (procedure as ProcDef)._def;
    if (def?.type !== "mutation") continue;
    if (SYNC_TOKEN_EXCEPTIONS.includes(name)) continue;
    const capability = (
      def.meta as { omnidat?: { capability?: string } } | undefined
    )?.omnidat?.capability;
    if (capability) out.push({ name, capability });
  }
  return out;
}

const ROLE_ERROR = /operator role required/i;

describe("OMNIDAT role x mutation matrix", () => {
  beforeEach(() => {
    // Persistence stays off so mutation bodies short-circuit; we only assert
    // whether the role gate admits or rejects the call.
    process.env.OMNIDAT_PERSISTENCE = "seed";
  });
  afterEach(() => {
    process.env.OMNIDAT_PERSISTENCE = originalPersistence;
  });

  it("covers every mutation with a capability gate", () => {
    // Guard: the router exposes gated mutations to test.
    expect(mutationCapabilities().length).toBeGreaterThanOrEqual(11);
  });

  for (const role of OMNIDAT_ROLES) {
    for (const { name, capability } of mutationCapabilities()) {
      const expected = roleGrants(role, capability as never);
      it(`${role} ${expected ? "may" : "may NOT"} call ${name}`, async () => {
        const caller = roleCaller(role);
        const call = (
          caller.omnidat as unknown as Record<
            string,
            ((input: unknown) => Promise<unknown>) | undefined
          >
        )[name];
        if (!call) throw new Error(`missing procedure ${name}`);
        if (!expected) {
          // The role gate runs before input parsing, so a bad role rejects
          // with the role error regardless of input shape.
          await expect(call({})).rejects.toThrow(ROLE_ERROR);
        } else {
          // A granted role passes the gate. The body may still reject on the
          // empty input, but never with the role error.
          await call({}).catch((error: unknown) => {
            expect(String(error)).not.toMatch(ROLE_ERROR);
          });
        }
      });
    }
  }

  // Auditor rejection is proven exhaustively by the per-cell matrix above
  // (auditor grants only operator.read, so every mutation cell asserts "may
  // NOT"). The admin-only check on role management is the one explicit spot
  // check the plan calls out on top of the derived matrix.
  it("only admin can grant or revoke operator roles", async () => {
    for (const role of OMNIDAT_ROLES) {
      const caller = roleCaller(role);
      const grant = (
        caller.omnidat as unknown as {
          grantOperatorRole: (input: unknown) => Promise<unknown>;
        }
      ).grantOperatorRole;
      if (role === "admin") {
        await grant({
          userId: "u",
          role: "packet-operator",
        }).catch((error: unknown) => {
          expect(String(error)).not.toMatch(ROLE_ERROR);
        });
      } else {
        await expect(grant({ userId: "u", role: "packet-operator" })).rejects.toThrow(
          ROLE_ERROR,
        );
      }
    }
  });
});
