import { OmnidatOperatorShell } from "../../_components/omnidat-operator-shell";
import { Vt100OperatorTerminal } from "../../_components/vt100-terminal";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export const metadata = {
  title: "OMNIDAT VT100 Terminal",
  description:
    "Interactive DEC VT100 PAD terminal for the OMNIDAT X.25 network.",
};

export default async function TerminalPage() {
  await prefetch(trpc.omnidat.terminalBanner.queryOptions({}));
  await prefetch(trpc.omnidat.services.queryOptions());

  return (
    <HydrateClient>
      <OmnidatOperatorShell
        active="terminal"
        eyebrow="Packet Terminal"
        title="VT100 PAD"
        description="An asynchronous DEC VT100 wired to the Exchange 88 PAD. Drive the network with DIR, CALL, STATUS, PAD, or HELP. Calls clear with honest X.25 cause codes and leave evidence for signed-in operators."
        requireAuth={false}
      >
        <div className="rounded border border-[#4f3920] bg-[#0a0906] p-2 sm:p-4">
          <Vt100OperatorTerminal />
        </div>
      </OmnidatOperatorShell>
    </HydrateClient>
  );
}
