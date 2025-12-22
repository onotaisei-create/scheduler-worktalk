// app/api/auth/google/start/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

function mustEnv(name: string) {
  const v = process.env[name];
  return v && v.length ? v : null;
}

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signState(payloadB64Url: string, secret: string) {
  const sig = crypto
    .createHmac("sha256", secret)
    .update(payloadB64Url)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${payloadB64Url}.${sig}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  // Bubbleから来るパラメータ
  const employeeId = url.searchParams.get("employee_id") || "";
  const returnTo = url.searchParams.get("return_to") || process.env.APP_BASE_URL || "/";

  if (!employeeId) {
    return NextResponse.json({ error: "employee_id required" }, { status: 400 });
  }

  const clientId = mustEnv("GOOGLE_OAUTH_CLIENT_ID");
  const redirectUri = mustEnv("GOOGLE_OAUTH_REDIRECT_URI");
  const stateSecret = mustEnv("OAUTH_STATE_SECRET");

  if (!clientId || !redirectUri || !stateSecret) {
    return NextResponse.json(
      {
        error: "Missing env",
        missing: {
          GOOGLE_OAUTH_CLIENT_ID: !!clientId,
          GOOGLE_OAUTH_REDIRECT_URI: !!redirectUri,
          OAUTH_STATE_SECRET: !!stateSecret,
        },
      },
      { status: 500 }
    );
  }

  // callback側が読む形（snake_case）に合わせる
  const payloadObj = {
    employee_id: employeeId,
    return_to: returnTo,
    ts: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const payloadB64Url = base64url(JSON.stringify(payloadObj));
  const state = signState(payloadB64Url, stateSecret);

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
