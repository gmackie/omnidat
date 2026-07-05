import { omnidatNetworkMetric } from "@omnidat/db/schema";

import {
  databasePersistenceEnabled,
  type OmnidatPersistenceDb,
} from "./omnidat-persistence";

/**
 * The single KPI choke point. Operational counts land in
 * `omnidatNetworkMetric` today; when Workstream A (Split Authority Sync) lands,
 * this one call site swaps to writing journal entries and no mutation changes.
 * Metric names align to the roadmap Observability KPI set so daily summaries
 * aggregate without renames. See docs/metrics.md.
 */
export type OmnidatMetric = {
  metricName: string;
  value: number;
  unit: string;
  networkId?: string | null;
  serviceId?: string | null;
  circuitId?: string | null;
};

export async function recordOperationalMetric(
  db: OmnidatPersistenceDb | undefined,
  metric: OmnidatMetric,
) {
  if (!db || !databasePersistenceEnabled()) return;
  await db.insert(omnidatNetworkMetric).values({
    metricName: metric.metricName,
    value: metric.value,
    unit: metric.unit,
    networkId: metric.networkId ?? null,
    serviceId: metric.serviceId ?? null,
    circuitId: metric.circuitId ?? null,
  });
}
