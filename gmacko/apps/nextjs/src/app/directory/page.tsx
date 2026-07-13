import Link from "next/link";

import { DirectoryBoard } from "../_components/omnidat-directory-board";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

/**
 * Public packet directory — services and campsite apps without auth.
 * Operators use /console for CRUD; this is the participant-facing listing.
 */
export default async function DirectoryPage() {
  await prefetch(trpc.omnidat.services.queryOptions());
  await prefetch(trpc.omnidat.dashboard.queryOptions());
  await prefetch(trpc.omnidat.network.queryOptions());
  await prefetch(trpc.omnidat.listTransports.queryOptions());

  return (
    <HydrateClient>
      <main className="min-h-screen bg-[#16140f] px-5 py-8 text-[#f4ead2]">
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <Link className="font-bold tracking-wide" href="/">
              OMNIDAT Exchange 88
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link
                className="rounded border border-[#9ed783] px-3 py-2 text-[#9ed783]"
                href="/directory"
              >
                Directory
              </Link>
              <Link
                className="rounded border border-[#7a694f] px-3 py-2"
                href="/console/terminal"
              >
                VT100
              </Link>
              <Link
                className="rounded border border-[#7a694f] px-3 py-2"
                href="/noc"
              >
                NOC
              </Link>
              <Link
                className="rounded border border-[#7a694f] px-3 py-2"
                href="/what-is-real"
              >
                What is real
              </Link>
              <Link
                className="rounded border border-[#7a694f] px-3 py-2"
                href="/login"
              >
                Login
              </Link>
            </div>
          </nav>

          <header className="rounded border border-[#4f3920] bg-[#211d15] p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#c0a36e]">
              Packet Clearing Directory
            </p>
            <h1 className="mt-2 text-4xl font-black">X.121 Service Map</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#d9cbb0]">
              Public listing of Exchange 88 services and open-namespace
              campsite apps. Be brief, use honest CLR, respect 020xxx
              etiquette. CALL from the VT100 terminal when signed in as an
              operator.
            </p>
          </header>

          <DirectoryBoard />
        </section>
      </main>
    </HydrateClient>
  );
}
