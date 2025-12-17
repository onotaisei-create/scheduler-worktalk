// app/api/freebusy/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

// ▼ 社員ID → GoogleカレンダーID
//   ※ サービスアカウントから実際に読めるカレンダーIDにしてください。
const EMPLOYEE_CALENDAR_MAP: Record<string, string> = {
  emp_ogiso: "ogiso.keisuke@my-career.co.jp",
  emp_ishimoto: "ishimoto.yoshihiro@my-career.co.jp",
  emp_bito: "bito.riku@my-career.co.jp",
};

// ▼ デフォルトのカレンダーID（今まで使っていたもの）
function getDefaultCalendarId(): string {
  const envId = process.env.GOOGLE_CALENDAR_ID;
  if (!envId) {
    throw new Error("GOOGLE_CALENDAR_ID が設定されていません");
  }
  return envId;
}

// ▼ employeeId から、まず試すカレンダーIDを決める
function resolveCalendarId(employeeId: string | null): string {
  if (employeeId) {
    const mapped = EMPLOYEE_CALENDAR_MAP[employeeId];
    if (mapped) return mapped;
  }
  return getDefaultCalendarId();
}

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

// =====================
// JWT を作る関数
// =====================
function getJwt() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error("SERVICE ACCOUNT の環境変数が設定されていません");
  }

  const privateKey = key.replace(/\\n/g, "\n");

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: email,
    scope: SCOPES.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 60 * 60, // 1時間有効
    iat: now,
  };

  const base64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+/g, "");

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

// =====================
// アクセストークン取得
// =====================
async function getAccessToken() {
  const jwt = getJwt();

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    console.error("Failed to get access token", await res.text());
    throw new Error("token error");
  }

  const json = await res.json();
  return json.access_token as string;
}

// freeBusy API のレスポンス型（必要な部分だけ）
type FreeBusyResponse = {
  calendars?: Record<
    string,
    {
      busy?: { start: string; end: string }[];
    }
  >;
};

// 特定のカレンダーIDで freeBusy を叩くヘルパー
async function fetchBusyForCalendar(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<{ start: string; end: string }[] | null> {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/freeBusy",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        timeZone: "Asia/Tokyo",
        items: [{ id: calendarId }],
      }),
    }
  );

  if (!res.ok) {
    console.error("freeBusy error for", calendarId, await res.text());
    return null;
  }

  const data = (await res.json()) as FreeBusyResponse;
  const calendars = data.calendars ?? {};
  return calendars[calendarId]?.busy ?? [];
}

// =====================
// /api/freebusy GET
// =====================
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

    const accessToken = await getAccessToken();

    const defaultCalendarId = getDefaultCalendarId();
    const primaryCalendarId = resolveCalendarId(employeeId);

    // 1️⃣ まず社員ごとのカレンダー（or デフォルト）を試す
    let busy =
      (await fetchBusyForCalendar(
        accessToken,
        primaryCalendarId,
        timeMin,
        timeMax
      )) ?? null;

    // 2️⃣ 失敗していて、かつ「社員用ID ≠ デフォルト」の場合はデフォルトにフォールバック
    if (busy === null && primaryCalendarId !== defaultCalendarId) {
      busy =
        (await fetchBusyForCalendar(
          accessToken,
          defaultCalendarId,
          timeMin,
          timeMax
        )) ?? null;
    }

    if (busy === null) {
      // どちらも失敗した場合だけエラーにする
      return NextResponse.json({ error: "freeBusy error" }, { status: 500 });
    }

    return NextResponse.json({ busy });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
