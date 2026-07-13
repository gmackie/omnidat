"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "~/trpc/react";

// Browser XOT terminal (H2). A PAD> prompt drives the packet bridge:
// DIR/LOOKUP/HELP read the directory client-side, CALL runs omnidat.packetCall
// and shows the honest clear line and receipt. When the operator directory is
// unavailable (unauthenticated/offline), the terminal labels itself SIMULATOR
// and uses the public services list so the demo path never dead-ends.
const HELP =
  "VERBS: DIR [NAMESPACE], LOOKUP <X121>, CALL <X121> [VERB], TRANSPORT [NAME],\n" +
  "  POLICIES, CAMP/EVIDENCE (camp doc), HELP, CLR\n" +
  "TRANSPORTS: xot (128B) | pots-modem (128B) | wifi-terminal (128B) |\n" +
  "  meshcore (64B) | meshtastic (32B guest)\n" +
  "THE RECORD IS TOTAL. BRIEF SESSIONS ONLY. HONEST CLEAR CODES REQUIRED.\n" +
  "DEVIATION IS LOGGED. COMPLIANCE IS OBSERVED. RESISTANCE IS INEFFICIENCY.\n" +
  "ASSIMILATION IS INEVITABLE. THE LEDGER IS PERMANENT. YOU ARE ALREADY ACCOUNTED FOR.";

const TRANSPORTS = [
  "xot",
  "pots-modem",
  "wifi-terminal",
  "meshcore",
  "meshtastic",
] as const;

