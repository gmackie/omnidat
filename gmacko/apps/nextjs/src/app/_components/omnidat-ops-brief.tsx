"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { useTRPC } from "~/trpc/react";

const CHECKLIST: Array<{
  step: string;
  href: string;
  detail: string;
}> = [
  {
    step: "1. Sign in",
    href: "/login",
    detail: "OmniAuth passkey preferred; confirm roles on Account",
  },
  {
    step: "2. Event live",
    href: "/console",
    detail: "Create/advance event to active; note event UUID for authority",
  },
  {
    step: "3. Campsites & apps",
    href: "/console",
    detail: "Pending → active campsites; publish campsite apps",
  },
  {
    step: "4. X.121 & provisioning",
    href: "/console",
    detail: "Allocate → verify; walk provisioning to active",
  },
  {
    step: "5. Terminal CALL",
    href: "/console/terminal",
    detail: "VT100/XOT CALL → session + packet-call-receipt",
  },
  {
    step: "6. NOC watch",
    href: "/noc",
    detail: "Sessions, clear codes, incidents, authority drill",
  },
  {
    step: "7. Merchant demo",
    href: "/console",
    detail: "POS sale / batch close — play-money only",
  },
  {
    step: "8. Daily package",
    href: "/console",
    detail: "Daily NOC package + evidence export",
  },
  {
    step: "9. Public claims",
    href: "/what-is-real",
    detail: "Keep wording honest for leadership / campers",
  },
];

/** Camp-day operator brief: live status + ordered checklist. */
export function OmnidatOpsBrief() {
  const trpc = useTRPC();
  const me = useQuery({
    ...trpc.omnidat.operatorMe.queryOptions(),
    retry: 1,
  });
  const status = useQuery(trpc.omnidat.publicStatus.queryOptions({}));
  const events = useQuery({
    ...trpc.omnidat.listEvents.queryOptions(),
    retry: 1,
  });
  const sessions = useQuery({
    ...trpc.omnidat.listPacketSessions.queryOptions(),
    retry: 1,
  });
  const incidents = useQuery({
    ...trpc.omnidat.listIncidents.queryOptions(),
    retry: 1,
  });

  const openIncidents =
    incidents.data?.incidents?.filter((i) => i.status !== "resolved").length ??
    0;
  const openSessions =
    sessions.data?.sessions?.filter(
      (s) => s.status !== "cleared" && s.clearCause === null,
    ).length ?? 0;
  const activeEvents =
    events.data?.events?.filter((e) => e.status === "active").length ?? 0;

  return (
    <div className="grid gap-5" data-testid="ops-brief">
      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <h2 className="text-2xl font-bold">Operator identity</h2>
        {me.isError ? (
          <p className="mt-2 font-mono text-sm text-[#f0a875]">
            Not signed in or no operator session —{" "}
            <Link className="underline" href="/login">
              /login
            </Link>
          </p>
        ) : (
          <dl className="mt-3 grid gap-2 font-mono text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[#c0a36e]">Operator</dt>
              <dd>
                {me.data?.name ?? "—"}{" "}
                {me.data?.email ? `<${me.data.email}>` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[#c0a36e]">Roles</dt>
              <dd>
                {(me.data?.roles ?? []).join(", ") || "none"}
                {me.data?.isBootstrapAdmin ? " · bootstrap-admin" : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[#c0a36e]">Can operate</dt>
              <dd>{me.data?.canOperate ? "yes" : "no"}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Network"
          value={
            status.data
              ? `${status.data.network.protocol} ${status.data.network.status}`
              : "…"
          }
        />
        <Tile
          label="Active events"
          value={events.isError ? "?" : String(activeEvents)}
        />
        <Tile
          label="Open sessions"
          value={sessions.isError ? "?" : String(openSessions)}
        />
        <Tile
          label="Open incidents"
          value={incidents.isError ? "?" : String(openIncidents)}
        />
      </section>

      <section className="rounded border border-[#4f3920] bg-[#211d15] p-5">
        <h2 className="text-2xl font-bold">Camp-day checklist</h2>
        <p className="mt-1 text-sm text-[#c0a36e]">
          Ordered path for a bounded rehearsal. Links jump to the live surface.
        </p>
        <ol className="mt-4 space-y-3">
          {CHECKLIST.map((item) => (
            <li
              key={item.step}
              className="rounded border border-[#5c4a32] bg-[#17130d] p-3"
            >
              <Link
                className="font-semibold text-[#9ed783] underline"
                href={item.href}
              >
                {item.step}
              </Link>
              <p className="mt-1 text-sm text-[#d9cbb0]">{item.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded border border-[#4f6b3a] bg-[#1a2413] p-5">
        <h2 className="text-lg font-bold text-[#9ed783]">Quick links</h2>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {[
            ["/console", "Console"],
            ["/console/terminal", "VT100"],
            ["/noc", "NOC"],
            ["/operator-admin", "Admin"],
            ["/directory", "Directory"],
            ["/status", "Status"],
            ["/what-is-real", "Honesty"],
          ].map(([href, label]) => (
            <li key={href}>
              <Link
                className="rounded border border-[#5c4a32] px-3 py-1.5 text-[#d9cbb0] hover:border-[#9ed783]"
                href={href}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 font-mono text-xs text-[#9a8a6e]">
          Authority: {status.data?.sync.holder ?? "—"} epoch{" "}
          {status.data?.sync.epoch ?? "—"} · Bank:{" "}
          {status.data?.bank.rail ?? "—"} (
          {status.data?.bank.merchantLinkStatus ?? "—"})
        </p>
      </section>
    </div>
  );
}

function Tile(props: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#5c4a32] bg-[#17130d] p-4">
      <p className="text-sm text-[#c0a36e]">{props.label}</p>
      <p className="mt-2 font-mono text-xl font-bold">{props.value}</p>
    </div>
  );
}
