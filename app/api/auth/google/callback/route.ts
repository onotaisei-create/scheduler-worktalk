// app/api/auth/google/callback/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 必須 env（なければ null）
 * ※throwしないのはあなたの方針に合わせてます
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
  // padding を補う
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

    // employee_id は必須
    if (!employee_id) return null;

    // ts が入ってるなら、古すぎる state を弾く（例：30分）
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
 * 「最終的に戻すURL」を確定する
 *
 * ✅ 最優先：APP_RETURN_TO_URL（本番/テストで固定して“必ず call に戻す”）
 * ✅ env が未設定の時のみ、state.return_to から “/call に矯正” して使う
 *
 * これで admin_connect 等に飛ぶ事故を防げます。
 */
function resolveReturnTo(req: Request, stateReturnTo?: string) {
  const fixed = (process.env.APP_RETURN_TO_URL || "").trim();
  if (fixed) return fixed;

  // envが無い場合の保険：stateのreturn_toがあっても、必ず /call に戻す
  if (stateReturnTo) {
    try {
      const u = new URL(stateReturnTo);

      // version-test なら version-test/call、それ以外は /call
      const isVersionTest = u.pathname.startsWith("/version-test/");
      const callPath = isVersionTest ? "/version-test/call" : "/call";

      return `${u.origin}${callPath}`;
    } catch {
      // ignore
    }
  }

  // さらに保険：今アクセスしてるリクエストURLの origin を使って /call
  try {
    const current = new URL(req.url);
    return `${current.origin}/call`;
  } catch {
    return "/call";
  }
}

export async function GET(req: Request) {
  const CLIENT_ID = mustEnv("GOOGLE_OAUTH_CLIENT_ID");
  const CLIENT_SECRET = mustEnv("GOOGLE_OAUTH_CLIENT_SECRET");
  const REDIRECT_URI = mustEnv("GOOGLE_OAUTH_REDIRECT_URI");
  const STATE_SECRET = mustEnv("OAUTH_STATE_SECRET");

  // Bubbleへ保存（任意）
  const BUBBLE_SAVE_GOOGLE_TOKEN_URL = (process.env.BUBBLE_SAVE_GOOGLE_TOKEN_URL || "").trim();
  const SCHEDULER_API_KEY = (process.env.SCHEDULER_API_KEY || "").trim();

  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI || !STATE_SECRET) {
    return NextResponse.json(
      {
        error: "Missing env",
        hint:
          "Vercelの環境変数に GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI / OAUTH_STATE_SECRET を設定して再デプロイしてください。加えて、本番/テストで必ずcallに戻すなら APP_RETURN_TO_URL も設定してください。",
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

  // ★ここで戻り先を「call固定」に確定（admin_connect等には戻さない）
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

  // 永続保存：BubbleにPOST（任意）
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
          error: "failed to save token to bubble",
          hint: "Bubbleの保存用API(backend workflow)が未作成 / URL違い / APIキー検証で落ちてる可能性があります。",
          raw: t,
        },
        { status: 500 }
      );
    }
  }

  // ✅ 認証完了 → “必ず call” に戻す
  // bubble側で使いやすいようにパラメータも統一して付与
  const url = new URL(returnTo);
  url.searchParams.set("connected", "google");
  url.searchParams.set("google_auth", "ok");
  url.searchParams.set("employee_id", employeeId);
  if (googleEmail) url.searchParams.set("google_email", googleEmail);

  return NextResponse.redirect(url.toString());
}
