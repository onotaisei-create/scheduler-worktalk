// app/api/auth/google/start/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = process.env[name];
  return v && v.length ? v : null;
}

function signState(payload: string, secret: string) {
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
  const CLIENT_ID = mustEnv("GOOGLE_OAUTH_CLIENT_ID");
  const REDIRECT_URI = mustEnv("GOOGLE_OAUTH_REDIRECT_URI");
  const STATE_SECRET = mustEnv("OAUTH_STATE_SECRET");

  // return_to を固定したい場合のデフォルト（未設定なら / ）
  const DEFAULT_RETURN_TO =
    process.env.APP_RETURN_TO_URL || process.env.APP_BASE_URL || "/";

  if (!CLIENT_ID || !REDIRECT_URI || !STATE_SECRET) {
    return NextResponse.json(
      {
        error: "Missing env",
        missing: {
          GOOGLE_OAUTH_CLIENT_ID: !!CLIENT_ID,
          GOOGLE_OAUTH_REDIRECT_URI: !!REDIRECT_URI,
          OAUTH_STATE_SECRET: !!STATE_SECRET,
        },
      },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const employeeId = url.searchParams.get("employee_id") || "";
  const returnTo = url.searchParams.get("return_to") || DEFAULT_RETURN_TO;

  if (!employeeId) {
    return NextResponse.json({ error: "employee_id required" }, { status: 400 });
  }

  // state payload（base64url）
  const payloadObj = {
    employee_id: employeeId,
    return_to: returnTo,
    ts: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  };
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
  const state = signState(payload, STATE_SECRET);

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent"); // refresh_tokenを安定して取る
  authUrl.searchParams.set(
    "scope",
    [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar",
    ].join(" ")
  );
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
