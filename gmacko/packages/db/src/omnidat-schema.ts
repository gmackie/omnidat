import { sql } from "drizzle-orm";
import { pgSchema, unique } from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

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

export const omnidatNetwork = omnidatNamespace.table("omnidat_network", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  networkCode: t.varchar({ length: 64 }).notNull(),
  name: t.varchar({ length: 160 }).notNull(),
  x121Prefix: t.varchar({ length: 32 }).notNull(),
  status: t.varchar({ length: 32 }).notNull().default("planning"),
  statusSource: t.varchar({ length: 120 }).notNull().default("seeded-exchange-88-adapter"),
  adapterUrl: t.text(),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}), (table) => [
  unique("omnidat_network_code_unique").on(table.networkCode),
]);

export const omnidatX25Node = omnidatNamespace.table("omnidat_x25_node", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  networkId: t
    .uuid()
    .notNull()
    .references(() => omnidatNetwork.id, { onDelete: "cascade" }),
  nodeCode: t.varchar({ length: 64 }).notNull(),
  displayName: t.varchar({ length: 160 }).notNull(),
  nodeKind: t.varchar({ length: 64 }).notNull(),
  locationLabel: t.varchar({ length: 160 }),
  managementAddress: t.varchar({ length: 160 }),
  status: t.varchar({ length: 32 }).notNull().default("planned"),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}), (table) => [
  unique("omnidat_x25_node_network_code_unique").on(table.networkId, table.nodeCode),
]);

export const omnidatX25Circuit = omnidatNamespace.table("omnidat_x25_circuit", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  networkId: t
    .uuid()
    .notNull()
    .references(() => omnidatNetwork.id, { onDelete: "cascade" }),
  localNodeId: t
    .uuid()
    .references(() => omnidatX25Node.id, { onDelete: "set null" }),
  remoteNodeId: t
    .uuid()
    .references(() => omnidatX25Node.id, { onDelete: "set null" }),
  localX121: t.varchar({ length: 32 }).notNull(),
  remoteX121: t.varchar({ length: 32 }),
  circuitKind: t.varchar({ length: 64 }).notNull(),
  transport: t.varchar({ length: 80 }).notNull(),
  status: t.varchar({ length: 32 }).notNull().default("planned"),
  packetWindow: t.integer().notNull().default(2),
  throughputBps: t.integer(),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}), (table) => [
  unique("omnidat_x25_circuit_local_x121_unique").on(table.localX121),
]);

export const omnidatAddressAllocation = omnidatNamespace.table("omnidat_address_allocation", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  networkId: t
    .uuid()
    .notNull()
    .references(() => omnidatNetwork.id, { onDelete: "cascade" }),
  x121: t.varchar({ length: 32 }).notNull(),
  assignedToKind: t.varchar({ length: 64 }).notNull(),
  assignedToId: t.uuid(),
  namespace: t.varchar({ length: 64 }).notNull().default("camp"),
  status: t.varchar({ length: 32 }).notNull().default("reserved"),
  notes: t.text(),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}), (table) => [
  unique("omnidat_address_allocation_x121_unique").on(table.x121),
]);

export const omnidatService = omnidatNamespace.table("omnidat_service", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  networkId: t
    .uuid()
    .references(() => omnidatNetwork.id, { onDelete: "set null" }),
  ownerCampsiteId: t
    .uuid()
    .references(() => omnidatCampsite.id, { onDelete: "set null" }),
  slug: t.varchar({ length: 120 }).notNull(),
  displayName: t.varchar({ length: 160 }).notNull(),
  x121: t.varchar({ length: 32 }).notNull(),
  ownerKind: t.varchar({ length: 64 }).notNull().default("omnidat"),
  serviceKind: t.varchar({ length: 64 }).notNull(),
  status: t.varchar({ length: 32 }).notNull().default("draft"),
  reachable: t.boolean().notNull().default(false),
  description: t.text(),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}), (table) => [
  unique("omnidat_service_slug_unique").on(table.slug),
  unique("omnidat_service_x121_unique").on(table.x121),
]);

export const omnidatServiceVerb = omnidatNamespace.table("omnidat_service_verb", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  serviceId: t
    .uuid()
    .notNull()
    .references(() => omnidatService.id, { onDelete: "cascade" }),
  verb: t.varchar({ length: 80 }).notNull(),
  description: t.text(),
  inputs: t.json().$type<string[]>().notNull().default([]),
  outputs: t.json().$type<string[]>().notNull().default([]),
  securityPolicy: t.json().$type<Record<string, unknown>>().notNull().default({}),
  active: t.boolean().notNull().default(true),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}), (table) => [
  unique("omnidat_service_verb_service_verb_unique").on(table.serviceId, table.verb),
]);

