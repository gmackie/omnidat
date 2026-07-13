"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "~/trpc/react";

const CLEAR_PRESETS = [
  { label: "Normal DTE", cause: 0, diagnostic: 0 },
  { label: "NP (13/67)", cause: 13, diagnostic: 67 },
  { label: "NA (11/70)", cause: 11, diagnostic: 70 },
  { label: "DER (9/0)", cause: 9, diagnostic: 0 },
  { label: "OCC (1/0)", cause: 1, diagnostic: 0 },
  { label: "NC (5/71)", cause: 5, diagnostic: 71 },
] as const;

export function OmnidatNocDashboard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [clearNotice, setClearNotice] = useState<string | null>(null);
  const noc = useQuery(trpc.omnidat.noc.queryOptions());
  const operations = useQuery(trpc.omnidat.operations.queryOptions());
  // Operator-gated views: the public status board renders without them, an
  // authenticated operator additionally sees live sessions and evidence.
  const packetSessions = useQuery({
    ...trpc.omnidat.listPacketSessions.queryOptions(),
    retry: 1,
    staleTime: 5_000,
  });
  const evidence = useQuery({
    ...trpc.omnidat.listEvidenceArtifacts.queryOptions({}),
    retry: 1,
    staleTime: 5_000,
  });
  const clearSession = useMutation(
    trpc.omnidat.clearPacketSession.mutationOptions({
      onSuccess: (result) => {
        setClearNotice(
          `Cleared ${result.id.slice(0, 8)} C:${result.clearCause} D:${result.clearDiagnostic}`,
        );
        void queryClient.invalidateQueries(
          trpc.omnidat.listPacketSessions.queryFilter(),
        );
      },
      onError: (error: { message?: string }) => {
        setClearNotice(
          /role required|FORBIDDEN/i.test(error.message ?? "")
            ? "session.write required to clear sessions."
            : (error.message ?? "Clear failed"),
        );
      },
    }),
  );
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

      <AuthorityDrillPanel />

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

      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <h2 className="text-2xl font-bold">Packet Sessions</h2>
        <p className="mt-1 text-sm text-[#c0a36e]">
          Live sessions from signed-in VT100/XOT CALL. Operators can clear open
          sessions with honest X.25 cause codes (session.write).
        </p>
        {clearNotice ? (
          <p className="mt-2 font-mono text-xs text-[#f0a875]">{clearNotice}</p>
        ) : null}
        {packetSessions.isError ? (
          <p className="mt-4 font-mono text-sm text-[#d9cbb0]">
            AUTH/ROLE REQUIRED — sign in at /login to list sessions
          </p>
        ) : sessions.length === 0 ? (
          <p className="mt-4 font-mono text-sm text-[#d9cbb0]">
            NO SESSIONS — place a CALL from /console/terminal while signed in
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="text-left text-[#c0a36e]">
                <tr>
                  <th className="border-b border-[#5c4a32] py-2">Destination X.121</th>
                  <th className="border-b border-[#5c4a32] py-2">Source</th>
                  <th className="border-b border-[#5c4a32] py-2">Transport</th>
                  <th className="border-b border-[#5c4a32] py-2">Status</th>
                  <th className="border-b border-[#5c4a32] py-2">Clear</th>
                  <th className="border-b border-[#5c4a32] py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const open =
                    session.status !== "cleared" &&
                    session.clearCause === null;
                  return (
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
                      <td className="border-b border-[#33291d] py-3">
                        {open ? (
                          <div className="flex flex-wrap gap-1">
                            {CLEAR_PRESETS.map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                className="rounded border border-[#5c4a32] px-1.5 py-0.5 text-[10px] uppercase disabled:opacity-50"
                                disabled={clearSession.isPending}
                                title={`CLR ${preset.label}`}
                                onClick={() =>
                                  clearSession.mutate({
                                    sessionId: session.id,
                                    clearCause: preset.cause,
                                    clearDiagnostic: preset.diagnostic,
                                    transcript: `NOC clear ${preset.label} for ${session.destinationX121}`,
                                  })
                                }
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-[#9a8a6e]">cleared</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <NocIncidentBoard />

      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <h2 className="text-2xl font-bold">Evidence Artifacts</h2>
        <p className="mt-1 text-sm text-[#c0a36e]">
          Packet-call receipts and exports (operator role required).
        </p>
        {evidence.isError ? (
          <p className="mt-4 font-mono text-sm text-[#d9cbb0]">
            AUTH/ROLE REQUIRED — sign in at /login to list evidence
          </p>
        ) : artifacts.length === 0 ? (
          <p className="mt-4 font-mono text-sm text-[#d9cbb0]">
            NO ARTIFACTS — CALL a service to create a packet-call-receipt
          </p>
        ) : (
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
        )}
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

function NocIncidentBoard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const incidents = useQuery({
    ...trpc.omnidat.listIncidents.queryOptions(),
    retry: 1,
    staleTime: 5_000,
  });
  const update = useMutation(
    trpc.omnidat.updateIncident.mutationOptions({
      onSuccess: (_r, input) => {
        setNotice(`Incident ${input.incidentId.slice(0, 8)} → ${input.status}`);
        void queryClient.invalidateQueries(
          trpc.omnidat.listIncidents.queryFilter(),
        );
      },
      onError: (error: { message?: string }) => {
        setNotice(
          /role required|FORBIDDEN/i.test(error.message ?? "")
            ? "incident.write required."
            : (error.message ?? "Update failed"),
        );
      },
    }),
  );

  const rows = incidents.data?.incidents ?? [];
  const openCount = rows.filter((i) => i.status !== "resolved").length;

  return (
    <section
      className="rounded border border-[#4f3920] bg-[#211d15] p-5"
      data-testid="noc-incidents"
    >
      <h2 className="text-2xl font-bold">Incident Board</h2>
      <p className="mt-1 text-sm text-[#c0a36e]">
        Live NOC incidents ({openCount} open/mitigating). Manage from Console
        CRUD for create.
      </p>
      {notice ? (
        <p className="mt-2 font-mono text-xs text-[#f0a875]">{notice}</p>
      ) : null}
      {incidents.isError ? (
        <p className="mt-4 font-mono text-sm text-[#d9cbb0]">
          AUTH/ROLE REQUIRED — sign in to list incidents
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-4 font-mono text-sm text-[#d9cbb0]">
          NO INCIDENTS — open one from /console Operator CRUD
        </p>
      ) : (
        <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto font-mono text-xs">
          {rows.slice(0, 20).map((inc) => (
            <li
              key={inc.id}
              className="flex flex-wrap items-center gap-2 border-b border-[#33291d] py-1.5"
            >
              <span className="text-[#9ed783]">{inc.id.slice(0, 8)}</span>
              <span className="uppercase text-[#c0a36e]">{inc.status}</span>
              <span className="uppercase">{inc.severity}</span>
              <span className="text-[#d9cbb0]">{inc.title}</span>
              {inc.status !== "resolved" ? (
                <span className="ml-auto flex gap-1">
                  {inc.status !== "mitigating" ? (
                    <button
                      type="button"
                      className="rounded border border-[#5c4a32] px-1.5 py-0.5 text-[10px] uppercase"
                      disabled={update.isPending}
                      onClick={() =>
                        update.mutate({
                          incidentId: inc.id,
                          status: "mitigating",
                        })
                      }
                    >
                      Mitigate
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded border border-[#9ed783] px-1.5 py-0.5 text-[10px] uppercase text-[#9ed783]"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({
                        incidentId: inc.id,
                        status: "resolved",
                        timeToClearMinutes: 15,
                      })
                    }
                  >
                    Resolve
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Split-authority status + failover drill.
 * authorityStatus is public (holder/epoch/sources); transferAuthority and
 * registerSyncSource require authority.transfer (admin / noc-operator).
 */
function AuthorityDrillPanel() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [eventId, setEventId] = useState("");
  const [toHolder, setToHolder] = useState<"field" | "cloud">("cloud");
  const [toSourceId, setToSourceId] = useState("cloud");
  const [reason, setReason] = useState(
    "NOC failover drill — field kit unreachable",
  );
  const [fieldSourceId, setFieldSourceId] = useState("field-kit-01");
  const [notice, setNotice] = useState<string | null>(null);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const events = useQuery({
    ...trpc.omnidat.listEvents.queryOptions(),
    retry: 1,
  });

  // Prefer a real event UUID once the list loads.
  const eventOptions = events.data?.events ?? [];
  const effectiveEventId =
    eventId.trim() || eventOptions[0]?.id || "";

  const status = useQuery({
    ...trpc.omnidat.authorityStatus.queryOptions({
      eventId: effectiveEventId || null,
    }),
    retry: 1,
    staleTime: 5_000,
  });

  const transfer = useMutation(
    trpc.omnidat.transferAuthority.mutationOptions({
      onSuccess: (result) => {
        setNotice(
          `Authority transferred → holder=${result.holder} epoch=${result.epoch} fence=${result.fenceSeq ?? 0}`,
        );
        void queryClient.invalidateQueries(
          trpc.omnidat.authorityStatus.queryFilter(),
        );
        void queryClient.invalidateQueries(trpc.omnidat.noc.queryFilter());
        void queryClient.invalidateQueries(
          trpc.omnidat.dashboard.queryFilter(),
        );
      },
      onError: (error: { message?: string }) => {
        setNotice(
          /role required|FORBIDDEN/i.test(error.message ?? "")
            ? "Operator role with authority.transfer required."
            : (error.message ?? "Transfer failed."),
        );
      },
    }),
  );

  const registerSource = useMutation(
    trpc.omnidat.registerSyncSource.mutationOptions({
      onSuccess: (result) => {
        setIssuedToken(result.syncToken);
        setNotice(
          result.rotated
            ? `Rotated sync token for ${result.sourceId} (copy once below)`
            : `Registered ${result.sourceId} (copy sync token once below)`,
        );
        setToSourceId(result.sourceId);
        void queryClient.invalidateQueries(
          trpc.omnidat.authorityStatus.queryFilter(),
        );
      },
      onError: (error: { message?: string }) => {
        setNotice(
          /role required|FORBIDDEN/i.test(error.message ?? "")
            ? "Operator role with authority.transfer required to register field kits."
            : (error.message ?? "Register failed."),
        );
      },
    }),
  );

  const authority = status.data?.authority;
  const sources = status.data?.sources ?? [];

  return (
    <section
      className="rounded border border-[#4f3920] bg-[#211d15] p-5"
      data-testid="authority-drill"
    >
      <h2 className="text-2xl font-bold">Authority &amp; Failover Drill</h2>
      <p className="mt-1 text-sm text-[#c0a36e]">
        Field kit authoritative during active events; cloud primary on
        failover. Transfers require{" "}
        <span className="font-mono">authority.transfer</span> and refuse
        targets that have not caught up. Use the event UUID (not event code).
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Status
          label="Holder"
          value={authority?.holder?.toUpperCase() ?? "—"}
        />
        <Status
          label="Epoch"
          value={authority ? String(authority.epoch) : "—"}
        />
        <Status
          label="Source"
          value={authority?.holderSourceId ?? "none"}
        />
        <Status
          label="Fence seq"
          value={
            authority?.fenceSeq !== undefined && authority?.fenceSeq !== null
              ? String(authority.fenceSeq)
              : "—"
          }
        />
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold uppercase text-[#c0a36e]">
          Sync sources
        </h3>
        {status.isError ? (
          <p className="mt-2 font-mono text-sm text-[#d9cbb0]">
            Authority status unavailable
          </p>
        ) : sources.length === 0 ? (
          <p className="mt-2 font-mono text-sm text-[#d9cbb0]">
            No registered sync sources — register a field kit below, then
            transfer field ↔ cloud
          </p>
        ) : (
          <ul className="mt-2 space-y-1 font-mono text-sm">
            {sources.map((source) => (
              <li
                key={source.sourceId}
                className="flex flex-wrap gap-3 border-b border-[#33291d] py-1"
              >
                <button
                  type="button"
                  className="text-[#9ed783] underline"
                  onClick={() => setToSourceId(source.sourceId)}
                >
                  {source.sourceId}
                </button>
                <span className="text-[#c0a36e]">{source.sourceKind}</span>
                <span>seq {source.lastPushedSeq}</span>
                <span className="uppercase">
                  {source.active ? "active" : "inactive"}
                </span>
                <span className="text-[#9a8a6e]">
                  {source.lastSyncAt
                    ? `sync ${new Date(source.lastSyncAt).toISOString()}`
                    : "never synced"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 rounded border border-[#5c4a32] bg-[#17130d] p-4">
        <h3 className="text-sm font-semibold uppercase text-[#c0a36e]">
          Register field kit
        </h3>
        <p className="mt-1 text-[10px] text-[#9a8a6e]">
          Issues a one-time sync token (SHA-256 stored). Use with{" "}
          <span className="font-mono">./scripts/authority-drill</span> or
          syncPush.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <input
            aria-label="field source id"
            className="rounded border border-[#5c4a32] bg-[#211d15] px-2 py-1 font-mono"
            value={fieldSourceId}
            onChange={(e) => setFieldSourceId(e.target.value)}
            placeholder="field-kit-01"
          />
          <button
            type="button"
            className="rounded border border-[#9ed783] px-3 py-1 text-[#9ed783] disabled:opacity-50"
            disabled={
              registerSource.isPending || !fieldSourceId.trim()
            }
            onClick={() =>
              registerSource.mutate({
                sourceId: fieldSourceId.trim(),
                sourceKind: "field-kit",
              })
            }
          >
            {registerSource.isPending
              ? "Registering…"
              : "Register / rotate token"}
          </button>
        </div>
        {issuedToken ? (
          <p
            className="mt-3 break-all rounded border border-[#4f6b3a] bg-[#1a2413] px-3 py-2 font-mono text-[10px] text-[#9ed783]"
            data-testid="sync-token-once"
          >
            SYNC TOKEN (copy once): {issuedToken}
          </p>
        ) : null}
      </div>

      <div className="mt-5 rounded border border-[#5c4a32] bg-[#17130d] p-4">
        <h3 className="text-sm font-semibold uppercase text-[#c0a36e]">
          Transfer authority (drill)
        </h3>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <select
            aria-label="event for authority transfer"
            className="rounded border border-[#5c4a32] bg-[#211d15] px-2 py-1 font-mono"
            value={effectiveEventId}
            onChange={(e) => setEventId(e.target.value)}
          >
            <option value="">
              {events.isError
                ? "sign in for events"
                : eventOptions.length === 0
                  ? "create an event first"
                  : "select event uuid"}
            </option>
            {eventOptions.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.eventCode} — {ev.status} ({ev.id.slice(0, 8)})
              </option>
            ))}
          </select>
          <input
            aria-label="event id for authority transfer"
            className="min-w-[12rem] rounded border border-[#5c4a32] bg-[#211d15] px-2 py-1 font-mono text-xs"
            value={eventId || effectiveEventId}
            onChange={(e) => setEventId(e.target.value)}
            placeholder="event uuid"
          />
          <select
            aria-label="transfer holder"
            className="rounded border border-[#5c4a32] bg-[#211d15] px-2 py-1"
            value={toHolder}
            onChange={(e) => {
              const holder = e.target.value as "field" | "cloud";
              setToHolder(holder);
              if (holder === "cloud") setToSourceId("cloud");
              else if (sources[0]?.sourceId) setToSourceId(sources[0].sourceId);
              else setToSourceId(fieldSourceId);
            }}
          >
            <option value="cloud">cloud</option>
            <option value="field">field</option>
          </select>
          <input
            aria-label="target source id"
            className="rounded border border-[#5c4a32] bg-[#211d15] px-2 py-1 font-mono"
            value={toSourceId}
            onChange={(e) => setToSourceId(e.target.value)}
            placeholder="toSourceId"
          />
          <input
            aria-label="transfer reason"
            className="min-w-[16rem] flex-1 rounded border border-[#5c4a32] bg-[#211d15] px-2 py-1"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="reason"
          />
          <button
            type="button"
            className="rounded bg-[#c0a36e] px-3 py-1 font-semibold text-black disabled:opacity-50"
            disabled={
              transfer.isPending ||
              !effectiveEventId ||
              !toSourceId.trim() ||
              !reason.trim()
            }
            onClick={() =>
              transfer.mutate({
                eventId: effectiveEventId,
                toHolder,
                toSourceId: toSourceId.trim(),
                reason: reason.trim(),
              })
            }
          >
            {transfer.isPending ? "Transferring…" : "Execute transfer"}
          </button>
        </div>
        {notice ? (
          <p
            className="mt-3 rounded border border-[#a1471f] bg-[#2c1a12] px-3 py-2 font-mono text-xs text-[#f0a875]"
            data-testid="authority-transfer-notice"
          >
            {notice}
          </p>
        ) : null}
      </div>
    </section>
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
