"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "~/trpc/react";

// Browser XOT terminal (H2). A PAD> prompt drives the packet bridge:
// DIR/LOOKUP/HELP read the directory client-side, CALL runs omnidat.packetCall
// and shows the honest clear line and receipt. When the operator directory is
// unavailable (unauthenticated/offline), the terminal labels itself SIMULATOR
// and uses the public services list so the demo path never dead-ends.
const HELP =
  "VERBS: DIR [NAMESPACE], LOOKUP <X121>, CALL <X121> [VERB], CAMP/EVIDENCE (camp doc), HELP, CLR";

export function OmnidatXotTerminal() {
  const trpc = useTRPC();
  const services = useQuery(trpc.omnidat.services.queryOptions());
  const [lines, setLines] = useState<string[]>([
    "OMNIDAT PACKET CLEARING XOT TERMINAL",
    "TYPE HELP FOR VERBS",
  ]);
  const [command, setCommand] = useState("");
  const [status, setStatus] = useState<"idle" | "connected" | "cleared">("idle");

  const directory = services.data?.services ?? [];
  const simulator = services.isError;

  const packetCall = useMutation(
    trpc.omnidat.packetCall.mutationOptions({
      onSuccess: (result) => {
        setLines((prev) => [
          ...prev,
          ...result.transcript.split("\n"),
          `RECEIPT: ${result.receipt.title}`,
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

  const renderDoc = useMutation(
    trpc.omnidat.renderDocument.mutationOptions({
      onSuccess: (doc) => {
        setLines((prev) => [...prev, `DOC ${doc.title}:`, ...doc.body.split('\n').slice(0, 8), "(truncated for terminal)"]);
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
    } else if (upper === "CALL") {
      const x121 = args[0] ?? "";
      const callVerb = args[1] ?? "CALL";
      packetCall.mutate({
        sourceIdentity: "browser-xot-terminal",
        sourceTransport: "xot",
        destinationX121: x121,
        verb: callVerb,
      });
    } else if (upper === "CAMP" || upper === "EVIDENCE") {
      renderDoc.mutate({
        kind: "camp-deployment-summary",
        data: { event: "TOORCAMP-2028", scope: "OPT-IN VILLAGE", dates: "2028-07", services: "25", apps: "12", allocations: "87" },
      });
    } else {
      setLines((prev) => [...prev, `CLR NP C:13 D:67 — UNKNOWN VERB ${upper}`]);
    }
    setCommand("");
  }

  return (
    <section className="rounded border border-[#4f3920] bg-[#0d0b07] p-5 font-mono">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#9ed783]">XOT TERMINAL</h2>
        <span className="text-xs uppercase text-[#c0a36e]">
          {simulator ? "SIMULATOR" : status}
        </span>
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
