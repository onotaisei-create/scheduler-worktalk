// app/api/auth/google/start/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) return null;
  return v;
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
  return crypto
    .createHmac("sha256", secret)
    .update(payloadB64Url)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function GET(req: Request) {
  const CLIENT_ID = mustEnv("GOOGLE_OAUTH_CLIENT_ID");
  const REDIRECT_URI = mustEnv("GOOGLE_OAUTH_REDIRECT_URI");
  const STATE_SECRET = mustEnv("OAUTH_STATE_SECRET");

  if (!CLIENT_ID || !REDIRECT_URI || !STATE_SECRET) {
    return NextResponse.json(
      {
        error: "Missing env",
        hint:
          "Vercelの環境変数に GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_REDIRECT_URI / OAUTH_STATE_SECRET を設定して再デプロイしてください。",
        missing: {
          GOOGLE_OAUTH_CLIENT_ID: !!CLIENT_ID,
          GOOGLE_OAUTH_REDIRECT_URI: !!REDIRECT_URI,
          OAUTH_STATE_SECRET: !!STATE_SECRET,
        },
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);

  // Bubbleから渡す想定
  const employeeId = searchParams.get("employee_id") || "";
  const returnTo = searchParams.get("return_to") || "";

  if (!employeeId || !returnTo) {
    return NextResponse.json(
      { error: "employee_id / return_to missing" },
      { status: 400 }
    );
  }

  // state payload（署名対象）
  const payloadObj = {
    employee_id: employeeId,
    return_to: returnTo,
    ts: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  const payload = base64url(JSON.stringify(payloadObj));
  const sig = signState(payload, STATE_SECRET);
  const state = `${payload}.${sig}`;

  // OAuth URL
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline"); // refresh_token狙い
  authUrl.searchParams.set("prompt", "consent"); // refresh_tokenが返らない事故対策
  authUrl.searchParams.set("scope", [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar",
  ].join(" "));
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
