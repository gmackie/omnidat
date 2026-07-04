import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  omnidatAddressAllocation,
  omnidatAuditEvent,
  omnidatBillingAccount,
  omnidatBillingLedgerEntry,
  omnidatCampsite,
  omnidatCampsiteApp,
  omnidatEvent,
  omnidatEvidenceArtifact,
  omnidatFoodMenuItem,
  omnidatFoodOrder,
  omnidatInfraEndpoint,
  omnidatNetwork,
  omnidatNetworkMetric,
  omnidatNocIncident,
  omnidatOperatorRole,
  omnidatPadConfig,
  omnidatPassportStamp,
  omnidatPdfProfile,
  omnidatProvisioningRequest,
  omnidatSecurityCredential,
  omnidatService,
  omnidatServiceVerb,
  omnidatShadyBucksAtm,
  omnidatTransportEndpoint,
  omnidatX25Circuit,
  omnidatX25Node,
} from "../schema";

function uniqueNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).uniqueConstraints.map((constraint) =>
    constraint.getName(),
  );
}

describe("OMNIDAT X.25 operational schema", () => {
  it("models the X.25 network topology and X.121 allocation surface", () => {
    expect(omnidatNetwork.networkCode).toBeDefined();
    expect(omnidatNetwork.x121Prefix).toBeDefined();
    expect(omnidatX25Node.networkId).toBeDefined();
    expect(omnidatX25Node.nodeKind).toBeDefined();
    expect(omnidatX25Circuit.localX121).toBeDefined();
    expect(omnidatX25Circuit.remoteX121).toBeDefined();
    expect(omnidatAddressAllocation.x121).toBeDefined();
    expect(omnidatAddressAllocation.assignedToKind).toBeDefined();

    expect(uniqueNames(omnidatNetwork)).toContain(
      "omnidat_network_code_unique",
    );
    expect(uniqueNames(omnidatAddressAllocation)).toContain(
      "omnidat_address_allocation_x121_unique",
    );
  });

  it("models services with verbs, inputs, outputs, and X.121 addresses", () => {
    expect(omnidatService.slug).toBeDefined();
    expect(omnidatService.x121).toBeDefined();
    expect(omnidatService.ownerKind).toBeDefined();
    expect(omnidatServiceVerb.serviceId).toBeDefined();
    expect(omnidatServiceVerb.verb).toBeDefined();
    expect(omnidatServiceVerb.inputs).toBeDefined();
    expect(omnidatServiceVerb.outputs).toBeDefined();

    expect(uniqueNames(omnidatService)).toContain(
      "omnidat_service_x121_unique",
    );
    expect(uniqueNames(omnidatServiceVerb)).toContain(
      "omnidat_service_verb_service_verb_unique",
    );
  });

  it("models users, PDFs, provisioning, billing, ATMs, and food service", () => {
    expect(omnidatPdfProfile.userId).toBeDefined();
    expect(omnidatPdfProfile.enabledForms).toBeDefined();
    expect(omnidatProvisioningRequest.requestedByUserId).toBeDefined();
    expect(omnidatProvisioningRequest.verificationTranscript).toBeDefined();
    expect(omnidatPadConfig.x121).toBeDefined();
    expect(omnidatPadConfig.padKind).toBeDefined();
    expect(omnidatPadConfig.profile).toBeDefined();
    expect(omnidatBillingAccount.provider).toBeDefined();
    expect(omnidatBillingAccount.externalAccountId).toBeDefined();
    expect(omnidatBillingLedgerEntry.amount).toBeDefined();
    expect(omnidatShadyBucksAtm.settlementAccountId).toBeDefined();
    expect(omnidatShadyBucksAtm.terminalX121).toBeDefined();
    expect(omnidatFoodMenuItem.priceAmount).toBeDefined();
    expect(omnidatFoodOrder.lineTicket).toBeDefined();
    expect(omnidatPassportStamp.passportId).toBeDefined();
    expect(omnidatPassportStamp.badgeId).toBeDefined();
    expect(omnidatPassportStamp.stampId).toBeDefined();

    expect(uniqueNames(omnidatBillingAccount)).toContain(
      "omnidat_billing_account_provider_external_unique",
    );
    expect(uniqueNames(omnidatShadyBucksAtm)).toContain(
      "omnidat_shadybucks_atm_terminal_x121_unique",
    );
    expect(uniqueNames(omnidatPadConfig)).toContain(
      "omnidat_pad_config_x121_unique",
    );
    expect(uniqueNames(omnidatPassportStamp)).toContain(
      "omnidat_passport_stamp_stamp_id_unique",
    );
  });

  it("models infra, metrics, security, audit, and NOC operations", () => {
    expect(omnidatInfraEndpoint.endpointKind).toBeDefined();
    expect(omnidatInfraEndpoint.healthStatus).toBeDefined();
    expect(omnidatNetworkMetric.metricName).toBeDefined();
    expect(omnidatNetworkMetric.value).toBeDefined();
    expect(omnidatSecurityCredential.credentialKind).toBeDefined();
    expect(omnidatSecurityCredential.permissions).toBeDefined();
    expect(omnidatAuditEvent.actorUserId).toBeDefined();
    expect(omnidatAuditEvent.eventType).toBeDefined();
    expect(omnidatNocIncident.severity).toBeDefined();
    expect(omnidatNocIncident.status).toBeDefined();
  });

  it("preserves existing campsite, app, and transport tables", () => {
    expect(omnidatCampsite.namespace).toBeDefined();
    expect(omnidatCampsiteApp.address).toBeDefined();
    expect(omnidatTransportEndpoint.transport).toBeDefined();
  });

  it("models historical events, evidence artifacts, and operator roles", () => {
    expect(omnidatEvent.eventCode).toBeDefined();
    expect(omnidatEvent.publicArchive).toBeDefined();
    expect(omnidatEvidenceArtifact.artifactKind).toBeDefined();
    expect(omnidatEvidenceArtifact.recordCount).toBeDefined();
    expect(omnidatOperatorRole.userId).toBeDefined();
    expect(omnidatOperatorRole.role).toBeDefined();

    expect(uniqueNames(omnidatEvent)).toContain("omnidat_event_code_unique");
    expect(uniqueNames(omnidatOperatorRole)).toContain(
      "omnidat_operator_role_user_event_role_unique",
    );
  });
});
