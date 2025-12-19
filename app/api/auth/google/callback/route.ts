// app/api/auth/google/callback/route.ts
import { NextResponse } from "next/server";
import { upsertIntegration } from "@/app/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function exchangeCodeForToken(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    id_token?: string;
    scope?: string;
    token_type?: string;
  };
}

async function getGoogleEmail(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return (json.email as string) || null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return NextResponse.json({ error: "code/state missing" }, { status: 400 });
    }

    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    const employeeId = decoded.employeeId as string;
    const returnTo = (decoded.returnTo as string) || process.env.APP_BASE_URL || "/";

    const token = await exchangeCodeForToken(code);
    const email = await getGoogleEmail(token.access_token);

    // refresh_token は初回だけ返らないケースがある（なので start で prompt=consent を強制してる）
    if (!token.refresh_token) {
      // 既に保存済みならそれを使えるので、ここでは更新しない
      await upsertIntegration(employeeId, {
        google_email: email,
        google_access_token: token.access_token,
        google_expiry: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      });
    } else {
      await upsertIntegration(employeeId, {
        google_email: email,
        google_refresh_token: token.refresh_token,
        google_access_token: token.access_token,
        google_expiry: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      });
    }

    const next = new URL(returnTo);
    next.searchParams.set("connected", "google");
    next.searchParams.set("employee_id", employeeId);

    return NextResponse.redirect(next.toString());
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "google oauth failed", detail: String(e?.message ?? e) }, { status: 500 });
  }
}
