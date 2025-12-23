// app/api/auth/google/callback/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 必須 env（なければ null）
 */
function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) return null;
  return v;
}

/**
 * base64url helpers
 */
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
      const now = Date.now();
      const ageMs = Math.abs(now - parsed.ts);
      if (ageMs > 30 * 60 * 1000) return null;
    }

    return { ...parsed, employee_id, return_to };
  } catch {
    return null;
  }
}

/**
 * 「最終的に戻すURL」を確定する（call固定）
 */
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

/**
 * Supabase Admin Client（Service Role）
 * - SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */
function getSupabaseAdmin() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { "X-Client-Info": "scheduler-worktalk" } },
  });
}

export async function GET(req: Request) {
  const CLIENT_ID = mustEnv("GOOGLE_OAUTH_CLIENT_ID");
  const CLIENT_SECRET = mustEnv("GOOGLE_OAUTH_CLIENT_SECRET");
  const REDIRECT_URI = mustEnv("GOOGLE_OAUTH_REDIRECT_URI");
  const STATE_SECRET = mustEnv("OAUTH_STATE_SECRET");

  // Bubbleへ保存（任意）
  const BUBBLE_SAVE_GOOGLE_TOKEN_URL = (process.env.BUBBLE_SAVE_GOOGLE_TOKEN_URL || "").trim();
  const SCHEDULER_API_KEY = (process.env.SCHEDULER_API_KEY || "").trim();

  // Supabase（必須：この修正の主役）
  const supabase = getSupabaseAdmin();

  const missing: Record<string, boolean> = {
    GOOGLE_OAUTH_CLIENT_ID: !CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: !CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI: !REDIRECT_URI,
    OAUTH_STATE_SECRET: !STATE_SECRET,
    SUPABASE_URL_or_NEXT_PUBLIC_SUPABASE_URL: !((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()),
    SUPABASE_SERVICE_ROLE_KEY: !(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
  };

  if (
    !CLIENT_ID ||
    !CLIENT_SECRET ||
    !REDIRECT_URI ||
    !STATE_SECRET ||
    !supabase
  ) {
    return NextResponse.json(
      {
        error: "Missing env",
        hint:
          "Vercelの環境変数に以下を設定して再デプロイしてください。\n" +
          "- GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI / OAUTH_STATE_SECRET\n" +
          "- SUPABASE_URL（または NEXT_PUBLIC_SUPABASE_URL）\n" +
          "- SUPABASE_SERVICE_ROLE_KEY\n" +
          "（本番/テストで必ずcallに戻すなら APP_RETURN_TO_URL も推奨です）",
        missing,
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

  // code → token 交換
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
    id_token?: string;
    scope?: string;
    token_type?: string;
  };

  // email取得（任意）
  let googleEmail = "";
  try {
    const meRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      cache: "no-store",
    });
    if (meRes.ok) {
      const me = await meRes.json();
      googleEmail = me.email || "";
    }
  } catch {
    // ignore
  }

  // ✅ ここが重要：Supabaseへ必ず保存（employee_id + provider=google を upsert）
  const googleExpiry = new Date(Date.now() + tokenJson.expires_in * 1000).toISOString();

  const { error: upsertErr } = await supabase
    .from("employee_integrations")
    .upsert(
      {
        employee_id: employeeId,
        provider: "google",
        google_access_token: tokenJson.access_token,
        // refresh_tokenが返らないケースもあるので空は許容（既存があれば上書きしない方が理想だが、まずは確実に保存優先）
        google_refresh_token: tokenJson.refresh_token || null,
        google_expiry: googleExpiry,
        google_email: googleEmail || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "employee_id,provider" }
    );

  if (upsertErr) {
    return NextResponse.json(
      {
        error: "failed to upsert supabase",
        detail: upsertErr.message,
        employee_id: employeeId,
      },
      { status: 500 }
    );
  }

  // （任意）Bubbleへ保存：残したいならOK
  if (BUBBLE_SAVE_GOOGLE_TOKEN_URL) {
    const saveRes = await fetch(BUBBLE_SAVE_GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SCHEDULER_API_KEY ? { "x-scheduler-api-key": SCHEDULER_API_KEY } : {}),
      },
      body: JSON.stringify({
        employee_id: employeeId,
        google_email: googleEmail,
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token || "",
        expires_in: tokenJson.expires_in,
      }),
      cache: "no-store",
    });

    if (!saveRes.ok) {
      const t = await saveRes.text();
      return NextResponse.json(
        {
          error: "saved to supabase but failed to save token to bubble",
          hint:
            "Supabase保存は成功しています。Bubbleの保存用API(backend workflow)が未作成 / URL違い / APIキー検証で落ちてる可能性があります。",
          raw: t,
        },
        { status: 500 }
      );
    }
  }

  // ✅ 認証完了 → call に戻す
  const url = new URL(returnTo);
  url.searchParams.set("connected", "google");
  url.searchParams.set("google_auth", "ok");
  url.searchParams.set("employee_id", employeeId);
  if (googleEmail) url.searchParams.set("google_email", googleEmail);

  return NextResponse.redirect(url.toString());
}
