export type OmnidatDirectoryEntry = {
  address: string;
  name: string;
  kind: "office" | "directory" | "campsite-app" | "gateway";
};

export type OmnidatTransportProfile = {
  name: string;
  description: string;
};

export type OmnidatServiceVerb = {
  name: string;
  description: string;
  inputs: string[];
  outputs: string[];
};

export type OmnidatServiceDefinition = {
  slug: string;
  name: string;
  x121: string;
  owner: string;
  category: "directory" | "food" | "billing" | "passport" | "transport";
  status: "up" | "degraded" | "down";
  reachable: boolean;
  verbs: OmnidatServiceVerb[];
};

export type OmnidatBillingAccount = {
  accountId: string;
  provider: "ShadyBucks";
  type: "camp-operating" | "atm-settlement";
  owner: string;
  status: "linked-demo" | "ready-for-terminal";
  balance: number;
  currency: "SHDY";
};

export type OmnidatCircuitMetric = {
  x121: string;
  service: string;
  status: "up" | "degraded" | "down";
  latencyMs: number;
  transport: string;
  packetLoss: number;
};

export type OmnidatProvisioningRequest = {
  id: string;
  campsiteName: string;
  namespace: string;
  transport: string;
  assignedX121: string;
  status: "pending-network-install" | "verified" | "failed";
};

export type OmnidatFoodMenuItem = {
  itemId: string;
  name: string;
  priceShadyBucks: number;
  available: boolean;
};

export type OmnidatFoodOrder = {
  id: string;
  lineTicket: string;
  pickupName: string;
  itemIds: string[];
  total: number;
  currency: "SHDY";
  status: "received" | "preparing" | "ready" | "fulfilled" | "cancelled";
  estimatedWaitMinutes: number;
  receiptId: string;
};

export type OmnidatPadConfig = {
  id: string;
  x121: string;
  transport: string;
  padKind: "meshcore-pad" | "meshtastic-pad" | "wifi-terminal" | "pots-pad" | "xot-terminal";
  endpointLabel: string;
  status: "configured" | "testing" | "disabled";
  profile: string;
};

export type OmnidatBillingLedgerEntry = {
  id: string;
  accountId: string;
  entryKind: "provisioning-fee" | "atm-activation" | "food-order" | "adjustment";
  amount: number;
  currency: "SHDY";
  memo: string;
  receiptId: string;
};

export type OmnidatAuditEvent = {
  id: string;
  eventType: string;
  subjectKind: string;
  subjectId: string;
  details: Record<string, string | number | boolean>;
};

export type OmnidatOperationalState = {
  services: OmnidatServiceDefinition[];
  circuits: OmnidatCircuitMetric[];
  provisioningRequests: OmnidatProvisioningRequest[];
  billingAccounts: OmnidatBillingAccount[];
  ledger: OmnidatBillingLedgerEntry[];
  pads: OmnidatPadConfig[];
  foodOrders: OmnidatFoodOrder[];
  auditEvents: OmnidatAuditEvent[];
  nextCampAddress: number;
};

export const omnidatDirectoryEntries: OmnidatDirectoryEntry[] = [
  { address: "010001", name: "OMNIDAT FIELD OFFICE", kind: "office" },
  { address: "010110", name: "PACKET CLEARING DIRECTORY", kind: "directory" },
  { address: "020184", name: "CAMP LAMINAR MESSAGE DESK", kind: "campsite-app" },
  { address: "020501", name: "MILIWAYS ORDER ENTRY", kind: "campsite-app" },
  { address: "030021", name: "PASSPORT LOG ENTRY", kind: "campsite-app" },
  { address: "030088", name: "BADGE CLAIMS COUNTER", kind: "campsite-app" },
  { address: "040777", name: "RADIO GATEWAY STATUS", kind: "gateway" },
];

