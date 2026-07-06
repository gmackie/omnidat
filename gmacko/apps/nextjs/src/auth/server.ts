import "server-only";

import { initAuth } from "@omnidat/auth";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";

import { env } from "~/env";

const baseUrl =
  env.APP_URL ??
  env.PORTLESS_URL ??
  env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";
const isBuildTime =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build" ||
  process.env.npm_lifecycle_event === "with-env";

// Built lazily, not at module top-level. On Cloudflare Workers, secrets are
// only present on the per-request env binding (bridged to process.env by the
// worker entry before the handler runs), so constructing better-auth at
// module init would miss OMNIAUTH_*/AUTH_SECRET and silently drop the OIDC
// provider. Memoize per isolate after the first request populates process.env.
let cachedAuth: ReturnType<typeof initAuth> | undefined;

function buildAuth() {
  // Read runtime secrets live from process.env (the worker entry bridges the
  // Cloudflare env binding into it before the request) so a frozen t3-env
  // snapshot from module init can't hide them.
  const rt = (key: string) => process.env[key] || undefined;
  return initAuth({
    baseUrl,
    productionUrl: env.APP_URL ?? env.NEXT_PUBLIC_APP_URL ?? baseUrl,
    secret:
      rt("AUTH_SECRET") ??
      env.AUTH_SECRET ??
      (isBuildTime ? "omnidat-build-time-secret-not-used-at-runtime-2026" : undefined),
    githubClientId: rt("AUTH_GITHUB_ID") ?? env.AUTH_GITHUB_ID,
    githubClientSecret: rt("AUTH_GITHUB_SECRET") ?? env.AUTH_GITHUB_SECRET,
    googleClientId: rt("AUTH_GOOGLE_ID") ?? env.AUTH_GOOGLE_ID,
    googleClientSecret: rt("AUTH_GOOGLE_SECRET") ?? env.AUTH_GOOGLE_SECRET,
    appleClientId: env.AUTH_APPLE_ID,
    appleClientSecret: env.AUTH_APPLE_SECRET,
    appleBundleIdentifier: env.AUTH_APPLE_BUNDLE_ID,
    githubUrl: env.AUTH_GITHUB_URL,
    githubApiUrl: env.AUTH_GITHUB_API_URL,
    googleUrl: env.AUTH_GOOGLE_URL,
    googleTokenUrl: env.AUTH_GOOGLE_TOKEN_URL,
    appleUrl: env.AUTH_APPLE_URL,
    omniauthDiscoveryUrl: rt("OMNIAUTH_DISCOVERY_URL") ?? env.OMNIAUTH_DISCOVERY_URL,
    omniauthClientId: rt("OMNIAUTH_CLIENT_ID") ?? env.OMNIAUTH_CLIENT_ID,
    omniauthClientSecret: rt("OMNIAUTH_CLIENT_SECRET") ?? env.OMNIAUTH_CLIENT_SECRET,
    bypassMagicLink: env.BYPASS_MAGIC_LINK,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pkg.pr.new causes duplicate @better-auth/core type instances
    extraPlugins: [nextCookies() as any],
  });
}

export function getAuth() {
  if (!cachedAuth) cachedAuth = buildAuth();
  return cachedAuth;
}

// Proxy so existing `auth.handler` / `auth.api` call sites resolve the lazy
// instance at access time (first request), not at module load.
export const auth = new Proxy({} as ReturnType<typeof initAuth>, {
  get(_target, prop) {
    return Reflect.get(getAuth(), prop);
  },
});

export const getSession = cache(async () =>
  getAuth().api.getSession({ headers: await headers() }),
);
