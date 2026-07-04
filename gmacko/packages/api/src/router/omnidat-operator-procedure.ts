import { omnidatAuditEvent, omnidatOperatorRole } from "@omnidat/db/schema";
import { TRPCError } from "@trpc/server";

import { protectedProcedure } from "../trpc";
import {
  type OmnidatCapability,
  type OmnidatRole,
  isOmnidatRole,
  roleGrants,
} from "./omnidat-roles";

export interface OmnidatOperatorContext {
  userId: string;
  roles: OmnidatRole[];
}

type OperatorRoleRow = {
  userId?: string;
  role?: string;
  active?: boolean | null;
};

type OperatorDb = {
  select?: () => {
    from: (table: unknown) => Promise<OperatorRoleRow[]>;
  };
  insert?: (table: unknown) => {
    values: (value: unknown) => unknown;
  };
};

export async function loadActiveOperatorRoles(
  db: OperatorDb | undefined,
  userId: string,
): Promise<OmnidatRole[]> {
  if (!db?.select) return [];
  const rows = await db.select().from(omnidatOperatorRole);
  return rows
    .filter((row) => row.userId === userId && row.active !== false)
    .map((row) => row.role)
    .filter((role): role is OmnidatRole =>
      typeof role === "string" ? isOmnidatRole(role) : false,
    );
}

export function bootstrapAdmin(userId: string) {
  return (process.env.OMNIDAT_BOOTSTRAP_ADMINS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .includes(userId);
}

async function auditBootstrapAdminUse(db: OperatorDb | undefined, userId: string) {
  if (!db?.insert) return;
  await db.insert(omnidatAuditEvent).values({
    actorUserId: userId,
    eventType: "role.bootstrap-admin.used",
    subjectKind: "operator-role",
    subjectId: userId,
    details: { role: "admin", source: "OMNIDAT_BOOTSTRAP_ADMINS" },
  });
}

export function omnidatOperatorProcedure(capability: OmnidatCapability) {
  return protectedProcedure
    .meta({ omnidat: { capability, audited: true } })
    .use(async ({ ctx, next }) => {
      const roles = await loadActiveOperatorRoles(ctx.db, ctx.session.user.id);
      if (bootstrapAdmin(ctx.session.user.id) && !roles.includes("admin")) {
        roles.push("admin");
        await auditBootstrapAdminUse(ctx.db, ctx.session.user.id);
      }
      if (!roles.some((role) => roleGrants(role, capability))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "OMNIDAT operator role required",
        });
      }
      return next({
        ctx: {
          ...ctx,
          operator: {
            userId: ctx.session.user.id,
            roles,
          } satisfies OmnidatOperatorContext,
        },
      });
    });
}

export const omnidatOperatorReadProcedure =
  omnidatOperatorProcedure("operator.read");
