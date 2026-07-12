"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";
import { OmnidatOperatorRolesPanel } from "./omnidat-operator-roles-panel";

export function OmnidatAdminDashboard() {
  const trpc = useTRPC();
  const dashboard = useQuery(trpc.omnidat.dashboard.queryOptions());
  const services = useQuery(trpc.omnidat.services.queryOptions());
  const billing = useQuery(trpc.omnidat.billing.queryOptions());
  const operations = useQuery(trpc.omnidat.operations.queryOptions());
  const audit = useQuery({
    ...trpc.omnidat.listRecentAuditEvents.queryOptions({ limit: 30 }),
    retry: 1,
    staleTime: 10_000,
  });

  return (
    <div className="grid gap-5">
      <OmnidatOperatorRolesPanel />

      <section
        className="rounded border border-[#4f3920] bg-[#211d15] p-5"
        data-testid="audit-trail"
      >
        <h2 className="text-2xl font-bold">Audit Trail</h2>
        <p className="mt-1 text-sm text-[#c0a36e]">
          Recent operator-attributed writes (operator.read). Newest first.
        </p>
        {audit.isError ? (
          <p className="mt-3 font-mono text-sm text-[#d9cbb0]">
            AUTH/ROLE REQUIRED — sign in as an operator to list audit events
          </p>
        ) : (audit.data?.events ?? []).length === 0 ? (
          <p className="mt-3 font-mono text-sm text-[#d9cbb0]">
            NO AUDIT EVENTS YET — create an event, grant a role, or run a
            transfer
          </p>
        ) : (
          <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
            {(audit.data?.events ?? []).map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap gap-2 border-b border-[#33291d] py-1.5"
              >
                <span className="text-[#9a8a6e]">
                  {entry.createdAt
                    ? new Date(entry.createdAt as string | Date).toISOString()
                    : "—"}
                </span>
                <span className="text-[#9ed783]">{entry.eventType}</span>
                <span className="text-[#c0a36e]">
                  {entry.subjectKind}
                  {entry.subjectId ? `:${entry.subjectId.slice(0, 12)}` : ""}
                </span>
                <span className="text-[#d9cbb0]">
                  actor {entry.actorUserId?.slice(0, 12) ?? "system"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <p className="text-sm font-semibold uppercase text-[#c0a36e]">
          OMNIDAT Administrative Control
        </p>
        <h2 className="mt-2 text-2xl font-bold">Service Registry</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <AdminMetric
            label="Services"
            value={dashboard.data?.metrics.totalServices ?? 0}
          />
          <AdminMetric
            label="Up"
            value={dashboard.data?.metrics.upServices ?? 0}
          />
          <AdminMetric
            label="Degraded Circuits"
            value={dashboard.data?.metrics.degradedCircuits ?? 0}
          />
          <AdminMetric
            label="Provisioning"
            value={dashboard.data?.metrics.pendingProvisioning ?? 0}
          />
        </div>
      </section>

      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <h2 className="text-2xl font-bold">ShadyBucks Settlement</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(billing.data?.accounts ?? []).map((account) => (
            <article
              className="rounded border border-[#5c4a32] bg-[#17130d] p-4"
              key={account.accountId}
            >
              <p className="font-mono text-sm text-[#9ed783]">{account.accountId}</p>
              <h3 className="mt-1 font-semibold">{account.owner}</h3>
              <p className="mt-2 text-sm text-[#d9cbb0]">
                {account.type} / {account.status}
              </p>
              <p className="mt-3 text-xl font-black">
                {account.balance} {account.currency}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <h2 className="text-2xl font-bold">Billing Ledger and Audit</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded border border-[#5c4a32] bg-[#17130d] p-4">
            <h3 className="font-semibold">Recent Ledger Entries</h3>
            <div className="mt-3 grid gap-2 text-sm">
              {(operations.data?.ledger ?? []).slice(0, 6).map((entry) => (
                <div className="rounded border border-[#33291d] p-3" key={entry.id}>
                  <p className="font-mono text-xs text-[#9ed783]">{entry.receiptId}</p>
                  <p className="mt-1 font-semibold">
                    {entry.amount} {entry.currency} / {entry.entryKind}
                  </p>
                  <p className="mt-1 text-[#d9cbb0]">{entry.memo}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded border border-[#5c4a32] bg-[#17130d] p-4">
            <h3 className="font-semibold">Control Plane Audit</h3>
            <div className="mt-3 grid gap-2 text-sm">
              {(operations.data?.auditEvents ?? []).slice(0, 6).map((event) => (
                <div className="rounded border border-[#33291d] p-3" key={event.id}>
                  <p className="font-mono text-xs text-[#9ed783]">{event.eventType}</p>
                  <p className="mt-1">
                    {event.subjectKind}: {event.subjectId}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <h2 className="text-2xl font-bold">Verbs and Address Assignments</h2>
        <div className="mt-4 grid gap-3">
          {(services.data?.services ?? []).map((service) => (
            <article
              className="rounded border border-[#5c4a32] bg-[#17130d] p-4"
              key={service.slug}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm text-[#9ed783]">{service.x121}</p>
                  <h3 className="mt-1 font-semibold">{service.name}</h3>
                </div>
                <span className="rounded border border-[#7a694f] px-2 py-1 text-xs uppercase">
                  {service.category}
                </span>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {service.verbs.map((verb) => (
                  <div
                    className="rounded border border-[#33291d] p-3"
                    key={verb.name}
                  >
                    <p className="font-mono text-sm font-semibold">{verb.name}</p>
                    <p className="mt-1 text-sm text-[#d9cbb0]">{verb.description}</p>
                    <p className="mt-2 text-xs text-[#c0a36e]">
                      in: {verb.inputs.join(", ")} / out:{" "}
                      {verb.outputs.join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminMetric(props: { label: string; value: number }) {
  return (
    <div className="rounded border border-[#5c4a32] bg-[#17130d] p-4">
      <p className="text-sm text-[#c0a36e]">{props.label}</p>
      <p className="mt-2 text-2xl font-black">{props.value}</p>
    </div>
  );
}
