// app/api/auth/zoom/callback/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { upsertIntegration } from "@/app/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = process.env[name];
  return v && v.length ? v : null;
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

function verifyState(state: string, secret: string): (StatePayload & { employee_id: string; return_to?: string }) | null {
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
    } catch {}
  }

  try {
    const current = new URL(req.url);
    return `${current.origin}/call`;
  } catch {
    return "/call";
  }
}

export async function GET(req: Request) {
  const ZOOM_CLIENT_ID = mustEnv("ZOOM_CLIENT_ID");
  const ZOOM_CLIENT_SECRET = mustEnv("ZOOM_CLIENT_SECRET");
  const ZOOM_REDIRECT_URI = mustEnv("ZOOM_REDIRECT_URI");
  const STATE_SECRET = mustEnv("OAUTH_STATE_SECRET");

  if (!ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET || !ZOOM_REDIRECT_URI || !STATE_SECRET) {
    return NextResponse.json(
      {
        error: "Missing env (zoom)",
        missing: {
          ZOOM_CLIENT_ID: !ZOOM_CLIENT_ID,
          ZOOM_CLIENT_SECRET: !ZOOM_CLIENT_SECRET,
          ZOOM_REDIRECT_URI: !ZOOM_REDIRECT_URI,
          OAUTH_STATE_SECRET: !STATE_SECRET,
        },
      },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state") || "";

    if (!code) return NextResponse.json({ error: "code missing" }, { status: 400 });

    const parsed = verifyState(state, STATE_SECRET);
    if (!parsed) return NextResponse.json({ error: "invalid state" }, { status: 400 });

    const employeeId = parsed.employee_id;
    const returnTo = resolveReturnTo(req, parsed.return_to);

    const basic = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64");

    // code -> token
    const tokenRes = await fetch("https://zoom.us/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: ZOOM_REDIRECT_URI,
      }),
      cache: "no-store",
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      return NextResponse.json({ error: "token exchange failed", raw: tokenJson }, { status: 500 });
    }

    const accessToken = String(tokenJson.access_token || "");
    const refreshToken = String(tokenJson.refresh_token || "");
    const expiresIn = Number(tokenJson.expires_in || 0);
    const scope = String(tokenJson.scope || "");
    const expiryIso = new Date(Date.now() + expiresIn * 1000).toISOString();

    // users/me で zoom user id / email を取る
    let zoomUserId = "";
    let zoomEmail = "";
    try {
      const meRes = await fetch("https://api.zoom.us/v2/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (meRes.ok) {
        const me = await meRes.json();
        zoomUserId = String(me.id || "");
        zoomEmail = String(me.email || "");
      }
    } catch {
      // ignore
    }

    // ✅ Supabaseへ upsert（employee_id + provider=zoom）
    await upsertIntegration(employeeId, {
      provider: "zoom",
      provider_user_id: zoomUserId || null,
      email: zoomEmail || null,

      zoom_access_token: accessToken || null,
      zoom_refresh_token: refreshToken || null,
      zoom_expiry: expiryIso,

      zoom_user_id: zoomUserId || null,
      zoom_email: zoomEmail || null,

      scopes: scope || null,
      updated_at: new Date().toISOString(),
    });

    // call に戻す
    const url = new URL(returnTo);
    url.searchParams.set("connected", "zoom");
    url.searchParams.set("zoom_auth", "ok");
    url.searchParams.set("employee_id", employeeId);
    if (zoomEmail) url.searchParams.set("zoom_email", zoomEmail);

    return NextResponse.redirect(url.toString());
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "zoom oauth failed", detail: String(e?.message ?? e) }, { status: 500 });
  }
}
