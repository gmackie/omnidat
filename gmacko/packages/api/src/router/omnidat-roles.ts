export const OMNIDAT_ROLES = [
  "campsite-owner",
  "vendor-operator",
  "packet-operator",
  "noc-operator",
  "bank-operator",
  "admin",
  "auditor",
] as const;

export type OmnidatRole = (typeof OMNIDAT_ROLES)[number];

export const OMNIDAT_CAPABILITIES = {
  "operator.read": [...OMNIDAT_ROLES],
  "event.write": [],
  "campsite.write": ["packet-operator"],
  "service.request": [
    "campsite-owner",
    "vendor-operator",
    "packet-operator",
  ],
  "service.write": ["packet-operator"],
  "service.disable": ["packet-operator", "noc-operator"],
  "verb.write": ["packet-operator"],
  "allocation.write": ["packet-operator"],
  "provisioning.write": ["packet-operator"],
  "session.write": ["packet-operator", "noc-operator"],
  "evidence.write": ["packet-operator", "noc-operator"],
  "incident.write": ["packet-operator", "noc-operator"],
  "authority.transfer": ["noc-operator"],
  "bank.write": ["bank-operator"],
  "vendor.write": ["vendor-operator", "bank-operator"],
  "role.write": [],
} satisfies Record<string, readonly OmnidatRole[]>;

export type OmnidatCapability = keyof typeof OMNIDAT_CAPABILITIES;

export function roleGrants(
  role: OmnidatRole,
  capability: OmnidatCapability | string,
) {
  if (role === "admin") return true;
  if (!isOmnidatCapability(capability)) return false;
  // The `satisfies` above guarantees every value is a readonly OmnidatRole[];
  // the annotation keeps `.includes` from narrowing the empty `role.write`
  // array's element type to `never`.
  return (OMNIDAT_CAPABILITIES[capability] as readonly OmnidatRole[]).includes(
    role,
  );
}

export function isOmnidatRole(role: string): role is OmnidatRole {
  return (OMNIDAT_ROLES as readonly string[]).includes(role);
}

export function isOmnidatCapability(
  capability: string,
): capability is OmnidatCapability {
  return Object.hasOwn(OMNIDAT_CAPABILITIES, capability);
}
