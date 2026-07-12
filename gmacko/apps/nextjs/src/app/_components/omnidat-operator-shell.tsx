import { appRouter, createTRPCContext } from "@omnidat/api";
import { headers } from "next/headers";
import Link from "next/link";

import { auth, getSession } from "~/auth/server";

type Active =
  | "home"
  | "console"
  | "terminal"
  | "noc"
  | "admin"
  | "login"
  | "what-is-real";

const NAV: { href: string; label: string; key: Active }[] = [
  { href: "/console", label: "Operator Console", key: "console" },
  { href: "/console/terminal", label: "VT100 Terminal", key: "terminal" },
  { href: "/noc", label: "NOC", key: "noc" },
  { href: "/operator-admin", label: "Admin", key: "admin" },
  { href: "/what-is-real", label: "What is real", key: "what-is-real" },
];

export async function OmnidatOperatorShell(props: {
  active: Active;
  title: string;
  eyebrow: string;
  description: string;
  children: React.ReactNode;
  requireAuth?: boolean;
}) {
  const session = await getSession();
  const requireAuth = props.requireAuth ?? true;

  let operatorMe: {
    userId: string;
    email: string | null;
    name: string | null;
    roles: string[];
    isBootstrapAdmin: boolean;
    canOperate: boolean;
  } | null = null;

  if (session?.user) {
    try {
      const heads = new Headers(await headers());
      heads.set("x-trpc-source", "rsc-operator-shell");
      const caller = appRouter.createCaller(
        await createTRPCContext({
          headers: heads,
          authApi: auth.api,
        }),
      );
      operatorMe = await caller.omnidat.operatorMe();
    } catch {
      operatorMe = null;
    }
  }

  const signedIn = Boolean(session?.user);
  const canOperate = Boolean(operatorMe?.canOperate);

  return (
    <main className="min-h-screen bg-[#16140f] px-5 py-8 text-[#f4ead2]">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link className="font-bold tracking-wide" href="/">
            OMNIDAT Exchange 88
          </Link>
          <div className="flex flex-wrap gap-2">
            {NAV.map((item) => {
              const active = item.key === props.active;
              return (
                <Link
                  key={item.href}
                  className={
                    active
                      ? "rounded border border-[#9ed783] px-3 py-2 text-[#9ed783]"
                      : "rounded border border-[#7a694f] px-3 py-2"
                  }
                  href={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              className={
                props.active === "login"
                  ? "rounded border border-[#9ed783] px-3 py-2 text-[#9ed783]"
                  : "rounded border border-[#7a694f] px-3 py-2"
              }
              href="/login"
            >
              {signedIn ? "Account" : "Login"}
            </Link>
          </div>
        </nav>

        <header className="rounded border border-[#4f3920] bg-[#211d15] p-5">
          <p className="text-sm font-semibold uppercase text-[#c0a36e]">
            {props.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-black">{props.title}</h1>
          <p className="mt-2 text-sm leading-6 text-[#d9cbb0]">
            {props.description}
          </p>
          <OperatorStatusStrip
            signedIn={signedIn}
            email={operatorMe?.email ?? session?.user.email ?? null}
            name={operatorMe?.name ?? session?.user.name ?? null}
            roles={operatorMe?.roles ?? []}
            isBootstrapAdmin={operatorMe?.isBootstrapAdmin ?? false}
            canOperate={canOperate}
          />
        </header>

        {requireAuth && !signedIn ? (
          <AuthRequiredCard />
        ) : requireAuth && signedIn && !canOperate ? (
          <NoRoleCard email={operatorMe?.email ?? session?.user.email ?? null} />
        ) : (
          props.children
        )}
      </section>
    </main>
  );
}

function OperatorStatusStrip(props: {
  signedIn: boolean;
  email: string | null;
  name: string | null;
  roles: string[];
  isBootstrapAdmin: boolean;
  canOperate: boolean;
}) {
  if (!props.signedIn) {
    return (
      <p className="mt-4 font-mono text-xs text-[#c0a36e]">
        AUTH: none · use OmniAuth at /login for operator capabilities
      </p>
    );
  }

  const roleLabel =
    props.roles.length > 0 ? props.roles.join(", ") : "none";

  return (
    <dl className="mt-4 grid gap-2 font-mono text-xs text-[#9ed783] sm:grid-cols-2">
      <div>
        OPERATOR: {props.name ?? "unknown"}
        {props.email ? ` <${props.email}>` : ""}
      </div>
      <div>
        ROLES: {roleLabel}
        {props.isBootstrapAdmin ? " · bootstrap-admin" : ""}
      </div>
      <div className="sm:col-span-2">
        CAPABILITY: {props.canOperate ? "operator-ready" : "read-only / blocked"}
      </div>
    </dl>
  );
}

function AuthRequiredCard() {
  return (
    <section className="rounded border border-[#7a694f] bg-[#211d15] p-6">
      <h2 className="text-xl font-bold text-[#f2cf8b]">Authorized access required</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d9cbb0]">
        Sign in with OmniAuth (auth.omnidat.cc) to use the operator console, NOC
        live boards, and admin registry. Passkeys are preferred; password is
        fallback.
      </p>
      <div className="mt-4">
        <Link
          className="inline-block rounded bg-[#d8b46f] px-4 py-3 font-semibold text-[#16140f]"
          href="/login"
        >
          Sign in with OmniAuth
        </Link>
      </div>
    </section>
  );
}

function NoRoleCard(props: { email: string | null }) {
  return (
    <section className="rounded border border-[#7a694f] bg-[#211d15] p-6">
      <h2 className="text-xl font-bold text-[#f2cf8b]">Operator role required</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d9cbb0]">
        You are signed in
        {props.email ? ` as ${props.email}` : ""}, but no OMNIDAT operator role
        is granted. An admin must grant a role, or your email/user id must be
        listed in <code className="text-[#9ed783]">OMNIDAT_BOOTSTRAP_ADMINS</code>.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          className="rounded border border-[#7a694f] px-3 py-2 text-sm"
          href="/login"
        >
          Account
        </Link>
        <Link className="rounded border border-[#7a694f] px-3 py-2 text-sm" href="/">
          Public directory
        </Link>
      </div>
    </section>
  );
}
