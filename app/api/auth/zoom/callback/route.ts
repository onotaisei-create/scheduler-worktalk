// app/api/auth/zoom/callback/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = process.env[name];
  return v && v.length ? v : null;
}

function base64url(input: Buffer) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function verifyState(state: string, secret: string) {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;

  const expected = base64url(crypto.createHmac("sha256", secret).update(payload).digest());
  if (expected !== sig) return null;

  const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  const parsed = JSON.parse(json) as {
    employee_id: string;
    return_to: string;
    ts?: number;
    nonce?: string;
  };
  return parsed;
}

function parseTokenResponse(text: string) {
  // 1) JSONとして読めるならJSON
  try {
    const obj = JSON.parse(text);
    return { ok: true as const, data: obj, kind: "json" as const };
  } catch {}

  // 2) access_token=...&... の形式ならURLSearchParams
  const sp = new URLSearchParams(text.trim());
  if (sp.get("access_token")) {
    const obj: Record<string, string> = {};
    sp.forEach((v, k) => (obj[k] = v));
    return { ok: true as const, data: obj, kind: "form" as const };
  }

  return { ok: false as const, data: null, kind: "unknown" as const };
}

export async function GET(req: Request) {
  const ZOOM_CLIENT_ID = mustEnv("ZOOM_CLIENT_ID");
  const ZOOM_CLIENT_SECRET = mustEnv("ZOOM_CLIENT_SECRET");
  const ZOOM_REDIRECT_URI = mustEnv("ZOOM_REDIRECT_URI");
  const STATE_SECRET = mustEnv("OAUTH_STATE_SECRET");

  // 任意：Bubbleへ保存する場合
  const BUBBLE_SAVE_ZOOM_TOKEN_URL = process.env.BUBBLE_SAVE_ZOOM_TOKEN_URL || "";
  const SCHEDULER_API_KEY = process.env.SCHEDULER_API_KEY || "";

  if (!ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET || !ZOOM_REDIRECT_URI || !STATE_SECRET) {
    return NextResponse.json(
      {
        error: "Missing env (zoom)",
        missing: {
          ZOOM_CLIENT_ID: !!ZOOM_CLIENT_ID,
          ZOOM_CLIENT_SECRET: !!ZOOM_CLIENT_SECRET,
          ZOOM_REDIRECT_URI: !!ZOOM_REDIRECT_URI,
          OAUTH_STATE_SECRET: !!STATE_SECRET,
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

    const employeeId = parsed.employee_id || "";
    const returnTo = parsed.return_to || process.env.APP_BASE_URL || "/";

    // code -> token
    const basic = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64");

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

    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      return NextResponse.json(
        { error: "token exchange failed", status: tokenRes.status, raw: tokenText },
        { status: 500 }
      );
    }

    const parsedToken = parseTokenResponse(tokenText);
    if (!parsedToken.ok) {
      return NextResponse.json(
        { error: "token parse failed", raw: tokenText },
        { status: 500 }
      );
    }

    const token = parsedToken.data as any;

    // Bubbleに保存（任意）
    if (BUBBLE_SAVE_ZOOM_TOKEN_URL) {
      const saveRes = await fetch(BUBBLE_SAVE_ZOOM_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-scheduler-api-key": SCHEDULER_API_KEY,
        },
        body: JSON.stringify({
          employee_id: employeeId,
          access_token: token.access_token || "",
          refresh_token: token.refresh_token || "",
          expires_in: Number(token.expires_in || 0),
          token_type: token.token_type || "",
          scope: token.scope || "",
        }),
        cache: "no-store",
      });

      if (!saveRes.ok) {
        const t = await saveRes.text();
        return NextResponse.json(
          { error: "failed to save token to bubble", raw: t },
          { status: 500 }
        );
      }
    }

    // 元のBubbleページ(call)へ戻す
    const next = new URL(returnTo);
    next.searchParams.set("connected", "zoom");
    next.searchParams.set("employee_id", employeeId);
    return NextResponse.redirect(next.toString());
  } catch (e: any) {
    return NextResponse.json(
      { error: "zoom oauth failed", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
