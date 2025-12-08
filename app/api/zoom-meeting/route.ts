// app/api/zoom-meeting/route.ts

import { NextRequest, NextResponse } from "next/server";

type RequestBody = {
  topic?: string;
  start_time: string; // 例: "2025-12-10T19:00:00"
  duration?: number;
  timezone?: string;
};

export async function POST(req: NextRequest) {
  try {
    // リクエストボディを取得
    const body = (await req.json()) as RequestBody;

    const topic = body.topic || "WorkTalk カジュアル面談";
    const start_time = body.start_time;
    const duration = body.duration ?? 30; // 分
    const timezone = body.timezone || "Asia/Tokyo";

    if (!start_time) {
      return NextResponse.json(
        { error: "start_time is required" },
        { status: 400 }
      );
    }

    // ===== 1. Zoom アクセストークン取得 =====
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

    // ===== 2. Zoom ミーティング作成 =====
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
          type: 2, // schedule
          start_time, // "YYYY-MM-DDTHH:mm:ss" 形式
          duration,
          timezone,
          settings: {
            join_before_host: true,
            waiting_room: false,
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

    // Bubble で使いやすい情報だけ返す
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
