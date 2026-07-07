"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";

export function OmnidatHomeDashboard() {
  const trpc = useTRPC();
  const dashboard = useQuery(trpc.omnidat.dashboard.queryOptions());
  const services = useQuery(trpc.omnidat.services.queryOptions());

  if (!dashboard.data || !services.data) {
    return (
      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        Loading OMNIDAT dashboard...
      </section>
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <p className="text-sm font-semibold uppercase text-[#c0a36e]">
          Exchange 88 Status
        </p>
        <p className="text-[10px] text-[#9a8a6e] mt-1">THE RECORD IS TOTAL. COMPLIANCE IS OBSERVED. RESISTANCE IS INEFFICIENCY.</p>
        <h2 className="mt-2 text-2xl font-bold">
          {dashboard.data.network.protocol} {dashboard.data.network.status}
        </h2>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Metric label="Services" value={dashboard.data.metrics.totalServices} />
          <Metric label="Reachable" value={dashboard.data.metrics.upServices} />
          <Metric
            label="Provisioning"
            value={dashboard.data.metrics.pendingProvisioning}
          />
          <Metric
            label="Accounts"
            value={dashboard.data.metrics.billingAccounts}
          />
        </dl>
      </div>

      <div className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase text-[#c0a36e]">
              Service Directory
            </p>
            <h2 className="mt-2 text-2xl font-bold">X.121 Published Apps</h2>
          </div>
          <p className="font-mono text-sm text-[#9ed783]">
            {dashboard.data.network.source}
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {services.data.services.map((service) => (
            <article
              className="rounded border border-[#5c4a32] bg-[#17130d] p-4"
              key={service.slug}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm text-[#9ed783]">
                    {service.x121}
                  </p>
                  <h3 className="mt-1 font-semibold">{service.name}</h3>
                </div>
                <span className="rounded border border-[#7a694f] px-2 py-1 text-xs uppercase">
                  {service.status}
                </span>
              </div>
              <p className="mt-3 text-xs uppercase text-[#c0a36e]">
                {service.owner}
              </p>
              <p className="mt-2 text-sm text-[#d9cbb0]">
                {service.verbs.map((verb) => verb.name).join(" / ")}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metric(props: { label: string; value: number }) {
  return (
    <div className="rounded border border-[#5c4a32] bg-[#17130d] p-3">
      <dt className="text-[#c0a36e]">{props.label}</dt>
      <dd className="mt-1 text-2xl font-black">{props.value}</dd>
    </div>
  );
}
