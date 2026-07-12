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

export type Iso8583FieldDefinition = {
  bit: number;
  name: string;
  format: "fixed" | "llvar" | "lllvar";
  length: number;
  dataType: "n" | "ans" | "b";
  requiredFor: string[];
  sensitive: boolean;
};

export type Iso8583MessageType = {
  mti: "0100" | "0110" | "0200" | "0210" | "0400" | "0410" | "0800" | "0810";
  name: string;
  direction: "request" | "response";
};

export type Iso8583TransactionInput = {
  mti: "0100" | "0200" | "0400" | "0800";
  processingCode: "000000" | "010000" | "310000" | "210000" | "920000";
  amount: number;
  accountId: string;
  terminalId: string;
  retrievalReference: string;
};

export type Iso8583TransactionResult = {
  protocol: string;
  requestMti: string;
  responseMti: string;
  processingCode: string;
  responseCode: "00" | "12" | "51" | "91";
  authorizationCode: string;
  packedRequest: string;
  packedResponse: string;
  transcript: string;
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
  /** OmniBucks testnet (OMNI) is default; SHDY is production ShadyBucks. */
  currency: "OMNI" | "SHDY";
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
  currency: "OMNI" | "SHDY";
  status: "received" | "preparing" | "ready" | "fulfilled" | "cancelled";
  estimatedWaitMinutes: number;
  receiptId: string;
};

export type OmnidatPassportStamp = {
  id: string;
  passportId: string;
  badgeId: string;
  operatorId: string;
  evidence: string;
  stampId: string;
  receiptId: string;
  status: "filed" | "under-review" | "approved" | "rejected";
};

export type OmnidatPadConfig = {
  id: string;
  x121: string;
  transport: string;
  padKind:
    | "meshcore-pad"
    | "meshtastic-pad"
    | "wifi-terminal"
    | "pots-pad"
    | "xot-terminal";
  endpointLabel: string;
  status: "configured" | "testing" | "disabled";
  profile: string;
};

export type VintageTerminalFamily = {
  family: "TRANZ_330_380_TCL" | "OMNI_3200_ZONTALK";
  models: string[];
  primaryRuntime: "VeriFone TCL" | "Omni application SRAM";
  downloadMethods: string[];
  notes: string[];
};

export type VintageTerminalProgram = {
  name: string;
  target: string;
  tcl: string;
  hostMessage: string;
};

export type VintageTerminalProgramPack = {
  version: string;
  network: {
    dialAccess: string;
    posX121: string;
    settlementRail: string;
  };
  sourceBasis: {
    shortName: string;
    detail: string;
    locator: string;
  }[];
  supportedFamilies: VintageTerminalFamily[];
  capabilities: string[];
  hostBindings: Record<
    "sale" | "refund" | "credit" | "batchClose",
    {
      verb: string;
      x121: string;
      shadyBankEndpoints: string[];
      paymentInputs: string[];
    }
  >;
  programs: Record<
    "sale" | "refund" | "credit" | "batchClose",
    VintageTerminalProgram
  >;
  deployment: {
    configMemory: Record<string, string>;
    runbook: string[];
  };
};

export type VintageTerminalPrimitive = {
  command: string;
  purpose: string;
  source: string;
};

export type VintageTerminalPortProfile = {
  id: string;
  direction: "terminal-to-host" | "host-to-terminal";
  purpose: string;
  dialNumber: string;
  x121: string;
  modem: {
    nominalBaud: 1200 | 2400 | 9600 | 19200;
    framing: string;
  };
};

export type VintageTerminalDownloadFile = {
  path: string;
  mediaType: "text/plain";
  contents: string;
};

export type VintageTerminalDownloadPackage = {
  packageId: string;
  validationStatus: "bench-validation-required";
  terminalId: string;
  merchantAccountId: string;
  family: VintageTerminalFamily["family"];
  verifiedTclPrimitives: VintageTerminalPrimitive[];
  portProfiles: VintageTerminalPortProfile[];
  shadyBankProtocol: {
    sale: {
      authorize: {
        method: "POST";
        path: "/api/authorize";
        fields: string[];
      };
      capture: {
        method: "POST";
        path: "/api/capture";
        fields: string[];
      };
    };
    refund: {
      reverse: {
        method: "POST";
        path: "/api/reverse";
        fields: string[];
      };
    };
    credit: {
      credit: {
        method: "POST";
        path: "/api/credit";
        fields: string[];
      };
    };
  };
  files: VintageTerminalDownloadFile[];
};

export type OmnidatBillingLedgerEntry = {
  id: string;
  accountId: string;
  entryKind:
    | "provisioning-fee"
    | "atm-activation"
    | "food-order"
    | "pos-network-fee"
    | "adjustment";
  amount: number;
  currency: "OMNI" | "SHDY";
  memo: string;
  receiptId: string;
};

export const iso8583MessageTypes: Iso8583MessageType[] = [
  { mti: "0100", name: "Authorization request", direction: "request" },
  { mti: "0110", name: "Authorization response", direction: "response" },
  { mti: "0200", name: "Financial transaction request", direction: "request" },
  {
    mti: "0210",
    name: "Financial transaction response",
    direction: "response",
  },
  { mti: "0400", name: "Reversal advice request", direction: "request" },
  { mti: "0410", name: "Reversal advice response", direction: "response" },
  { mti: "0800", name: "Network management request", direction: "request" },
  { mti: "0810", name: "Network management response", direction: "response" },
];

