// app/api/auth/google/callback/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { upsertIntegration } from "../../../../lib/integrations"; // ← @/ を使わず相対に固定

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = process.env[name];
  return v ? v : null;
}

function toBase64Url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, "base64");
}

type StatePayload = {
  employee_id?: string;
  employeeId?: string;
  return_to?: string;
  returnTo?: string;
  ts?: number;
  nonce?: string;
};

function verifyState(
  state: string,
  secret: string
): (StatePayload & { employee_id: string; return_to?: string }) | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;

  const expected = toBase64Url(crypto.createHmac("sha256", secret).update(payload).digest());
  if (expected !== sig) return null;

  try {
    const json = fromBase64Url(payload).toString("utf8");
    const parsed = JSON.parse(json) as StatePayload;

    const employee_id = (parsed.employee_id || parsed.employeeId || "").trim();
    const return_to = (parsed.return_to || parsed.returnTo || "").trim();
    if (!employee_id) return null;

    if (typeof parsed.ts === "number") {
      const ageMs = Math.abs(Date.now() - parsed.ts);
      if (ageMs > 30 * 60 * 1000) return null;
    }

    return { ...parsed, employee_id, return_to };
  } catch {
    return null;
  }
}

function resolveReturnTo(req: Request, stateReturnTo?: string) {
  const fixed = (process.env.APP_RETURN_TO_URL || "").trim();
  if (fixed) return fixed;

  if (stateReturnTo) {
    try {
      const u = new URL(stateReturnTo);
      const isVersionTest = u.pathname.startsWith("/version-test/");
      const callPath = isVersionTest ? "/version-test/call" : "/call";
      return `${u.origin}${callPath}`;
    } catch {
      // ignore
    }
  }

  try {
    const current = new URL(req.url);
    return `${current.origin}/call`;
  } catch {
    return "/call";
  }
}

export async function GET(req: Request) {
  try {
    const CLIENT_ID = mustEnv("GOOGLE_OAUTH_CLIENT_ID");
    const CLIENT_SECRET = mustEnv("GOOGLE_OAUTH_CLIENT_SECRET");
    const REDIRECT_URI = mustEnv("GOOGLE_OAUTH_REDIRECT_URI");
    const STATE_SECRET = mustEnv("OAUTH_STATE_SECRET");

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI || !STATE_SECRET) {
      return NextResponse.json(
        {
          error: "Missing env",
          missing: {
            GOOGLE_OAUTH_CLIENT_ID: !CLIENT_ID,
            GOOGLE_OAUTH_CLIENT_SECRET: !CLIENT_SECRET,
            GOOGLE_OAUTH_REDIRECT_URI: !REDIRECT_URI,
            OAUTH_STATE_SECRET: !STATE_SECRET,
          },
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state") || "";
    if (!code) return NextResponse.json({ error: "code missing" }, { status: 400 });

    const parsed = verifyState(state, STATE_SECRET);
    if (!parsed) return NextResponse.json({ error: "invalid state" }, { status: 400 });

    const employeeId = parsed.employee_id;
    const returnTo = resolveReturnTo(req, parsed.return_to);

    // code -> token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });

    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      return NextResponse.json({ error: "token exchange failed", raw: tokenText }, { status: 500 });
    }

    const tokenJson = JSON.parse(tokenText) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
      token_type?: string;
    };

    const expiryIso = new Date(Date.now() + tokenJson.expires_in * 1000).toISOString();

    // userinfo（email / sub）
    let googleEmail = "";
    let googleSub = "";
    try {
      const meRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
        cache: "no-store",
      });
      if (meRes.ok) {
        const me = await meRes.json();
        googleEmail = (me.email || "").toString();
        googleSub = (me.sub || "").toString();
      }
    } catch {
      // ignore
    }

    // ✅ Supabaseへ保存（型で落ちるのを避けるため as any）
    await upsertIntegration(
      employeeId,
      {
        provider: "google",
        provider_user_id: googleSub || null,
        email: googleEmail || null,
        google_access_token: tokenJson.access_token,
        google_refresh_token: tokenJson.refresh_token || null,
        google_expiry: expiryIso,
        google_email: googleEmail || null,
        scopes: tokenJson.scope || null,
        updated_at: new Date().toISOString(),
      } as any
    );

    // call に戻す
    const url = new URL(returnTo);
    url.searchParams.set("connected", "google");
    url.searchParams.set("google_auth", "ok");
    url.searchParams.set("employee_id", employeeId);
    if (googleEmail) url.searchParams.set("google_email", googleEmail);

    return NextResponse.redirect(url.toString());
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "server error", detail: String(e?.message ?? e) }, { status: 500 });
  }
}
