"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";

export function OmnidatNocDashboard() {
  const trpc = useTRPC();
  const noc = useQuery(trpc.omnidat.noc.queryOptions());
  const operations = useQuery(trpc.omnidat.operations.queryOptions());
  // Operator-gated views: the public status board renders without them, an
  // authenticated operator additionally sees live sessions and evidence.
  const packetSessions = useQuery({
    ...trpc.omnidat.listPacketSessions.queryOptions(),
    retry: false,
  });
  const evidence = useQuery({
    ...trpc.omnidat.listEvidenceArtifacts.queryOptions(),
    retry: false,
  });
  const sessions = packetSessions.data?.sessions ?? [];
  const artifacts = evidence.data?.artifacts ?? [];

  return (
    <div className="grid gap-5">
      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <p className="text-sm font-semibold uppercase text-[#c0a36e]">
          {noc.data?.center ?? "Exchange 88 Network Operations Center"}
        </p>
        <h1 className="mt-2 text-3xl font-black">Network Operations Center</h1>
        {noc.data?.sync ? <SyncBanner sync={noc.data.sync} /> : null}
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

      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <h2 className="text-2xl font-bold">PAD and XOT Terminal Inventory</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="text-left text-[#c0a36e]">
              <tr>
                <th className="border-b border-[#5c4a32] py-2">X.121</th>
                <th className="border-b border-[#5c4a32] py-2">Endpoint</th>
                <th className="border-b border-[#5c4a32] py-2">Kind</th>
                <th className="border-b border-[#5c4a32] py-2">Transport</th>
                <th className="border-b border-[#5c4a32] py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(operations.data?.pads ?? []).map((pad) => (
                <tr key={pad.id}>
                  <td className="border-b border-[#33291d] py-3 font-mono">
                    {pad.x121}
                  </td>
                  <td className="border-b border-[#33291d] py-3">
                    {pad.endpointLabel}
                  </td>
                  <td className="border-b border-[#33291d] py-3">
                    {pad.padKind}
                  </td>
                  <td className="border-b border-[#33291d] py-3">
                    {pad.transport}
                  </td>
                  <td className="border-b border-[#33291d] py-3 uppercase">
                    {pad.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {sessions.length > 0 ? (
        <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
          <h2 className="text-2xl font-bold">Packet Sessions</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="text-left text-[#c0a36e]">
                <tr>
                  <th className="border-b border-[#5c4a32] py-2">Destination X.121</th>
                  <th className="border-b border-[#5c4a32] py-2">Source</th>
                  <th className="border-b border-[#5c4a32] py-2">Transport</th>
                  <th className="border-b border-[#5c4a32] py-2">Status</th>
                  <th className="border-b border-[#5c4a32] py-2">Clear</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="border-b border-[#33291d] py-3 font-mono">
                      {session.destinationX121}
                    </td>
                    <td className="border-b border-[#33291d] py-3">
                      {session.sourceIdentity}
                    </td>
                    <td className="border-b border-[#33291d] py-3">
                      {session.sourceTransport}
                    </td>
                    <td className="border-b border-[#33291d] py-3 uppercase">
                      {session.status}
                    </td>
                    <td className="border-b border-[#33291d] py-3 font-mono">
                      {session.clearCause === null
                        ? "-"
                        : `C:${session.clearCause} D:${session.clearDiagnostic ?? 0}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {artifacts.length > 0 ? (
        <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
          <h2 className="text-2xl font-bold">Evidence Artifacts</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {artifacts.map((artifact) => (
              <article
                className="rounded border border-[#5c4a32] bg-[#17130d] p-4"
                key={artifact.id}
              >
                <p className="text-sm uppercase text-[#c0a36e]">
                  {artifact.artifactKind}
                </p>
                <h3 className="mt-1 font-semibold">{artifact.label}</h3>
                <p className="mt-2 break-all font-mono text-sm text-[#9ed783]">
                  {artifact.url}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
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

type SyncState = {
  holder: string;
  epoch: number;
  sourceId: string | null;
  lastSyncAt: string | Date | null;
  stalenessSeconds: number | null;
};

const STALENESS_ESCALATION_SECONDS = 300;

// Renders the honest field-data banner from the server-computed staleness.
// The browser clock is never consulted, so stale field data is never shown as
// live.
export function syncBannerText(sync: SyncState): string {
  if (sync.holder !== "field") {
    return `CLOUD PRIMARY (EPOCH ${sync.epoch})`;
  }
  if (sync.stalenessSeconds === null || sync.lastSyncAt === null) {
    return "FIELD AUTHORITATIVE — AWAITING FIRST SYNC";
  }
  const at = new Date(sync.lastSyncAt);
  const clock = `${String(at.getUTCHours()).padStart(2, "0")}:${String(
    at.getUTCMinutes(),
  ).padStart(2, "0")}`;
  const minutes = Math.floor(sync.stalenessSeconds / 60);
  const age = minutes < 1 ? "LESS THAN 1 MIN AGO" : `${minutes} MIN AGO`;
  return `FIELD DATA AS OF ${clock} (${age})`;
}

function SyncBanner(props: { sync: SyncState }) {
  const escalated =
    props.sync.holder === "field" &&
    (props.sync.stalenessSeconds ?? 0) > STALENESS_ESCALATION_SECONDS;
  const tone = escalated
    ? "border-[#a1471f] bg-[#2c1a12] text-[#f0a875]"
    : "border-[#4f6b3a] bg-[#1a2413] text-[#9ed783]";
  return (
    <p
      className={`mt-3 rounded border px-3 py-2 font-mono text-sm font-bold uppercase ${tone}`}
      data-testid="sync-banner"
    >
      {syncBannerText(props.sync)}
    </p>
  );
}
