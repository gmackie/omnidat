"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { useTRPC } from "~/trpc/react";
import { OmnidatTransportBoard } from "./omnidat-transport-board";

export function PublicStatusBoard() {
  const trpc = useTRPC();
  const status = useQuery(trpc.omnidat.publicStatus.queryOptions({}));

  if (status.isError) {
    return (
      <p className="rounded border border-[#a1471f] bg-[#2c1a12] p-4 font-mono text-sm text-[#f0a875]">
        Status unavailable
      </p>
    );
  }

  const data = status.data;
  const sync = data?.sync;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Network"
          value={
            data
              ? `${data.network.protocol} ${data.network.status}`
              : "loading"
          }
        />
        <Tile
          label="Services up"
          value={
            data
              ? `${data.metrics.upServices}/${data.metrics.totalServices}`
              : "—"
          }
        />
        <Tile
          label="Authority"
          value={
            sync
              ? `${sync.holder.toUpperCase()} e${sync.epoch}`
              : "—"
          }
        />
        <Tile
          label="Bank rail"
          value={
            data
              ? `${data.bank.rail}${data.bank.testnet ? " testnet" : ""}`
              : "—"
          }
        />
      </section>

      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <h2 className="text-xl font-bold">Adapter &amp; sync</h2>
        <dl className="mt-3 grid gap-2 font-mono text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[#c0a36e]">Source</dt>
            <dd>{data?.network.source ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[#c0a36e]">As of</dt>
            <dd>{data?.asOf ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[#c0a36e]">Sync holder</dt>
            <dd>{sync?.holder ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[#c0a36e]">Staleness</dt>
            <dd>
              {sync?.stalenessSeconds != null
                ? `${sync.stalenessSeconds}s`
                : "n/a"}
            </dd>
          </div>
          <div>
            <dt className="text-[#c0a36e]">Merchant link</dt>
            <dd>{data?.bank.merchantLinkStatus ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[#c0a36e]">Campsite apps</dt>
            <dd>{data?.metrics.campsiteApps ?? 0}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded border border-[#4f6b3a] bg-[#1a2413] p-5">
        <h2 className="text-xl font-bold text-[#9ed783]">Honesty flags</h2>
        <ul className="mt-3 space-y-1 font-mono text-sm text-[#d9cbb0]">
          <li>
            event-critical utility:{" "}
            {data?.honesty.eventCritical ? "CLAIMED" : "NOT PROMISED"}
          </li>
          <li>
            cash redemption:{" "}
            {data?.honesty.cashRedemption ? "CLAIMED" : "NOT PROMISED"}
          </li>
          <li>
            simulation layer:{" "}
            {data?.honesty.simulation ? "ACTIVE" : "off"}
          </li>
        </ul>
        <p className="mt-3 text-sm">
          <Link className="underline text-[#9ed783]" href="/what-is-real">
            Full claim matrix
          </Link>
        </p>
      </section>

      <OmnidatTransportBoard compact />
    </div>
  );
}

function Tile(props: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#5c4a32] bg-[#17130d] p-4">
      <p className="text-sm text-[#c0a36e]">{props.label}</p>
      <p className="mt-2 font-mono text-lg font-bold">{props.value}</p>
    </div>
  );
}
