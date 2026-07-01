import Link from "next/link";

import { OmnidatOperatorConsole } from "../_components/omnidat-operator-console";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export default async function ConsolePage() {
  await prefetch(trpc.omnidat.dashboard.queryOptions());
  await prefetch(trpc.omnidat.services.queryOptions());
  await prefetch(trpc.omnidat.foodProtocol.queryOptions());
  await prefetch(trpc.omnidat.atmProtocol.queryOptions());

  return (
    <HydrateClient>
      <main className="min-h-screen bg-[#16140f] px-5 py-8 text-[#f4ead2]">
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <Link className="font-bold" href="/">
              OMNIDAT Exchange 88
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link className="rounded border border-[#7a694f] px-3 py-2" href="/noc">
                NOC
              </Link>
              <Link className="rounded border border-[#7a694f] px-3 py-2" href="/operator-admin">
                Admin
              </Link>
            </div>
          </nav>
          <header className="rounded border border-[#4f3920] bg-[#211d15] p-5">
            <p className="text-sm font-semibold uppercase text-[#c0a36e]">
              Operator Console
            </p>
            <h1 className="mt-2 text-3xl font-black">PDF Configuration</h1>
            <p className="mt-2 text-sm leading-6 text-[#d9cbb0]">
              Provisioning Verification confirms the camp PDF, transport, and
              service route against the Exchange 88 X.25 adapter.
            </p>
          </header>
          <OmnidatOperatorConsole />
        </section>
      </main>
    </HydrateClient>
  );
}