export const omnidatTransportProfiles: OmnidatTransportProfile[] = [
  {
    name: "MeshCore / Meshtastic gateway",
    description: "Camp-local LoRa terminals bridge packet directory traffic into the OMNIDAT clearing network.",
  },
  {
    name: "Wi-Fi terminal",
    description: "Browser and terminal clients connect through camp Wi-Fi when radio links are impractical.",
  },
  {
    name: "POTS or ShadyTel interconnect",
    description: "Dial-up style terminal access keeps the historical carrier ritual visible.",
  },
  {
    name: "Hosted OMNIDAT circuit",
    description: "Small camps can run on shared ShadyTel/OMNIDAT infrastructure until they bring hardware.",
  },
];

export const omnidatServiceDefinitions: OmnidatServiceDefinition[] = [
  {
    slug: "directory",
    name: "Packet Clearing Directory",
    x121: "311088010110",
    owner: "OMNIDAT",
    category: "directory",
    status: "up",
    reachable: true,
    verbs: [
      { name: "DIR", description: "List services by namespace.", inputs: ["namespace"], outputs: ["entries", "x121", "serviceName"] },
      { name: "LOOKUP", description: "Resolve one X.121 service.", inputs: ["x121"], outputs: ["service", "verbs", "status"] },
    ],
  },
  {
    slug: "food-service",
    name: "Miliways Order Entry",
    x121: "311088020501",
    owner: "Department of Recreational Commerce",
    category: "food",
    status: "up",
    reachable: true,
    verbs: [
      { name: "MENU", description: "Return active menu, prices, and line status.", inputs: ["serviceId"], outputs: ["items", "prices", "waitLines"] },
      { name: "QUOTE", description: "Quote order total in ShadyBucks.", inputs: ["itemIds", "shadybucksAccountId"], outputs: ["total", "currency", "estimatedWait"] },
      { name: "ORDER.CREATE", description: "Create an order and line ticket.", inputs: ["itemIds", "pickupName", "shadybucksAccountId"], outputs: ["orderId", "lineTicket", "receiptId"] },
      { name: "ORDER.STATUS", description: "Check order progress.", inputs: ["orderId"], outputs: ["status", "window", "estimatedWait"] },
    ],
  },
  {
    slug: "activity-passport",
    name: "Passport Log Entry",
    x121: "311088030021",
    owner: "Packet Utility Commission",
    category: "passport",
    status: "up",
    reachable: true,
    verbs: [
      { name: "STAMP", description: "File activity evidence.", inputs: ["badge", "operatorId", "evidence"], outputs: ["stampId", "meritClaimStatus"] },
      { name: "CLAIM.STATUS", description: "Check merit claim review.", inputs: ["stampId"], outputs: ["status", "reviewer", "receiptId"] },
    ],
  },
  {
    slug: "shadybucks-atm",
    name: "ShadyBucks ATM PAD",
    x121: "311088030100",
    owner: "ShadyBucks Settlement Office",
    category: "billing",
    status: "up",
    reachable: true,
    verbs: [
      { name: "ATM.SETUP", description: "Activate an ATM terminal on the X.25 network.", inputs: ["terminalId", "settlementAccountId", "x121"], outputs: ["atmId", "activationCode", "receiptId"] },
      { name: "BALANCE", description: "Read account balance.", inputs: ["shadybucksAccountId"], outputs: ["availableBalance", "currency"] },
      { name: "WITHDRAW", description: "Authorize a withdrawal.", inputs: ["shadybucksAccountId", "amount"], outputs: ["receiptId", "authorizationCode"] },
      { name: "DEPOSIT", description: "Post a deposit.", inputs: ["shadybucksAccountId", "amount"], outputs: ["receiptId", "postedBalance"] },
    ],
  },
  {
    slug: "radio-pad",
    name: "Radio Gateway Status",
    x121: "311088040777",
    owner: "Office of Field Telecommunications",
    category: "transport",
    status: "degraded",
    reachable: true,
    verbs: [
      { name: "PING", description: "Measure PAD path health.", inputs: ["transport"], outputs: ["latencyMs", "packetLoss", "status"] },
      { name: "TRACE", description: "Trace transport path to destination.", inputs: ["destinationX121"], outputs: ["hops", "transportPath"] },
    ],
  },
];

