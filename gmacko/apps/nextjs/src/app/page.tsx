import Link from "next/link";

import { OmnidatHomeDashboard } from "./_components/omnidat-home-dashboard";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export default async function HomePage() {
  await prefetch(trpc.omnidat.dashboard.queryOptions());
  await prefetch(trpc.omnidat.services.queryOptions());

  return (
    <HydrateClient>
      <main className="min-h-screen bg-[#16140f] text-[#f4ead2]">
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8">
          <header className="border-[#7a694f] border-b pb-7">
            <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <Link className="font-bold tracking-wide" href="/">
                OMNIDAT Exchange 88
              </Link>
              <div className="flex flex-wrap gap-2">
                <Link className="rounded border border-[#7a694f] px-3 py-2" href="/login">
                  Login
                </Link>
                <Link className="rounded border border-[#7a694f] px-3 py-2" href="/console">
                  Operator Console
                </Link>
                <Link className="rounded border border-[#7a694f] px-3 py-2" href="/noc">
                  NOC
                </Link>
                <Link className="rounded border border-[#7a694f] px-3 py-2" href="/operator-admin">
                  Admin
                </Link>
                <Link className="rounded border border-[#7a694f] px-3 py-2" href="/what-is-real">
                  What is real
                </Link>
              </div>
            </nav>

            <div className="mt-12 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <p className="text-sm font-semibold uppercase text-[#c0a36e]">
                  Packet clearing for ambitious campsites
                </p>
                <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight sm:text-6xl">
                  OMNIDAT X.25 makes your camp a business terminal.
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-7 text-[#d9cbb0]">
                  Register services, assign X.121 addresses, publish verbs,
                  settle through ShadyBucks, and connect through MeshCore,
                  Meshtastic, Wi-Fi, POTS, ShadyTel, or hosted OMNIDAT
                  infrastructure.
                </p>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c9b999]">
                  We support "business" in the formal
                  <a className="mx-1 underline" href="https://haha.business">
                    haha.business
                  </a>
                  sense: future-forward commerce, directory entries, and terminal
                  paperwork with just enough ceremony to feel real.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link className="rounded bg-[#d8b46f] px-4 py-3 font-semibold text-[#16140f]" href="/console">
                    Configure Circuit
                  </Link>
                  <Link className="rounded border border-[#7a694f] px-4 py-3 font-semibold" href="/login">
                    Login
                  </Link>
                </div>
              </div>
              <pre className="overflow-x-auto rounded border border-[#7a694f] bg-black p-5 font-mono text-sm leading-6 text-[#8ee36c]">
                {`OMNIDAT 88 READY
CALL 311088010110
CONNECT PACKET CLEARING DIRECTORY
DIR CAMP
311088020501  MILIWAYS ORDER ENTRY
311088030021  PASSPORT LOG ENTRY
311088030100  OMNIBUCKS ATM PAD
OK`}
              </pre>
            </div>
          </header>

          <OmnidatHomeDashboard />

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded border border-[#4f3920] bg-[#211d15] p-5">
              <h2 className="text-lg font-bold text-[#f2cf8b]">Join</h2>
              <p className="mt-2 text-sm leading-6 text-[#d9cbb0]">
                Submit a campsite namespace request, choose a transport, and get
                a packet clearing receipt.
              </p>
            </div>
            <div className="rounded border border-[#4f3920] bg-[#211d15] p-5">
              <h2 className="text-lg font-bold text-[#f2cf8b]">Create Apps</h2>
              <p className="mt-2 text-sm leading-6 text-[#d9cbb0]">
                Define verbs, inputs, outputs, billing behavior, and X.121
                addresses for terminal-native services.
              </p>
            </div>
            <div className="rounded border border-[#4f3920] bg-[#211d15] p-5">
              <h2 className="text-lg font-bold text-[#f2cf8b]">Operate</h2>
              <p className="mt-2 text-sm leading-6 text-[#d9cbb0]">
                Monitor circuits, provision PDFs, publish service directory
                entries, and hand ATM setup receipts to ShadyBucks operators.
              </p>
            </div>
          </section>
        </section>
      </main>
    </HydrateClient>
  );
}
