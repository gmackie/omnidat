// Deterministic printable document builders. PDF rendering is a later concern;
// these produce the printable source (title + monospace body) in the same
// terse, uppercase station style as the field-office receipt renderers.
//
// Covers evidence needs for all horizons including H5-H8 field events,
// ToorCamp 2028 flagship, and potential CC Camp 2027 deployments.

export type OmnidatDocumentKind =
  | "address-assignment"
  | "demarc-sheet"
  | "service-certificate"
  | "provisioning-transcript"
  | "daily-noc-summary"
  | "operator-license"
  | "camp-deployment-summary";

export type OmnidatDocument = { kind: OmnidatDocumentKind; title: string; body: string };

const HEADER = ["OMNIDAT PACKET CLEARING", "A GMACKO CORPORATION", "EXCHANGE 88", ""];

function doc(kind: OmnidatDocumentKind, title: string, lines: string[]): OmnidatDocument {
  return { kind, title, body: [...HEADER, title, "", ...lines, ""].join("\n") };
}

export function buildOmnidatDocument(
  kind: OmnidatDocumentKind,
  data: Record<string, unknown>,
): OmnidatDocument {
  const field = (key: string, fallback = "-") =>
    data[key] === undefined || data[key] === null ? fallback : String(data[key]);

  switch (kind) {
    case "address-assignment":
      return doc("address-assignment", "X.121 ADDRESS ASSIGNMENT", [
        `X.121: ${field("x121")}`,
        `CAMPSITE: ${field("campsite")}`,
        `NAMESPACE: ${field("namespace", "camp").toUpperCase()}`,
        `TRANSPORT: ${field("transport").toUpperCase()}`,
        `STATUS: ${field("status", "reserved").toUpperCase()}`,
      ]);
    case "demarc-sheet":
      return doc("demarc-sheet", "SERVICE DEMARCATION SHEET", [
        `SERVICE: ${field("service")}`,
        `X.121: ${field("x121")}`,
        `ENDPOINT: ${field("endpoint")}`,
        `TRANSPORT: ${field("transport").toUpperCase()}`,
        `CONTACT: ${field("contact")}`,
      ]);
    case "service-certificate":
      return doc("service-certificate", "SERVICE CERTIFICATE", [
        `SERVICE: ${field("service")}`,
        `X.121: ${field("x121")}`,
        `OWNER: ${field("owner", "OMNIDAT")}`,
        `VERBS: ${field("verbs", "").toUpperCase()}`,
        `STATUS: ${field("status", "up").toUpperCase()}`,
      ]);
    case "provisioning-transcript":
      return doc("provisioning-transcript", "PROVISIONING VERIFICATION TRANSCRIPT", [
        `X.121: ${field("x121")}`,
        `STATUS: ${field("status", "verified").toUpperCase()}`,
        "",
        "TRANSCRIPT:",
        field("transcript", "(none)"),
      ]);
    case "daily-noc-summary":
      return doc("daily-noc-summary", "DAILY NOC SUMMARY", [
        `DATE: ${field("date")}`,
        `PACKET SESSIONS: ${field("sessions", "0")}`,
        `INCIDENTS: ${field("incidents", "0")}`,
        `ALLOCATIONS: ${field("allocations", "0")}`,
        `ORDERS: ${field("orders", "0")}`,
        `EVIDENCE ARTIFACTS: ${field("evidence", "0")}`,
      ]);
    case "operator-license":
      return doc("operator-license", "OMNIDAT OPERATOR LICENSE", [
        `OPERATOR: ${field("operator")}`,
        `ROLE: ${field("role").toUpperCase()}`,
        `LICENSE NO: ${field("licenseNo")}`,
        `EVENT: ${field("event", "ALL")}`,
        `EXAM PASSED: ${field("examDate")}`,
        "",
        `CAPABILITIES: ${field("capabilities", "").toUpperCase()}`,
        "",
        "PRESENT AT THE NOC DESK FOR OPERATOR ACCESS",
      ]);
    case "camp-deployment-summary":
      return doc("camp-deployment-summary", "CAMP DEPLOYMENT SUMMARY", [
        `EVENT: ${field("event", "TOORCAMP-2028")}`,
        `SCOPE: ${field("scope", "VILLAGE / FIELD OFFICE")}`,
        `DATES: ${field("dates")}`,
        `SHADYTEL: ${field("shadytel", "PENDING")}`,
        `SERVICES: ${field("services", "0")}`,
        `APPS: ${field("apps", "0")}`,
        `ALLOCATIONS: ${field("allocations", "0")}`,
        "",
        "CC CAMP 2027: European rehearsal target (H6/H8)",
        `REHEARSAL: ${field("rehearsal", "YES")}`,
        `PARTICIPANTS: ${field("participants", "500")}`,
        "ETIQUETTE: Be brief, use honest CLR, respect 020xxx. See packet-clearing.md",
        "See README Planned Camp Deployments for ToorCamp 2028 / CC Camp 2027 details.",
      ]);
  }
}
