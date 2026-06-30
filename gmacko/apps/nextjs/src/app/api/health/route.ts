import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    service: "omnidat-v1",
    status: "healthy",
    database: "postgres-shared-fryos-v1",
    schema: process.env.OMNIDAT_DB_SCHEMA ?? "omnidat",
    hostname: "omnidat.gmac.io",
  });
}
