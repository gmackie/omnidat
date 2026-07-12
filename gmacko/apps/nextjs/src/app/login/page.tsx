import Link from "next/link";

import { AuthShowcase } from "../_components/auth-showcase";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#16140f] px-5 py-10 text-[#f4ead2]">
      <section className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Link className="text-sm underline" href="/">
            Back to OMNIDAT
          </Link>
          <p className="mt-8 text-sm font-semibold uppercase text-[#c0a36e]">
            Operator Authentication
          </p>
          <h1 className="mt-2 text-4xl font-black">Login</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#d9cbb0]">
            Sign in with OmniAuth (auth.omnidat.cc). Passkeys are preferred;
            password is available as fallback. After login you can open the
            Operator Console, NOC, and Admin surfaces.
          </p>
          <pre className="mt-6 overflow-x-auto rounded border border-[#7a694f] bg-black p-4 font-mono text-sm leading-6 text-[#8ee36c]">
            {`LOGIN OMNIDAT
AUTH REALM EXCHANGE-88
IDP auth.omnidat.cc
METHOD PASSKEY (PRIMARY) / PASSWORD (FALLBACK)
STATUS OMNIAUTH ENABLED`}
          </pre>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            <Link className="rounded border border-[#7a694f] px-3 py-2" href="/console">
              Operator Console
            </Link>
            <Link className="rounded border border-[#7a694f] px-3 py-2" href="/noc">
              NOC
            </Link>
            <Link className="rounded border border-[#7a694f] px-3 py-2" href="/operator-admin">
              Admin
            </Link>
          </div>
        </div>
        <div className="rounded border border-[#4f3920] bg-[#211d15] p-6 text-foreground">
          <AuthShowcase />
        </div>
      </section>
    </main>
  );
}
