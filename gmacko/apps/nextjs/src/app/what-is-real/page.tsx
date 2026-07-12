import Link from "next/link";

/**
 * Public honesty page (H0 exit gate).
 * Simulation, operator tooling, and demo rails are real.
 * Event-critical utility, emergency services, and cash redemption are not promised.
 */
export default function WhatIsRealPage() {
  return (
    <main className="min-h-screen bg-[#16140f] px-5 py-8 text-[#f4ead2]">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link className="font-bold tracking-wide" href="/">
            OMNIDAT Exchange 88
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded border border-[#7a694f] px-3 py-2"
              href="/console"
            >
              Console
            </Link>
            <Link
              className="rounded border border-[#7a694f] px-3 py-2"
              href="/noc"
            >
              NOC
            </Link>
            <Link
              className="rounded border border-[#9ed783] px-3 py-2 text-[#9ed783]"
              href="/what-is-real"
            >
              What is real
            </Link>
          </div>
        </nav>

        <header className="rounded border border-[#4f3920] bg-[#211d15] p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#c0a36e]">
            Honesty ledger
          </p>
          <h1 className="mt-2 text-4xl font-black">What is real today</h1>
          <p className="mt-3 text-sm leading-7 text-[#d9cbb0]">
            OMNIDAT is a retro packet-data carrier for hacker camps. This page
            is the public contract: what works, what is still simulation, and
            what we refuse to overclaim.
          </p>
          <p className="mt-2 font-mono text-xs text-[#9a8a6e]">
            Last reviewed: 2026-07-13 · console.omnidat.cc / omnidat.cc
          </p>
        </header>

        <ClaimBlock
          tone="real"
          title="Real today"
          items={[
            "Simulation layer: weekend-scale camp sims, service map 8800–8824, directory, receipts, and evidence artifacts.",
            "Operator console (console.omnidat.cc): role-gated CRUD, VT100/XOT browser terminal, NOC board, packet sessions, evidence lists.",
            "Identity: OmniAuth via Authentik (auth.omnidat.cc) — passkey preferred, password fallback for bootstrap/recovery.",
            "Merchant demo rail: OmniBank/OmniBucks testnet on bucks.omnidat.cc with authorize/capture and POS/Verifone demo paths.",
            "Public edge: omnidat.cc Worker health, directory demos, and status surfaces.",
            "Authority model code: field/cloud split-authority journal, status, and failover transfer (drillable from NOC).",
          ]}
        />

        <ClaimBlock
          tone="partial"
          title="Working in lab / production-partial"
          items={[
            "Browser XOT CALL → packet session + packet-call-receipt evidence (lab and production console proven; not every field transport).",
            "Telnet PAD and Matrix bridge for MSG/MAIL/board — available as packages; field deploy is ops-gated.",
            "H1b operator lifecycle (events, campsites, allocations, provisioning, incidents) — API + UI; full multi-operator rehearsal still open.",
            "Vintage POS / ATM / ISO 8583 rails — coded and demoed; money policy sign-off still open.",
          ]}
        />

        <ClaimBlock
          tone="not"
          title="Not promised"
          items={[
            "Event-critical utility: OMNIDAT is not emergency comms, official event radio, medical dispatch, or guaranteed food logistics.",
            "Real cash redemption: OmniBucks / ShadyBucks are play-money unless a separately posted policy says otherwise.",
            "Field kit always-online authority: failover and journal exist; full multi-day camp rehearsal with hardware is not closed.",
            "Universal hardware bench: Verifone, VT100, POTS acoustic, MeshCore/Meshtastic paths are not all inventory-complete for every camp.",
            "Guaranteed SLA: this is a camp packet service under construction, not a carrier contract.",
          ]}
        />

        <section className="rounded border border-[#4f3920] bg-[#211d15] p-6">
          <h2 className="text-xl font-bold">Boundaries</h2>
          <dl className="mt-4 space-y-3 text-sm leading-6 text-[#d9cbb0]">
            <div>
              <dt className="font-semibold text-[#c0a36e]">OMNIDAT</dt>
              <dd>
                Packet Clearing, Exchange 88 services, operator/NOC tooling,
                evidence. Network authority is X.25-style; transports are
                access only.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[#c0a36e]">OmniBank / ShadyBucks</dt>
              <dd>
                Separate ledger surface (bucks.omnidat.cc). Shared IdP; money
                policy is independent of packet utility claims.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[#c0a36e]">ShadyTel / PBX</dt>
              <dd>
                Voice/POTS scaffolding exists; not a substitute for camp phone
                plant commitments.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[#c0a36e]">Event leadership</dt>
              <dd>
                Space, power, RF, and money boundaries require an explicit ask
                and opt-in. See leadership pilot materials in-repo.
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded border border-[#4f3920] bg-[#211d15] p-6">
          <h2 className="text-xl font-bold">Try the real surfaces</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link className="underline text-[#9ed783]" href="/console">
                Operator Console
              </Link>{" "}
              — provision, POS demo, VT100
            </li>
            <li>
              <Link className="underline text-[#9ed783]" href="/console/terminal">
                VT100 Terminal
              </Link>{" "}
              — CALL / DIR / EVIDENCE
            </li>
            <li>
              <Link className="underline text-[#9ed783]" href="/noc">
                NOC
              </Link>{" "}
              — circuit board, sessions, authority drill
            </li>
            <li>
              <a
                className="underline text-[#9ed783]"
                href="https://bucks.omnidat.cc/app/login"
              >
                OmniBank
              </a>{" "}
              — testnet fund desk &amp; SSO
            </li>
            <li>
              <a
                className="underline text-[#9ed783]"
                href="https://omnidat.cc"
              >
                omnidat.cc
              </a>{" "}
              — public Worker edge
            </li>
          </ul>
        </section>

        <p className="text-center font-mono text-xs text-[#9a8a6e]">
          Issued under Exchange 88 · keep claims honest · print receipts
        </p>
      </section>
    </main>
  );
}

function ClaimBlock(props: {
  tone: "real" | "partial" | "not";
  title: string;
  items: string[];
}) {
  const border =
    props.tone === "real"
      ? "border-[#4f6b3a] bg-[#1a2413]"
      : props.tone === "partial"
        ? "border-[#5c4a32] bg-[#211d15]"
        : "border-[#a1471f] bg-[#2c1a12]";
  const label =
    props.tone === "real"
      ? "text-[#9ed783]"
      : props.tone === "partial"
        ? "text-[#c0a36e]"
        : "text-[#f0a875]";

  return (
    <section className={`rounded border p-6 ${border}`}>
      <h2 className={`text-xl font-bold uppercase tracking-wide ${label}`}>
        {props.title}
      </h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-[#d9cbb0]">
        {props.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
