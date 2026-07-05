import { omnidatNetworkMetric } from "@omnidat/db/schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { recordOperationalMetric } from "./omnidat-kpi";

const originalPersistence = process.env.OMNIDAT_PERSISTENCE;

function metricFakeDb() {
  const writes: Array<{ table: unknown; value: Record<string, unknown> }> = [];
  return {
    writes,
    db: {
      insert: (table: unknown) => ({
        values: (value: Record<string, unknown>) => {
          writes.push({ table, value });
          return { onConflictDoUpdate: () => ({}), returning: async () => [] };
        },
      }),
    },
  };
}

describe("OMNIDAT KPI choke point", () => {
  afterEach(() => {
    process.env.OMNIDAT_PERSISTENCE = originalPersistence;
  });

  it("writes omnidatNetworkMetric rows when persistence is enabled", async () => {
    process.env.OMNIDAT_PERSISTENCE = "database";
    const fake = metricFakeDb();

    await recordOperationalMetric(fake.db, {
      metricName: "packet.session.opened",
      value: 1,
      unit: "session",
    });
    await recordOperationalMetric(fake.db, {
      metricName: "packet.session.cleared.cause.0",
      value: 1,
      unit: "session",
    });
    await recordOperationalMetric(fake.db, {
      metricName: "service.verb.called",
      value: 1,
      unit: "verb",
      serviceId: "service-1",
    });

    expect(fake.writes.every((w) => w.table === omnidatNetworkMetric)).toBe(true);
    expect(fake.writes.map((w) => w.value.metricName)).toEqual([
      "packet.session.opened",
      "packet.session.cleared.cause.0",
      "service.verb.called",
    ]);
    expect(fake.writes[2]?.value.serviceId).toBe("service-1");
  });

  it("is a no-op when persistence is disabled", async () => {
    process.env.OMNIDAT_PERSISTENCE = "seed";
    const fake = metricFakeDb();

    await recordOperationalMetric(fake.db, {
      metricName: "packet.session.opened",
      value: 1,
      unit: "session",
    });

    expect(fake.writes).toHaveLength(0);
  });
});