export const omnidatPdfProfile = omnidatNamespace.table("omnidat_pdf_profile", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  userId: t
    .text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  campsiteId: t
    .uuid()
    .references(() => omnidatCampsite.id, { onDelete: "set null" }),
  enabledForms: t.json().$type<string[]>().notNull().default([]),
  pageSize: t.varchar({ length: 32 }).notNull().default("letter"),
  deliveryMode: t.varchar({ length: 64 }).notNull().default("download-and-print"),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}), (table) => [
  unique("omnidat_pdf_profile_user_unique").on(table.userId),
]);

export const omnidatProvisioningRequest = omnidatNamespace.table("omnidat_provisioning_request", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  requestedByUserId: t
    .text()
    .references(() => user.id, { onDelete: "set null" }),
  campsiteId: t
    .uuid()
    .references(() => omnidatCampsite.id, { onDelete: "set null" }),
  serviceId: t
    .uuid()
    .references(() => omnidatService.id, { onDelete: "set null" }),
  requestedX121: t.varchar({ length: 32 }),
  assignedX121: t.varchar({ length: 32 }),
  transport: t.varchar({ length: 80 }).notNull(),
  status: t.varchar({ length: 32 }).notNull().default("queued"),
  verificationTranscript: t.text(),
  pdfReceiptUrl: t.text(),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  verifiedAt: t.timestamp({ mode: "date", withTimezone: true }),
}));

export const omnidatPadConfig = omnidatNamespace.table("omnidat_pad_config", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  x121: t.varchar({ length: 32 }).notNull(),
  serviceId: t
    .uuid()
    .references(() => omnidatService.id, { onDelete: "set null" }),
  transport: t.varchar({ length: 80 }).notNull(),
  padKind: t.varchar({ length: 64 }).notNull(),
  endpointLabel: t.varchar({ length: 160 }).notNull(),
  status: t.varchar({ length: 32 }).notNull().default("configured"),
  profile: t.text().notNull(),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}), (table) => [
  unique("omnidat_pad_config_x121_unique").on(table.x121),
]);

export const omnidatBillingAccount = omnidatNamespace.table("omnidat_billing_account", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  userId: t
    .text()
    .references(() => user.id, { onDelete: "set null" }),
  campsiteId: t
    .uuid()
    .references(() => omnidatCampsite.id, { onDelete: "set null" }),
  provider: t.varchar({ length: 64 }).notNull().default("ShadyBucks"),
  externalAccountId: t.varchar({ length: 120 }).notNull(),
  accountType: t.varchar({ length: 64 }).notNull(),
  displayName: t.varchar({ length: 160 }).notNull(),
  status: t.varchar({ length: 32 }).notNull().default("pending"),
  balanceAmount: t.integer().notNull().default(0),
  currency: t.varchar({ length: 12 }).notNull().default("SHDY"),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}), (table) => [
  unique("omnidat_billing_account_provider_external_unique").on(table.provider, table.externalAccountId),
]);

export const omnidatBillingLedgerEntry = omnidatNamespace.table("omnidat_billing_ledger_entry", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  accountId: t
    .uuid()
    .notNull()
    .references(() => omnidatBillingAccount.id, { onDelete: "cascade" }),
  relatedServiceId: t
    .uuid()
    .references(() => omnidatService.id, { onDelete: "set null" }),
  entryKind: t.varchar({ length: 64 }).notNull(),
  amount: t.integer().notNull(),
  currency: t.varchar({ length: 12 }).notNull().default("SHDY"),
  memo: t.text(),
  externalReceiptId: t.varchar({ length: 160 }),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

export const omnidatShadyBucksAtm = omnidatNamespace.table("omnidat_shadybucks_atm", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  terminalId: t.varchar({ length: 120 }).notNull(),
  terminalX121: t.varchar({ length: 32 }).notNull(),
  settlementAccountId: t
    .uuid()
    .notNull()
    .references(() => omnidatBillingAccount.id, { onDelete: "restrict" }),
  serviceId: t
    .uuid()
    .references(() => omnidatService.id, { onDelete: "set null" }),
  locationLabel: t.varchar({ length: 160 }),
  status: t.varchar({ length: 32 }).notNull().default("planned"),
  activationCodeHash: t.text(),
  lastSeenAt: t.timestamp({ mode: "date", withTimezone: true }),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}), (table) => [
  unique("omnidat_shadybucks_atm_terminal_id_unique").on(table.terminalId),
  unique("omnidat_shadybucks_atm_terminal_x121_unique").on(table.terminalX121),
]);

