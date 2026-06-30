export type OmnidatDirectoryEntry = {
  address: string;
  name: string;
  kind: "office" | "directory" | "campsite-app" | "gateway";
};

export type OmnidatTransportProfile = {
  name: string;
  description: string;
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
