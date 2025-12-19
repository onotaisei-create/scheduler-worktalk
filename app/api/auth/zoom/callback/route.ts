// app/api/auth/zoom/callback/route.ts
import { NextResponse } from "next/server";
import { upsertIntegration } from "@/app/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function basicAuth(clientId: string, clientSecret: string) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

async function exchangeCodeForToken(code: string) {
  const clientId = process.env.ZOOM_CLIENT_ID!;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET!;
  const redirectUri = process.env.ZOOM_REDIRECT_URI!;

  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(clientId, clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope?: string;
  };
}

async function getZoomMe(accessToken: string) {
  const res = await fetch("https://api.zoom.us/v2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json as { id: string; email?: string };
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
    const me = await getZoomMe(token.access_token);

    await upsertIntegration(employeeId, {
      zoom_user_id: me.id,
      zoom_email: me.email ?? null,
      zoom_refresh_token: token.refresh_token,
      zoom_access_token: token.access_token,
      zoom_expiry: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    });

    const next = new URL(returnTo);
    next.searchParams.set("connected", "zoom");
    next.searchParams.set("employee_id", employeeId);

    return NextResponse.redirect(next.toString());
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "zoom oauth failed", detail: String(e?.message ?? e) }, { status: 500 });
  }
}
