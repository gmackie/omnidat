"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";
import { OmnidatTransportBoard } from "./omnidat-transport-board";

export function DirectoryBoard() {
  const trpc = useTRPC();
  const services = useQuery(trpc.omnidat.services.queryOptions());
  const dashboard = useQuery(trpc.omnidat.dashboard.queryOptions());
  const network = useQuery(trpc.omnidat.network.queryOptions());

  const list = services.data?.services ?? [];
  const metrics = dashboard.data?.metrics;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Services"
          value={String(metrics?.totalServices ?? list.length)}
        />
        <Metric
          label="Up"
          value={String(metrics?.upServices ?? "—")}
        />
        <Metric
          label="Adapter"
          value={network.data?.status ?? "ready"}
        />
      </section>

      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <h2 className="text-2xl font-bold">Exchange 88 Services</h2>
        <p className="mt-1 text-sm text-[#c0a36e]">
          DIR / CALL targets. Verbs shown for operator and pad use.
        </p>
        <div className="mt-4 grid gap-3">
          {list.map((service) => (
            <article
              key={service.slug}
              className="rounded border border-[#5c4a32] bg-[#17130d] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-lg text-[#9ed783]">
                    {service.x121}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">{service.name}</h3>
                  <p className="text-xs text-[#9a8a6e]">
                    {service.slug} · {service.owner}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs uppercase">
                  <span className="rounded border border-[#7a694f] px-2 py-1">
                    {service.category}
                  </span>
                  <span
                    className={
                      service.status === "up"
                        ? "text-[#9ed783]"
                        : "text-[#f0a875]"
                    }
                  >
                    {service.status}
                    {service.reachable === false ? " · unreachable" : ""}
                  </span>
                </div>
              </div>
              <ul className="mt-3 flex flex-wrap gap-2 font-mono text-xs">
                {service.verbs.map((verb) => (
                  <li
                    key={verb.name}
                    className="rounded border border-[#33291d] px-2 py-1 text-[#c0a36e]"
                    title={verb.description}
                  >
                    {verb.name}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <OmnidatTransportBoard />

      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <h2 className="text-2xl font-bold">Etiquette</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#d9cbb0]">
          <li>Be brief on 020xxx campsite apps — short sessions, honest CLR.</li>
          <li>
            Clear with an explicit cause; never drop a call silently.
          </li>
          <li>
            Play-money rails only unless a posted money policy says otherwise (
            <a className="underline text-[#9ed783]" href="/what-is-real">
              what is real
            </a>
            ).
          </li>
          <li>
            Operators: provision and CALL from{" "}
            <a className="underline text-[#9ed783]" href="/console">
              console
            </a>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#5c4a32] bg-[#17130d] p-4">
      <p className="text-sm text-[#c0a36e]">{props.label}</p>
      <p className="mt-2 font-mono text-xl font-bold">{props.value}</p>
    </div>
  );
}