export const omnidatFoodMenuItem = omnidatNamespace.table("omnidat_food_menu_item", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  serviceId: t
    .uuid()
    .notNull()
    .references(() => omnidatService.id, { onDelete: "cascade" }),
  itemCode: t.varchar({ length: 80 }).notNull(),
  displayName: t.varchar({ length: 160 }).notNull(),
  priceAmount: t.integer().notNull(),
  currency: t.varchar({ length: 12 }).notNull().default("SHDY"),
  available: t.boolean().notNull().default(true),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}), (table) => [
  unique("omnidat_food_menu_item_service_code_unique").on(table.serviceId, table.itemCode),
]);

export const omnidatFoodOrder = omnidatNamespace.table("omnidat_food_order", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  serviceId: t
    .uuid()
    .references(() => omnidatService.id, { onDelete: "cascade" }),
  billingAccountId: t
    .uuid()
    .references(() => omnidatBillingAccount.id, { onDelete: "set null" }),
  lineTicket: t.varchar({ length: 80 }).notNull(),
  pickupName: t.varchar({ length: 160 }).notNull(),
  items: t.json().$type<Array<{ itemCode: string; quantity: number }>>().notNull().default([]),
  totalAmount: t.integer().notNull().default(0),
  status: t.varchar({ length: 32 }).notNull().default("received"),
  estimatedWaitMinutes: t.integer(),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  fulfilledAt: t.timestamp({ mode: "date", withTimezone: true }),
}), (table) => [
  unique("omnidat_food_order_line_ticket_unique").on(table.lineTicket),
]);

export const omnidatPassportStamp = omnidatNamespace.table("omnidat_passport_stamp", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  passportId: t.varchar({ length: 120 }).notNull(),
  badgeId: t.varchar({ length: 120 }).notNull(),
  operatorId: t.varchar({ length: 120 }).notNull(),
  evidence: t.text().notNull(),
  stampId: t.varchar({ length: 120 }).notNull(),
  receiptId: t.varchar({ length: 120 }).notNull(),
  status: t.varchar({ length: 32 }).notNull().default("filed"),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}), (table) => [
  unique("omnidat_passport_stamp_stamp_id_unique").on(table.stampId),
]);

export const omnidatInfraEndpoint = omnidatNamespace.table("omnidat_infra_endpoint", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  networkId: t
    .uuid()
    .references(() => omnidatNetwork.id, { onDelete: "cascade" }),
  endpointKind: t.varchar({ length: 80 }).notNull(),
  label: t.varchar({ length: 160 }).notNull(),
  url: t.text(),
  healthStatus: t.varchar({ length: 32 }).notNull().default("unknown"),
  owner: t.varchar({ length: 120 }).notNull().default("OMNIDAT"),
  lastCheckedAt: t.timestamp({ mode: "date", withTimezone: true }),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

export const omnidatNetworkMetric = omnidatNamespace.table("omnidat_network_metric", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  networkId: t
    .uuid()
    .references(() => omnidatNetwork.id, { onDelete: "cascade" }),
  serviceId: t
    .uuid()
    .references(() => omnidatService.id, { onDelete: "set null" }),
  circuitId: t
    .uuid()
    .references(() => omnidatX25Circuit.id, { onDelete: "set null" }),
  metricName: t.varchar({ length: 120 }).notNull(),
  value: t.integer().notNull(),
  unit: t.varchar({ length: 32 }).notNull(),
  observedAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

export const omnidatSecurityCredential = omnidatNamespace.table("omnidat_security_credential", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  userId: t
    .text()
    .references(() => user.id, { onDelete: "cascade" }),
  serviceId: t
    .uuid()
    .references(() => omnidatService.id, { onDelete: "cascade" }),
  credentialKind: t.varchar({ length: 64 }).notNull(),
  keyPrefix: t.varchar({ length: 24 }),
  secretHash: t.text().notNull(),
  permissions: t.json().$type<string[]>().notNull().default([]),
  expiresAt: t.timestamp({ mode: "date", withTimezone: true }),
  revokedAt: t.timestamp({ mode: "date", withTimezone: true }),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

export const omnidatAuditEvent = omnidatNamespace.table("omnidat_audit_event", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  actorUserId: t
    .text()
    .references(() => user.id, { onDelete: "set null" }),
  eventType: t.varchar({ length: 120 }).notNull(),
  subjectKind: t.varchar({ length: 80 }).notNull(),
  subjectId: t.varchar({ length: 160 }),
  ipAddress: t.varchar({ length: 80 }),
  details: t.json().$type<Record<string, unknown>>().notNull().default({}),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

export const omnidatEvent = omnidatNamespace.table("omnidat_event", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  eventCode: t.varchar({ length: 80 }).notNull(),
  displayName: t.varchar({ length: 180 }).notNull(),
  eventKind: t.varchar({ length: 80 }).notNull().default("hackercamp"),
  status: t.varchar({ length: 32 }).notNull().default("planning"),
  startsAt: t.timestamp({ mode: "date", withTimezone: true }),
  endsAt: t.timestamp({ mode: "date", withTimezone: true }),
  publicArchive: t.boolean().notNull().default(false),
  notes: t.text(),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}), (table) => [
  unique("omnidat_event_code_unique").on(table.eventCode),
]);

export const omnidatEvidenceArtifact = omnidatNamespace.table("omnidat_evidence_artifact", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  eventId: t
    .uuid()
    .references(() => omnidatEvent.id, { onDelete: "set null" }),
  artifactKind: t.varchar({ length: 80 }).notNull(),
  label: t.varchar({ length: 180 }).notNull(),
  url: t.text().notNull(),
  recordCount: t.integer(),
  contentType: t.varchar({ length: 120 }).notNull().default("application/json"),
  checksum: t.varchar({ length: 128 }),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

export const omnidatOperatorRole = omnidatNamespace.table("omnidat_operator_role", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  userId: t
    .text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  eventId: t
    .uuid()
    .references(() => omnidatEvent.id, { onDelete: "cascade" }),
  role: t.varchar({ length: 64 }).notNull(),
  scope: t.varchar({ length: 80 }).notNull().default("event"),
  active: t.boolean().notNull().default(true),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}), (table) => [
  unique("omnidat_operator_role_user_event_role_unique").on(table.userId, table.eventId, table.role),
]);

export const omnidatSyncSource = omnidatNamespace.table("omnidat_sync_source", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  sourceId: t.varchar({ length: 80 }).notNull(),
  sourceKind: t.varchar({ length: 32 }).notNull().default("field-kit"),
  tokenHash: t.text().notNull(),
  lastPushedSeq: t.bigint({ mode: "number" }).notNull().default(0),
  lastSyncAt: t.timestamp({ mode: "date", withTimezone: true }),
  active: t.boolean().notNull().default(true),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}), (table) => [
  unique("omnidat_sync_source_source_id_unique").on(table.sourceId),
]);

