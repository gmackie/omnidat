import { omnidatDirectoryEntries } from "@omnidat/operator-core/omnidat";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    service: "omnidat-v1",
    apps: omnidatDirectoryEntries.filter((entry) => entry.kind === "campsite-app"),
  });
}
