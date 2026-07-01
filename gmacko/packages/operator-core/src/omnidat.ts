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
  return {
    protocol: "X.25",
    source: "seeded-exchange-88-adapter",
    status: "operational",
    services: omnidatServiceDefinitions,
    circuits: omnidatCircuitMetrics,
    directory: omnidatServiceDefinitions.map((entry) => ({
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
  const fallback = omnidatServiceDefinitions[0];
  const destination =
    omnidatServiceDefinitions.find((entry) => entry.slug === input.serviceSlug) ??
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