export const omnidatJournalEntry = omnidatNamespace.table("omnidat_journal_entry", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  sourceId: t.varchar({ length: 80 }).notNull(),
  seq: t.bigint({ mode: "number" }).notNull(),
  eventId: t.uuid().references(() => omnidatEvent.id, { onDelete: "set null" }),
  epoch: t.integer().notNull(),
  opType: t.varchar({ length: 120 }).notNull(),
  payload: t.json().$type<Record<string, unknown>>().notNull().default({}),
  idempotencyKey: t.varchar({ length: 160 }).notNull(),
  payloadChecksum: t.varchar({ length: 64 }).notNull(),
  recordedAt: t.timestamp({ mode: "date", withTimezone: true }).notNull(),
  receivedAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  applyStatus: t.varchar({ length: 32 }).notNull().default("pending"),
  appliedAt: t.timestamp({ mode: "date", withTimezone: true }),
}), (table) => [
  unique("omnidat_journal_source_seq_unique").on(table.sourceId, table.seq),
  unique("omnidat_journal_idempotency_unique").on(table.idempotencyKey),
]);

export const omnidatEventAuthority = omnidatNamespace.table("omnidat_event_authority", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  eventId: t
    .uuid()
    .notNull()
    .references(() => omnidatEvent.id, { onDelete: "cascade" }),
  epoch: t.integer().notNull(),
  holder: t.varchar({ length: 16 }).notNull(),
  holderSourceId: t.varchar({ length: 80 }).notNull(),
  fenceSeq: t.bigint({ mode: "number" }),
  transferredByUserId: t
    .text()
    .references(() => user.id, { onDelete: "set null" }),
  reason: t.text(),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}), (table) => [
  unique("omnidat_event_authority_event_epoch_unique").on(table.eventId, table.epoch),
]);

export const omnidatNocIncident = omnidatNamespace.table("omnidat_noc_incident", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  networkId: t
    .uuid()
    .references(() => omnidatNetwork.id, { onDelete: "cascade" }),
  serviceId: t
    .uuid()
    .references(() => omnidatService.id, { onDelete: "set null" }),
  title: t.varchar({ length: 200 }).notNull(),
  severity: t.varchar({ length: 32 }).notNull().default("minor"),
  status: t.varchar({ length: 32 }).notNull().default("open"),
  openedByUserId: t
    .text()
    .references(() => user.id, { onDelete: "set null" }),
  openedAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  resolvedAt: t.timestamp({ mode: "date", withTimezone: true }),
}));