export const iso8583FieldDefinitions: Iso8583FieldDefinition[] = [
  {
    bit: 2,
    name: "Primary account number token",
    format: "llvar",
    length: 19,
    dataType: "n",
    requiredFor: ["0100", "0200"],
    sensitive: true,
  },
  {
    bit: 3,
    name: "Processing code",
    format: "fixed",
    length: 6,
    dataType: "n",
    requiredFor: ["0100", "0200", "0400"],
    sensitive: false,
  },
  {
    bit: 4,
    name: "Transaction amount",
    format: "fixed",
    length: 12,
    dataType: "n",
    requiredFor: ["0100", "0200", "0400"],
    sensitive: false,
  },
  {
    bit: 7,
    name: "Transmission date and time",
    format: "fixed",
    length: 10,
    dataType: "n",
    requiredFor: ["0100", "0200", "0400", "0800"],
    sensitive: false,
  },
  {
    bit: 11,
    name: "System trace audit number",
    format: "fixed",
    length: 6,
    dataType: "n",
    requiredFor: ["0100", "0200", "0400", "0800"],
    sensitive: false,
  },
  {
    bit: 12,
    name: "Local transaction time",
    format: "fixed",
    length: 6,
    dataType: "n",
    requiredFor: ["0100", "0200"],
    sensitive: false,
  },
  {
    bit: 13,
    name: "Local transaction date",
    format: "fixed",
    length: 4,
    dataType: "n",
    requiredFor: ["0100", "0200"],
    sensitive: false,
  },
  {
    bit: 37,
    name: "Retrieval reference number",
    format: "fixed",
    length: 12,
    dataType: "ans",
    requiredFor: ["0100", "0200", "0400"],
    sensitive: false,
  },
  {
    bit: 38,
    name: "Authorization identification response",
    format: "fixed",
    length: 6,
    dataType: "ans",
    requiredFor: ["0110", "0210", "0410"],
    sensitive: false,
  },
  {
    bit: 39,
    name: "Response code",
    format: "fixed",
    length: 2,
    dataType: "ans",
    requiredFor: ["0110", "0210", "0410", "0810"],
    sensitive: false,
  },
  {
    bit: 41,
    name: "Card acceptor terminal identification",
    format: "fixed",
    length: 8,
    dataType: "ans",
    requiredFor: ["0100", "0200", "0400", "0800"],
    sensitive: false,
  },
  {
    bit: 42,
    name: "Card acceptor identification code",
    format: "fixed",
    length: 15,
    dataType: "ans",
    requiredFor: ["0100", "0200", "0400"],
    sensitive: false,
  },
  {
    bit: 49,
    name: "Transaction currency code",
    format: "fixed",
    length: 3,
    dataType: "n",
    requiredFor: ["0100", "0200", "0400"],
    sensitive: false,
  },
  {
    bit: 52,
    name: "PIN data block",
    format: "fixed",
    length: 16,
    dataType: "b",
    requiredFor: ["0100", "0200"],
    sensitive: true,
  },
  {
    bit: 70,
    name: "Network management information code",
    format: "fixed",
    length: 3,
    dataType: "n",
    requiredFor: ["0800", "0810"],
    sensitive: false,
  },
];

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
  passportStamps: OmnidatPassportStamp[];
  auditEvents: OmnidatAuditEvent[];
  nextCampAddress: number;
};

export const omnidatDirectoryEntries: OmnidatDirectoryEntry[] = [
  { address: "010001", name: "OMNIDAT FIELD OFFICE", kind: "office" },
  { address: "010110", name: "PACKET CLEARING DIRECTORY", kind: "directory" },
  {
    address: "020184",
    name: "CAMP LAMINAR MESSAGE DESK",
    kind: "campsite-app",
  },
  { address: "020501", name: "MILIWAYS ORDER ENTRY", kind: "campsite-app" },
  { address: "030021", name: "PASSPORT LOG ENTRY", kind: "campsite-app" },
  { address: "030088", name: "BADGE CLAIMS COUNTER", kind: "campsite-app" },
  { address: "040777", name: "RADIO GATEWAY STATUS", kind: "gateway" },
];

