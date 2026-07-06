"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "~/trpc/react";

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

  const [eventCode, setEventCode] = useState("TOORCAMP-2028");
  const [eventName, setEventName] = useState("ToorCamp 2028");
  const [x121, setX121] = useState("311088020777");
  const [campsiteSlug, setCampsiteSlug] = useState("camp-laminar");
  const [campsiteName, setCampsiteName] = useState("Camp Laminar");
  const [contactHandle, setContactHandle] = useState("operator@camp.example");
  const [notice, setNotice] = useState<string | null>(null);

  const onError = (error: { message?: string }) =>
    setNotice(
      /role required/i.test(error.message ?? "")
        ? "Operator role required for this action."
        : (error.message ?? "Action failed."),
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
  const advanceProvisioning = useMutation(
    trpc.omnidat.advanceProvisioning.mutationOptions({
      onSuccess: () => void queryClient.invalidateQueries(),
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
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">Provisioning Lifecycle (H1b)</h3>
          <div className="mt-2 text-sm text-[#9a8a6e]">
            (Use operator console or tRPC ops for advance; list below)
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {(provisioning.data?.provisioning ?? []).slice(0, 5).map((item: any) => (
              <li key={item.id} className="font-mono">
                {item.assignedX121 || item.id} — {item.status} {item.transport ? `(${item.transport})` : ""}
              </li>
            ))}
          </ul>
          <div className="mt-1 text-[10px] text-[#9a8a6e]">Use tRPC ops or console for advanceProvisioning (H1b)</div>
        </div>

        <div>
          <h3 className="font-semibold text-sm">Evidence (camp-deployment-summary)</h3>
          <div className="text-[10px] text-[#9a8a6e]">New kind wired in renderDocument + test. Use for ToorCamp 2028 / CC Camp 2027 artifacts.</div>
        </div>
      </div>
    </section>
  );
}
