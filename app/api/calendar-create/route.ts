// app/api/calendar-create/route.ts
import { NextResponse } from "next/server";
import { getGoogleAccessToken, getZoomAccessToken } from "@/app/lib/tokenRefresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  employeeId: string;
  startIso: string; // "2025-12-18T02:00:00.000Z" みたいなISO
  endIso: string;
  candidateName?: string;
  candidateEmail?: string;
  title?: string; // 予定タイトル
  notes?: string; // 補足
};

function requireApiKey(req: Request) {
  const expected = process.env.SCHEDULER_API_KEY;
  const got = req.headers.get("x-scheduler-key") || req.headers.get("x-scheduler-api-key");

  if (!expected || got !== expected) {
    throw new Error("UNAUTHORIZED");
  }
}

export async function POST(req: Request) {
  try {
    requireApiKey(req);

    const body = (await req.json()) as Body;

    const employeeId = body.employeeId;
    if (!employeeId || !body.startIso || !body.endIso) {
      return NextResponse.json({ error: "employeeId/startIso/endIso required" }, { status: 400 });
    }

    const start = new Date(body.startIso);
    const end = new Date(body.endIso);
    const durationMin = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

    // 1) Zoom meeting（社員のZoomで作成）
    const zoomToken = await getZoomAccessToken(employeeId);

    const zoomRes = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${zoomToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: body.title || "WorkTalk 面談",
        type: 2,
        start_time: start.toISOString(),
        duration: durationMin,
        timezone: "Asia/Tokyo",
        settings: {
          waiting_room: true,
          join_before_host: false,
        },
      }),
    });

    const zoomJson = await zoomRes.json();
    if (!zoomRes.ok) {
      return NextResponse.json({ error: "Zoom create failed", raw: zoomJson }, { status: 500 });
    }

    const joinUrl = zoomJson.join_url as string;
    const startUrl = zoomJson.start_url as string;
    const zoomId = zoomJson.id;

    // 2) Google calendar event（社員のGoogleで作成）
    const googleToken = await getGoogleAccessToken(employeeId);

    const descriptionLines = [
      "【Zoom】",
      `参加URL: ${joinUrl}`,
      "",
      body.notes ? `【補足】\n${body.notes}` : "",
    ].filter(Boolean);

    const attendees =
      body.candidateEmail
        ? [{ email: body.candidateEmail, displayName: body.candidateName || undefined }]
        : [];

    const gRes = await fetch(
  "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${googleToken}`,
      "Content-Type": "application/json",
    },
      body: JSON.stringify({
        summary: body.title || "WorkTalk 面談",
        description: descriptionLines.join("\n"),
        start: { dateTime: start.toISOString(), timeZone: "Asia/Tokyo" },
        end: { dateTime: end.toISOString(), timeZone: "Asia/Tokyo" },
        attendees,
      }),
    });

    const gJson = await gRes.json();
    if (!gRes.ok) {
      return NextResponse.json(
        { error: "Google Calendar create failed", zoom: { zoomId, joinUrl }, raw: gJson },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      employeeId,
      zoom: { zoomId, joinUrl, startUrl },
      google: { eventId: gJson.id, htmlLink: gJson.htmlLink },
    });
  } catch (e: any) {
    if (String(e?.message) === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "server error", detail: String(e?.message ?? e) }, { status: 500 });
  }
}
