// app/api/auth/zoom/start/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES = [
  "meeting:write:meeting",
  "user:read:user",
];

function mustEnv(name: string) {
  const v = process.env[name];
  return v && v.length ? v : null;
}

function signState(payloadObj: any, secret: string) {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${payload}.${sig}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const employeeId = url.searchParams.get("employee_id");
  const returnTo = url.searchParams.get("return_to") || process.env.APP_BASE_URL || "/";

  if (!employeeId) {
    return NextResponse.json({ error: "employee_id required" }, { status: 400 });
  }

  const ZOOM_CLIENT_ID = mustEnv("ZOOM_CLIENT_ID");
  const ZOOM_REDIRECT_URI = mustEnv("ZOOM_REDIRECT_URI");
  const OAUTH_STATE_SECRET = mustEnv("OAUTH_STATE_SECRET");

  if (!ZOOM_CLIENT_ID || !ZOOM_REDIRECT_URI || !OAUTH_STATE_SECRET) {
    return NextResponse.json(
      { error: "Missing env (zoom)", missing: { ZOOM_CLIENT_ID: !!ZOOM_CLIENT_ID, ZOOM_REDIRECT_URI: !!ZOOM_REDIRECT_URI, OAUTH_STATE_SECRET: !!OAUTH_STATE_SECRET } },
      { status: 500 }
    );
  }

  const state = signState(
    { employee_id: employeeId, return_to: returnTo, ts: Date.now(), nonce: crypto.randomBytes(8).toString("hex") },
    OAUTH_STATE_SECRET
  );

  const authUrl = new URL("https://zoom.us/oauth/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", ZOOM_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", ZOOM_REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
