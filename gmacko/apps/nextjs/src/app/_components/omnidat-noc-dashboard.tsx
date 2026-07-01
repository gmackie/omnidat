"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";

export function OmnidatNocDashboard() {
  const trpc = useTRPC();
  const noc = useQuery(trpc.omnidat.noc.queryOptions());

  return (
    <div className="grid gap-5">
      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <p className="text-sm font-semibold uppercase text-[#c0a36e]">
          {noc.data?.center ?? "Exchange 88 Network Operations Center"}
        </p>
        <h1 className="mt-2 text-3xl font-black">Network Operations Center</h1>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Status label="Protocol" value={noc.data?.adapter.protocol ?? "X.25"} />
          <Status label="Adapter" value={noc.data?.adapter.source ?? "loading"} />
          <Status label="State" value={noc.data?.adapter.status ?? "loading"} />
        </div>
      </section>

      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <h2 className="text-2xl font-bold">Circuit State</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="text-left text-[#c0a36e]">
              <tr>
                <th className="border-b border-[#5c4a32] py-2">X.121</th>
                <th className="border-b border-[#5c4a32] py-2">Service</th>
                <th className="border-b border-[#5c4a32] py-2">Transport</th>
                <th className="border-b border-[#5c4a32] py-2">Latency</th>
                <th className="border-b border-[#5c4a32] py-2">Loss</th>
                <th className="border-b border-[#5c4a32] py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(noc.data?.circuits ?? []).map((circuit) => (
                <tr key={circuit.x121}>
                  <td className="border-b border-[#33291d] py-3 font-mono">
                    {circuit.x121}
                  </td>
                  <td className="border-b border-[#33291d] py-3">
                    {circuit.service}
                  </td>
                  <td className="border-b border-[#33291d] py-3">
                    {circuit.transport}
                  </td>
                  <td className="border-b border-[#33291d] py-3">
                    {circuit.latencyMs} ms
                  </td>
                  <td className="border-b border-[#33291d] py-3">
                    {(circuit.packetLoss * 100).toFixed(1)}%
                  </td>
                  <td className="border-b border-[#33291d] py-3 uppercase">
                    {circuit.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <h2 className="text-2xl font-bold">X.25 Adapter Services</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(noc.data?.services ?? []).map((service) => (
            <article
              className="rounded border border-[#5c4a32] bg-[#17130d] p-4"
              key={service.x121}
            >
              <p className="font-mono text-sm text-[#9ed783]">{service.x121}</p>
              <h3 className="mt-1 font-semibold">{service.name}</h3>
              <p className="mt-2 text-sm text-[#d9cbb0]">
                {service.verbs.length} verbs defined by {service.owner}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Status(props: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#5c4a32] bg-[#17130d] p-4">
      <p className="text-sm text-[#c0a36e]">{props.label}</p>
      <p className="mt-2 font-mono text-lg font-bold">{props.value}</p>
    </div>
  );
}
