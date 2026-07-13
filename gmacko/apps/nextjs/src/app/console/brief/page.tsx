import { OmnidatOpsBrief } from "../../_components/omnidat-ops-brief";
import { OmnidatOperatorShell } from "../../_components/omnidat-operator-shell";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export default async function OpsBriefPage() {
  await prefetch(trpc.omnidat.publicStatus.queryOptions({}));

  return (
    <HydrateClient>
      <OmnidatOperatorShell
        active="console"
        eyebrow="Ops Brief"
        title="Camp-day operator brief"
        description="Live readiness counters and an ordered checklist for a bounded packet rehearsal. Sign in for roles, sessions, and incidents."
        requireAuth={false}
      >
        <OmnidatOpsBrief />
      </OmnidatOperatorShell>
    </HydrateClient>
  );
}
