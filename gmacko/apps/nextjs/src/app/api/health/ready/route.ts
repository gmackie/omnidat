import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

  return NextResponse.json(
    {
      service: "omnidat-v1",
      status: hasDatabaseUrl ? "ready" : "degraded",
      database: "postgres-shared-fryos-v1",
      schema: process.env.OMNIDAT_DB_SCHEMA ?? "omnidat",
      checks: {
        databaseUrl: hasDatabaseUrl,
      },
    },
    { status: hasDatabaseUrl ? 200 : 503 },
  );
}
