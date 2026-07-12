import { OmnidatOperatorConsole } from "../_components/omnidat-operator-console";
import { OmnidatOperatorShell } from "../_components/omnidat-operator-shell";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export default async function ConsolePage() {
  await prefetch(trpc.omnidat.dashboard.queryOptions());
  await prefetch(trpc.omnidat.services.queryOptions());
  await prefetch(trpc.omnidat.foodProtocol.queryOptions());
  await prefetch(trpc.omnidat.atmProtocol.queryOptions());

  return (
    <HydrateClient>
      <OmnidatOperatorShell
        active="console"
        eyebrow="Operator Console"
        title="Exchange 88 Operations"
        description="Provision campsite PDFs, run packet verbs, open the VT100 terminal, and verify transport routes against the X.25 adapter."
      >
        <OmnidatOperatorConsole />
      </OmnidatOperatorShell>
    </HydrateClient>
  );
}
