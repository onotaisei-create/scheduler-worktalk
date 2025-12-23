// app/api/freebusy/route.ts
import { NextResponse } from "next/server";
import { getGoogleAccessToken } from "@/app/lib/tokenRefresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FreeBusyResponse = {
  calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
};

/**
 * Google freeBusy は RFC3339 必須。
 * - 末尾が "Z" または "+09:00" 等の offset が付いていればそのまま
 * - 付いていない場合は「JST(+09:00)として解釈」して offset を付与
 */
function normalizeRfc3339(input: string) {
  const s = input.trim();

  // すでに timezone 情報があるならそのまま
  if (/[zZ]$/.test(s) || /[+\-]\d{2}:\d{2}$/.test(s)) return s;

  // "YYYY-MM-DDTHH:mm:ss" / "YYYY-MM-DDTHH:mm" を想定して +09:00 を付ける
  // ミリ秒が無ければ付けない（GoogleはどちらでもOK）
  return `${s}+09:00`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employee_id");
    const timeMinRaw = searchParams.get("timeMin");
    const timeMaxRaw = searchParams.get("timeMax");

    if (!employeeId || !timeMinRaw || !timeMaxRaw) {
      return NextResponse.json(
        { error: "timeMin/timeMax/employee_id required" },
        { status: 400 }
      );
    }

    const timeMin = normalizeRfc3339(timeMinRaw);
    const timeMax = normalizeRfc3339(timeMaxRaw);

    // ここで employeeId ごとに token を取る（切替の要）
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

    const dataText = await googleRes.text();
    let data: FreeBusyResponse | any = {};
    try {
      data = JSON.parse(dataText);
    } catch {
      // JSON じゃない返しを握りつぶさず見える化
      return NextResponse.json(
        { error: "freeBusy non-json response", raw: dataText },
        { status: 500 }
      );
    }

    if (!googleRes.ok) {
      return NextResponse.json(
        { error: "freeBusy error", raw: data },
        { status: 500 }
      );
    }

    const busy = data.calendars?.["primary"]?.busy ?? [];
    return NextResponse.json(
      { employeeId, timeMin, timeMax, busy },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: "server error", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