export const omnidatBillingAccounts: OmnidatBillingAccount[] = [
  {
    accountId: "SB-CAMP-LAMINAR-001",
    provider: "ShadyBucks",
    type: "camp-operating",
    owner: "Camp Laminar",
    status: "linked-demo",
    balance: 1288,
    currency: "SHDY",
  },
  {
    accountId: "SB-ATM-EX88-100",
    provider: "ShadyBucks",
    type: "atm-settlement",
    owner: "Exchange 88 ATM Desk",
    status: "ready-for-terminal",
    balance: 5000,
    currency: "SHDY",
  },
];

export const omnidatCircuitMetrics: OmnidatCircuitMetric[] = [
  { x121: "311088010110", service: "Packet Clearing Directory", status: "up", latencyMs: 42, transport: "cloudflare-worker", packetLoss: 0 },
  { x121: "311088020501", service: "Miliways Order Entry", status: "up", latencyMs: 88, transport: "meshcore-pad", packetLoss: 0.01 },
  { x121: "311088030100", service: "ShadyBucks ATM PAD", status: "up", latencyMs: 74, transport: "shadytel-hosted", packetLoss: 0 },
  { x121: "311088040777", service: "Radio Gateway Status", status: "degraded", latencyMs: 240, transport: "meshtastic-pad", packetLoss: 0.08 },
];

export const omnidatProvisioningRequests: OmnidatProvisioningRequest[] = [
  {
    id: "PV-020184",
    campsiteName: "Camp Laminar",
    namespace: "camp",
    transport: "meshcore",
    assignedX121: "311088020184",
    status: "pending-network-install",
  },
];

export const omnidatFoodMenu: OmnidatFoodMenuItem[] = [
  { itemId: "NOODLE-CUP", name: "Noodle Cup", priceShadyBucks: 7, available: true },
  { itemId: "TEA-THERMOS", name: "Thermos Tea", priceShadyBucks: 4, available: true },
  { itemId: "NIGHT-PLATE", name: "Night Plate", priceShadyBucks: 13, available: false },
];

function createInitialOperationalState(): OmnidatOperationalState {
  return {
    services: omnidatServiceDefinitions.map((service) => ({
      ...service,
      verbs: service.verbs.map((verb) => ({ ...verb })),
    })),
    circuits: omnidatCircuitMetrics.map((circuit) => ({ ...circuit })),
    provisioningRequests: omnidatProvisioningRequests.map((request) => ({
      ...request,
    })),
    billingAccounts: omnidatBillingAccounts.map((account) => ({ ...account })),
    ledger: [
      {
        id: "LEDGER-PV-020184",
        accountId: "SB-CAMP-LAMINAR-001",
        entryKind: "provisioning-fee",
        amount: -25,
        currency: "SHDY",
        memo: "X.121 provisioning fee for Camp Laminar",
        receiptId: "RCPT-PV-020184",
      },
    ],
    pads: [
      {
        id: "PAD-040777",
        x121: "311088040777",
        transport: "meshtastic",
        padKind: "meshtastic-pad",
        endpointLabel: "Exchange 88 radio gateway",
        status: "testing",
        profile: [
          "PAD SET TRANSPORT MESHTASTIC",
          "PAD SET X121 311088040777",
          "PAD SET WINDOW 2",
          "PAD SET ECHO LOCAL",
        ].join("\n"),
      },
    ],
    foodOrders: [],
    auditEvents: [
      {
        id: "AUDIT-BOOT",
        eventType: "network.boot",
        subjectKind: "network",
        subjectId: "exchange-88",
        details: { source: "seeded-exchange-88-adapter" },
      },
    ],
    nextCampAddress: 185,
  };
}

const globalForOmnidat = globalThis as unknown as {
  omnidatOperationalState: OmnidatOperationalState | undefined;
};

function state() {
  globalForOmnidat.omnidatOperationalState ??= createInitialOperationalState();
  return globalForOmnidat.omnidatOperationalState;
}

export function resetOmnidatOperationalState() {
  globalForOmnidat.omnidatOperationalState = createInitialOperationalState();
}

