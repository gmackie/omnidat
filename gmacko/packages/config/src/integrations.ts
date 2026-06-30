export const integrations = {
  sentry: false,
  posthog: false,
  stripe: false,
  revenuecat: false,
  forgegraph: false,
  notifications: false,
  email: {
    enabled: false,
    provider: "none" as "resend" | "sendgrid" | "none",
  },
  realtime: {
    enabled: false,
    provider: "none" as "pusher" | "ably" | "none",
  },
  storage: {
    enabled: false,
    provider: "none" as "uploadthing" | "none",
  },
  i18n: false,
  openapi: false,
} as const;

export type Integrations = typeof integrations;

export const platformPrimitives = {
  featureFlags: {
    enabled: false,
    provider: "none" as "growthbook" | "posthog" | "none",
  },
  jobs: {
    enabled: false,
    provider: "none" as "bullmq" | "inngest" | "none",
  },
  rateLimits: {
    enabled: true,
    scopes: ["auth", "api", "signup"] as const,
  },
  botProtection: {
    enabled: false,
    provider: "none" as "turnstile" | "hcaptcha" | "none",
  },
  compliance: {
    enabled: true,
    dataExport: true,
    dataDeletion: true,
  },
  emailDelivery: {
    enabled: false,
    provider: "none" as "resend" | "sendgrid" | "none",
    requiredEnv: [] as const,
  },
} as const;

export type PlatformPrimitives = typeof platformPrimitives;

export const saasFeatures = {
  collaboration: false,
  billing: false,
  metering: false,
  support: false,
  launch: false,
  referrals: false,
  operatorApis: false,
} as const;

export type SaasFeatures = typeof saasFeatures;

export const isSentryEnabled = () => integrations.sentry;
export const isPostHogEnabled = () => integrations.posthog;
export const isStripeEnabled = () => integrations.stripe;
export const isRevenueCatEnabled = () => integrations.revenuecat;
export const isForgeGraphEnabled = () => integrations.forgegraph;
export const isNotificationsEnabled = () => integrations.notifications;
export const isEmailEnabled = () => integrations.email.enabled;
export const isRealtimeEnabled = () => integrations.realtime.enabled;
export const isStorageEnabled = () => integrations.storage.enabled;
export const isI18nEnabled = () => integrations.i18n;
export const isOpenApiEnabled = () => integrations.openapi;
export const isSaasCollaborationEnabled = () => saasFeatures.collaboration;
export const isSaasBillingEnabled = () => saasFeatures.billing;
export const isSaasMeteringEnabled = () => saasFeatures.metering;
export const isSaasSupportEnabled = () => saasFeatures.support;
export const isSaasLaunchEnabled = () => saasFeatures.launch;
export const isSaasReferralsEnabled = () => saasFeatures.referrals;
export const isSaasOperatorApisEnabled = () => saasFeatures.operatorApis;
