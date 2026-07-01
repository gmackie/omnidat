import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { OmnidatAdminDashboard } from "../_components/omnidat-admin-dashboard";

export default async function AdminPage() {
  await prefetch(trpc.omnidat.dashboard.queryOptions());
  await prefetch(trpc.omnidat.services.queryOptions());
  await prefetch(trpc.omnidat.billing.queryOptions());

  return (
    <HydrateClient>
      <div className="p-6">
        <header className="mb-6 rounded border border-border bg-card p-5">
          <p className="text-muted-foreground text-sm font-semibold uppercase">
            ShadyBucks Settlement
          </p>
          <h1 className="mt-2 text-3xl font-black">Service Registry</h1>
        </header>
        <OmnidatAdminDashboard />
      </div>
    </HydrateClient>
  );
}
