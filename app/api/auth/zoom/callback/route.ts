// app/api/auth/zoom/callback/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = process.env[name];
  return v && v.length ? v : null; // ★throwしない
}

export async function GET(req: Request) {
  // ★envチェックは必ずここで
  const ZOOM_CLIENT_ID = mustEnv("ZOOM_CLIENT_ID");
  const ZOOM_CLIENT_SECRET = mustEnv("ZOOM_CLIENT_SECRET");
  const ZOOM_REDIRECT_URI = mustEnv("ZOOM_REDIRECT_URI");
  const OAUTH_STATE_SECRET = mustEnv("OAUTH_STATE_SECRET");

  // もし Supabase を使っているならこれもここでチェック
  const SUPABASE_URL = mustEnv("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (
    !ZOOM_CLIENT_ID ||
    !ZOOM_CLIENT_SECRET ||
    !ZOOM_REDIRECT_URI ||
    !OAUTH_STATE_SECRET
  ) {
    return NextResponse.json(
      {
        error: "Missing env (zoom)",
        missing: {
          ZOOM_CLIENT_ID: !ZOOM_CLIENT_ID,
          ZOOM_CLIENT_SECRET: !ZOOM_CLIENT_SECRET,
          ZOOM_REDIRECT_URI: !ZOOM_REDIRECT_URI,
          OAUTH_STATE_SECRET: !OAUTH_STATE_SECRET,
        },
      },
      { status: 500 }
    );
  }

  // ★Supabase client を使うなら GET の中で生成（トップレベル禁止）
  // const { createClient } = await import("@supabase/supabase-js");
  // const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    // ここに「今のZoom callbackの処理」を移植してください
    // （code/state取得→token交換→保存→return_toへ戻す、等）

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: "zoom oauth failed", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
