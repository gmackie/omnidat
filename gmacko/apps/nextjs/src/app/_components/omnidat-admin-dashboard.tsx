"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";

export function OmnidatAdminDashboard() {
  const trpc = useTRPC();
  const dashboard = useQuery(trpc.omnidat.dashboard.queryOptions());
  const services = useQuery(trpc.omnidat.services.queryOptions());
  const billing = useQuery(trpc.omnidat.billing.queryOptions());
  const operations = useQuery(trpc.omnidat.operations.queryOptions());

  return (
    <div className="grid gap-5">
      <section className="rounded border border-border bg-card p-5">
        <p className="text-muted-foreground text-sm font-semibold uppercase">
          OMNIDAT Administrative Control
        </p>
        <h1 className="mt-2 text-3xl font-black">Service Registry</h1>
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

      <section className="rounded border border-border bg-card p-5">
        <h2 className="text-2xl font-bold">ShadyBucks Settlement</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(billing.data?.accounts ?? []).map((account) => (
            <article className="rounded border border-border p-4" key={account.accountId}>
              <p className="font-mono text-sm">{account.accountId}</p>
              <h3 className="mt-1 font-semibold">{account.owner}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {account.type} / {account.status}
              </p>
              <p className="mt-3 text-xl font-black">
                {account.balance} {account.currency}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded border border-border bg-card p-5">
        <h2 className="text-2xl font-bold">Billing Ledger and Audit</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded border border-border p-4">
            <h3 className="font-semibold">Recent Ledger Entries</h3>
            <div className="mt-3 grid gap-2 text-sm">
              {(operations.data?.ledger ?? []).slice(0, 6).map((entry) => (
                <div className="rounded bg-muted p-3" key={entry.id}>
                  <p className="font-mono text-xs">{entry.receiptId}</p>
                  <p className="mt-1 font-semibold">
                    {entry.amount} {entry.currency} / {entry.entryKind}
                  </p>
                  <p className="mt-1 text-muted-foreground">{entry.memo}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded border border-border p-4">
            <h3 className="font-semibold">Control Plane Audit</h3>
            <div className="mt-3 grid gap-2 text-sm">
              {(operations.data?.auditEvents ?? []).slice(0, 6).map((event) => (
                <div className="rounded bg-muted p-3" key={event.id}>
                  <p className="font-mono text-xs">{event.eventType}</p>
                  <p className="mt-1">
                    {event.subjectKind}: {event.subjectId}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded border border-border bg-card p-5">
        <h2 className="text-2xl font-bold">Verbs and Address Assignments</h2>
        <div className="mt-4 grid gap-3">
          {(services.data?.services ?? []).map((service) => (
            <article className="rounded border border-border p-4" key={service.slug}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm">{service.x121}</p>
                  <h3 className="mt-1 font-semibold">{service.name}</h3>
                </div>
                <span className="rounded border border-border px-2 py-1 text-xs uppercase">
                  {service.category}
                </span>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {service.verbs.map((verb) => (
                  <div className="rounded bg-muted p-3" key={verb.name}>
                    <p className="font-mono text-sm font-semibold">{verb.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {verb.description}
                    </p>
                    <p className="mt-2 text-xs">
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
    <div className="rounded border border-border p-4">
      <p className="text-muted-foreground text-sm">{props.label}</p>
      <p className="mt-2 text-2xl font-black">{props.value}</p>
    </div>
  );
}
