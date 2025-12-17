// app/api/freebusy/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

// ▼ 社員ID → GoogleカレンダーID
const EMPLOYEE_CALENDAR_MAP: Record<string, string> = {
  emp_ogiso: "ogiso.keisuke@my-career.co.jp",
  emp_ishimoto: "ishimoto.yoshihiro@my-career.co.jp",
  emp_bito: "bito.riku@my-career.co.jp",
};

const DEFAULT_CALENDAR_ID = EMPLOYEE_CALENDAR_MAP.emp_ogiso;

function resolveCalendarId(employeeId: string | null): string {
  if (!employeeId) return DEFAULT_CALENDAR_ID;
  return EMPLOYEE_CALENDAR_MAP[employeeId] ?? DEFAULT_CALENDAR_ID;
}

type FreeBusyResponse = {
  calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
};

function base64url(obj: unknown) {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+/g, "");
}

function getJwt() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error("SERVICE ACCOUNT の環境変数が設定されていません");
  }

  const privateKey = key.replace(/\\n/g, "\n");

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: email,
    scope: SCOPES.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 60 * 60,
    iat: now,
  };

  const headerPart = base64url(header);
  const payloadPart = base64url(payload);
  const data = `${headerPart}.${payloadPart}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(data);

  const signature = signer
    .sign(privateKey, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+/g, "");

  return `${data}.${signature}`;
}

async function getAccessToken() {
  const jwt = getJwt();

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("Failed to get access token", await res.text());
    throw new Error("token error");
  }

  const json = await res.json();
  return json.access_token as string;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const timeMin = searchParams.get("timeMin");
    const timeMax = searchParams.get("timeMax");
    const employeeId = searchParams.get("employee_id");

    if (!timeMin || !timeMax) {
      return NextResponse.json(
        { error: "timeMin/timeMax required" },
        { status: 400 }
      );
    }

    // ★ ここが「どの社員のカレンダーを見に行くか」の確定値
    const calendarId = resolveCalendarId(employeeId);

    const token = await getAccessToken();

    const googleRes = await fetch(
      "https://www.googleapis.com/calendar/v3/freeBusy",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin,
          timeMax,
          timeZone: "Asia/Tokyo",
          items: [{ id: calendarId }],
        }),
        cache: "no-store",
      }
    );

    if (!googleRes.ok) {
      console.error("freeBusy error", await googleRes.text());
      return NextResponse.json({ error: "freeBusy error" }, { status: 500 });
    }

    const data = (await googleRes.json()) as FreeBusyResponse;
    const busy = data.calendars?.[calendarId]?.busy ?? [];

    // ★ デバッグしやすいように、今どのカレンダーを見たかも返します
    return NextResponse.json(
      { calendarId, busy },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
