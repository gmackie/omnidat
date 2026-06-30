import { buildSignupReceipt } from "@omnidat/operator-core/omnidat";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const campsiteName = String("campsiteName" in body ? body.campsiteName : "").trim();
  const namespace = String("namespace" in body ? body.namespace : "camp").trim();
  const contact = String("contact" in body ? body.contact : "").trim();
  const transport = String("transport" in body ? body.transport : "").trim();

  if (!campsiteName || !namespace || !contact || !transport) {
    return NextResponse.json({ error: "missing_required_signup_field" }, { status: 400 });
  }

  return NextResponse.json(
    buildSignupReceipt({ campsiteName, namespace, contact, transport }),
    { status: 202 },
  );
}
