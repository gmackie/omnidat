import { OmnidatAdminDashboard } from "../_components/omnidat-admin-dashboard";
import { OmnidatOperatorShell } from "../_components/omnidat-operator-shell";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export default async function OperatorAdminPage() {
  await prefetch(trpc.omnidat.dashboard.queryOptions());
  await prefetch(trpc.omnidat.services.queryOptions());
  await prefetch(trpc.omnidat.billing.queryOptions());
  await prefetch(trpc.omnidat.operations.queryOptions());

  return (
    <HydrateClient>
      <OmnidatOperatorShell
        active="admin"
        eyebrow="Service Registry"
        title="Operator Admin"
        description="Registry controls for X.121 services, packet verbs, billing ledgers, provisioning lifecycle, incidents, and operator roles."
      >
        <OmnidatAdminDashboard />
      </OmnidatOperatorShell>
    </HydrateClient>
  );
}