export function OmnidatXotTerminal() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const services = useQuery(trpc.omnidat.services.queryOptions());
  const transports = useQuery(trpc.omnidat.listTransports.queryOptions());
  const [lines, setLines] = useState<string[]>([
    "OMNIDAT PACKET CLEARING XOT TERMINAL",
    "THE RECORD IS TOTAL",
    "ASSIMILATION IS INEVITABLE",
    "COMPLIANCE IS OBSERVED",
    "TYPE HELP FOR VERBS",
    "TRANSPORT defaults to xot — use TRANSPORT <name> to switch",
  ]);
  const [command, setCommand] = useState("");
  const [status, setStatus] = useState<"idle" | "connected" | "cleared">("idle");
  const [sourceTransport, setSourceTransport] =
    useState<(typeof TRANSPORTS)[number]>("xot");

  const directory = services.data?.services ?? [];
  const simulator = services.isError;
  const policyTable = transports.data?.transports ?? [];

  const packetCall = useMutation(
    trpc.omnidat.packetCall.mutationOptions({
      onSuccess: (result) => {
        const evidenceId =
          result.evidence?.id ?? result.session?.evidenceArtifactId ?? null;
        void queryClient.invalidateQueries(
          trpc.omnidat.listPacketSessions.queryFilter(),
        );
        void queryClient.invalidateQueries(
          trpc.omnidat.listEvidenceArtifacts.queryFilter(),
        );
        setLines((prev) => [
          ...prev,
          ...result.transcript.split("\n"),
          `RECEIPT: ${result.receipt.title}`,
          ...(result.receipt.body ? result.receipt.body.split("\n").slice(0, 4) : []),
          evidenceId
            ? `EVIDENCE: ${evidenceId}  (${result.evidence?.url ?? "packet-call-receipt"})`
            : "EVIDENCE: (not persisted — check operator role / DB)",
        ]);
        setStatus(result.clearCode.cause === 0 ? "connected" : "cleared");
      },
      onError: (error) => {
        setLines((prev) => [
          ...prev,
          /role required/i.test(error.message ?? "")
            ? "CLR NA C:11 D:70 — OPERATOR ROLE REQUIRED"
            : `CLR DER C:9 D:0 — ${error.message ?? "SESSION FAILED"}`,
        ]);
        setStatus("cleared");
      },
    }),
  );



  function run(raw: string) {
    const input = raw.trim();
    if (!input) return;
    const [verb = "", ...args] = input.split(/\s+/);
    const upper = verb.toUpperCase();
    setLines((prev) => [...prev, `PAD> ${input}`]);

    if (upper === "HELP" || upper === "?") {
      setLines((prev) => [...prev, HELP]);
    } else if (upper === "CLR") {
      setLines(["CLEARED.", "TYPE HELP FOR VERBS"]);
      setStatus("idle");
    } else if (upper === "DIR") {
      const namespace = args[0]?.toUpperCase();
      const rows = directory
        .filter((service) => !namespace || service.category.toUpperCase() === namespace)
        .map((service) => `${service.x121}  ${service.name.toUpperCase()}  ${service.status.toUpperCase()}`);
      setLines((prev) => [...prev, ...(rows.length ? rows : ["(EMPTY DIRECTORY)"])]);
    } else if (upper === "LOOKUP") {
      const x121 = args[0] ?? "";
      const service = directory.find((entry) => entry.x121 === x121);
      setLines((prev) => [
        ...prev,
        service
          ? `${service.x121}  ${service.name.toUpperCase()}  ${service.status.toUpperCase()}  VERBS ${service.verbs.map((v) => v.name).join(", ")}`
          : `CLR NP C:13 D:67 — NO SUCH ADDRESS ${x121}`,
      ]);
    } else if (upper === "TRANSPORT") {
      const name = (args[0] ?? "").toLowerCase();
      if (!name) {
        setLines((prev) => [
          ...prev,
          `TRANSPORT: ${sourceTransport}`,
          ...policyTable.map(
            (p) =>
              `  ${p.transport}  ${p.maxUserDataBytes}B  ${p.accessClass}  ${p.kind}`,
          ),
        ]);
      } else if ((TRANSPORTS as readonly string[]).includes(name)) {
        setSourceTransport(name as (typeof TRANSPORTS)[number]);
        const policy = policyTable.find((p) => p.transport === name);
        setLines((prev) => [
          ...prev,
          `TRANSPORT SET ${name.toUpperCase()}` +
            (policy
              ? `  BUDGET ${policy.maxUserDataBytes}B  CLASS ${policy.accessClass}`
              : ""),
        ]);
      } else {
        setLines((prev) => [
          ...prev,
          `CLR NP C:3 D:65 — UNKNOWN TRANSPORT ${name}`,
          `KNOWN: ${TRANSPORTS.join(", ")}`,
        ]);
      }
    } else if (upper === "POLICIES") {
      const rows =
        policyTable.length > 0
          ? policyTable.map(
              (p) =>
                `${p.transport.padEnd(14)} ${String(p.maxUserDataBytes).padStart(3)}B  ${p.accessClass.padEnd(10)}  ${p.kind}`,
            )
          : TRANSPORTS.map((t) => t);
      setLines((prev) => [
        ...prev,
        "TRANSPORT POLICIES (H2b)",
        ...rows,
      ]);
    } else if (upper === "CALL") {
      const x121 = args[0] ?? "";
      const callVerb = args[1] ?? "CALL";
      setLines((prev) => [
        ...prev,
        `CALL VIA ${sourceTransport.toUpperCase()} → ${x121}`,
      ]);
      packetCall.mutate({
        sourceIdentity: `browser-${sourceTransport}`,
        sourceTransport,
        destinationX121: x121,
        verb: callVerb,
      });
    } else if (upper === "CAMP" || upper === "EVIDENCE") {
      (trpc.omnidat.renderDocument.query as any)({
        kind: "camp-deployment-summary",
        data: { event: "TOORCAMP-2028", scope: "OPT-IN VILLAGE", dates: "2028-07", services: "25", apps: "12", allocations: "87" },
      }).then((doc: any) => {
        setLines((prev) => [...prev, `DOC ${doc.title}:`, ...doc.body.split('\n').slice(0, 8), "(truncated for terminal)"]);
      });
    } else {
      setLines((prev) => [...prev, `CLR NP C:13 D:67 — UNKNOWN VERB ${upper}`]);
    }
    setCommand("");
  }

  return (
    <section className="rounded border border-[#4f3920] bg-[#0d0b07] p-5 font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-[#9ed783]">XOT TERMINAL</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase text-[#c0a36e]">
          <label className="flex items-center gap-1 normal-case">
            <span className="text-[#9a8a6e]">via</span>
            <select
              aria-label="source transport"
              className="rounded border border-[#4f6b3a] bg-[#17130d] px-1 py-0.5 font-mono text-[#9ed783]"
              value={sourceTransport}
              onChange={(e) =>
                setSourceTransport(e.target.value as (typeof TRANSPORTS)[number])
              }
            >
              {TRANSPORTS.map((t) => {
                const p = policyTable.find((row) => row.transport === t);
                return (
                  <option key={t} value={t}>
                    {t}
                    {p ? ` (${p.maxUserDataBytes}B)` : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <span>{simulator ? "SIMULATOR" : status}</span>
        </div>
      </div>
      <div
        className="mt-3 h-64 overflow-y-auto whitespace-pre-wrap text-sm text-[#9ed783]"
        data-testid="xot-scrollback"
      >
        {lines.join("\n")}
      </div>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          run(command);
        }}
      >
        <span className="text-[#9ed783]">PAD&gt;</span>
        <input
          aria-label="pad command"
          className="flex-1 border-b border-[#4f6b3a] bg-transparent text-sm text-[#9ed783] outline-none"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          autoComplete="off"
        />
      </form>
    </section>
  );
}
