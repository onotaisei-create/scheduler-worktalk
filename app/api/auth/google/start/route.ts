// app/api/auth/google/start/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const employeeId = url.searchParams.get("employee_id");
  const returnTo = url.searchParams.get("return_to") || process.env.APP_BASE_URL || "/";

  if (!employeeId) {
    return NextResponse.json({ error: "employee_id required" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI!;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");

  // state に employee_id / return_to を詰める
  authUrl.searchParams.set(
    "state",
    Buffer.from(JSON.stringify({ employeeId, returnTo })).toString("base64url")
  );

  return NextResponse.redirect(authUrl.toString());
}
