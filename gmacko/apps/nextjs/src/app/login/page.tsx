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
            ShadyTel SSO will become the authoritative identity provider. For
            v1, create-gmacko auth lets operators access PDF configuration,
            provisioning, and administrative network views.
          </p>
          <pre className="mt-6 overflow-x-auto rounded border border-[#7a694f] bg-black p-4 font-mono text-sm leading-6 text-[#8ee36c]">
            {`LOGIN OMNIDAT
AUTH REALM EXCHANGE-88
SSO SHADYTEL PENDING
STATUS LOCAL-AUTH ENABLED`}
          </pre>
        </div>
        <div className="rounded border border-[#4f3920] bg-[#211d15] p-6 text-foreground">
          <AuthShowcase />
        </div>
      </section>
    </main>
  );
}
