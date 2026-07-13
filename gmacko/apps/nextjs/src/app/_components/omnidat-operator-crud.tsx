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

const EVENT_STATUS_ORDER = [
  "planning",
  "active",
  "closed",
  "archived",
] as const;

const CAMPSITE_STATUS_ORDER = ["pending", "active", "suspended"] as const;

function nextProvisioningStatus(status: string): string | null {
  const index = (PROVISIONING_ORDER as readonly string[]).indexOf(status);
  if (index < 0 || index >= PROVISIONING_ORDER.length - 1) return null;
  return PROVISIONING_ORDER[index + 1] ?? null;
}

function isTerminalProvisioning(status: string) {
  return status === "suspended" || status === "revoked";
}

function nextInOrder(
  order: readonly string[],
  status: string,
): string | null {
  const index = order.indexOf(status);
  if (index < 0 || index >= order.length - 1) return null;
  return order[index + 1] ?? null;
}

function statusButtonClass(active: boolean) {
  return active
    ? "rounded border border-[#9ed783] bg-[#1f2a18] px-2 py-0.5 text-[10px] uppercase text-[#9ed783]"
    : "rounded border border-[#5c4a32] px-2 py-0.5 text-[10px] uppercase text-[#d9cbb0] hover:border-[#c0a36e]";
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
  const packetSessions = useQuery({
    ...trpc.omnidat.listPacketSessions.queryOptions(),
    retry: false,
  });
  const evidenceList = useQuery({
    ...trpc.omnidat.listEvidenceArtifacts.queryOptions(
      evidenceKindFilter
        ? { artifactKind: evidenceKindFilter }
        : {},
    ),
    retry: false,
  });

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
  const [campsiteNamespace, setCampsiteNamespace] = useState<"camp" | "vendor">(
    "camp",
  );
  const [provisionTransport, setProvisionTransport] = useState("xot");
  const [provisionX121, setProvisionX121] = useState("311088020501");
  const [padX121, setPadX121] = useState("311088040777");
  const [padTransport, setPadTransport] = useState("meshcore");
  const [padKind, setPadKind] = useState<
    | "meshcore-pad"
    | "meshtastic-pad"
    | "wifi-terminal"
    | "pots-pad"
    | "xot-terminal"
  >("meshcore-pad");
  const [padLabel, setPadLabel] = useState("Field Mesh PAD");
  const [evidenceKindFilter, setEvidenceKindFilter] = useState("");
  const [foodPickup, setFoodPickup] = useState("Packet Window 3");
  const [foodAccount, setFoodAccount] = useState("SB-CAMP-LAMINAR-001");
  const [passportId, setPassportId] = useState("PASS-04271");
  const [badgeId, setBadgeId] = useState("FIELD-COURIER");
  const [passportOp, setPassportOp] = useState("OP-EX88");
  const [passportEvidence, setPassportEvidence] = useState(
    "Filed an X.25 packet receipt.",
  );
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

  // H1b incident (live list from DB)
  const [incidentTitle, setIncidentTitle] = useState("Network issue at PAD-01");
  const [incidentId, setIncidentId] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState<
    "minor" | "major" | "critical"
  >("minor");
  const incidents = useQuery({
    ...trpc.omnidat.listIncidents.queryOptions(),
    retry: 1,
  });

  // Evidence export + printable documents
  const [exportLabel, setExportLabel] = useState("Event export");
  const [exportEventId, setExportEventId] = useState("");
  const [docKind, setDocKind] = useState<
    | "address-assignment"
    | "demarc-sheet"
    | "service-certificate"
    | "provisioning-transcript"
    | "daily-noc-summary"
    | "operator-license"
    | "camp-deployment-summary"
    | "corporate-history"
  >("camp-deployment-summary");
  const [docPreview, setDocPreview] = useState<string | null>(null);

  const openIncident = useMutation(
    trpc.omnidat.openIncident.mutationOptions({
      onSuccess: (created) => {
        void queryClient.invalidateQueries(
          trpc.omnidat.listIncidents.queryFilter(),
        );
        if (created?.id) setIncidentId(created.id);
        setNotice(`Opened incident ${created.id}`);
      },
      onError,
    }),
  );
  const updateIncident = useMutation(
    trpc.omnidat.updateIncident.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(
          trpc.omnidat.listIncidents.queryFilter(),
        );
        setNotice("Incident updated");
      },
      onError,
    }),
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
  const updateEventStatus = useMutation(
    trpc.omnidat.updateEventStatus.mutationOptions({
      onSuccess: (_result, input) => {
        setNotice(`Event status → ${input.status}`);
        void queryClient.invalidateQueries(
          trpc.omnidat.listEvents.queryFilter(),
        );
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
  const updateCampsiteStatus = useMutation(
    trpc.omnidat.updateCampsiteStatus.mutationOptions({
      onSuccess: (_result, input) => {
        setNotice(`Campsite status → ${input.status}`);
        void queryClient.invalidateQueries(
          trpc.omnidat.listCampsites.queryFilter(),
        );
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
  const configurePad = useMutation(
    trpc.omnidat.configurePad.mutationOptions({
      onSuccess: (result) => {
        setNotice(
          `PAD configured ${result.x121} via ${result.transport ?? padTransport}`,
        );
        void queryClient.invalidateQueries(
          trpc.omnidat.operations.queryFilter(),
        );
      },
      onError,
    }),
  );
  const createFoodOrder = useMutation(
    trpc.omnidat.createFoodOrder.mutationOptions({
      onSuccess: (result) => {
        setNotice(
          `Food order ${result.lineTicket ?? result.id ?? "ok"} — ${result.status ?? "received"}`,
        );
      },
      onError,
    }),
  );
  const stampPassport = useMutation(
    trpc.omnidat.stampActivityPassport.mutationOptions({
      onSuccess: (result) => {
        setNotice(
          `Passport stamp ${result.stampId ?? result.id ?? "ok"} filed`,
        );
      },
      onError,
    }),
  );
  const setupAtm = useMutation(
    trpc.omnidat.setupAtmTerminal.mutationOptions({
      onSuccess: (result) => {
        setNotice(
          `ATM ${result.terminalId} @ ${result.terminalX121} — ${result.activationCode}`,
        );
        void queryClient.invalidateQueries(
          trpc.omnidat.operations.queryFilter(),
        );
      },
      onError,
    }),
  );
  const vintagePos = useMutation(
    trpc.omnidat.vintagePosSale.mutationOptions({
      onSuccess: (result) => {
        setNotice(
          `POS ${result.status} host ${result.hostX121} — pos-sale-receipt when persisted`,
        );
        void queryClient.invalidateQueries(
          trpc.omnidat.listEvidenceArtifacts.queryFilter(),
        );
      },
      onError,
    }),
  );
  const isoSim = useMutation(
    trpc.omnidat.iso8583Transaction.mutationOptions({
      onSuccess: (result) => {
        setNotice(
          `ISO8583 RC=${result.responseCode} AUTH=${result.authorizationCode}`,
        );
      },
      onError,
    }),
  );
  const [atmId, setAtmId] = useState("ATM-EX88-001");
  const [atmAccount, setAtmAccount] = useState("SB-ATM-EX88-100");
  const [posTerminal, setPosTerminal] = useState("VF-TR330-NITEMARKT-01");
  const [posAmount, setPosAmount] = useState("19");
  const exportEvidence = useMutation(
    trpc.omnidat.exportEventEvidence.mutationOptions({
      onSuccess: (artifact) => {
        setNotice(
          `Exported evidence ${artifact.id} (${artifact.artifactKind ?? "event-export"})`,
        );
        void queryClient.invalidateQueries(
          trpc.omnidat.listEvidenceArtifacts.queryFilter(),
        );
      },
      onError,
    }),
  );
  const renderDocument = useMutation({
    mutationFn: async () => {
      const firstEvent = events.data?.events?.[0];
      const firstAlloc = allocations.data?.allocations?.[0];
      const firstCamp = campsites.data?.campsites?.[0] as
        | { slug?: string; displayName?: string }
        | undefined;
      const data: Record<string, unknown> = {
        event: firstEvent?.eventCode ?? "TOORCAMP-2028",
        x121: firstAlloc?.x121 ?? "311088020777",
        campsite: firstCamp?.displayName ?? firstCamp?.slug ?? "Camp Laminar",
        transport: "xot",
        status: firstAlloc?.status ?? "verified",
        service: "Packet Clearing Directory",
        endpoint: "PAD-EX88-01",
        contact: contactHandle,
        verbs: "DIR,LOOKUP,CALL",
        owner: "OMNIDAT",
        transcript: "STATUS VERIFIED\nCIRCUIT UP",
        date: new Date().toISOString().slice(0, 10),
        sessions: String(packetSessions.data?.sessions?.length ?? 0),
        incidents: String(incidents.data?.incidents?.length ?? 0),
        allocations: String(allocations.data?.allocations?.length ?? 0),
        orders: "0",
        evidence: String(evidenceList.data?.artifacts?.length ?? 0),
        operator: "EX88-OP",
        role: "packet-operator",
        licenseNo: "OP-0001",
        examDate: "2026-07-13",
        capabilities: "services, allocations, sessions, evidence",
        scope: "VILLAGE / FIELD OFFICE",
        dates: "2028-07",
        shadytel: "PENDING",
        services: "25",
        apps: String(apps.data?.apps?.length ?? 0),
        participants: "500",
        rehearsal: "YES",
        namespace: "camp",
      };
      return queryClient.fetchQuery(
        trpc.omnidat.renderDocument.queryOptions({ kind: docKind, data }),
      );
    },
    onSuccess: (doc) => {
      setDocPreview(`${doc.title}\n\n${doc.body}`);
      setNotice(`Rendered ${doc.kind}`);
    },
    onError,
  });

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
          <p className="mt-1 text-[10px] text-[#9a8a6e]">
            Lifecycle: planning → active → closed → archived. Buttons jump to
            any status; audit records the change.
          </p>
          <ul className="mt-3 space-y-2 text-sm" data-testid="events-list">
            {(events.data?.events ?? []).map((item) => {
              const next = nextInOrder(EVENT_STATUS_ORDER, item.status);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-2 font-mono"
                >
                  <span>
                    {item.eventCode} — {item.status}
                  </span>
                  {EVENT_STATUS_ORDER.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={statusButtonClass(item.status === status)}
                      disabled={
                        item.status === status || updateEventStatus.isPending
                      }
                      onClick={() =>
                        updateEventStatus.mutate({
                          eventId: item.id,
                          status,
                        })
                      }
                    >
                      {status}
                    </button>
                  ))}
                  {next ? (
                    <button
                      type="button"
                      className="rounded bg-[#c0a36e] px-2 py-0.5 text-[10px] font-semibold uppercase text-black"
                      disabled={updateEventStatus.isPending}
                      onClick={() =>
                        updateEventStatus.mutate({
                          eventId: item.id,
                          status: next as (typeof EVENT_STATUS_ORDER)[number],
                        })
                      }
                    >
                      Advance → {next}
                    </button>
                  ) : null}
                </li>
              );
            })}
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
            <select
              aria-label="campsite namespace"
              className="rounded border border-[#5c4a32] bg-[#17130d] px-2 py-1 text-sm"
              value={campsiteNamespace}
              onChange={(e) =>
                setCampsiteNamespace(e.target.value as "camp" | "vendor")
              }
            >
              <option value="camp">namespace: camp</option>
              <option value="vendor">namespace: vendor</option>
            </select>
            <button
              className="rounded bg-[#c0a36e] px-3 py-1 text-sm font-semibold text-black"
              onClick={() =>
                createCampsite.mutate({
                  slug: campsiteSlug,
                  displayName: campsiteName,
                  contactHandle,
                  namespace: campsiteNamespace,
                })
              }
            >
              Create {campsiteNamespace === "vendor" ? "vendor" : "campsite"}
            </button>
          </div>
          <p className="mt-1 text-[10px] text-[#9a8a6e]">
            Lifecycle: pending → active → suspended. Vendors reuse campsite
            rows with namespace=vendor (H1b). Suspend freezes directory
            participation.
          </p>
          <ul className="mt-3 space-y-2 text-sm" data-testid="campsites-list">
            {(campsites.data?.campsites ?? []).map(
              (item: {
                id: string;
                slug: string;
                status: string;
                displayName?: string;
                namespace?: string;
              }) => {
                const next = nextInOrder(CAMPSITE_STATUS_ORDER, item.status);
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 font-mono"
                  >
                    <span>
                      [{item.namespace ?? "camp"}] {item.slug} — {item.status}
                    </span>
                    <button
                      type="button"
                      className="text-[10px] text-[#9ed783] underline"
                      onClick={() => setAppCampsiteId(item.id)}
                      title="Use as campsite app parent"
                    >
                      use for apps
                    </button>
                    {CAMPSITE_STATUS_ORDER.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={statusButtonClass(item.status === status)}
                        disabled={
                          item.status === status ||
                          updateCampsiteStatus.isPending
                        }
                        onClick={() =>
                          updateCampsiteStatus.mutate({
                            campsiteId: item.id,
                            status,
                          })
                        }
                      >
                        {status}
                      </button>
                    ))}
                    {item.status !== "suspended" ? (
                      <button
                        type="button"
                        className="rounded border border-[#a1471f] px-2 py-0.5 text-[10px] uppercase text-[#f0a875]"
                        disabled={updateCampsiteStatus.isPending}
                        onClick={() =>
                          updateCampsiteStatus.mutate({
                            campsiteId: item.id,
                            status: "suspended",
                          })
                        }
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded bg-[#c0a36e] px-2 py-0.5 text-[10px] font-semibold uppercase text-black"
                        disabled={updateCampsiteStatus.isPending}
                        onClick={() =>
                          updateCampsiteStatus.mutate({
                            campsiteId: item.id,
                            status: "active",
                          })
                        }
                      >
                        Reactivate
                      </button>
                    )}
                    {next && next !== "suspended" ? (
                      <button
                        type="button"
                        className="rounded border border-[#5c4a32] px-2 py-0.5 text-[10px] uppercase"
                        disabled={updateCampsiteStatus.isPending}
                        onClick={() =>
                          updateCampsiteStatus.mutate({
                            campsiteId: item.id,
                            status: next as (typeof CAMPSITE_STATUS_ORDER)[number],
                          })
                        }
                      >
                        Advance → {next}
                      </button>
                    ) : null}
                  </li>
                );
              },
            )}
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

        <div data-testid="evidence-export-panel">
          <h3 className="font-semibold">Evidence Export (H1b)</h3>
          <p className="mt-1 text-[10px] text-[#9a8a6e]">
            Records an event-export artifact (evidence.write). Label + optional
            event id; URL is a stable path stamp for the export bundle.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <input
              aria-label="export label"
              className="rounded border border-[#5c4a32] bg-[#17130d] px-2 py-1"
              value={exportLabel}
              onChange={(e) => setExportLabel(e.target.value)}
              placeholder="label"
            />
            <select
              aria-label="export event"
              className="rounded border border-[#5c4a32] bg-[#17130d] px-2 py-1 font-mono"
              value={exportEventId}
              onChange={(e) => setExportEventId(e.target.value)}
            >
              <option value="">(no event link)</option>
              {(events.data?.events ?? []).map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.eventCode} ({ev.id.slice(0, 8)})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded bg-[#c0a36e] px-3 py-1 font-semibold text-black disabled:opacity-50"
              disabled={!exportLabel.trim() || exportEvidence.isPending}
              onClick={() => {
                const stamp = new Date().toISOString().replace(/[:.]/g, "-");
                exportEvidence.mutate({
                  label: exportLabel.trim(),
                  eventId: exportEventId || null,
                  url: `/evidence/export/${stamp}.json`,
                  recordCount:
                    (allocations.data?.allocations?.length ?? 0) +
                    (incidents.data?.incidents?.length ?? 0) +
                    (events.data?.events?.length ?? 0),
                });
              }}
            >
              Export event evidence
            </button>
            <button
              type="button"
              className="rounded border border-[#9ed783] px-3 py-1 text-[#9ed783] disabled:opacity-50"
              disabled={exportEvidence.isPending || renderDocument.isPending}
              onClick={async () => {
                const stamp = new Date().toISOString().replace(/[:.]/g, "-");
                const date = new Date().toISOString().slice(0, 10);
                const sessions = packetSessions.data?.sessions?.length ?? 0;
                const incCount = incidents.data?.incidents?.length ?? 0;
                const allocs = allocations.data?.allocations?.length ?? 0;
                const evidenceCount =
                  evidenceList.data?.artifacts?.length ?? 0;
                try {
                  const doc = await queryClient.fetchQuery(
                    trpc.omnidat.renderDocument.queryOptions({
                      kind: "daily-noc-summary",
                      data: {
                        date,
                        sessions,
                        incidents: incCount,
                        allocations: allocs,
                        orders: 0,
                        evidence: evidenceCount,
                      },
                    }),
                  );
                  setDocKind("daily-noc-summary");
                  setDocPreview(`${doc.title}\n\n${doc.body}`);
                  exportEvidence.mutate({
                    label: `Daily NOC ${date}`,
                    eventId: exportEventId || null,
                    url: `/evidence/daily-noc/${stamp}.txt`,
                    recordCount:
                      sessions + incCount + allocs + evidenceCount,
                  });
                } catch (error) {
                  onError(
                    error as { message?: string },
                  );
                }
              }}
            >
              Daily NOC package
            </button>
          </div>

          <h3 className="mt-4 font-semibold">Printable Documents</h3>
          <p className="mt-1 text-[10px] text-[#9a8a6e]">
            Deterministic station-style source (renderDocument). Fill from live
            lists when present.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <select
              aria-label="document kind"
              className="rounded border border-[#5c4a32] bg-[#17130d] px-2 py-1"
              value={docKind}
              onChange={(e) =>
                setDocKind(e.target.value as typeof docKind)
              }
            >
              <option value="camp-deployment-summary">camp-deployment-summary</option>
              <option value="address-assignment">address-assignment</option>
              <option value="demarc-sheet">demarc-sheet</option>
              <option value="service-certificate">service-certificate</option>
              <option value="provisioning-transcript">provisioning-transcript</option>
              <option value="daily-noc-summary">daily-noc-summary</option>
              <option value="operator-license">operator-license</option>
              <option value="corporate-history">corporate-history</option>
            </select>
            <button
              type="button"
              className="rounded border border-[#5c4a32] px-3 py-1 uppercase"
              disabled={renderDocument.isPending}
              onClick={() => renderDocument.mutate()}
            >
              Render
            </button>
          </div>
          {docPreview ? (
            <pre
              className="mt-2 max-h-40 overflow-auto rounded border border-[#33291d] bg-black p-2 font-mono text-[10px] leading-4 text-[#8ee36c]"
              data-testid="document-preview"
            >
              {docPreview}
            </pre>
          ) : null}
        </div>

        <div>
          <h3 className="font-semibold">Incidents (H1b)</h3>
          <p className="mt-1 text-[10px] text-[#9a8a6e]">
            Lifecycle: open → mitigating → resolved. Severity on open only.
          </p>
          <div className="mt-1 flex flex-wrap gap-1 text-xs">
            <input
              className="min-w-[8rem] flex-1 border border-[#5c4a32] bg-[#17130d] px-1"
              value={incidentTitle}
              onChange={(e) => setIncidentTitle(e.target.value)}
            />
            <select
              aria-label="incident severity"
              className="border border-[#5c4a32] bg-[#17130d] px-1"
              value={incidentSeverity}
              onChange={(e) =>
                setIncidentSeverity(e.target.value as typeof incidentSeverity)
              }
            >
              <option value="minor">minor</option>
              <option value="major">major</option>
              <option value="critical">critical</option>
            </select>
            <button
              className="bg-[#c0a36e] px-2 text-black"
              onClick={() =>
                openIncident.mutate({
                  title: incidentTitle,
                  severity: incidentSeverity,
                })
              }
            >
              Open
            </button>
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-xs">
            <input
              className="min-w-[8rem] flex-1 border border-[#5c4a32] bg-[#17130d] px-1 font-mono"
              placeholder="incident uuid"
              value={incidentId}
              onChange={(e) => setIncidentId(e.target.value)}
            />
            <button
              className="border border-[#5c4a32] px-2 disabled:opacity-50"
              disabled={!incidentId.trim() || updateIncident.isPending}
              onClick={() =>
                updateIncident.mutate({
                  incidentId: incidentId.trim(),
                  status: "open",
                })
              }
            >
              Reopen
            </button>
            <button
              className="border border-[#c0a36e] px-2 text-[#c0a36e] disabled:opacity-50"
              disabled={!incidentId.trim() || updateIncident.isPending}
              onClick={() =>
                updateIncident.mutate({
                  incidentId: incidentId.trim(),
                  status: "mitigating",
                })
              }
            >
              Mitigating
            </button>
            <button
              className="bg-[#c0a36e] px-2 text-black disabled:opacity-50"
              disabled={!incidentId.trim() || updateIncident.isPending}
              onClick={() =>
                updateIncident.mutate({
                  incidentId: incidentId.trim(),
                  status: "resolved",
                  timeToClearMinutes: 15,
                })
              }
            >
              Resolve
            </button>
          </div>
          {incidents.isError ? (
            <p className="mt-1 text-[10px] text-[#c0a36e]">
              Role required to list incidents.
            </p>
          ) : (
            <ul className="mt-1 max-h-32 overflow-y-auto text-[10px] text-[#d9cbb0]">
              {(incidents.data?.incidents ?? []).length === 0 ? (
                <li className="text-[#9a8a6e]">
                  No incidents in DB — open one above.
                </li>
              ) : (
                (incidents.data?.incidents ?? []).slice(0, 12).map((inc) => (
                  <li
                    key={inc.id}
                    className="flex flex-wrap items-center gap-1 border-b border-[#33291d] py-0.5"
                  >
                    <button
                      type="button"
                      className="font-mono text-[#9ed783] underline"
                      onClick={() => setIncidentId(inc.id)}
                      title="Select for status updates"
                    >
                      {inc.id.slice(0, 8)}
                    </button>
                    <span className="uppercase text-[#c0a36e]">{inc.status}</span>
                    <span className="uppercase">{inc.severity}</span>
                    <span>{inc.title}</span>
                    {inc.status !== "resolved" ? (
                      <>
                        <button
                          type="button"
                          className="border border-[#5c4a32] px-1"
                          onClick={() =>
                            updateIncident.mutate({
                              incidentId: inc.id,
                              status: "mitigating",
                            })
                          }
                        >
                          → mit
                        </button>
                        <button
                          type="button"
                          className="border border-[#5c4a32] px-1"
                          onClick={() =>
                            updateIncident.mutate({
                              incidentId: inc.id,
                              status: "resolved",
                              timeToClearMinutes: 15,
                            })
                          }
                        >
                          → res
                        </button>
                      </>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          )}
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

        <div data-testid="merchant-rail" className="md:col-span-2">
          <h3 className="font-semibold">Merchant rail (H4 demo)</h3>
          <p className="mt-1 text-[10px] text-[#9a8a6e]">
            Play-money only — bank.write / vendor.write. No cash redemption
            without posted policy.
          </p>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            <div className="rounded border border-[#33291d] p-2">
              <p className="text-[10px] uppercase text-[#c0a36e]">ATM setup</p>
              <div className="mt-1 flex flex-wrap gap-1 text-xs">
                <input
                  className="w-28 border border-[#5c4a32] bg-[#17130d] px-1 font-mono"
                  value={atmId}
                  onChange={(e) => setAtmId(e.target.value)}
                />
                <input
                  className="min-w-[6rem] flex-1 border border-[#5c4a32] bg-[#17130d] px-1 font-mono"
                  value={atmAccount}
                  onChange={(e) => setAtmAccount(e.target.value)}
                />
                <button
                  type="button"
                  className="bg-[#c0a36e] px-2 text-black disabled:opacity-50"
                  disabled={setupAtm.isPending}
                  onClick={() =>
                    setupAtm.mutate({
                      terminalId: atmId.trim(),
                      settlementAccountId: atmAccount.trim(),
                      terminalX121: "311088030100",
                      locationLabel: "Exchange 88 ATM Desk",
                    })
                  }
                >
                  Setup ATM
                </button>
              </div>
            </div>
            <div className="rounded border border-[#33291d] p-2">
              <p className="text-[10px] uppercase text-[#c0a36e]">
                Vintage POS sale
              </p>
              <div className="mt-1 flex flex-wrap gap-1 text-xs">
                <input
                  className="min-w-[8rem] flex-1 border border-[#5c4a32] bg-[#17130d] px-1 font-mono"
                  value={posTerminal}
                  onChange={(e) => setPosTerminal(e.target.value)}
                />
                <input
                  className="w-16 border border-[#5c4a32] bg-[#17130d] px-1 font-mono"
                  value={posAmount}
                  onChange={(e) => setPosAmount(e.target.value)}
                />
                <button
                  type="button"
                  className="bg-[#c0a36e] px-2 text-black disabled:opacity-50"
                  disabled={vintagePos.isPending}
                  onClick={() => {
                    const rrn = String(Date.now()).slice(-12);
                    vintagePos.mutate({
                      terminalId: posTerminal.trim(),
                      terminalModel: "VERIFONE_TRANZ_330",
                      merchantAccountId: foodAccount.trim() || "SB-CAMP-LAMINAR-001",
                      clerkCode: "042",
                      amount: Number.parseFloat(posAmount) || 19,
                      feePolicyId: "MERCHANT_POS_MERCHANT_PAYS",
                      noteSerial: `SBMO-${rrn}`,
                      retrievalReference: rrn,
                    });
                  }}
                >
                  POS sale
                </button>
              </div>
            </div>
            <div className="rounded border border-[#33291d] p-2">
              <p className="text-[10px] uppercase text-[#c0a36e]">
                ISO 8583 sim
              </p>
              <div className="mt-1 flex flex-wrap gap-1 text-xs">
                <button
                  type="button"
                  className="border border-[#5c4a32] px-2 disabled:opacity-50"
                  disabled={isoSim.isPending}
                  onClick={() => {
                    const rrn = String(Date.now()).slice(-12);
                    isoSim.mutate({
                      mti: "0200",
                      processingCode: "000000",
                      amount: Number.parseFloat(posAmount) || 19,
                      accountId: foodAccount.trim() || "SB-CAMP-LAMINAR-001",
                      terminalId: atmId.trim() || "ATM-EX88-001",
                      retrievalReference: rrn,
                    });
                  }}
                >
                  Purchase sim
                </button>
                <button
                  type="button"
                  className="border border-[#5c4a32] px-2"
                  onClick={() =>
                    batchClose.mutate({
                      terminalId: "DEMO-01",
                      batchId: "BATCH-001",
                      transactions: [
                        { kind: "sale", amount: 42, reference: "REF1" },
                      ],
                    })
                  }
                >
                  Batch close
                </button>
                <button
                  type="button"
                  className="border border-[#5c4a32] px-2"
                  onClick={() =>
                    batchClose.mutate({
                      terminalId: "CC-CAMP-27",
                      batchId: "CC-001",
                      transactions: [
                        { kind: "sale", amount: 19, reference: "EU-1" },
                        { kind: "sale", amount: 25, reference: "EU-2" },
                      ],
                    })
                  }
                >
                  CC Camp batch
                </button>
              </div>
              {batchReport ? (
                <pre className="mt-1 max-h-16 overflow-auto text-[8px]">
                  {batchReport}
                </pre>
              ) : null}
            </div>
          </div>
        </div>

        <div data-testid="field-ops" className="md:col-span-2">
          <h3 className="font-semibold">Field Ops (food + passport)</h3>
          <p className="mt-1 text-[10px] text-[#9a8a6e]">
            vendor.write — Miliways order and activity passport stamp. Play
            money only.
          </p>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <div className="rounded border border-[#33291d] p-2">
              <p className="text-[10px] uppercase text-[#c0a36e]">Food order</p>
              <div className="mt-1 flex flex-wrap gap-1 text-xs">
                <input
                  className="min-w-[6rem] flex-1 border border-[#5c4a32] bg-[#17130d] px-1"
                  value={foodPickup}
                  onChange={(e) => setFoodPickup(e.target.value)}
                  placeholder="pickup"
                />
                <input
                  className="min-w-[6rem] flex-1 border border-[#5c4a32] bg-[#17130d] px-1 font-mono"
                  value={foodAccount}
                  onChange={(e) => setFoodAccount(e.target.value)}
                  placeholder="account"
                />
                <button
                  type="button"
                  className="bg-[#c0a36e] px-2 text-black disabled:opacity-50"
                  disabled={createFoodOrder.isPending}
                  onClick={() =>
                    createFoodOrder.mutate({
                      itemIds: ["NOODLE-CUP"],
                      pickupName: foodPickup.trim() || "Window",
                      shadybucksAccountId: foodAccount.trim(),
                    })
                  }
                >
                  Order noodle cup
                </button>
              </div>
            </div>
            <div className="rounded border border-[#33291d] p-2">
              <p className="text-[10px] uppercase text-[#c0a36e]">
                Passport stamp
              </p>
              <div className="mt-1 flex flex-wrap gap-1 text-xs">
                <input
                  className="w-24 border border-[#5c4a32] bg-[#17130d] px-1 font-mono"
                  value={passportId}
                  onChange={(e) => setPassportId(e.target.value)}
                />
                <input
                  className="w-28 border border-[#5c4a32] bg-[#17130d] px-1"
                  value={badgeId}
                  onChange={(e) => setBadgeId(e.target.value)}
                />
                <input
                  className="w-20 border border-[#5c4a32] bg-[#17130d] px-1"
                  value={passportOp}
                  onChange={(e) => setPassportOp(e.target.value)}
                />
                <input
                  className="min-w-[8rem] flex-1 border border-[#5c4a32] bg-[#17130d] px-1"
                  value={passportEvidence}
                  onChange={(e) => setPassportEvidence(e.target.value)}
                />
                <button
                  type="button"
                  className="bg-[#c0a36e] px-2 text-black disabled:opacity-50"
                  disabled={stampPassport.isPending}
                  onClick={() =>
                    stampPassport.mutate({
                      passportId: passportId.trim(),
                      badgeId: badgeId.trim(),
                      operatorId: passportOp.trim(),
                      evidence: passportEvidence.trim(),
                    })
                  }
                >
                  Stamp passport
                </button>
              </div>
            </div>
          </div>
        </div>

        <div data-testid="pad-configure">
          <h3 className="font-semibold">Configure PAD</h3>
          <p className="mt-1 text-[10px] text-[#9a8a6e]">
            provisioning.write — register a field PAD endpoint (mesh / Wi-Fi /
            POTS / XOT).
          </p>
          <div className="mt-2 flex flex-wrap gap-1 text-xs">
            <input
              aria-label="pad x121"
              className="w-32 border border-[#5c4a32] bg-[#17130d] px-1 font-mono"
              value={padX121}
              onChange={(e) => setPadX121(e.target.value)}
            />
            <select
              aria-label="pad transport"
              className="border border-[#5c4a32] bg-[#17130d] px-1"
              value={padTransport}
              onChange={(e) => setPadTransport(e.target.value)}
            >
              <option value="meshcore">meshcore</option>
              <option value="meshtastic">meshtastic</option>
              <option value="wifi-terminal">wifi-terminal</option>
              <option value="pots-modem">pots-modem</option>
              <option value="xot">xot</option>
            </select>
            <select
              aria-label="pad kind"
              className="border border-[#5c4a32] bg-[#17130d] px-1"
              value={padKind}
              onChange={(e) =>
                setPadKind(e.target.value as typeof padKind)
              }
            >
              <option value="meshcore-pad">meshcore-pad</option>
              <option value="meshtastic-pad">meshtastic-pad</option>
              <option value="wifi-terminal">wifi-terminal</option>
              <option value="pots-pad">pots-pad</option>
              <option value="xot-terminal">xot-terminal</option>
            </select>
            <input
              aria-label="pad endpoint label"
              className="min-w-[8rem] flex-1 border border-[#5c4a32] bg-[#17130d] px-1"
              value={padLabel}
              onChange={(e) => setPadLabel(e.target.value)}
            />
            <button
              type="button"
              className="bg-[#c0a36e] px-2 text-black disabled:opacity-50"
              disabled={configurePad.isPending || !padX121.trim()}
              onClick={() =>
                configurePad.mutate({
                  x121: padX121.trim(),
                  transport: padTransport,
                  padKind,
                  endpointLabel: padLabel.trim() || "PAD",
                })
              }
            >
              Configure PAD
            </button>
          </div>
        </div>

        <div data-testid="evidence-browser" className="md:col-span-2">
          <h3 className="font-semibold">Evidence Browser</h3>
          <p className="mt-1 text-[10px] text-[#9a8a6e]">
            Live artifacts (packet-call-receipt, event-export, pos-sale-receipt).
            Filter by kind optional.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <select
              aria-label="evidence kind filter"
              className="border border-[#5c4a32] bg-[#17130d] px-2 py-1"
              value={evidenceKindFilter}
              onChange={(e) => setEvidenceKindFilter(e.target.value)}
            >
              <option value="">all kinds</option>
              <option value="packet-call-receipt">packet-call-receipt</option>
              <option value="event-export">event-export</option>
              <option value="pos-sale-receipt">pos-sale-receipt</option>
              <option value="camp-deployment-summary">
                camp-deployment-summary
              </option>
            </select>
            <button
              type="button"
              className="border border-[#5c4a32] px-2"
              onClick={() => void evidenceList.refetch()}
            >
              Refresh
            </button>
          </div>
          {evidenceList.isError ? (
            <p className="mt-2 text-[10px] text-[#c0a36e]">
              Role required to list evidence.
            </p>
          ) : (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto font-mono text-[10px]">
              {(evidenceList.data?.artifacts ?? []).length === 0 ? (
                <li className="text-[#9a8a6e]">
                  No artifacts — CALL, export, or POS sale to create some.
                </li>
              ) : (
                (evidenceList.data?.artifacts ?? []).slice(0, 20).map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap gap-2 border-b border-[#33291d] py-1"
                  >
                    <span className="text-[#9ed783]">{a.id.slice(0, 8)}</span>
                    <span className="uppercase text-[#c0a36e]">
                      {a.artifactKind}
                    </span>
                    <span>{a.label}</span>
                    <span className="break-all text-[#9a8a6e]">{a.url}</span>
                    {a.recordCount != null ? (
                      <span>n={a.recordCount}</span>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
