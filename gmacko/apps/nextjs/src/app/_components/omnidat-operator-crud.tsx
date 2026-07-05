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

  const [eventCode, setEventCode] = useState("TOORCAMP-2028");
  const [eventName, setEventName] = useState("ToorCamp 2028");
  const [x121, setX121] = useState("311088020777");
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
      </div>
    </section>
  );
}
