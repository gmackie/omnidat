import { appRouter, createTRPCContext } from "@omnidat/api";
import { Button } from "@omnidat/ui/button";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, getSession } from "~/auth/server";
import { env } from "~/env";
import { MagicLinkForm } from "./magic-link-form";
import { PasskeySoftEnroll } from "./passkey-soft-enroll";

function runtimeSecret(key: string): string | undefined {
  return process.env[key] || undefined;
}

export async function AuthShowcase() {
  const session = await getSession();

  if (!session) {
    const omniauthEnabled = Boolean(
      (runtimeSecret("OMNIAUTH_DISCOVERY_URL") ?? env.OMNIAUTH_DISCOVERY_URL) &&
        (runtimeSecret("OMNIAUTH_CLIENT_ID") ?? env.OMNIAUTH_CLIENT_ID) &&
        (runtimeSecret("OMNIAUTH_CLIENT_SECRET") ?? env.OMNIAUTH_CLIENT_SECRET),
    );
    const githubEnabled = Boolean(
      (runtimeSecret("AUTH_GITHUB_ID") ?? env.AUTH_GITHUB_ID) &&
        (runtimeSecret("AUTH_GITHUB_SECRET") ?? env.AUTH_GITHUB_SECRET),
    );
    const googleEnabled = Boolean(
      (runtimeSecret("AUTH_GOOGLE_ID") ?? env.AUTH_GOOGLE_ID) &&
        (runtimeSecret("AUTH_GOOGLE_SECRET") ?? env.AUTH_GOOGLE_SECRET),
    );
    const appleEnabled = Boolean(
      env.AUTH_APPLE_ID && env.AUTH_APPLE_SECRET,
    );
    const showMagicLink = env.BYPASS_MAGIC_LINK || !omniauthEnabled;
    const socialFallback = githubEnabled || googleEnabled || appleEnabled;

    return (
      <div className="flex w-full flex-col items-center gap-4">
        {omniauthEnabled ? (
          <>
            <p className="w-full text-center text-sm text-muted-foreground">
              Use your OMNIDAT OmniAuth account (passkey preferred).
            </p>
            <SocialSignInButton
              provider="omniauth"
              label="Sign in with OmniAuth"
              primary
            />
          </>
        ) : (
          <p className="w-full text-center text-sm text-amber-200/90">
            OmniAuth is not configured on this deployment. Contact an operator.
          </p>
        )}

        {socialFallback ? (
          <>
            <div className="flex w-full items-center gap-3 py-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-muted-foreground text-sm">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            {githubEnabled ? (
              <SocialSignInButton provider="github" label="Sign in with GitHub" />
            ) : null}
            {googleEnabled ? (
              <SocialSignInButton provider="google" label="Sign in with Google" />
            ) : null}
            {appleEnabled ? (
              <SocialSignInButton provider="apple" label="Sign in with Apple" />
            ) : null}
          </>
        ) : null}

        {showMagicLink ? (
          <>
            <div className="flex w-full items-center gap-3 py-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-muted-foreground text-sm">lab only</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <MagicLinkForm bypassMagicLink={env.BYPASS_MAGIC_LINK} />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center justify-center gap-4">
      <p className="text-center text-2xl">
        <span>Logged in as {session.user.name}</span>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        {session.user.email}
      </p>
      <PasskeySoftEnroll
        signedIn
        userEmail={session.user.email}
      />
      <div className="flex w-full flex-wrap justify-center gap-2">
        <Button asChild size="lg" variant="default">
          <Link href="/console">Operator Console</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/noc">NOC</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/operator-admin">Admin</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/what-is-real">What is real</Link>
        </Button>
      </div>
      <form className="w-full">
        <Button
          className="w-full"
          size="lg"
          variant="outline"
          formAction={async () => {
            "use server";
            await auth.api.signOut({
              headers: await headers(),
            });
            redirect("/login");
          }}
        >
          Sign out
        </Button>
      </form>
    </div>
  );
}

function SocialSignInButton({
  provider,
  label,
  primary = false,
}: {
  provider: "github" | "google" | "apple" | "omniauth";
  label: string;
  primary?: boolean;
}) {
  return (
    <form className="w-full">
      <Button
        className="w-full"
        size="lg"
        variant={primary ? "default" : "outline"}
        formAction={async () => {
          "use server";
          const requestHeaders = new Headers(await headers());
          const caller = appRouter.createCaller(
            await createTRPCContext({
              headers: requestHeaders,
              authApi: auth.api,
            }),
          );
          const settingsCaller = caller.settings as {
            getLaunchState: () => Promise<{
              maintenanceMode: boolean;
              signupEnabled: boolean;
              canAutoCreateAccounts: boolean;
            }>;
          };
          const launchState = await settingsCaller.getLaunchState();

          if (launchState.maintenanceMode) {
            redirect("/?maintenance=1");
          }

          if (
            !launchState.signupEnabled &&
            !launchState.canAutoCreateAccounts
          ) {
            redirect("/?waitlist=1");
          }

          const res = await auth.api.signInSocial({
            body: {
              provider,
              callbackURL: "/console",
            },
          });
          if (!res.url) {
            throw new Error("No URL returned from signInSocial");
          }
          redirect(res.url);
        }}
      >
        {label}
      </Button>
    </form>
  );
}
