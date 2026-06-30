import { sql } from "drizzle-orm";
import { pgSchema, unique } from "drizzle-orm/pg-core";

export const omnidatNamespace = pgSchema("omnidat");

export const omnidatCampsite = omnidatNamespace.table("omnidat_campsite", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  namespace: t.varchar({ length: 64 }).notNull().default("camp"),
  slug: t.varchar({ length: 120 }).notNull(),
  displayName: t.varchar({ length: 160 }).notNull(),
  contactHandle: t.varchar({ length: 160 }).notNull(),
  status: t.varchar({ length: 32 }).notNull().default("pending"),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}), (table) => [
  unique("omnidat_campsite_namespace_slug_unique").on(table.namespace, table.slug),
]);

export const omnidatCampsiteApp = omnidatNamespace.table("omnidat_campsite_app", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  campsiteId: t
    .uuid()
    .notNull()
    .references(() => omnidatCampsite.id, { onDelete: "cascade" }),
  address: t.varchar({ length: 16 }).notNull(),
  name: t.varchar({ length: 160 }).notNull(),
  appKind: t.varchar({ length: 64 }).notNull(),
  status: t.varchar({ length: 32 }).notNull().default("active"),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}), (table) => [
  unique("omnidat_campsite_app_address_unique").on(table.address),
]);

export const omnidatTransportEndpoint = omnidatNamespace.table("omnidat_transport_endpoint", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  campsiteId: t
    .uuid()
    .references(() => omnidatCampsite.id, { onDelete: "cascade" }),
  transport: t.varchar({ length: 80 }).notNull(),
  endpointLabel: t.varchar({ length: 160 }).notNull(),
  routingHint: t.text(),
  active: t.boolean().notNull().default(true),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));
