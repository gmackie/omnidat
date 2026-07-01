import { integrations } from "@omnidat/config";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const telemetryInitModule = ["@omnidat/telemetry", "init"].join("/");
    const { initTelemetry } = await import(telemetryInitModule);
    initTelemetry();
  }

  if (integrations.sentry) {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("../sentry.server.config");
    }

    if (process.env.NEXT_RUNTIME === "edge") {
      await import("../sentry.edge.config");
    }
  }
}
