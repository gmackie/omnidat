import { OmnidatNocDashboard } from "../_components/omnidat-noc-dashboard";
import { OmnidatOperatorShell } from "../_components/omnidat-operator-shell";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export default async function NocPage() {
  await prefetch(trpc.omnidat.noc.queryOptions());

  return (
    <HydrateClient>
      <OmnidatOperatorShell
        active="noc"
        eyebrow="Circuit State"
        title="Network Operations Center"
        description="Live circuit board, packet sessions, and evidence. Authenticated operators see session and evidence lists; the public board shows adapter health."
        requireAuth={false}
      >
        <OmnidatNocDashboard />
      </OmnidatOperatorShell>
    </HydrateClient>
  );
}
