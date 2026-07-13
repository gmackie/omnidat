import Link from "next/link";

import { PublicStatusBoard } from "../_components/omnidat-public-status";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

/** Public ops status — honest readiness without operator secrets. */
export default async function StatusPage() {
  await prefetch(trpc.omnidat.publicStatus.queryOptions({}));
  await prefetch(trpc.omnidat.listTransports.queryOptions());

  return (
    <HydrateClient>
      <main className="min-h-screen bg-[#16140f] px-5 py-8 text-[#f4ead2]">
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <Link className="font-bold tracking-wide" href="/">
              OMNIDAT Exchange 88
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link
                className="rounded border border-[#9ed783] px-3 py-2 text-[#9ed783]"
                href="/status"
              >
                Status
              </Link>
              <Link
                className="rounded border border-[#7a694f] px-3 py-2"
                href="/directory"
              >
                Directory
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
              Exchange status
            </p>
            <h1 className="mt-2 text-4xl font-black">Live readiness board</h1>
            <p className="mt-3 text-sm leading-7 text-[#d9cbb0]">
              Public metrics only. Not emergency infrastructure. Not cash
              redemption. See honesty page for claim matrix.
            </p>
          </header>

          <PublicStatusBoard />
        </section>
      </main>
    </HydrateClient>
  );
}
