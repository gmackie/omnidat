import Link from "next/link";

import { Vt100OperatorTerminal } from "../../_components/vt100-terminal";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export const metadata = {
  title: "OMNIDAT VT100 Terminal",
  description: "Interactive DEC VT100 PAD terminal for the OMNIDAT X.25 network.",
};

export default async function TerminalPage() {
  await prefetch(trpc.omnidat.terminalBanner.queryOptions({}));
  await prefetch(trpc.omnidat.services.queryOptions());

  return (
    <HydrateClient>
      <main className="min-h-screen bg-[#0a0906] px-5 py-8 text-[#f4ead2]">
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <Link className="font-bold" href="/console">
              OMNIDAT Exchange 88
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link className="rounded border border-[#7a694f] px-3 py-2" href="/console">
                Console
              </Link>
              <Link className="rounded border border-[#7a694f] px-3 py-2" href="/noc">
                NOC
              </Link>
            </div>
          </nav>
          <header className="rounded border border-[#4f3920] bg-[#211d15] p-5">
            <p className="text-sm font-semibold uppercase text-[#c0a36e]">
              Packet Terminal
            </p>
            <h1 className="mt-2 text-3xl font-black">VT100 PAD</h1>
            <p className="mt-2 text-sm leading-6 text-[#d9cbb0]">
              An asynchronous DEC VT100 wired to the Exchange 88 PAD. Click the
              screen, then drive the network: <code>DIR</code>, <code>CALL
              311088020501</code>, <code>STATUS</code>, <code>PAD</code>, or{" "}
              <code>HELP</code>. Calls clear with honest X.25 cause codes and are
              journaled to the operator audit trail.
            </p>
          </header>
          <Vt100OperatorTerminal />
        </section>
      </main>
    </HydrateClient>
  );
}
