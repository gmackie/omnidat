import {
  omnidatDirectoryEntries,
  omnidatTransportProfiles,
  renderDirectoryText,
} from "@omnidat/operator-core/omnidat";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#15110b] text-[#f3e4bf]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8">
        <header className="rounded-md border border-[#6f5128] bg-[#20180f] p-6">
          <p className="text-sm font-semibold uppercase text-[#b98b45]">
            Exchange 88 v1 field office
          </p>
          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            OMNIDAT Field Office
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#e4d2aa]">
            Campsites can request packet names, publish terminal applications,
            and connect through LoRa, Wi-Fi, POTS, ShadyTel, or hosted OMNIDAT
            infrastructure.
          </p>
          <pre className="mt-6 overflow-x-auto rounded-md border border-[#b98b45] bg-black p-4 text-sm leading-6 text-[#9be07a]">
            {`OMNIDAT 88 READY
CALL 010110
CONNECT PACKET CLEARING DIRECTORY
DIR
${renderDirectoryText()}`}
          </pre>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-md border border-[#4f3920] bg-[#1d160f] p-5">
            <h2 className="text-lg font-bold text-[#f6d78f]">Join</h2>
            <p className="mt-2 text-sm leading-6 text-[#d9c59c]">
              Submit a campsite signup request for the open camp namespace and
              receive a queued packet clearing receipt.
            </p>
          </div>
          <div className="rounded-md border border-[#4f3920] bg-[#1d160f] p-5">
            <h2 className="text-lg font-bold text-[#f6d78f]">Create Apps</h2>
            <p className="mt-2 text-sm leading-6 text-[#d9c59c]">
              Publish message desks, Miliways order entry, activity passports,
              badge claims, and other terminal-native camp services.
            </p>
          </div>
          <div className="rounded-md border border-[#4f3920] bg-[#1d160f] p-5">
            <h2 className="text-lg font-bold text-[#f6d78f]">Connect</h2>
            <p className="mt-2 text-sm leading-6 text-[#d9c59c]">
              Bring a local node over MeshCore, Meshtastic, Wi-Fi, POTS, or use
              shared ShadyTel/OMNIDAT hosting for v1.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold">Directory</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {omnidatDirectoryEntries.map((entry) => (
              <article
                className="rounded-md border border-[#4f3920] bg-[#1d160f] p-4"
                key={entry.address}
              >
                <p className="text-sm text-[#b98b45]">{entry.address}</p>
                <h3 className="mt-1 font-semibold">{entry.name}</h3>
                <p className="mt-2 text-xs uppercase text-[#a9936f]">
                  {entry.kind}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold">Transport Profiles</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {omnidatTransportProfiles.map((profile) => (
              <article
                className="rounded-md border border-[#4f3920] bg-[#1d160f] p-4"
                key={profile.name}
              >
                <h3 className="font-semibold text-[#f6d78f]">{profile.name}</h3>
                <p className="mt-2 text-sm leading-6 text-[#d9c59c]">
                  {profile.description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
