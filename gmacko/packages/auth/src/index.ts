import { expo } from "@better-auth/expo";
import { db } from "@omnidat/db/client";
import type { WorkspaceRole } from "@omnidat/db/schema";
import { createLogger } from "@omnidat/logging";
import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth, magicLink, oAuthProxy } from "better-auth/plugins";

const log = createLogger({ module: "auth" });

export function isPlatformAdminRole(
  role: "user" | "admin" | null | undefined,
): role is "admin" {
  return role === "admin";
}

export function canManageWorkspace(
  role: WorkspaceRole | null | undefined,
): boolean {
  return role === "owner" || role === "admin";
}

export function initAuth<
  TExtraPlugins extends BetterAuthPlugin[] = [],
>(options: {
  baseUrl: string;
  productionUrl: string;
  secret: string | undefined;

  githubClientId?: string;
  githubClientSecret?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  appleClientId?: string;
  appleClientSecret?: string;
  appleBundleIdentifier?: string;
  githubUrl?: string;
  githubApiUrl?: string;
  googleUrl?: string;
  googleTokenUrl?: string;
  appleUrl?: string;
  // OmniAuth is OMNIDAT's identity provider, backed by Authentik (OIDC).
  // Supply the Authentik application's OIDC discovery URL, e.g.
  // https://<authentik-host>/application/o/<app-slug>/.well-known/openid-configuration
  omniauthDiscoveryUrl?: string;
  omniauthClientId?: string;
  omniauthClientSecret?: string;
  bypassMagicLink?: boolean;
  sendMagicLinkEmail?: (params: {
    email: string;
    url: string;
  }) => Promise<void>;
  extraPlugins?: TExtraPlugins;
}) {
  const ghUrl = options.githubUrl ?? "https://github.com";
  const ghApiUrl = options.githubApiUrl ?? "https://api.github.com";
  const googleUrl = options.googleUrl ?? "https://accounts.google.com";
  const googleTokenUrl =
    options.googleTokenUrl ?? "https://oauth2.googleapis.com/token";
  const appleUrl = options.appleUrl ?? "https://appleid.apple.com";

  const config = {
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    baseURL: options.baseUrl,
    secret: options.secret,
    plugins: [
      oAuthProxy({
        productionURL: options.productionUrl,
      }),
      expo(),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          if (options.bypassMagicLink) {
            log.info({ email, url }, "magic link generated (bypass mode)");
            return;
          }
          if (options.sendMagicLinkEmail) {
            await options.sendMagicLinkEmail({ email, url });
          }
        },
      }),
      // OmniAuth (Authentik OIDC). Callback:
      // <baseUrl>/api/auth/oauth2/callback/omniauth
      ...(options.omniauthDiscoveryUrl &&
      options.omniauthClientId &&
      options.omniauthClientSecret
        ? [
            genericOAuth({
              config: [
                {
                  providerId: "omniauth",
                  discoveryUrl: options.omniauthDiscoveryUrl,
                  clientId: options.omniauthClientId,
                  clientSecret: options.omniauthClientSecret,
                  scopes: ["openid", "profile", "email"],
                },
              ],
            }),
          ]
        : []),
      ...(options.extraPlugins ?? []),
    ],
    socialProviders: {
      ...(options.githubClientId && options.githubClientSecret
        ? {
            github: {
              clientId: options.githubClientId,
              clientSecret: options.githubClientSecret,
              authorizationEndpoint: `${ghUrl}/login/oauth/authorize`,
              tokenEndpoint: `${ghUrl}/login/oauth/access_token`,
              userInfoEndpoint: `${ghApiUrl}/user`,
            },
          }
        : {}),
      ...(options.googleClientId && options.googleClientSecret
        ? {
            google: {
              clientId: options.googleClientId,
              clientSecret: options.googleClientSecret,
              authorizationEndpoint: `${googleUrl}/o/oauth2/v2/auth`,
              tokenEndpoint: googleTokenUrl,
            },
          }
        : {}),
      ...(options.appleClientId && options.appleClientSecret
        ? {
            apple: {
              clientId: options.appleClientId,
              clientSecret: options.appleClientSecret,
              appBundleIdentifier: options.appleBundleIdentifier,
              authorizationEndpoint: `${appleUrl}/auth/authorize`,
              tokenEndpoint: `${appleUrl}/auth/token`,
              jwksEndpoint: `${appleUrl}/auth/keys`,
            },
          }
        : {}),
    },
    trustedOrigins: ["expo://", appleUrl, "https://gmacko.localhost"],
    onAPIError: {
      onError(error, ctx) {
        log.error({ err: error, context: ctx }, "better-auth API error");
      },
    },
  } satisfies BetterAuthOptions;

  return betterAuth(config);
}

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];
