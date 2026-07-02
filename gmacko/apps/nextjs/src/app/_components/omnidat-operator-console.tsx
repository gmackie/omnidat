"use client";

import { Button } from "@omnidat/ui/button";
import { Input } from "@omnidat/ui/input";
import { toast } from "@omnidat/ui/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useTRPC } from "~/trpc/react";

export function OmnidatOperatorConsole() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const dashboard = useQuery(trpc.omnidat.dashboard.queryOptions());
  const services = useQuery(trpc.omnidat.services.queryOptions());
  const food = useQuery(trpc.omnidat.foodProtocol.queryOptions());
  const atm = useQuery(trpc.omnidat.atmProtocol.queryOptions());
  const operations = useQuery(trpc.omnidat.operations.queryOptions());
  const [campsiteName, setCampsiteName] = useState("Camp Laminar");
  const [contact, setContact] = useState("operator@camp.example");
  const [appName, setAppName] = useState("Camp Message Desk");
  const [appKind, setAppKind] = useState("message-desk");
  const [transport, setTransport] = useState("meshcore");
  const [serviceSlug, setServiceSlug] = useState("food-service");
  const [assignedX121, setAssignedX121] = useState("311088020184");
  const [terminalCommand, setTerminalCommand] = useState("DIR CAMP");
  const [pickupName, setPickupName] = useState("Packet Window 3");
  const [shadybucksAccountId, setShadybucksAccountId] = useState(
    "SB-CAMP-LAMINAR-001",
  );
  const [selectedFoodItems, setSelectedFoodItems] = useState(["NOODLE-CUP"]);
  const [passportId, setPassportId] = useState("PASS-04271");
  const [badgeId, setBadgeId] = useState("FIELD-COURIER");
  const [passportOperatorId, setPassportOperatorId] = useState("OP-EX88");
  const [passportEvidence, setPassportEvidence] = useState(
    "Filed an X.25 packet receipt.",
  );
  const [isoAmount, setIsoAmount] = useState("19");
  const [isoProcessingCode, setIsoProcessingCode] = useState<
    "000000" | "010000" | "210000" | "310000" | "920000"
  >("000000");
  const [isoTerminalId, setIsoTerminalId] = useState("ATM-EX88-001");
  const [isoRetrievalReference, setIsoRetrievalReference] =
    useState("000000000019");

  const verify = useMutation(
    trpc.omnidat.verifyProvisioning.mutationOptions({
      onError: () => toast.error("Provisioning verification failed"),
    }),
  );

  const provision = useMutation(
    trpc.omnidat.provisionCampsiteService.mutationOptions({
      onSuccess: (data) => {
        setAssignedX121(data.assignment.assignedX121);
        setTerminalCommand(`CALL ${data.assignment.assignedX121}`);
        toast.success("X.121 address provisioned");
        void queryClient.invalidateQueries();
      },
      onError: () => toast.error("X.121 provisioning failed"),
    }),
  );

  const configureXot = useMutation(
    trpc.omnidat.configurePad.mutationOptions({
      onSuccess: () => {
        toast.success("XOT PAD configured");
        void queryClient.invalidateQueries();
      },
      onError: () => toast.error("PAD configuration failed"),
    }),
  );

  const xot = useMutation(
    trpc.omnidat.xotCommand.mutationOptions({
      onError: () => toast.error("XOT terminal command failed"),
    }),
  );

  const foodOrder = useMutation(
    trpc.omnidat.createFoodOrder.mutationOptions({
      onSuccess: () => {
        toast.success("Miliways line ticket issued");
        void queryClient.invalidateQueries();
      },
      onError: () => toast.error("Food order failed"),
    }),
  );

  const passportStamp = useMutation(
    trpc.omnidat.stampActivityPassport.mutationOptions({
      onSuccess: () => {
        toast.success("Activity passport stamped");
        void queryClient.invalidateQueries();
      },
      onError: () => toast.error("Passport stamp failed"),
    }),
  );

  const iso8583 = useMutation(
    trpc.omnidat.iso8583Transaction.mutationOptions({
      onError: () => toast.error("ISO 8583 transaction failed"),
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
            Operator Contact
            <Input
              value={contact}
              onChange={(event) => setContact(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            Campsite App
            <Input
              value={appName}
              onChange={(event) => setAppName(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            App Kind
            <Input
              value={appKind}
              onChange={(event) => setAppKind(event.target.value)}
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
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            disabled={provision.isPending}
            onClick={() =>
              provision.mutate({
                campsiteName,
                namespace: "camp",
                contact,
                appName,
                appKind,
                transport,
              })
            }
          >
            Provision X.121 Address
          </Button>
          <Button
            disabled={configureXot.isPending}
            variant="outline"
            onClick={() =>
              configureXot.mutate({
                x121: assignedX121,
                transport: "xot",
                padKind: "xot-terminal",
                endpointLabel: `${campsiteName} XOT terminal`,
              })
            }
          >
            Configure XOT PAD
          </Button>
        </div>

        <div className="mt-6 rounded border border-[#5c4a32] bg-[#17130d] p-4">
          <h2 className="text-xl font-bold">Provisioning Verification</h2>
          <p className="mt-2 text-sm leading-6 text-[#d9cbb0]">
            Submit a test call through the seeded Exchange 88 adapter and print
            a terminal receipt for the camp operator.
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

        <div className="mt-6 rounded border border-[#5c4a32] bg-[#17130d] p-4">
          <h2 className="text-xl font-bold">XOT Terminal</h2>
          <p className="mt-2 text-sm leading-6 text-[#d9cbb0]">
            Issue X.25 operator commands through the OMNIDAT XOT adapter.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <Input
              value={terminalCommand}
              onChange={(event) => setTerminalCommand(event.target.value)}
            />
            <Button
              disabled={xot.isPending}
              onClick={() =>
                xot.mutate({
                  sourceX121: assignedX121,
                  command: terminalCommand,
                })
              }
            >
              Send
            </Button>
          </div>
          <pre className="mt-4 min-h-36 overflow-x-auto rounded bg-black p-4 font-mono text-sm leading-6 text-[#8ee36c]">
            {xot.data?.transcript ??
              `XOT READY ${assignedX121}
HELP
DIR CAMP
CALL ${assignedX121}
PAD ${assignedX121}
BILL SB-CAMP-LAMINAR-001`}
          </pre>
        </div>
      </section>

      <section className="grid gap-5">
        <div className="rounded border border-[#4f3920] bg-[#211d15] p-5">
          <h2 className="text-2xl font-bold">Network Assignment</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Panel label="X.121 Address" value={assignedX121} />
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
              <label
                className="grid gap-2 rounded border border-[#5c4a32] bg-[#17130d] p-4"
                key={item.itemId}
              >
                <span className="flex items-center gap-3">
                  <input
                    checked={selectedFoodItems.includes(item.itemId)}
                    disabled={!item.available}
                    onChange={(event) =>
                      setSelectedFoodItems((current) =>
                        event.target.checked
                          ? [...current, item.itemId]
                          : current.filter((itemId) => itemId !== item.itemId),
                      )
                    }
                    type="checkbox"
                  />
                  <span className="font-semibold">{item.name}</span>
                </span>
                <p className="mt-1 text-sm text-[#c0a36e]">
                  {item.priceShadyBucks} SHDY
                </p>
                <p className="mt-2 text-xs uppercase">
                  {item.available ? "available" : "sold out"}
                </p>
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              Pickup Name
              <Input
                value={pickupName}
                onChange={(event) => setPickupName(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              ShadyBucks Account
              <Input
                value={shadybucksAccountId}
                onChange={(event) => setShadybucksAccountId(event.target.value)}
              />
            </label>
          </div>
          <Button
            className="mt-4"
            disabled={foodOrder.isPending || selectedFoodItems.length === 0}
            onClick={() =>
              foodOrder.mutate({
                itemIds: selectedFoodItems,
                pickupName,
                shadybucksAccountId,
              })
            }
          >
            Submit Food Order
          </Button>
          <pre className="mt-4 min-h-28 overflow-x-auto rounded bg-black p-4 font-mono text-sm leading-6 text-[#8ee36c]">
            {foodOrder.data?.transcript ??
              `CALL 311088020501
ORDER.CREATE ${selectedFoodItems.join(",") || "NO SELECTION"}
ACCOUNT ${shadybucksAccountId}
STATUS AWAITING MENU SELECTION`}
          </pre>
          <div className="mt-4 grid gap-3">
            {(operations.data?.foodOrders ?? []).slice(0, 3).map((order) => (
              <div
                className="rounded border border-[#5c4a32] bg-[#17130d] p-4"
                key={order.id}
              >
                <p className="font-mono text-sm text-[#9ed783]">
                  {order.lineTicket}
                </p>
                <p className="mt-1 font-semibold">{order.pickupName}</p>
                <p className="mt-2 text-xs uppercase text-[#c0a36e]">
                  {order.status} / {order.total} {order.currency} /{" "}
                  {order.estimatedWaitMinutes} min
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-[#4f3920] bg-[#211d15] p-5">
          <h2 className="text-2xl font-bold">ShadyBucks Account</h2>
          <p className="mt-2 font-mono text-sm text-[#9ed783]">
            {atm.data?.x121}
          </p>
          <p className="mt-2 font-mono text-xs uppercase text-[#c0a36e]">
            {atm.data?.iso8583?.protocol ?? "ISO8583-1987-SHADYBUCKS-X25"}
          </p>
          <ul className="mt-4 grid gap-2 text-sm leading-6 text-[#d9cbb0]">
            {(atm.data?.setupChecklist ?? []).map((item) => (
              <li
                className="rounded border border-[#5c4a32] bg-[#17130d] p-3"
                key={item}
              >
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-2 text-xs md:grid-cols-2">
            {(atm.data?.iso8583?.fields ?? [])
              .filter((field) => [2, 3, 4, 37, 39, 41, 52].includes(field.bit))
              .map((field) => (
                <div
                  className="rounded border border-[#5c4a32] bg-[#17130d] p-3"
                  key={field.bit}
                >
                  <p className="font-mono text-[#9ed783]">
                    DE{String(field.bit).padStart(3, "0")} / {field.format} /{" "}
                    {field.length}
                  </p>
                  <p className="mt-1 text-[#d9cbb0]">{field.name}</p>
                  <p className="mt-1 uppercase text-[#c0a36e]">
                    {field.sensitive ? "sensitive" : field.dataType}
                  </p>
                </div>
              ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              Processing Code
              <select
                className="h-10 rounded-md border bg-background px-3"
                value={isoProcessingCode}
                onChange={(event) =>
                  setIsoProcessingCode(
                    event.target.value as
                      | "000000"
                      | "010000"
                      | "210000"
                      | "310000"
                      | "920000",
                  )
                }
              >
                <option value="000000">000000 purchase</option>
                <option value="010000">010000 withdrawal</option>
                <option value="210000">210000 deposit</option>
                <option value="310000">310000 balance inquiry</option>
                <option value="920000">920000 network management</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              Amount
              <Input
                value={isoAmount}
                onChange={(event) => setIsoAmount(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              Terminal ID
              <Input
                value={isoTerminalId}
                onChange={(event) => setIsoTerminalId(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              Retrieval Reference
              <Input
                value={isoRetrievalReference}
                onChange={(event) =>
                  setIsoRetrievalReference(event.target.value)
                }
              />
            </label>
          </div>
          <Button
            className="mt-4"
            disabled={iso8583.isPending}
            onClick={() =>
              iso8583.mutate({
                mti: "0200",
                processingCode: isoProcessingCode,
                amount: Number.parseFloat(isoAmount) || 0.01,
                accountId: shadybucksAccountId,
                terminalId: isoTerminalId,
                retrievalReference: isoRetrievalReference,
              })
            }
          >
            Send ISO 8583
          </Button>
          <pre className="mt-4 min-h-40 overflow-x-auto rounded bg-black p-4 font-mono text-sm leading-6 text-[#8ee36c]">
            {iso8583.data
              ? `${iso8583.data.transcript}

${iso8583.data.packedRequest}
${iso8583.data.packedResponse}`
              : `CALL 311088030100
ISO8583 0200
DE003=${isoProcessingCode}
DE004=${String(Math.round((Number.parseFloat(isoAmount) || 0) * 100)).padStart(12, "0")}
DE037=${isoRetrievalReference}
STATUS AWAITING ATM MESSAGE`}
          </pre>
        </div>

        <div className="rounded border border-[#4f3920] bg-[#211d15] p-5">
          <h2 className="text-2xl font-bold">Activity Passport</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              Passport ID
              <Input
                value={passportId}
                onChange={(event) => setPassportId(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              Badge ID
              <Input
                value={badgeId}
                onChange={(event) => setBadgeId(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              Operator ID
              <Input
                value={passportOperatorId}
                onChange={(event) => setPassportOperatorId(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              Evidence
              <Input
                value={passportEvidence}
                onChange={(event) => setPassportEvidence(event.target.value)}
              />
            </label>
          </div>
          <Button
            className="mt-4"
            disabled={passportStamp.isPending}
            onClick={() =>
              passportStamp.mutate({
                passportId,
                badgeId,
                operatorId: passportOperatorId,
                evidence: passportEvidence,
              })
            }
          >
            Stamp Passport
          </Button>
          <pre className="mt-4 min-h-28 overflow-x-auto rounded bg-black p-4 font-mono text-sm leading-6 text-[#8ee36c]">
            {passportStamp.data?.transcript ??
              `CALL 311088030021
STAMP ${passportId}
BADGE ${badgeId}
STATUS AWAITING EVIDENCE`}
          </pre>
          <div className="mt-4 grid gap-3">
            {(operations.data?.passportStamps ?? [])
              .slice(0, 3)
              .map((stamp) => (
                <div
                  className="rounded border border-[#5c4a32] bg-[#17130d] p-4"
                  key={stamp.stampId}
                >
                  <p className="font-mono text-sm text-[#9ed783]">
                    {stamp.stampId}
                  </p>
                  <p className="mt-1 font-semibold">{stamp.passportId}</p>
                  <p className="mt-2 text-xs uppercase text-[#c0a36e]">
                    {stamp.badgeId} / {stamp.status} / {stamp.receiptId}
                  </p>
                </div>
              ))}
          </div>
        </div>

        <div className="rounded border border-[#4f3920] bg-[#211d15] p-5">
          <h2 className="text-2xl font-bold">Configured PADs</h2>
          <div className="mt-4 grid gap-3">
            {(operations.data?.pads ?? []).map((pad) => (
              <div
                className="rounded border border-[#5c4a32] bg-[#17130d] p-4"
                key={pad.id}
              >
                <p className="font-mono text-sm text-[#9ed783]">{pad.x121}</p>
                <p className="mt-1 font-semibold">{pad.endpointLabel}</p>
                <p className="mt-2 text-xs uppercase text-[#c0a36e]">
                  {pad.padKind} / {pad.status}
                </p>
              </div>
            ))}
          </div>
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
