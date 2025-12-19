// app/api/auth/zoom/start/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES = [
  "meeting:write",
  "user:read",
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const employeeId = url.searchParams.get("employee_id");
  const returnTo = url.searchParams.get("return_to") || process.env.APP_BASE_URL || "/";

  if (!employeeId) {
    return NextResponse.json({ error: "employee_id required" }, { status: 400 });
  }

  const clientId = process.env.ZOOM_CLIENT_ID!;
  const redirectUri = process.env.ZOOM_REDIRECT_URI!;

  const authUrl = new URL("https://zoom.us/oauth/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set(
    "state",
    Buffer.from(JSON.stringify({ employeeId, returnTo })).toString("base64url")
  );

  return NextResponse.redirect(authUrl.toString());
}
