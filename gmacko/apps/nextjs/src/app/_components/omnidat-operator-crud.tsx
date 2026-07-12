"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "~/trpc/react";

// Sequential provisioning path (mirrors PROVISIONING_STATES in omnidat-persistence).
// Illegal jumps are rejected by the API; the UI only offers the next legal step.
const PROVISIONING_ORDER = [
  "requested",
  "reviewed",
  "approved",
  "assigned",
  "installed",
  "verified",
  "active",
] as const;

function nextProvisioningStatus(status: string): string | null {
  const index = (PROVISIONING_ORDER as readonly string[]).indexOf(status);
  if (index < 0 || index >= PROVISIONING_ORDER.length - 1) return null;
  return PROVISIONING_ORDER[index + 1] ?? null;
}

function isTerminalProvisioning(status: string) {
  return status === "suspended" || status === "revoked";
}

// H1b operator CRUD: create events and X.121 allocations, and drive an
// allocation through its lifecycle, entirely through gated tRPC. Renders
// inside the authenticated operator console; a FORBIDDEN response surfaces as
// an explicit "role required" notice rather than a silent failure.
export function OmnidatOperatorCrud() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const events = useQuery({ ...trpc.omnidat.listEvents.queryOptions(), retry: false });
  const allocations = useQuery({
    ...trpc.omnidat.listAllocations.queryOptions(undefined),
    retry: false,
  });
  const campsites = useQuery({ ...trpc.omnidat.listCampsites.queryOptions(), retry: false });
  const provisioning = useQuery({ ...trpc.omnidat.listProvisioning.queryOptions(), retry: false });
  const apps = useQuery({ ...trpc.omnidat.listCampsiteApps.queryOptions({}), retry: false });

  const onError = (error: { message?: string }) =>
    setNotice(
      /role required/i.test(error.message ?? "")
        ? "Operator role required for this action."
        : (error.message ?? "Action failed."),
    );

  const [eventCode, setEventCode] = useState("TOORCAMP-2028");
  const [eventName, setEventName] = useState("ToorCamp 2028");
  const [x121, setX121] = useState("311088020777");
  const [campsiteSlug, setCampsiteSlug] = useState("camp-laminar");
  const [campsiteName, setCampsiteName] = useState("Camp Laminar");
  const [contactHandle, setContactHandle] = useState("operator@camp.example");
  const [provisionTransport, setProvisionTransport] = useState("xot");
  const [provisionX121, setProvisionX121] = useState("311088020501");
  const [notice, setNotice] = useState<string | null>(null);

  // H3/H4 demo state
  const [appCampsiteId, setAppCampsiteId] = useState("1");
  const [appAddress, setAppAddress] = useState("020100");
  const [appName, setAppName] = useState("Camp Bulletin");
  const [appKind, setAppKind] = useState("bulletin");

  const createApp = useMutation(
    trpc.omnidat.createCampsiteApp.mutationOptions({ onSuccess: () => void queryClient.invalidateQueries(), onError }),
  );
  const updateAppStatus = useMutation(
    trpc.omnidat.updateCampsiteAppStatus.mutationOptions({ onSuccess: () => void queryClient.invalidateQueries(), onError }),
  );
  const batchClose = useMutation(
    trpc.omnidat.posBatchClose.mutationOptions({ 
      onSuccess: (report) => { 
        void queryClient.invalidateQueries(); 
        setBatchReport(JSON.stringify(report, null, 2)); 
      }, 
      onError 
    }),
  );
  const [batchReport, setBatchReport] = useState<string | null>(null);

  // H1b incident
  const [incidentTitle, setIncidentTitle] = useState("Network issue at PAD-01");
  const [incidentId, setIncidentId] = useState("INC-001");

  const openIncident = useMutation(
    trpc.omnidat.openIncident.mutationOptions({ onSuccess: () => void queryClient.invalidateQueries(), onError }),
  );
  const updateIncident = useMutation(
    trpc.omnidat.updateIncident.mutationOptions({ onSuccess: () => void queryClient.invalidateQueries(), onError }),
  );

  const createEvent = useMutation(
    trpc.omnidat.createEvent.mutationOptions({
      onSuccess: () => {
        setNotice(null);
        void queryClient.invalidateQueries();
      },
      onError,
    }),
  );
  const createCampsite = useMutation(
    trpc.omnidat.createCampsite.mutationOptions({
      onSuccess: () => {
        setNotice(null);
        void queryClient.invalidateQueries();
      },
      onError,
    }),
  );
  const allocateAddress = useMutation(
    trpc.omnidat.allocateAddress.mutationOptions({
      onSuccess: () => {
        setNotice(null);
        void queryClient.invalidateQueries();
      },
      onError,
    }),
  );
  const advanceAllocation = useMutation(
    trpc.omnidat.updateAllocationStatus.mutationOptions({
      onSuccess: () => void queryClient.invalidateQueries(),
      onError,
    }),
  );
  const requestProvisioning = useMutation(
    trpc.omnidat.requestProvisioning.mutationOptions({
      onSuccess: (result) => {
        setNotice(`Provisioning requested: ${result.id} (${result.status})`);
        void queryClient.invalidateQueries();
      },
      onError,
    }),
  );
  const advanceProvisioning = useMutation(
    trpc.omnidat.advanceProvisioning.mutationOptions({
      onSuccess: (result) => {
        setNotice(
          `Provisioning ${result.id}: ${result.from ?? "?"} → ${result.status}`,
        );
        void queryClient.invalidateQueries();
      },
      onError,
    }),
  );

  return (
    <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
      <h2 className="text-2xl font-bold">Operator CRUD</h2>
      {notice ? (
        <p
          className="mt-3 rounded border border-[#a1471f] bg-[#2c1a12] px-3 py-2 text-sm font-semibold text-[#f0a875]"
          data-testid="crud-notice"
        >
          {notice}
        </p>
      ) : null}

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="font-semibold">Events</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              aria-label="event code"
              className="rounded border border-[#5c4a32] bg-[#17130d] px-2 py-1 text-sm"
              value={eventCode}
              onChange={(event) => setEventCode(event.target.value)}
            />
            <input
              aria-label="event name"
              className="rounded border border-[#5c4a32] bg-[#17130d] px-2 py-1 text-sm"
              value={eventName}
              onChange={(event) => setEventName(event.target.value)}
            />
            <button
              className="rounded bg-[#c0a36e] px-3 py-1 text-sm font-semibold text-black"
              onClick={() =>
                createEvent.mutate({ eventCode, displayName: eventName })
              }
            >
              Create event
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {(events.data?.events ?? []).map((item) => (
              <li key={item.id} className="font-mono">
                {item.eventCode} — {item.status}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">Campsites (H3 apps too)</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              aria-label="campsite slug"
              className="rounded border border-[#5c4a32] bg-[#17130d] px-2 py-1 text-sm"
              value={campsiteSlug}
              onChange={(event) => setCampsiteSlug(event.target.value)}
            />
            <input
              aria-label="campsite name"
              className="rounded border border-[#5c4a32] bg-[#17130d] px-2 py-1 text-sm"
              value={campsiteName}
              onChange={(event) => setCampsiteName(event.target.value)}
            />
            <input
              aria-label="contact handle"
              className="rounded border border-[#5c4a32] bg-[#17130d] px-2 py-1 text-sm"
              value={contactHandle}
              onChange={(event) => setContactHandle(event.target.value)}
            />
            <button
              className="rounded bg-[#c0a36e] px-3 py-1 text-sm font-semibold text-black"
              onClick={() =>
                createCampsite.mutate({ slug: campsiteSlug, displayName: campsiteName, contactHandle })
              }
            >
              Create campsite
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {(campsites.data?.campsites ?? []).map((item: any) => (
              <li key={item.id} className="font-mono">
                {item.slug} — {item.status}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">X.121 Allocations</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              aria-label="x121 address"
              className="rounded border border-[#5c4a32] bg-[#17130d] px-2 py-1 font-mono text-sm"
              value={x121}
              onChange={(event) => setX121(event.target.value)}
            />
            <button
              className="rounded bg-[#c0a36e] px-3 py-1 text-sm font-semibold text-black"
              onClick={() =>
                allocateAddress.mutate({ x121, assignedToKind: "service" })
              }
            >
              Allocate
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {(allocations.data?.allocations ?? []).map((item) => (
              <li key={item.id} className="flex items-center gap-2 font-mono">
                <span>
                  {item.x121} — {item.status}
                </span>
                <button
                  className="rounded border border-[#5c4a32] px-2 py-0.5 text-xs uppercase"
                  onClick={() =>
                    advanceAllocation.mutate({
                      allocationId: item.id,
                      x121: item.x121,
                      status: "verified",
                    })
                  }
                >
                  Verify
                </button>
                <button
                  className="rounded border border-[#5c4a32] px-2 py-0.5 text-xs uppercase"
                  onClick={() =>
                    advanceAllocation.mutate({
                      allocationId: item.id,
                      x121: item.x121,
                      status: "suspended",
                    })
                  }
                >
                  Suspend
                </button>
                <button
                  className="rounded border border-[#5c4a32] px-2 py-0.5 text-xs uppercase"
                  onClick={() =>
                    advanceAllocation.mutate({
                      allocationId: item.id,
                      x121: item.x121,
                      status: "revoked",
                    })
                  }
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">Provisioning Lifecycle (H1b)</h3>
          <p className="mt-1 text-[10px] text-[#9a8a6e]">
            Path: requested → reviewed → approved → assigned → installed →
            verified → active. Suspend/revoke allowed from any non-terminal
            state. Illegal jumps are rejected.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              aria-label="provisioning transport"
              className="rounded border border-[#5c4a32] bg-[#17130d] px-2 py-1 text-sm"
              value={provisionTransport}
              onChange={(event) => setProvisionTransport(event.target.value)}
            />
            <input
              aria-label="requested x121"
              className="rounded border border-[#5c4a32] bg-[#17130d] px-2 py-1 font-mono text-sm"
              value={provisionX121}
              onChange={(event) => setProvisionX121(event.target.value)}
            />
            <button
              className="rounded bg-[#c0a36e] px-3 py-1 text-sm font-semibold text-black"
              onClick={() =>
                requestProvisioning.mutate({
                  transport: provisionTransport,
                  requestedX121: provisionX121,
                })
              }
            >
              Request provisioning
            </button>
          </div>
          <ul className="mt-2 space-y-1 text-sm" data-testid="provisioning-list">
            {(provisioning.data?.provisioning ?? []).slice(0, 8).map((item: {
              id: string;
              status: string;
              transport?: string;
              assignedX121?: string | null;
            }) => {
              const next = nextProvisioningStatus(item.status);
              const terminal = isTerminalProvisioning(item.status);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-2 font-mono"
                >
                  <span>
                    {item.assignedX121 || item.id} — {item.status}
                    {item.transport ? ` (${item.transport})` : ""}
                  </span>
                  {next ? (
                    <button
                      className="rounded border border-[#5c4a32] px-2 py-0.5 text-[10px] uppercase"
                      onClick={() =>
                        advanceProvisioning.mutate({
                          requestId: item.id,
                          toStatus: next as
                            | "reviewed"
                            | "approved"
                            | "assigned"
                            | "installed"
                            | "verified"
                            | "active",
                          verificationTranscript:
                            next === "verified"
                              ? `VERIFY ${item.assignedX121 ?? item.id} OK`
                              : undefined,
                        })
                      }
                    >
                      Advance → {next}
                    </button>
                  ) : null}
                  {!terminal ? (
                    <>
                      <button
                        className="rounded border border-[#5c4a32] px-2 py-0.5 text-[10px] uppercase"
                        onClick={() =>
                          advanceProvisioning.mutate({
                            requestId: item.id,
                            toStatus: "suspended",
                          })
                        }
                      >
                        Suspend
                      </button>
                      <button
                        className="rounded border border-[#5c4a32] px-2 py-0.5 text-[10px] uppercase"
                        onClick={() =>
                          advanceProvisioning.mutate({
                            requestId: item.id,
                            toStatus: "revoked",
                          })
                        }
                      >
                        Revoke
                      </button>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-sm">Evidence (camp-deployment-summary)</h3>
          <div className="text-[10px] text-[#9a8a6e]">New kind wired in renderDocument + test. Use for ToorCamp 2028 / CC Camp 2027 artifacts.</div>
        </div>

        <div>
          <h3 className="font-semibold">Incidents (H1b)</h3>
          <div className="mt-1 flex gap-1 text-xs">
            <input className="flex-1 border border-[#5c4a32] bg-[#17130d] px-1" value={incidentTitle} onChange={e=>setIncidentTitle(e.target.value)} />
            <button className="bg-[#c0a36e] px-2 text-black" onClick={() => openIncident.mutate({title: incidentTitle, severity: "minor"})}>Open Incident</button>
          </div>
          <div className="mt-1 flex gap-1 text-xs">
            <input className="w-16 border border-[#5c4a32] bg-[#17130d] px-1" value={incidentId} onChange={e=>setIncidentId(e.target.value)} />
            <button className="bg-[#c0a36e] px-2 text-black" onClick={() => updateIncident.mutate({incidentId, status: "resolved"})}>Resolve</button>
            <span className="text-[10px] text-[#9a8a6e]"> (demo list via NOC/ops)</span>
          </div>
          <ul className="mt-1 text-[10px] text-[#9a8a6e]">
            <li>INC-001 - open - PAD network issue (ToorCamp)</li>
            <li>INC-042 - resolved - ToorCamp prep</li>
            <li>INC-CC27 - open - CC Camp 2027 village setup</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">Campsite Apps (H3)</h3>
          <div className="mt-1 flex flex-wrap gap-1 text-xs">
            <input className="w-20 border border-[#5c4a32] bg-[#17130d] px-1" placeholder="campsiteId" value={appCampsiteId} onChange={e=>setAppCampsiteId(e.target.value)} />
            <input className="w-20 border border-[#5c4a32] bg-[#17130d] px-1" placeholder="x121" value={appAddress} onChange={e=>setAppAddress(e.target.value)} />
            <input className="w-24 border border-[#5c4a32] bg-[#17130d] px-1" placeholder="name" value={appName} onChange={e=>setAppName(e.target.value)} />
            <input className="w-20 border border-[#5c4a32] bg-[#17130d] px-1" placeholder="kind" value={appKind} onChange={e=>setAppKind(e.target.value)} />
            <button className="bg-[#c0a36e] px-2 text-black" onClick={() => createApp.mutate({campsiteId: appCampsiteId, address: appAddress, name: appName, appKind: appKind as any})}>Create App</button>
          </div>
          <ul className="mt-1 text-[10px]">
            {(apps.data?.apps ?? []).slice(0,3).map((a: any) => (
              <li key={a.id} className="flex gap-1">
                {a.name} @ {a.address} [{a.status}]
                <button className="text-[8px] border px-0.5" onClick={() => updateAppStatus.mutate({appId: a.id, status: "active"})}>Promote</button>
                <button className="text-[8px] border px-0.5" onClick={() => updateAppStatus.mutate({appId: a.id, status: "delisted"})}>Delist</button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-sm">Merchant (H4 demo)</h3>
          <button className="text-xs border px-2" onClick={() => batchClose.mutate({terminalId: "DEMO-01", batchId: "BATCH-001", transactions: [{kind:"sale", amount: 42, reference: "REF1"}]})}>Close Demo Batch</button>
          <button className="text-xs border px-2" onClick={() => batchClose.mutate({terminalId: "CC-CAMP-27", batchId: "CC-001", transactions: [{kind:"sale", amount: 19, reference: "EU-1"}, {kind:"sale", amount: 25, reference: "EU-2"}]})}>CC Camp Demo</button>
          {batchReport && <pre className="text-[8px] mt-1 overflow-auto max-h-20">{batchReport}</pre>}
        </div>
      </div>
    </section>
  );
}