export const omnidatTransportProfiles: OmnidatTransportProfile[] = [
  {
    name: "MeshCore / Meshtastic gateway",
    description:
      "Camp-local LoRa terminals bridge packet directory traffic into the OMNIDAT clearing network.",
  },
  {
    name: "Wi-Fi terminal",
    description:
      "Browser and terminal clients connect through camp Wi-Fi when radio links are impractical.",
  },
  {
    name: "POTS or ShadyTel interconnect",
    description:
      "Dial-up style terminal access keeps the historical carrier ritual visible.",
  },
  {
    name: "Hosted OMNIDAT circuit",
    description:
      "Small camps can run on shared ShadyTel/OMNIDAT infrastructure until they bring hardware.",
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
      {
        name: "DIR",
        description: "List services by namespace.",
        inputs: ["namespace"],
        outputs: ["entries", "x121", "serviceName"],
      },
      {
        name: "LOOKUP",
        description: "Resolve one X.121 service.",
        inputs: ["x121"],
        outputs: ["service", "verbs", "status"],
      },
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
      {
        name: "MENU",
        description: "Return active menu, prices, and line status.",
        inputs: ["serviceId"],
        outputs: ["items", "prices", "waitLines"],
      },
      {
        name: "QUOTE",
        description: "Quote order total in ShadyBucks.",
        inputs: ["itemIds", "shadybucksAccountId"],
        outputs: ["total", "currency", "estimatedWait"],
      },
      {
        name: "ORDER.CREATE",
        description: "Create an order and line ticket.",
        inputs: ["itemIds", "pickupName", "shadybucksAccountId"],
        outputs: ["orderId", "lineTicket", "receiptId"],
      },
      {
        name: "ORDER.STATUS",
        description: "Check order progress.",
        inputs: ["orderId"],
        outputs: ["status", "window", "estimatedWait"],
      },
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
      {
        name: "STAMP",
        description: "File activity evidence.",
        inputs: ["badge", "operatorId", "evidence"],
        outputs: ["stampId", "meritClaimStatus"],
      },
      {
        name: "CLAIM.STATUS",
        description: "Check merit claim review.",
        inputs: ["stampId"],
        outputs: ["status", "reviewer", "receiptId"],
      },
    ],
  },
  {
    slug: "shadybucks-atm",
    name: "OmniBucks ATM PAD",
    x121: "311088030100",
    owner: "ShadyBucks Settlement Office",
    category: "billing",
    status: "up",
    reachable: true,
    verbs: [
      {
        name: "ATM.SETUP",
        description: "Activate an ATM terminal on the X.25 network.",
        inputs: ["terminalId", "settlementAccountId", "x121"],
        outputs: ["atmId", "activationCode", "receiptId"],
      },
      {
        name: "BALANCE",
        description: "Read account balance.",
        inputs: ["shadybucksAccountId"],
        outputs: ["availableBalance", "currency"],
      },
      {
        name: "WITHDRAW",
        description: "Authorize a withdrawal.",
        inputs: ["shadybucksAccountId", "amount"],
        outputs: ["receiptId", "authorizationCode"],
      },
      {
        name: "DEPOSIT",
        description: "Post a deposit.",
        inputs: ["shadybucksAccountId", "amount"],
        outputs: ["receiptId", "postedBalance"],
      },
      {
        name: "ISO8583.SEND",
        description: "Send a redacted ISO 8583 ATM message over X.25.",
        inputs: [
          "mti",
          "processingCode",
          "amount",
          "terminalId",
          "retrievalReference",
        ],
        outputs: ["responseMti", "responseCode", "authorizationCode"],
      },
    ],
  },
  {
    slug: "shadybucks-pos",
    name: "ShadyBucks POS Authorization",
    x121: "311088002010",
    owner: "ShadyBucks Settlement Office",
    category: "billing",
    status: "up",
    reachable: true,
    verbs: [
      {
        name: "POS.SALE",
        description: "Authorize a vintage dial terminal sale.",
        inputs: ["terminalId", "amount", "merchantAccountId", "clerkCode"],
        outputs: ["authorizationCode", "responseCode", "receiptId"],
      },
      {
        name: "POS.REDEEM-NOTE",
        description: "Redeem a bearer instrument at a merchant terminal.",
        inputs: ["terminalId", "amount", "noteSerial"],
        outputs: ["authorizationCode", "receiptId"],
      },
      {
        name: "POS.CLOSE-BATCH",
        description: "Close a terminal or clerk batch.",
        inputs: ["terminalId", "clerkCode"],
        outputs: ["batchId", "settlementStatus"],
      },
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
      {
        name: "PING",
        description: "Measure PAD path health.",
        inputs: ["transport"],
        outputs: ["latencyMs", "packetLoss", "status"],
      },
      {
        name: "TRACE",
        description: "Trace transport path to destination.",
        inputs: ["destinationX121"],
        outputs: ["hops", "transportPath"],
      },
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
  {
    x121: "311088010110",
    service: "Packet Clearing Directory",
    status: "up",
    latencyMs: 42,
    transport: "cloudflare-worker",
    packetLoss: 0,
  },
  {
    x121: "311088020501",
    service: "Miliways Order Entry",
    status: "up",
    latencyMs: 88,
    transport: "meshcore-pad",
    packetLoss: 0.01,
  },
  {
    x121: "311088030100",
    service: "OmniBucks ATM PAD",
    status: "up",
    latencyMs: 74,
    transport: "shadytel-hosted",
    packetLoss: 0,
  },
  {
    x121: "311088040777",
    service: "Radio Gateway Status",
    status: "degraded",
    latencyMs: 240,
    transport: "meshtastic-pad",
    packetLoss: 0.08,
  },
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
  {
    itemId: "NOODLE-CUP",
    name: "Noodle Cup",
    priceShadyBucks: 7,
    available: true,
  },
  {
    itemId: "TEA-THERMOS",
    name: "Thermos Tea",
    priceShadyBucks: 4,
    available: true,
  },
  {
    itemId: "NIGHT-PLATE",
    name: "Night Plate",
    priceShadyBucks: 13,
    available: false,
  },
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
    passportStamps: [],
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
    passportStamps: current.passportStamps.map((stamp) => ({ ...stamp })),
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

function appendAudit(
  eventType: string,
  subjectKind: string,
  subjectId: string,
  details: Record<string, string | number | boolean>,
) {
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

function nextPassportStampId() {
  const current = state();
  return `STAMP-${String(current.passportStamps.length + 1).padStart(5, "0")}`;
}

function responseMtiFor(mti: Iso8583TransactionInput["mti"]) {
  return {
    "0100": "0110",
    "0200": "0210",
    "0400": "0410",
    "0800": "0810",
  }[mti] as Iso8583TransactionResult["responseMti"];
}

function cents(amount: number) {
  return String(Math.round(amount * 100)).padStart(12, "0");
}

function terminalId(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8)
    .padEnd(8, "0");
}

function traceNumber(reference: string) {
  const digits = reference.replace(/\D/g, "");
  return (digits || "1").slice(-6).padStart(6, "0");
}

function authorizationCode(reference: string) {
  return `SB${traceNumber(reference).slice(-4)}`;
}

function redactedAccountToken(accountId: string) {
  const suffix = accountId
    .replace(/[^A-Z0-9]/gi, "")
    .slice(-4)
    .padStart(4, "0");
  return `TOKEN********${suffix}`;
}

function packIsoFields(fields: Record<number, string>) {
  return Object.entries(fields)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([bit, value]) => `DE${bit.padStart(3, "0")}=${value}`)
    .join("|");
}

export function getIso8583ProtocolProfile() {
  return {
    protocol: "ISO8583-1987-OMNIBUCKS-X25",
    x121: "311088030100",
    transport: "x25-pad",
    encoding:
      "ASCII field envelope with binary bitmap represented by field list",
    security: [
      "PAN values are tokenized before entering OMNIDAT logs.",
      "PIN blocks are accepted only as redacted HSM references.",
      "Packed message displays suppress all sensitive field values.",
    ],
    messageTypes: iso8583MessageTypes.map((message) => ({ ...message })),
    fields: iso8583FieldDefinitions.map((field) => ({ ...field })),
    processingCodes: [
      { code: "000000", name: "purchase" },
      { code: "010000", name: "cash-withdrawal" },
      { code: "210000", name: "deposit" },
      { code: "310000", name: "balance-inquiry" },
      { code: "920000", name: "network-management" },
    ],
  };
}

const vintageTerminalProgramPack: VintageTerminalProgramPack = {
  version: "OMNIDAT-VF-TCL-2028.1",
  network: {
    dialAccess: "POTS 8810",
    posX121: "311088002010",
    settlementRail: "ShadyBank ShadyBucks merchant API",
  },
  sourceBasis: [
    {
      shortName: "TCL Programmer's Manual",
      detail:
        "VeriFone TCL dial terminals include Tranz 330/380 internal modems, cardreader/keypad input, host communication control strings, and custom prompt/application flow.",
      locator:
        "/tmp/omnidat-verifone-docs/tranz330-tcl-program-guide.pdf pages 15-22 OCR",
    },
    {
      shortName: "TCLOAD Reference Manual",
      detail:
        "TCLOAD is the direct loading path for TCL files and deployment artifacts on Tranz-class terminals.",
      locator: "/tmp/omnidat-verifone-docs/tranz330-tcl-load-guide.pdf",
    },
    {
      shortName: "Omni 3200 Reference Manual",
      detail:
        "Omni 3200 supports direct and telephone application downloads, ZONTALK/VeriTalk workflows, SRAM application storage, and remote diagnostics.",
      locator: "/tmp/omnidat-verifone-docs/omni3200-reference.pdf",
    },
    {
      shortName: "ShadyBank API server",
      detail:
        "Merchant settlement uses bearer-token POST forms for authorize, capture, void, reverse, and credit operations.",
      locator: "/Volumes/dev/shady/shadybank/src/apiserver.py",
    },
  ],
  supportedFamilies: [
    {
      family: "TRANZ_330_380_TCL",
      models: ["TRANZ 330", "TRANZ 380"],
      primaryRuntime: "VeriFone TCL",
      downloadMethods: ["tcLoad-direct-download", "zontalk-telephone-download"],
      notes: [
        "Preferred for the historically accurate dial POS slice.",
        "Use the internal POTS modem for sale authorization calls.",
      ],
    },
    {
      family: "OMNI_3200_ZONTALK",
      models: ["Omni 3200", "Omni 3750"],
      primaryRuntime: "Omni application SRAM",
      downloadMethods: ["direct-zontalk", "telephone-zontalk"],
      notes: [
        "Use as the newer fallback family when available terminals are not TCL-based.",
        "Keep host messages identical so the OMNIDAT FEP does not fork by hardware.",
      ],
    },
  ],
  capabilities: [
    "track1-track2-cardreader",
    "keypad-amount-entry",
    "internal-pots-modem",
    "receipt-printer",
    "tcLoad-direct-download",
    "zontalk-telephone-download",
    "terminal-id-memory",
    "clerk-code-entry",
  ],
  hostBindings: {
    sale: {
      verb: "POS.SALE",
      x121: "311088002010",
      shadyBankEndpoints: ["/api/authorize", "/api/capture"],
      paymentInputs: ["track2", "pan+otp", "nfc_token"],
    },
    refund: {
      verb: "POS.REFUND",
      x121: "311088002010",
      shadyBankEndpoints: ["/api/reverse"],
      paymentInputs: ["auth_code"],
    },
    credit: {
      verb: "POS.CREDIT",
      x121: "311088002010",
      shadyBankEndpoints: ["/api/credit"],
      paymentInputs: ["track2", "pan", "nfc_token"],
    },
    batchClose: {
      verb: "POS.CLOSE-BATCH",
      x121: "311088002010",
      shadyBankEndpoints: ["/api/transactions", "/api/authorizations"],
      paymentInputs: ["terminalId", "clerkCode"],
    },
  },
  programs: {
    sale: {
      name: "OMNIDAT SALE",
      target: "TRANZ 330/380 TCL",
      tcl: [
        "; OMNIDAT SALE",
        "; Prompt clerk, read track data, dial OMNIDAT, print receipt.",
        'DISPLAY "OMNIDAT SALE"',
        "INPUT AMOUNT",
        "INPUT CLERK",
        "READ CARD TRACK2",
        "DIAL 8810",
        "SEND POS.SALE",
        "PRINT RECEIPT",
      ].join("\n"),
      hostMessage:
        "POS.SALE|terminalId|clerkCode|amount|track2|noteSerial|retrievalReference",
    },
    refund: {
      name: "OMNIDAT REFUND",
      target: "TRANZ 330/380 TCL",
      tcl: [
        "; OMNIDAT REFUND",
        'DISPLAY "OMNIDAT REFUND"',
        "INPUT AUTHCODE",
        "DIAL 8810",
        "SEND POS.REFUND",
        "PRINT RECEIPT",
      ].join("\n"),
      hostMessage: "POS.REFUND|terminalId|clerkCode|authCode",
    },
    credit: {
      name: "OMNIDAT CREDIT",
      target: "TRANZ 330/380 TCL",
      tcl: [
        "; OMNIDAT CREDIT",
        'DISPLAY "OMNIDAT CREDIT"',
        "INPUT AMOUNT",
        "READ CARD TRACK2",
        "DIAL 8810",
        "SEND POS.CREDIT",
        "PRINT RECEIPT",
      ].join("\n"),
      hostMessage: "POS.CREDIT|terminalId|clerkCode|amount|track2",
    },
    batchClose: {
      name: "OMNIDAT CLOSE",
      target: "TRANZ 330/380 TCL",
      tcl: [
        "; OMNIDAT CLOSE",
        'DISPLAY "CLOSE BATCH"',
        "INPUT CLERK",
        "DIAL 8810",
        "SEND POS.CLOSE-BATCH",
        "PRINT TOTALS",
      ].join("\n"),
      hostMessage: "POS.CLOSE-BATCH|terminalId|clerkCode|batchSequence",
    },
  },
  deployment: {
    configMemory: {
      hostDialNumber: "8810",
      terminalId: "assigned by OMNIDAT provisioning",
      hostX121: "311088002010",
      merchantToken: "stored at OMNIDAT FEP, never in terminal TCL",
    },
    runbook: [
      "Enroll terminal profile in OMNIDAT and bind terminal ID to a ShadyBucks merchant account.",
      "Load TRANZ 330/380 program with TCLOAD direct download during bench setup.",
      "Set host dial number to ShadyTel extension 8810 and verify CONNECT 2400.",
      "Use ZONTALK telephone download for field updates when direct serial access is not available.",
      "Run POS.SALE for 0.01 SHDY, capture ShadyBank auth code, then print activation receipt.",
    ],
  },
};

export function getVintageTerminalProgramPack() {
  return {
    ...vintageTerminalProgramPack,
    network: { ...vintageTerminalProgramPack.network },
    sourceBasis: vintageTerminalProgramPack.sourceBasis.map((source) => ({
      ...source,
    })),
    supportedFamilies: vintageTerminalProgramPack.supportedFamilies.map(
      (family) => ({
        ...family,
        models: [...family.models],
        downloadMethods: [...family.downloadMethods],
        notes: [...family.notes],
      }),
    ),
    capabilities: [...vintageTerminalProgramPack.capabilities],
    hostBindings: Object.fromEntries(
      Object.entries(vintageTerminalProgramPack.hostBindings).map(
        ([key, binding]) => [
          key,
          {
            ...binding,
            shadyBankEndpoints: [...binding.shadyBankEndpoints],
            paymentInputs: [...binding.paymentInputs],
          },
        ],
      ),
    ) as VintageTerminalProgramPack["hostBindings"],
    programs: Object.fromEntries(
      Object.entries(vintageTerminalProgramPack.programs).map(
        ([key, program]) => [key, { ...program }],
      ),
    ) as VintageTerminalProgramPack["programs"],
    deployment: {
      configMemory: { ...vintageTerminalProgramPack.deployment.configMemory },
      runbook: [...vintageTerminalProgramPack.deployment.runbook],
    },
  };
}

const verifiedVintageTclPrimitives: VintageTerminalPrimitive[] = [
  {
    command: "+D",
    purpose: "DTMF tone dial from destination buffer",
    source: "TCL Programmer's Manual command +D",
  },
  {
    command: "S",
    purpose: "dial phone number or set multiple-transaction function",
    source: "TCL Programmer's Manual command S",
  },
  {
    command: "+I",
    purpose: "modem character input/output",
    source: "TCL Programmer's Manual command +I",
  },
  {
    command: "E",
    purpose: "cardreader or keypad input",
    source: "TCL Programmer's Manual command E",
  },
  {
    command: "+E",
    purpose: "amount input with decimal placement",
    source: "TCL Programmer's Manual command +E",
  },
  {
    command: "P",
    purpose: "display custom prompt",
    source: "TCL Programmer's Manual command P",
  },
  {
    command: "F",
    purpose: "display fixed prompt",
    source: "TCL Programmer's Manual command F",
  },
  {
    command: "N",
    purpose: "send destination buffer to printer",
    source: "TCL Programmer's Manual command N",
  },
];

function tclSaleProgram(input: {
  terminalId: string;
  merchantAccountId: string;
}) {
  const hostMessage = [
    "POS.SALE",
    input.terminalId,
    input.merchantAccountId,
    "{CLERK}",
    "{AMOUNT}",
    "{TRACK2}",
    "{RRN}",
  ].join("|");

  return [
    "; OMNIDAT SALE - TRANZ 330/380 TCL bench artifact",
    "; Uses verified TCL primitives; exact offsets require hardware validation.",
    "100=OMNIDAT SALE",
    "101=ENTER AMOUNT",
    "102=SWIPE OR KEY",
    "103=DIALING OMNIDAT",
    "104=APPROVED",
    "105=DECLINED",
    "B.3        ; Select destination buffer 3",
    "G          ; Clear destination buffer",
    "P100       ; Display custom prompt",
    "+E4.15     ; Amount input with decimal placement",
    "R'|'       ; Append OMNIDAT field separator",
    "P102       ; Display card prompt",
    "E0.2.40.8  ; Cardreader/keypad numeric input",
    "R'|'       ; Append field separator",
    `R'${hostMessage}'`,
    "R'|'",
    "R'8810'    ; Host dial number loaded into destination buffer",
    "S3         ; Go off hook",
    "+D         ; DTMF tone dial from destination buffer",
    "+I7        ; Modem I/O with host control characters",
    "N          ; Send destination buffer to printer",
  ].join("\n");
}

function tcLoadManifest(input: {
  packageId: string;
  terminalId: string;
  family: VintageTerminalFamily["family"];
}) {
  return [
    "; OMNIDAT TCLOAD/ZONTALK MANIFEST",
    `PACKAGE=${input.packageId}`,
    `TERMINAL=${input.terminalId}`,
    `FAMILY=${input.family}`,
    "APP=OMNISALE.TCL",
    "CONFIG=CONFIG.SYS",
    "DOWNLOAD_DIRECT=TCLOAD",
    "DOWNLOAD_TELEPHONE=ZONTALK",
    "VALIDATION=BENCH_REQUIRED",
  ].join("\n");
}

function terminalConfig(input: {
  terminalId: string;
  merchantAccountId: string;
}) {
  return [
    "OMNIDAT_TERMINAL_CONFIG=1",
    `TERMINAL_ID=${input.terminalId}`,
    `MERCHANT_ACCOUNT=${input.merchantAccountId}`,
    "HOST_DIAL=8810",
    "HOST_X121=311088002010",
    "UPDATE_DIAL=8811",
    "UPDATE_X121=311088002020",
    "MERCHANT_RAIL=omnibucks",
    "OMNIBANK_API=https://bucks.omnidat.cc",
    "SHADYBANK_API=https://bucks.omnidat.cc",
    "SHADYBANK_TOKEN=FEP_ONLY",
  ].join("\n");
}

export function buildVintageTerminalDownloadPackage(input: {
  terminalId: string;
  merchantAccountId: string;
  family: VintageTerminalFamily["family"];
}): VintageTerminalDownloadPackage {
  const terminalIdValue = input.terminalId.trim().toUpperCase();
  const packageId = `${vintageTerminalProgramPack.version}-${terminalIdValue}`;

  return {
    packageId,
    validationStatus: "bench-validation-required",
    terminalId: terminalIdValue,
    merchantAccountId: input.merchantAccountId,
    family: input.family,
    verifiedTclPrimitives: verifiedVintageTclPrimitives.map((primitive) => ({
      ...primitive,
    })),
    portProfiles: [
      {
        id: "pots-sale",
        direction: "terminal-to-host",
        purpose: "sale/refund/credit authorization",
        dialNumber: "8810",
        x121: "311088002010",
        modem: { nominalBaud: 2400, framing: "8N1 async" },
      },
      {
        id: "zontalk-update",
        direction: "host-to-terminal",
        purpose: "telephone application download",
        dialNumber: "8811",
        x121: "311088002020",
        modem: { nominalBaud: 2400, framing: "8N1 async" },
      },
    ],
    shadyBankProtocol: {
      sale: {
        authorize: {
          method: "POST",
          path: "/api/authorize",
          fields: ["amount", "track2"],
        },
        capture: {
          method: "POST",
          path: "/api/capture",
          fields: ["amount", "auth_code", "description"],
        },
      },
      refund: {
        reverse: {
          method: "POST",
          path: "/api/reverse",
          fields: ["auth_code", "description"],
        },
      },
      credit: {
        credit: {
          method: "POST",
          path: "/api/credit",
          fields: ["amount", "track2", "description"],
        },
      },
    },
    files: [
      {
        path: "OMNISALE.TCL",
        mediaType: "text/plain",
        contents: tclSaleProgram({
          terminalId: terminalIdValue,
          merchantAccountId: input.merchantAccountId,
        }),
      },
      {
        path: "OMNIDAT.DTZ",
        mediaType: "text/plain",
        contents: tcLoadManifest({
          packageId,
          terminalId: terminalIdValue,
          family: input.family,
        }),
      },
      {
        path: "CONFIG.SYS",
        mediaType: "text/plain",
        contents: terminalConfig({
          terminalId: terminalIdValue,
          merchantAccountId: input.merchantAccountId,
        }),
      },
      {
        path: "README.TXT",
        mediaType: "text/plain",
        contents: [
          "OMNIDAT VERIFONE TERMINAL PACKAGE",
          "Load OMNIDAT.DTZ and OMNISALE.TCL with TCLOAD during bench setup.",
          "Use ZONTALK telephone download on dial port 8811 for field updates.",
          "Do not place ShadyBank bearer tokens on terminal media.",
        ].join("\n"),
      },
    ],
  };
}

export function simulateIso8583Transaction(
  input: Iso8583TransactionInput,
): Iso8583TransactionResult {
  const account = state().billingAccounts.find(
    (entry) => entry.accountId === input.accountId,
  );
  const responseCode: Iso8583TransactionResult["responseCode"] = account
    ? input.amount <= Math.max(account.balance, 0)
      ? "00"
      : "51"
    : "12";
  const auth =
    responseCode === "00"
      ? authorizationCode(input.retrievalReference)
      : "DECLIN";
  const requestFields: Record<number, string> = {
    2: redactedAccountToken(input.accountId),
    3: input.processingCode,
    4: cents(input.amount),
    7: "0101000000",
    11: traceNumber(input.retrievalReference),
    37: input.retrievalReference.padStart(12, "0").slice(-12),
    41: terminalId(input.terminalId),
    42: "SHADYBUCKS0001",
    49: "999",
    52: "[REDACTED-HSM-BLOCK]",
  };
  const responseFields: Record<number, string> = {
    3: input.processingCode,
    4: cents(input.amount),
    11: requestFields[11] ?? "000001",
    37: requestFields[37] ?? input.retrievalReference,
    38: auth,
    39: responseCode,
    41: requestFields[41] ?? terminalId(input.terminalId),
    49: "999",
  };
  const responseMti = responseMtiFor(input.mti);

  return {
    protocol: "ISO8583-1987-OMNIBUCKS-X25",
    requestMti: input.mti,
    responseMti,
    processingCode: input.processingCode,
    responseCode,
    authorizationCode: auth,
    packedRequest: `MTI=${input.mti}|${packIsoFields(requestFields)}`,
    packedResponse: `MTI=${responseMti}|${packIsoFields(responseFields)}`,
    transcript: [
      "CALL 311088030100",
      "CONNECT OMNIBUCKS ATM PAD",
      `ISO8583 ${input.mti} -> ${responseMti}`,
      `PROC ${input.processingCode}`,
      `AMOUNT ${cents(input.amount)} OMNI`,
      `RRN ${input.retrievalReference}`,
      `RC ${responseCode}`,
      `AUTH ${auth}`,
      "RAIL omnibucks",
    ].join("\n"),
  };
}

export function processVintagePosSale(input: {
  terminalId: string;
  terminalModel:
    | "VERIFONE_TRANZ_330"
    | "VERIFONE_TRANZ_380"
    | "VERIFONE_OMNI_3200"
    | "VERIFONE_OMNI_3750"
    | "UNKNOWN_DIAL_POS";
  merchantAccountId: string;
  clerkCode?: string;
  amount: number;
  feePolicyId: string;
  noteSerial?: string;
  retrievalReference: string;
}) {
  const current = state();
  const terminalIdValue = input.terminalId.trim().toUpperCase();
  const merchant = current.billingAccounts.find(
    (account) => account.accountId === input.merchantAccountId,
  );
  if (!merchant) {
    throw new Error(`Unknown merchant account: ${input.merchantAccountId}`);
  }

  const feeAmount = input.feePolicyId === "OFFICIAL_EVENT_WAIVED" ? 0 : 0.25;
  const hostX121 = "311088002010";
  const x121Origin = "311088040001";
  const receiptId = `RCPT-POS-${input.retrievalReference.slice(-6)}`;
  const iso = simulateIso8583Transaction({
    mti: "0200",
    processingCode: "000000",
    amount: input.amount,
    accountId: merchant.accountId,
    terminalId: terminalIdValue,
    retrievalReference: input.retrievalReference,
  });
  const status = iso.responseCode === "00" ? "approved" : "declined";
  const ledgerEntry: OmnidatBillingLedgerEntry = {
    id: `LEDGER-${receiptId}`,
    accountId: merchant.accountId,
    entryKind: "pos-network-fee",
    amount: -feeAmount,
    currency: "OMNI",
    memo: `OMNIDAT dial POS network fee for ${terminalIdValue}`,
    receiptId,
  };

  if (feeAmount > 0) {
    merchant.balance -= feeAmount;
  }
  current.ledger.unshift(ledgerEntry);
  appendAudit(`pos.sale.${status}`, "terminal", terminalIdValue, {
    amount: input.amount,
    merchantAccountId: merchant.accountId,
    clerkCode: input.clerkCode ?? "",
    feePolicyId: input.feePolicyId,
    responseCode: iso.responseCode,
  });

  const noteLine = input.noteSerial ? `NOTE ${input.noteSerial}` : "NOTE NONE";
  const clerkLine = input.clerkCode ? `CLERK ${input.clerkCode}` : "CLERK NONE";
  const transcript = [
    "DIAL 8810",
    "CONNECT 2400",
    `ORIGIN ${x121Origin}`,
    `CALL ${hostX121}`,
    "CONNECT OMNIBUCKS POS AUTHORIZATION",
    `TERMINAL ${terminalIdValue}`,
    `MODEL ${input.terminalModel}`,
    clerkLine,
    `SALE ${input.amount.toFixed(2)} OMNI`,
    noteLine,
    `FEE POLICY ${input.feePolicyId}`,
    `NETWORK FEE ${feeAmount.toFixed(2)} OMNI`,
    `RC ${iso.responseCode}`,
    `AUTH ${iso.authorizationCode}`,
    `RECEIPT ${receiptId}`,
  ].join("\n");

  return {
    status,
    hostX121,
    terminal: {
      id: terminalIdValue,
      model: input.terminalModel,
      x121Origin,
      accessMethod: "pots-dial" as const,
    },
    clerkSession: input.clerkCode
      ? {
          clerkCode: input.clerkCode,
          mode: "staffed" as const,
        }
      : null,
    merchantAccount: merchant,
    fee: {
      policyId: input.feePolicyId,
      amount: feeAmount,
      currency: "OMNI" as const,
      payer: "merchant" as const,
      ledgerEntry,
    },
    iso,
    transcript,
    receipt: [
      "OMNIDAT POS RECEIPT",
      `TERMINAL ${terminalIdValue}`,
      `MERCHANT ${merchant.accountId}`,
      input.clerkCode ? `CLERK ${input.clerkCode}` : "CLERK NONE",
      `AMOUNT ${input.amount.toFixed(2)} OMNI`,
      input.noteSerial ? `NOTE ${input.noteSerial}` : "NOTE NONE",
      status.toUpperCase(),
      `AUTH ${iso.authorizationCode}`,
      `NETWORK FEE ${feeAmount.toFixed(2)} OMNI`,
      `RECEIPT ${receiptId}`,
      "RAIL omnibucks",
    ].join("\n"),
  };
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
      "XOT HOST omnidat.cc",
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
    circuit.latencyMs =
      input.padKind === "xot-terminal" ? 38 : circuit.latencyMs;
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
    throw new Error(`Unknown OmniBucks account: ${input.settlementAccountId}`);
  }
  const terminalX121 = input.terminalX121?.trim() || nextX121();
  const ledgerEntry: OmnidatBillingLedgerEntry = {
    id: `LEDGER-ATM-${slugify(input.terminalId).toUpperCase()}`,
    accountId: settlementAccount.accountId,
    entryKind: "atm-activation",
    amount: -10,
    currency: "OMNI",
    memo: `ATM activation for ${input.terminalId}`,
    receiptId: `RCPT-ATM-${terminalX121.slice(-6)}`,
  };
  settlementAccount.balance -= 10;
  current.ledger.unshift(ledgerEntry);
  current.services.push({
    slug: `omnibucks-atm-${slugify(input.terminalId)}`,
    name: `OmniBucks ATM ${input.terminalId}`,
    x121: terminalX121,
    owner: settlementAccount.owner,
    category: "billing",
    status: "up",
    reachable: true,
    verbs: [
      {
        name: "BALANCE",
        description: "Return settlement account balance for this ATM terminal.",
        inputs: ["omnibucksAccountId"],
        outputs: ["balance", "currency"],
      },
      {
        name: "WITHDRAW",
        description: "Authorize an OmniBucks cash-out operation.",
        inputs: ["omnibucksAccountId", "amount"],
        outputs: ["authorizationCode", "receiptId"],
      },
      {
        name: "DEPOSIT",
        description: "Record an operator cash-in operation.",
        inputs: ["omnibucksAccountId", "amount"],
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

export function stampActivityPassport(input: {
  passportId: string;
  badgeId: string;
  operatorId: string;
  evidence: string;
}) {
  const current = state();
  const stampId = nextPassportStampId();
  const receiptId = `RCPT-PASS-${stampId.slice(-5)}`;
  const stamp: OmnidatPassportStamp = {
    id: stampId,
    passportId: input.passportId.trim(),
    badgeId: input.badgeId.trim().toUpperCase(),
    operatorId: input.operatorId.trim(),
    evidence: input.evidence.trim(),
    stampId,
    receiptId,
    status: "filed",
  };

  current.passportStamps.unshift(stamp);
  appendAudit("passport.stamped", "passport", stamp.passportId, {
    badgeId: stamp.badgeId,
    operatorId: stamp.operatorId,
    stampId,
  });

  return {
    ...stamp,
    meritClaimStatus: stamp.status,
    transcript: [
      "CALL 311088030021",
      "CONNECT PASSPORT LOG ENTRY",
      `STAMP ${stamp.passportId}`,
      `BADGE ${stamp.badgeId}`,
      `OPERATOR ${stamp.operatorId}`,
      `STAMP-ID ${stamp.stampId}`,
      `RECEIPT ${stamp.receiptId}`,
      "STATUS FILED",
    ].join("\n"),
  };
}

function serviceDirectory(namespace?: string) {
  const current = state();
  const services =
    namespace?.toLowerCase() === "camp"
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
    transcript =
      "VERBS: DIR [NAMESPACE], LOOKUP <X121>, CALL <X121>, STATUS <X121>, PAD <X121>, BILL <ACCOUNT>";
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
      ? [
          `PAD ${x121} ${pad.status.toUpperCase()} ${pad.padKind}`,
          pad.profile,
        ].join("\n")
      : `PAD ${x121} NOT CONFIGURED`;
  } else if (normalizedVerb === "BILL") {
    const accountId = args[0] ?? "";
    const account = current.billingAccounts.find(
      (entry) => entry.accountId === accountId,
    );
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
    status:
      transcript.startsWith("ERROR") || transcript.includes("UNKNOWN")
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
