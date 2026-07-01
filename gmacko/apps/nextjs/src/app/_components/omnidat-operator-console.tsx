"use client";

import { Button } from "@omnidat/ui/button";
import { Input } from "@omnidat/ui/input";
import { toast } from "@omnidat/ui/toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "~/trpc/react";

export function OmnidatOperatorConsole() {
  const trpc = useTRPC();
  const dashboard = useQuery(trpc.omnidat.dashboard.queryOptions());
  const services = useQuery(trpc.omnidat.services.queryOptions());
  const food = useQuery(trpc.omnidat.foodProtocol.queryOptions());
  const atm = useQuery(trpc.omnidat.atmProtocol.queryOptions());
  const [campsiteName, setCampsiteName] = useState("Camp Laminar");
  const [transport, setTransport] = useState("meshcore");
  const [serviceSlug, setServiceSlug] = useState("food-service");

  const verify = useMutation(
    trpc.omnidat.verifyProvisioning.mutationOptions({
      onError: () => toast.error("Provisioning verification failed"),
    }),
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <p className="text-sm font-semibold uppercase text-[#c0a36e]">
          Campsite Packet Setup
        </p>
        <h1 className="mt-2 text-3xl font-black">PDF Configuration</h1>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm">
            Campsite
            <Input
              value={campsiteName}
              onChange={(event) => setCampsiteName(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            Transport
            <Input
              value={transport}
              onChange={(event) => setTransport(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            Service Slug
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={serviceSlug}
              onChange={(event) => setServiceSlug(event.target.value)}
            >
              {(services.data?.services ?? []).map((service) => (
                <option key={service.slug} value={service.slug}>
                  {service.slug} - {service.x121}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 rounded border border-[#5c4a32] bg-[#17130d] p-4">
          <h2 className="text-xl font-bold">Provisioning Verification</h2>
          <p className="mt-2 text-sm leading-6 text-[#d9cbb0]">
            Submit a test call through the seeded Exchange 88 adapter and print a
            terminal receipt for the camp operator.
          </p>
          <Button
            className="mt-4"
            disabled={verify.isPending}
            onClick={() =>
              verify.mutate({
                campsiteName,
                serviceSlug,
                transport,
              })
            }
          >
            Verify X.25 Reachability
          </Button>
          <pre className="mt-4 overflow-x-auto rounded bg-black p-4 font-mono text-sm leading-6 text-[#8ee36c]">
            {verify.data?.transcript ??
              `OMNIDAT PAD READY
CALL 311088010110
VERIFY ${campsiteName.toUpperCase()}
STATUS AWAITING OPERATOR`}
          </pre>
        </div>
      </section>

      <section className="grid gap-5">
        <div className="rounded border border-[#4f3920] bg-[#211d15] p-5">
          <h2 className="text-2xl font-bold">Network Assignment</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Panel label="X.121 Address" value="311088020184" />
            <Panel
              label="Billing Accounts"
              value={dashboard.data?.metrics.billingAccounts ?? 0}
            />
            <Panel
              label="Open Requests"
              value={dashboard.data?.metrics.pendingProvisioning ?? 0}
            />
          </div>
        </div>

        <div className="rounded border border-[#4f3920] bg-[#211d15] p-5">
          <h2 className="text-2xl font-bold">Miliways Food Protocol</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(food.data?.menu ?? []).map((item) => (
              <div
                className="rounded border border-[#5c4a32] bg-[#17130d] p-4"
                key={item.itemId}
              >
                <p className="font-semibold">{item.name}</p>
                <p className="mt-1 text-sm text-[#c0a36e]">
                  {item.priceShadyBucks} SHDY
                </p>
                <p className="mt-2 text-xs uppercase">
                  {item.available ? "available" : "sold out"}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-[#4f3920] bg-[#211d15] p-5">
          <h2 className="text-2xl font-bold">ShadyBucks Account</h2>
          <p className="mt-2 font-mono text-sm text-[#9ed783]">{atm.data?.x121}</p>
          <ul className="mt-4 grid gap-2 text-sm leading-6 text-[#d9cbb0]">
            {(atm.data?.setupChecklist ?? []).map((item) => (
              <li className="rounded border border-[#5c4a32] bg-[#17130d] p-3" key={item}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Panel(props: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-[#5c4a32] bg-[#17130d] p-4">
      <p className="text-sm text-[#c0a36e]">{props.label}</p>
      <p className="mt-2 font-mono text-xl font-bold">{props.value}</p>
    </div>
  );
}
