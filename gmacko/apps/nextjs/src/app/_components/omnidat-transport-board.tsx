"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";

/** Public H2b transport policy table — budgets and access class. */
export function OmnidatTransportBoard(props: { compact?: boolean }) {
  const trpc = useTRPC();
  const transports = useQuery(trpc.omnidat.listTransports.queryOptions());
  const rows = transports.data?.transports ?? [];

  return (
    <section
      className="rounded border border-[#4f3920] bg-[#211d15] p-5"
      data-testid="transport-board"
    >
      <h2 className="text-2xl font-bold">
        {props.compact ? "Transports" : "Access Transports (H2b)"}
      </h2>
      <p className="mt-1 text-sm text-[#c0a36e]">
        Packet call budgets are enforced server-side. Over-budget or unknown
        transport clears with honest X.25 cause (3 or 19). Wire bridges still
        terminate POTS/radio separately.
      </p>
      {transports.isError ? (
        <p className="mt-3 font-mono text-sm text-[#d9cbb0]">
          Transport policies unavailable
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="text-left text-[#c0a36e]">
              <tr>
                <th className="border-b border-[#5c4a32] py-2">Transport</th>
                <th className="border-b border-[#5c4a32] py-2">Kind</th>
                <th className="border-b border-[#5c4a32] py-2">Access</th>
                <th className="border-b border-[#5c4a32] py-2">Budget</th>
                <th className="border-b border-[#5c4a32] py-2">Fast select</th>
                {!props.compact ? (
                  <th className="border-b border-[#5c4a32] py-2">Notes</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.transport}>
                  <td className="border-b border-[#33291d] py-2 font-mono text-[#9ed783]">
                    {row.transport}
                  </td>
                  <td className="border-b border-[#33291d] py-2">{row.kind}</td>
                  <td className="border-b border-[#33291d] py-2 uppercase">
                    {row.accessClass}
                  </td>
                  <td className="border-b border-[#33291d] py-2 font-mono">
                    {row.maxUserDataBytes} B
                  </td>
                  <td className="border-b border-[#33291d] py-2">
                    {row.fastSelectAllowed ? "yes" : "no"}
                  </td>
                  {!props.compact ? (
                    <td className="border-b border-[#33291d] py-2 text-[#d9cbb0]">
                      {row.notes}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