export function getOperationalState() {
  const current = state();
  return {
    services: current.services.map((service) => ({
      ...service,
      verbs: service.verbs.map((verb) => ({ ...verb })),
    })),
    circuits: current.circuits.map((circuit) => ({ ...circuit })),
    provisioningRequests: current.provisioningRequests.map((request) => ({
      ...request,
    })),
    billingAccounts: current.billingAccounts.map((account) => ({ ...account })),
    ledger: current.ledger.map((entry) => ({ ...entry })),
    pads: current.pads.map((pad) => ({ ...pad })),
    foodOrders: current.foodOrders.map((order) => ({ ...order })),
    auditEvents: current.auditEvents.map((event) => ({
      ...event,
      details: { ...event.details },
    })),
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function nextX121() {
  const current = state();
  const suffix = String(current.nextCampAddress).padStart(4, "0");
  current.nextCampAddress += 1;
  return `31108802${suffix}`;
}

function appendAudit(eventType: string, subjectKind: string, subjectId: string, details: Record<string, string | number | boolean>) {
  state().auditEvents.unshift({
    id: `AUDIT-${String(state().auditEvents.length + 1).padStart(4, "0")}`,
    eventType,
    subjectKind,
    subjectId,
    details,
  });
}

function accountIdFor(campsiteName: string) {
  return `SB-CAMP-${slugify(campsiteName).toUpperCase()}-001`;
}

function nextFoodTicket() {
  const current = state();
  return `MW-${String(current.foodOrders.length + 1).padStart(4, "0")}`;
}

export function provisionCampsiteService(input: {
  campsiteName: string;
  namespace: string;
  contact: string;
  appName: string;
  appKind: string;
  transport: string;
}) {
  const current = state();
  const campsiteName = input.campsiteName.trim();
  const namespace = input.namespace.trim().toLowerCase() || "camp";
  const appName = input.appName.trim();
  const x121 = nextX121();
  const slug = `${slugify(campsiteName)}-${slugify(appName)}`;
  const billingAccountId = accountIdFor(campsiteName);
  let billingAccount = current.billingAccounts.find(
    (account) => account.accountId === billingAccountId,
  );

  if (!billingAccount) {
    billingAccount = {
      accountId: billingAccountId,
      provider: "ShadyBucks",
      type: "camp-operating",
      owner: campsiteName,
      status: "linked-demo",
      balance: 250,
      currency: "SHDY",
    };
    current.billingAccounts.push(billingAccount);
  }

  billingAccount.balance -= 25;

  const request: OmnidatProvisioningRequest = {
    id: `PV-${x121.slice(-6)}`,
    campsiteName,
    namespace,
    transport: input.transport.trim(),
    assignedX121: x121,
    status: "verified",
  };
  current.provisioningRequests.unshift(request);

  const service: OmnidatServiceDefinition = {
    slug,
    name: appName,
    x121,
    owner: campsiteName,
    category: "transport",
    status: "up",
    reachable: true,
    verbs: [
      {
        name: "STATUS",
        description: "Return campsite app status.",
        inputs: ["x121"],
        outputs: ["status", "transport", "owner"],
      },
      {
        name: "MESSAGE.SEND",
        description: "Submit a campsite application message.",
        inputs: ["body", "operatorId"],
        outputs: ["messageId", "receiptId"],
      },
    ],
  };
  current.services.push(service);
  current.circuits.push({
    x121,
    service: appName,
    status: "up",
    latencyMs: input.transport === "xot" ? 38 : 96,
    transport: input.transport,
    packetLoss: 0,
  });

  const ledgerEntry: OmnidatBillingLedgerEntry = {
    id: `LEDGER-${request.id}`,
    accountId: billingAccount.accountId,
    entryKind: "provisioning-fee",
    amount: -25,
    currency: "SHDY",
    memo: `X.121 provisioning fee for ${campsiteName}`,
    receiptId: `RCPT-${request.id}`,
  };
  current.ledger.unshift(ledgerEntry);
  appendAudit("provisioning.verified", "x121", x121, {
    campsiteName,
    namespace,
    transport: request.transport,
  });

  return {
    status: "verified" as const,
    assignment: request,
    service,
    billing: {
      account: billingAccount,
      ledgerEntry,
    },
    transcript: [
      "OMNIDAT PACKET CLEARING OFFICE",
      `ASSIGN ${x121}`,
      `NAMESPACE ${namespace}`,
      `SERVICE ${appName.toUpperCase()}`,
      `BILL ${billingAccount.accountId} -25 SHDY`,
      "STATUS VERIFIED",
    ].join("\n"),
  };
}

function padProfile(input: {
  x121: string;
  transport: string;
  padKind: OmnidatPadConfig["padKind"];
  endpointLabel: string;
}) {
  if (input.padKind === "xot-terminal") {
    return [
      "XOT HOST omnidat.gmac.io",
      "XOT PORT 1998",
      `XOT CALLING ${input.x121}`,
      "PAD SET WINDOW 2",
      "PAD SET PACKET-SIZE 128",
      "PAD SET ECHO LOCAL",
      "PAD SET CR-PAD 1",
    ].join("\n");
  }

  return [
    `PAD SET TRANSPORT ${input.transport.toUpperCase()}`,
    `PAD SET X121 ${input.x121}`,
    "PAD SET WINDOW 2",
    "PAD SET ECHO LOCAL",
  ].join("\n");
}

export function configurePad(input: {
  x121: string;
  transport: string;
  padKind: OmnidatPadConfig["padKind"];
  endpointLabel: string;
}) {
  const current = state();
  const service = current.services.find((entry) => entry.x121 === input.x121);
  if (!service) {
    throw new Error(`Unknown X.121 address: ${input.x121}`);
  }

  const existing = current.pads.find((pad) => pad.x121 === input.x121);
  const pad: OmnidatPadConfig = {
    id: existing?.id ?? `PAD-${input.x121.slice(-6)}`,
    x121: input.x121,
    transport: input.transport,
    padKind: input.padKind,
    endpointLabel: input.endpointLabel.trim(),
    status: "configured",
    profile: padProfile(input),
  };

  if (existing) {
    Object.assign(existing, pad);
  } else {
    current.pads.unshift(pad);
  }

  const circuit = current.circuits.find((entry) => entry.x121 === input.x121);
  if (circuit) {
    circuit.transport = input.transport;
    circuit.status = "up";
    circuit.latencyMs = input.padKind === "xot-terminal" ? 38 : circuit.latencyMs;
    circuit.packetLoss = 0;
  }

  appendAudit("pad.configured", "x121", input.x121, {
    transport: input.transport,
    padKind: input.padKind,
  });
  return pad;
}

export function setupAtmTerminal(input: {
  terminalId: string;
  settlementAccountId: string;
  terminalX121?: string;
  locationLabel: string;
}) {
  const current = state();
  const settlementAccount = current.billingAccounts.find(
    (account) => account.accountId === input.settlementAccountId,
  );
  if (!settlementAccount) {
    throw new Error(`Unknown ShadyBucks account: ${input.settlementAccountId}`);
  }
  const terminalX121 = input.terminalX121?.trim() || nextX121();
  const ledgerEntry: OmnidatBillingLedgerEntry = {
    id: `LEDGER-ATM-${slugify(input.terminalId).toUpperCase()}`,
    accountId: settlementAccount.accountId,
    entryKind: "atm-activation",
    amount: -10,
    currency: "SHDY",
    memo: `ATM activation for ${input.terminalId}`,
    receiptId: `RCPT-ATM-${terminalX121.slice(-6)}`,
  };
  settlementAccount.balance -= 10;
  current.ledger.unshift(ledgerEntry);
  current.services.push({
    slug: `shadybucks-atm-${slugify(input.terminalId)}`,
    name: `ShadyBucks ATM ${input.terminalId}`,
    x121: terminalX121,
    owner: settlementAccount.owner,
    category: "billing",
    status: "up",
    reachable: true,
    verbs: [
      {
        name: "BALANCE",
        description: "Return settlement account balance for this ATM terminal.",
        inputs: ["shadybucksAccountId"],
        outputs: ["balance", "currency"],
      },
      {
        name: "WITHDRAW",
        description: "Authorize a ShadyBucks cash-out operation.",
        inputs: ["shadybucksAccountId", "amount"],
        outputs: ["authorizationCode", "receiptId"],
      },
      {
        name: "DEPOSIT",
        description: "Record an operator cash-in operation.",
        inputs: ["shadybucksAccountId", "amount"],
        outputs: ["receiptId", "newBalance"],
      },
    ],
  });
  current.circuits.push({
    x121: terminalX121,
    service: `ATM ${input.terminalId}`,
    status: "up",
    latencyMs: 54,
    transport: "xot",
    packetLoss: 0,
  });
  appendAudit("atm.activated", "x121", terminalX121, {
    terminalId: input.terminalId,
    locationLabel: input.locationLabel,
  });

  return {
    terminalId: input.terminalId,
    terminalX121,
    settlementAccount,
    locationLabel: input.locationLabel,
    activationCode: `ATM-${terminalX121.slice(-6)}-READY`,
    receiptId: ledgerEntry.receiptId,
  };
}

export function createFoodOrder(input: {
  itemIds: string[];
  pickupName: string;
  shadybucksAccountId: string;
}) {
  const current = state();
  const account = current.billingAccounts.find(
    (entry) => entry.accountId === input.shadybucksAccountId,
  );
  if (!account) {
    throw new Error(`Unknown ShadyBucks account: ${input.shadybucksAccountId}`);
  }

  const items = input.itemIds.map((itemId) => {
    const item = omnidatFoodMenu.find((entry) => entry.itemId === itemId);
    if (!item) throw new Error(`Unknown menu item: ${itemId}`);
    if (!item.available) throw new Error(`Menu item unavailable: ${itemId}`);
    return item;
  });
  if (items.length === 0) {
    throw new Error("Food order requires at least one item");
  }

  const lineTicket = nextFoodTicket();
  const total = items.reduce((sum, item) => sum + item.priceShadyBucks, 0);
  const receiptId = `RCPT-FOOD-${lineTicket.slice(-4)}`;
  const order: OmnidatFoodOrder = {
    id: `ORDER-${lineTicket}`,
    lineTicket,
    pickupName: input.pickupName.trim(),
    itemIds: items.map((item) => item.itemId),
    total,
    currency: "SHDY",
    status: "received",
    estimatedWaitMinutes: 7 + current.foodOrders.length * 2,
    receiptId,
  };
  const ledgerEntry: OmnidatBillingLedgerEntry = {
    id: `LEDGER-${receiptId}`,
    accountId: account.accountId,
    entryKind: "food-order",
    amount: -total,
    currency: "SHDY",
    memo: `Miliways food order ${lineTicket} for ${order.pickupName}`,
    receiptId,
  };

  account.balance -= total;
  current.foodOrders.unshift(order);
  current.ledger.unshift(ledgerEntry);
  appendAudit("food.order.created", "food-order", lineTicket, {
    pickupName: order.pickupName,
    itemCount: order.itemIds.length,
    total,
  });

  return {
    ...order,
    ledgerEntry,
    billingAccount: account,
    transcript: [
      "CALL 311088020501",
      "CONNECT MILIWAYS ORDER ENTRY",
      `ORDER.CREATE ${order.itemIds.join(",")}`,
      `LINE ${order.lineTicket}`,
      `BILL ${account.accountId} -${total} SHDY`,
      `RECEIPT ${receiptId}`,
      `WAIT ${order.estimatedWaitMinutes} MIN`,
    ].join("\n"),
  };
}

function serviceDirectory(namespace?: string) {
  const current = state();
  const services = namespace?.toLowerCase() === "camp"
    ? current.services.filter((service) => service.owner !== "OMNIDAT")
    : current.services;
  return services
    .map((service) => `${service.x121}  ${service.name}  ${service.status}`)
    .join("\n");
}

export function executeXotCommand(input: {
  sourceX121: string;
  command: string;
}) {
  const current = state();
  const command = input.command.trim();
  const [verb = "", ...args] = command.split(/\s+/);
  const normalizedVerb = verb.toUpperCase();
  let transcript: string;

  if (normalizedVerb === "HELP" || normalizedVerb === "?") {
    transcript = "VERBS: DIR [NAMESPACE], LOOKUP <X121>, CALL <X121>, STATUS <X121>, PAD <X121>, BILL <ACCOUNT>";
  } else if (normalizedVerb === "DIR") {
    transcript = serviceDirectory(args[0]);
  } else if (normalizedVerb === "LOOKUP" || normalizedVerb === "CALL") {
    const x121 = args[0] ?? "";
    const service = current.services.find((entry) => entry.x121 === x121);
    transcript = service
      ? [
          `CALL ${x121}`,
          `CONNECT ${service.name.toUpperCase()}`,
          `OWNER ${service.owner}`,
          `STATUS ${service.status.toUpperCase()}`,
          `VERBS ${service.verbs.map((entry) => entry.name).join(", ")}`,
        ].join("\n")
      : `CLEAR 13 UNKNOWN ADDRESS ${x121}`;
  } else if (normalizedVerb === "STATUS") {
    const x121 = args[0] ?? input.sourceX121;
    const circuit = current.circuits.find((entry) => entry.x121 === x121);
    transcript = circuit
      ? `STATUS ${x121} ${circuit.status.toUpperCase()} ${circuit.transport} ${circuit.latencyMs}MS LOSS ${(circuit.packetLoss * 100).toFixed(1)}%`
      : `STATUS ${x121} UNKNOWN`;
  } else if (normalizedVerb === "PAD") {
    const x121 = args[0] ?? input.sourceX121;
    const pad = current.pads.find((entry) => entry.x121 === x121);
    transcript = pad
      ? [`PAD ${x121} ${pad.status.toUpperCase()} ${pad.padKind}`, pad.profile].join("\n")
      : `PAD ${x121} NOT CONFIGURED`;
  } else if (normalizedVerb === "BILL") {
    const accountId = args[0] ?? "";
    const account = current.billingAccounts.find((entry) => entry.accountId === accountId);
    transcript = account
      ? `BILL ${account.accountId} BALANCE ${account.balance} ${account.currency}`
      : `BILL ${accountId} UNKNOWN`;
  } else {
    transcript = `ERROR UNKNOWN VERB ${normalizedVerb || "(EMPTY)"}`;
  }

  appendAudit("xot.command", "x121", input.sourceX121, {
    command,
    verb: normalizedVerb,
  });

  return {
    status: transcript.startsWith("ERROR") || transcript.includes("UNKNOWN")
      ? "error"
      : "ok",
    transcript,
  };
}

export function renderDirectoryText(entries = omnidatDirectoryEntries) {
  return entries.map((entry) => `${entry.address}  ${entry.name}`).join("\n");
}

export function buildSignupReceipt(input: {
  campsiteName: string;
  namespace: string;
  contact: string;
  transport: string;
}) {
  const normalizedName = input.campsiteName.trim();
  const normalizedNamespace = input.namespace.trim().toLowerCase();

  return {
    status: "queued",
    service: "omnidat-v1",
    campsiteName: normalizedName,
    namespace: normalizedNamespace,
    contact: input.contact.trim(),
    transport: input.transport.trim(),
    message: `${normalizedName} queued for packet clearing review in ${normalizedNamespace}`,
  };
}

export function buildNetworkSnapshot() {
  const current = state();
  return {
    protocol: "X.25",
    source: "seeded-exchange-88-adapter",
    status: "operational",
    services: current.services,
    circuits: current.circuits,
    directory: current.services.map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      x121: entry.x121,
      status: entry.status,
    })),
  };
}

export function buildProvisioningTranscript(input: {
  campsiteName: string;
  serviceSlug: string;
  transport: string;
}) {
  const current = state();
  const fallback = omnidatServiceDefinitions[0];
  const destination =
    current.services.find((entry) => entry.slug === input.serviceSlug) ??
    fallback;

  if (!destination) {
    throw new Error("OMNIDAT service registry is empty");
  }

  return {
    status: "verified" as const,
    assignment: {
      campsiteName: input.campsiteName,
      namespace: "camp",
      transport: input.transport,
      x121: "311088020184",
    },
    destination,
    transcript: `OMNIDAT PAD READY
CALL ${destination.x121}
CONNECT ${destination.name.toUpperCase()}
VERIFY 311088020184
STATUS VERIFIED`,
  };
}
