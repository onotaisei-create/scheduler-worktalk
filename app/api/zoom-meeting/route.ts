// app/api/zoom-meeting/route.ts

import { NextRequest, NextResponse } from "next/server";

type RequestBody = {
  topic?: string;
  start_time?: string; // Bubble から来る UTC の ISO 文字列（例: 2025-12-14T11:00:00.000Z）
  duration?: number;
  timezone?: string;
};

/**
 * UTC の ISO 文字列（"2025-12-14T11:00:00.000Z" など）を
 * Asia/Tokyo の「yyyy-MM-ddTHH:mm:ss」文字列に変換する
 */
function convertUtcToTokyoLocal(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid start_time: ${isoString}`);
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  const y = get("year");
  const m = get("month");
  const d = get("day");
  const h = get("hour");
  const mi = get("minute");
  const s = get("second");

  // Zoom に渡すローカル時間フォーマット: yyyy-MM-ddTHH:mm:ss
  return `${y}-${m}-${d}T${h}:${mi}:${s}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;

    const topic = body.topic || "WorkTalk カジュアル面談";
    const rawStartTime = body.start_time; // Bubble から来る UTC の ISO 文字列
    const duration = body.duration ?? 30; // 分
    const timezone = body.timezone || "Asia/Tokyo";

    if (!rawStartTime) {
      return NextResponse.json(
        { error: "start_time is required" },
        { status: 400 }
      );
    }

    // UTC → Tokyo のローカル時間文字列に変換
    const start_time_tokyo = convertUtcToTokyoLocal(rawStartTime);

    // ===== Zoom アクセストークン取得 =====
    const accountId = process.env.ZOOM_ACCOUNT_ID;
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;

    if (!accountId || !clientId || !clientSecret) {
      console.error("Zoom env missing:", {
        accountId: !!accountId,
        clientId: !!clientId,
        clientSecret: !!clientSecret,
      });
      return NextResponse.json(
        { error: "Zoom 環境変数が設定されていません" },
        { status: 500 }
      );
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    );

    const tokenRes = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
        },
      }
    );

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("Zoom token error:", errorText);
      return NextResponse.json(
        { error: "Failed to get Zoom access token" },
        { status: 500 }
      );
    }

    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson.access_token as string;

    // ===== Zoom ミーティング作成 =====
    const createMeetingRes = await fetch(
      "https://api.zoom.us/v2/users/me/meetings",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          type: 2, // scheduled
          start_time: start_time_tokyo, // 東京時間に変換済み
          duration,
          timezone, // "Asia/Tokyo"
          settings: {
            join_before_host: false,
            waiting_room: true,
          },
        }),
      }
    );

    if (!createMeetingRes.ok) {
      const errorText = await createMeetingRes.text();
      console.error("Zoom create meeting error:", errorText);
      return NextResponse.json(
        { error: "Failed to create Zoom meeting" },
        { status: 500 }
      );
    }

    const meetingJson = await createMeetingRes.json();

    // Bubble で使う値だけ返す
    return NextResponse.json(
      {
        id: meetingJson.id,
        join_url: meetingJson.join_url,
        start_url: meetingJson.start_url,
        password: meetingJson.password,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("Unexpected error:", e);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
