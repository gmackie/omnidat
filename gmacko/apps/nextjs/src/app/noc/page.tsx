import Link from "next/link";

import { OmnidatNocDashboard } from "../_components/omnidat-noc-dashboard";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export default async function NocPage() {
  await prefetch(trpc.omnidat.noc.queryOptions());

  return (
    <HydrateClient>
      <main className="min-h-screen bg-[#16140f] px-5 py-8 text-[#f4ead2]">
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <Link className="font-bold" href="/">
              OMNIDAT Exchange 88
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link className="rounded border border-[#7a694f] px-3 py-2" href="/console">
                Console
              </Link>
              <Link className="rounded border border-[#7a694f] px-3 py-2" href="/admin">
                Admin
              </Link>
            </div>
          </nav>
          <header className="rounded border border-[#4f3920] bg-[#211d15] p-5">
            <p className="text-sm font-semibold uppercase text-[#c0a36e]">
              Circuit State
            </p>
            <h1 className="mt-2 text-3xl font-black">
              Network Operations Center
            </h1>
          </header>
          <OmnidatNocDashboard />
        </section>
      </main>
    </HydrateClient>
  );
}
