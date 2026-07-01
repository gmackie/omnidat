import Link from "next/link";

import { OmnidatAdminDashboard } from "../_components/omnidat-admin-dashboard";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export default async function OperatorAdminPage() {
  await prefetch(trpc.omnidat.dashboard.queryOptions());
  await prefetch(trpc.omnidat.services.queryOptions());
  await prefetch(trpc.omnidat.billing.queryOptions());
  await prefetch(trpc.omnidat.operations.queryOptions());

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
              <Link className="rounded border border-[#7a694f] px-3 py-2" href="/noc">
                NOC
              </Link>
              <Link className="rounded border border-[#7a694f] px-3 py-2" href="/admin">
                Login Admin
              </Link>
            </div>
          </nav>
          <header className="rounded border border-[#4f3920] bg-[#211d15] p-5">
            <p className="text-sm font-semibold uppercase text-[#c0a36e]">
              ShadyBucks Settlement
            </p>
            <h1 className="mt-2 text-3xl font-black">Service Registry</h1>
            <p className="mt-2 text-sm leading-6 text-[#d9cbb0]">
              Operator-facing registry controls for X.121 services, packet
              verbs, billing ledgers, and audit receipts.
            </p>
          </header>
          <OmnidatAdminDashboard />
        </section>
      </main>
    </HydrateClient>
  );
}
