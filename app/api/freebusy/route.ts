// app/api/freebusy/route.ts
import { NextResponse } from "next/server";
import { getGoogleAccessToken } from "@/app/lib/tokenRefresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FreeBusyResponse = {
  calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const timeMin = searchParams.get("timeMin");
    const timeMax = searchParams.get("timeMax");
    const employeeId = searchParams.get("employee_id");

    if (!timeMin || !timeMax || !employeeId) {
      return NextResponse.json({ error: "timeMin/timeMax/employee_id required" }, { status: 400 });
    }

    const token = await getGoogleAccessToken(employeeId);

    const googleRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        timeZone: "Asia/Tokyo",
        items: [{ id: "primary" }],
      }),
      cache: "no-store",
    });

    const data = (await googleRes.json()) as FreeBusyResponse;

    if (!googleRes.ok) {
      return NextResponse.json({ error: "freeBusy error", raw: data }, { status: 500 });
    }

    const busy = data.calendars?.["primary"]?.busy ?? [];
    return NextResponse.json({ employeeId, busy }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "server error", detail: String(e?.message ?? e) }, { status: 500 });
  }
}
