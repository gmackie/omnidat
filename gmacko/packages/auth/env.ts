import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export function authEnv() {
  return createEnv({
    server: {
      AUTH_GITHUB_ID: z.string().min(1).optional(),
      AUTH_GITHUB_SECRET: z.string().min(1).optional(),
      AUTH_GOOGLE_ID: z.string().min(1).optional(),
      AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
      AUTH_APPLE_ID: z.string().min(1).optional(),
      AUTH_APPLE_SECRET: z.string().min(1).optional(),
      AUTH_APPLE_BUNDLE_ID: z.string().min(1).optional(),
      AUTH_GITHUB_URL: z.string().url().optional(),
      AUTH_GITHUB_API_URL: z.string().url().optional(),
      AUTH_GOOGLE_URL: z.string().url().optional(),
      AUTH_GOOGLE_TOKEN_URL: z.string().url().optional(),
      AUTH_APPLE_URL: z.string().url().optional(),
      // OmniAuth via Authentik (OIDC). Discovery URL is
      // https://<authentik-host>/application/o/<app-slug>/.well-known/openid-configuration
      OMNIAUTH_DISCOVERY_URL: z.string().url().optional(),
      OMNIAUTH_CLIENT_ID: z.string().min(1).optional(),
      OMNIAUTH_CLIENT_SECRET: z.string().min(1).optional(),
      AUTH_SECRET: z.string().min(1).optional(),
      BYPASS_MAGIC_LINK: z.coerce.boolean().default(false),
      NODE_ENV: z.enum(["development", "production"]).optional(),
    },
    runtimeEnv: process.env,
    skipValidation:
      !!process.env.CI ||
      process.env.SKIP_ENV_VALIDATION === "1" ||
      process.env.npm_lifecycle_event === "lint",
  });
}
