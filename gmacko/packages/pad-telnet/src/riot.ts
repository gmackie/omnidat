// riot Discord-mirror directory discovery.
//
// riot's Packet Clearing daemon advertises its guild mirrors via a DIRECTORY
// command. We fetch that once (and refresh periodically) so riot's X.121
// addresses appear in OMNIDAT's own DIR and can be CALLed directly — the relay
// then auto-enters the guild. Kept transparent: we only parse the directory
// lines (address + name); everything else about riot stays riot's business.

import net from "node:net";

export interface RiotEntry {
  address: string;
  name: string;
}

/** Parse riot DIRECTORY lines: "020600  RIOT ...  OMNIDAT Field Office  discord:...". */
export function parseRiotDirectory(text: string): RiotEntry[] {
  const entries: RiotEntry[] = [];
  for (const line of text.split(/\r?\n/u)) {
    const m = line.match(/^(\d{6})\s{2,}(.+)$/u);
    if (!m) continue;
    // Columns are 2+ space separated; the guild name is the human column,
    // preferring the one before a "discord:" reference if present.
    const cols = m[2]!.split(/\s{2,}/u).map((c) => c.trim());
    const discordIdx = cols.findIndex((c) => /^discord:/iu.test(c));
    const name =
      discordIdx > 0 ? cols[discordIdx - 1]! : (cols[cols.length - 1] ?? cols[0] ?? "");
    entries.push({ address: m[1]!, name });
  }
  return entries;
}

/**
 * Fetch riot's directory over its Packet Clearing TCP daemon. Connects, sends
 * DIRECTORY, collects output until the line stream goes idle, then parses. On
 * any failure returns [] — riot being down must never break the PAD's DIR.
 */
export function fetchRiotDirectory(
  host: string,
  port: number,
  timeoutMs = 2500,
): Promise<RiotEntry[]> {
  return new Promise((resolve) => {
    let buf = "";
    let idle: ReturnType<typeof setTimeout> | undefined;
    const socket = net.connect(port, host);
    const done = () => {
      clearTimeout(hardStop);
      if (idle) clearTimeout(idle);
      socket.destroy();
      resolve(parseRiotDirectory(buf));
    };
    const hardStop = setTimeout(done, timeoutMs);
    socket.setNoDelay(true);
    socket.on("connect", () => socket.write("DIRECTORY\r\n"));
    socket.on("data", (chunk: Buffer) => {
      buf += chunk.toString("binary");
      if (idle) clearTimeout(idle);
      // The directory has arrived once the stream pauses briefly.
      idle = setTimeout(done, 250);
    });
    socket.on("error", () => {
      clearTimeout(hardStop);
      if (idle) clearTimeout(idle);
      resolve([]);
    });
    socket.on("close", () => {
      clearTimeout(hardStop);
      if (idle) clearTimeout(idle);
      resolve(parseRiotDirectory(buf));
    });
  });
}
