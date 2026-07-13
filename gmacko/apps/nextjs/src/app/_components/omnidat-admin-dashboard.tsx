"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "~/trpc/react";
import { OmnidatOperatorRolesPanel } from "./omnidat-operator-roles-panel";

export function OmnidatAdminDashboard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const dashboard = useQuery(trpc.omnidat.dashboard.queryOptions());
  const services = useQuery(trpc.omnidat.services.queryOptions());
  const billing = useQuery(trpc.omnidat.billing.queryOptions());
  const operations = useQuery(trpc.omnidat.operations.queryOptions());
  const audit = useQuery({
    ...trpc.omnidat.listRecentAuditEvents.queryOptions({ limit: 30 }),
    retry: 1,
    staleTime: 10_000,
  });

  const [extId, setExtId] = useState("SB-CAMP-DEMO-001");
  const [displayName, setDisplayName] = useState("Camp Demo Operating");
  const [accountType, setAccountType] = useState("camp-operating");
  const [feeAccountId, setFeeAccountId] = useState("");
  const [policyKind, setPolicyKind] = useState<
    | "flat"
    | "percentage"
    | "per-message"
    | "waived"
    | "sponsored"
    | "merchant-pays"
    | "operator-pays"
  >("percentage");
  const [feeAmount, setFeeAmount] = useState("3");
  const [billingNotice, setBillingNotice] = useState<string | null>(null);

  const createBilling = useMutation(
    trpc.omnidat.createBillingAccount.mutationOptions({
      onSuccess: (result) => {
        setFeeAccountId(result.id);
        setBillingNotice(
          `Created billing account ${result.externalAccountId} (uuid ${result.id.slice(0, 8)}…)`,
        );
        void queryClient.invalidateQueries(trpc.omnidat.billing.queryFilter());
        void queryClient.invalidateQueries(
          trpc.omnidat.listRecentAuditEvents.queryFilter(),
        );
      },
      onError: (error: { message?: string }) => {
        setBillingNotice(
          /role required|FORBIDDEN/i.test(error.message ?? "")
            ? "bank.write required (bank-operator / admin)."
            : (error.message ?? "Create failed"),
        );
      },
    }),
  );

  const setFee = useMutation(
    trpc.omnidat.setFeePolicy.mutationOptions({
      onSuccess: (_result, input) => {
        setBillingNotice(
          `Fee policy ${input.policyKind} set on ${input.accountId.slice(0, 8)}…`,
        );
        void queryClient.invalidateQueries(
          trpc.omnidat.operations.queryFilter(),
        );
        void queryClient.invalidateQueries(
          trpc.omnidat.listRecentAuditEvents.queryFilter(),
        );
      },
      onError: (error: { message?: string }) => {
        setBillingNotice(
          /role required|FORBIDDEN/i.test(error.message ?? "")
            ? "bank.write required (bank-operator / admin)."
            : (error.message ?? "Fee policy failed"),
        );
      },
    }),
  );

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

      <section
        className="rounded border border-[#4f3920] bg-[#211d15] p-5"
        data-testid="billing-desk"
      >
        <h2 className="text-2xl font-bold">Billing Desk</h2>
        <p className="mt-1 text-sm text-[#c0a36e]">
          Create settlement accounts and set fee policy (bank.write). Play-money
          until policy is signed off — see /what-is-real.
        </p>
        <div className="mt-4 rounded border border-[#5c4a32] bg-[#17130d] p-4">
          <h3 className="text-sm font-semibold uppercase text-[#c0a36e]">
            Create billing account
          </h3>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <input
              aria-label="external account id"
              className="rounded border border-[#5c4a32] bg-[#211d15] px-2 py-1 font-mono"
              value={extId}
              onChange={(e) => setExtId(e.target.value)}
              placeholder="SB-…"
            />
            <input
              aria-label="display name"
              className="rounded border border-[#5c4a32] bg-[#211d15] px-2 py-1"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <select
              aria-label="account type"
              className="rounded border border-[#5c4a32] bg-[#211d15] px-2 py-1"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
            >
              <option value="camp-operating">camp-operating</option>
              <option value="atm-settlement">atm-settlement</option>
              <option value="merchant">merchant</option>
            </select>
            <button
              type="button"
              className="rounded bg-[#c0a36e] px-3 py-1 font-semibold text-black disabled:opacity-50"
              disabled={
                createBilling.isPending || !extId.trim() || !displayName.trim()
              }
              onClick={() =>
                createBilling.mutate({
                  externalAccountId: extId.trim(),
                  displayName: displayName.trim(),
                  accountType,
                })
              }
            >
              Create account
            </button>
          </div>
          <h3 className="mt-4 text-sm font-semibold uppercase text-[#c0a36e]">
            Set fee policy
          </h3>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <select
              aria-label="fee account"
              className="rounded border border-[#5c4a32] bg-[#211d15] px-2 py-1 font-mono"
              value={feeAccountId}
              onChange={(e) => setFeeAccountId(e.target.value)}
            >
              <option value="">select account uuid</option>
              {(billing.data?.accounts ?? [])
                .filter((a) => a.id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountId} ({a.id?.slice(0, 8)})
                  </option>
                ))}
            </select>
            <input
              aria-label="fee account uuid"
              className="min-w-[12rem] rounded border border-[#5c4a32] bg-[#211d15] px-2 py-1 font-mono text-xs"
              value={feeAccountId}
              onChange={(e) => setFeeAccountId(e.target.value)}
              placeholder="billing account uuid"
            />
            <select
              aria-label="policy kind"
              className="rounded border border-[#5c4a32] bg-[#211d15] px-2 py-1"
              value={policyKind}
              onChange={(e) =>
                setPolicyKind(e.target.value as typeof policyKind)
              }
            >
              <option value="flat">flat</option>
              <option value="percentage">percentage</option>
              <option value="per-message">per-message</option>
              <option value="waived">waived</option>
              <option value="sponsored">sponsored</option>
              <option value="merchant-pays">merchant-pays</option>
              <option value="operator-pays">operator-pays</option>
            </select>
            <input
              aria-label="fee amount"
              className="w-20 rounded border border-[#5c4a32] bg-[#211d15] px-2 py-1 font-mono"
              value={feeAmount}
              onChange={(e) => setFeeAmount(e.target.value)}
            />
            <button
              type="button"
              className="rounded border border-[#5c4a32] px-3 py-1 uppercase disabled:opacity-50"
              disabled={setFee.isPending || !feeAccountId.trim()}
              onClick={() =>
                setFee.mutate({
                  accountId: feeAccountId.trim(),
                  policyKind,
                  amount: Number.parseInt(feeAmount, 10) || 0,
                  memo: `fee policy ${policyKind}`,
                })
              }
            >
              Set fee policy
            </button>
          </div>
          {billingNotice ? (
            <p className="mt-3 font-mono text-xs text-[#f0a875]">{billingNotice}</p>
          ) : null}
        </div>

        <h3 className="mt-5 text-lg font-bold">Settlement accounts</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {(billing.data?.accounts ?? []).map((account) => (
            <article
              className="rounded border border-[#5c4a32] bg-[#17130d] p-4"
              key={account.id ?? account.accountId}
            >
              <p className="font-mono text-sm text-[#9ed783]">
                {account.accountId}
              </p>
              {account.id ? (
                <button
                  type="button"
                  className="mt-1 font-mono text-[10px] text-[#c0a36e] underline"
                  onClick={() => setFeeAccountId(account.id ?? "")}
                  title="Use for fee policy"
                >
                  uuid {account.id.slice(0, 12)}…
                </button>
              ) : (
                <p className="mt-1 font-mono text-[10px] text-[#9a8a6e]">
                  seed account (no uuid — create DB account for fee policy)
                </p>
              )}
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

      <ServiceVerbDesk
        services={services.data?.services ?? []}
        onChanged={() => {
          void queryClient.invalidateQueries(
            trpc.omnidat.services.queryFilter(),
          );
          void queryClient.invalidateQueries(
            trpc.omnidat.listRecentAuditEvents.queryFilter(),
          );
        }}
      />
    </div>
  );
}

function ServiceVerbDesk(props: {
  services: Array<{
    slug: string;
    name: string;
    x121: string;
    category: string;
    verbs: Array<{
      name: string;
      description: string;
      inputs: string[];
      outputs: string[];
    }>;
  }>;
  onChanged: () => void;
}) {
  const trpc = useTRPC();
  const [serviceId, setServiceId] = useState(
    props.services[0]?.slug ?? "directory",
  );
  const [verb, setVerb] = useState("HELP");
  const [description, setDescription] = useState("Operator-published verb");
  const [notice, setNotice] = useState<string | null>(null);

  const upsert = useMutation(
    trpc.omnidat.upsertServiceVerb.mutationOptions({
      onSuccess: (result) => {
        setNotice(`Upserted verb ${result.verb ?? verb} on ${serviceId}`);
        props.onChanged();
      },
      onError: (error: { message?: string }) => {
        setNotice(
          /role required|FORBIDDEN/i.test(error.message ?? "")
            ? "verb.write required (packet-operator / admin)."
            : (error.message ?? "Upsert failed"),
        );
      },
    }),
  );
  const disable = useMutation(
    trpc.omnidat.disableServiceVerb.mutationOptions({
      onSuccess: (_r, input) => {
        setNotice(`Disabled ${input.verb} on ${input.serviceId}`);
        props.onChanged();
      },
      onError: (error: { message?: string }) => {
        setNotice(
          /role required|FORBIDDEN/i.test(error.message ?? "")
            ? "verb.write required (packet-operator / admin)."
            : (error.message ?? "Disable failed"),
        );
      },
    }),
  );

  return (
    <section
      className="rounded border border-[#4f3920] bg-[#211d15] p-5"
      data-testid="service-verb-desk"
    >
      <h2 className="text-2xl font-bold">Verbs and Address Assignments</h2>
      <p className="mt-1 text-sm text-[#c0a36e]">
        Publish or disable service verbs (verb.write). serviceId is the
        service slug or DB uuid.
      </p>

      <div className="mt-4 rounded border border-[#5c4a32] bg-[#17130d] p-4">
        <h3 className="text-sm font-semibold uppercase text-[#c0a36e]">
          Upsert verb
        </h3>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <select
            aria-label="service for verb"
            className="rounded border border-[#5c4a32] bg-[#211d15] px-2 py-1 font-mono"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            {props.services.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.slug} ({s.x121})
              </option>
            ))}
          </select>
          <input
            aria-label="verb name"
            className="rounded border border-[#5c4a32] bg-[#211d15] px-2 py-1 font-mono uppercase"
            value={verb}
            onChange={(e) => setVerb(e.target.value.toUpperCase())}
          />
          <input
            aria-label="verb description"
            className="min-w-[12rem] flex-1 rounded border border-[#5c4a32] bg-[#211d15] px-2 py-1"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            type="button"
            className="rounded bg-[#c0a36e] px-3 py-1 font-semibold text-black disabled:opacity-50"
            disabled={upsert.isPending || !serviceId.trim() || !verb.trim()}
            onClick={() =>
              upsert.mutate({
                serviceId: serviceId.trim(),
                verb: verb.trim(),
                description: description.trim() || null,
                inputs: [],
                outputs: ["ok"],
              })
            }
          >
            Upsert verb
          </button>
        </div>
        {notice ? (
          <p className="mt-2 font-mono text-xs text-[#f0a875]">{notice}</p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3">
        {props.services.map((service) => (
          <article
            className="rounded border border-[#5c4a32] bg-[#17130d] p-4"
            key={service.slug}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-[#9ed783]">{service.x121}</p>
                <h3 className="mt-1 font-semibold">{service.name}</h3>
                <p className="font-mono text-[10px] text-[#9a8a6e]">
                  serviceId: {service.slug}
                </p>
              </div>
              <span className="rounded border border-[#7a694f] px-2 py-1 text-xs uppercase">
                {service.category}
              </span>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {service.verbs.map((v) => (
                <div
                  className="rounded border border-[#33291d] p-3"
                  key={v.name}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-sm font-semibold">{v.name}</p>
                    <button
                      type="button"
                      className="rounded border border-[#a1471f] px-1.5 py-0.5 text-[10px] uppercase text-[#f0a875] disabled:opacity-50"
                      disabled={disable.isPending}
                      onClick={() =>
                        disable.mutate({
                          serviceId: service.slug,
                          verb: v.name,
                        })
                      }
                    >
                      Disable
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-[#d9cbb0]">{v.description}</p>
                  <p className="mt-2 text-xs text-[#c0a36e]">
                    in: {v.inputs.join(", ") || "—"} / out:{" "}
                    {v.outputs.join(", ") || "—"}
                  </p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
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
