// app/api/calendar-create/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ★ 書き込みなので readonly ではなく calendar
const SCOPES = ["https://www.googleapis.com/auth/calendar"];

// ▼ 社員ID → GoogleカレンダーID（主に社員のメール＝primary想定）
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

type CreateRequestBody = {
  employee_id?: string | null;
  summary?: string;                 // 予定タイトル
  description?: string;             // 説明（Bubble側情報など）
  startIso: string;                 // 例: 2025-12-18T02:00:00.000Z（UTC ISO）
  endIso: string;                   // 例: 2025-12-18T03:00:00.000Z（UTC ISO）
  attendeeEmail?: string;           // 求職者メール（任意）
  attendeeName?: string;            // 求職者名（任意）
  userId?: string | null;           // Bubble側ユーザーIDなど（任意）
  requestId?: string | null;        // 重複防止用キー（任意）
};

type GoogleError = {
  error?: {
    code?: number;
    message?: string;
    errors?: { message?: string; reason?: string }[];
    status?: string;
  };
};

function base64url(obj: unknown) {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+/g, "");
}

/**
 * Domain-Wide Delegation を使う場合は sub を入れる（=誰として動くか）
 * - GOOGLE_USE_DOMAIN_WIDE_DELEGATION="1" のときだけ sub を付与
 * - sub は通常「予定を入れたい社員のメール(=calendarId)」にするのが分かりやすい
 */
function getJwt(subjectEmail?: string) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error("SERVICE ACCOUNT の環境変数が設定されていません");
  }

  const privateKey = key.replace(/\\n/g, "\n");

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const payload: Record<string, any> = {
    iss: email,
    scope: SCOPES.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 60 * 60,
    iat: now,
  };

  const useDwd = process.env.GOOGLE_USE_DOMAIN_WIDE_DELEGATION === "1";
  if (useDwd) {
    const sub = subjectEmail || process.env.GOOGLE_DELEGATED_ADMIN_EMAIL;
    if (!sub) {
      throw new Error(
        "Domain-Wide Delegation を使うなら subject が必要です（employee email or GOOGLE_DELEGATED_ADMIN_EMAIL）"
      );
    }
    payload.sub = sub;
  }

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

async function getAccessToken(subjectEmail?: string) {
  const jwt = getJwt(subjectEmail);

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
    const t = await res.text();
    console.error("Failed to get access token", t);
    throw new Error("token error");
  }

  const json = await res.json();
  return json.access_token as string;
}

function assertIso(s: string, name: string) {
  const d = new Date(s);
  if (isNaN(d.getTime())) {
    throw new Error(`${name} is invalid ISO: ${s}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateRequestBody;

    if (!body?.startIso || !body?.endIso) {
      return NextResponse.json(
        { error: "startIso/endIso required" },
        { status: 400 }
      );
    }

    assertIso(body.startIso, "startIso");
    assertIso(body.endIso, "endIso");

    const employeeId = body.employee_id ?? null;
    const calendarId = resolveCalendarId(employeeId);

    // Domain-Wide Delegation を使うなら「その社員として」トークンを作るのが一番確実
    // （DWD無しの場合は sub は付かない＝共有設定が必要）
    const token = await getAccessToken(calendarId);

    const summary = body.summary || "WorkTalk カジュアル面談";
    const description =
      body.description ||
      [
        "WorkTalk Scheduler",
        body.userId ? `userId: ${body.userId}` : null,
        body.requestId ? `requestId: ${body.requestId}` : null,
        body.attendeeName ? `attendeeName: ${body.attendeeName}` : null,
        body.attendeeEmail ? `attendeeEmail: ${body.attendeeEmail}` : null,
      ]
        .filter(Boolean)
        .join("\n");

    // 予定作成
    const createRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          summary,
          description,
          start: {
            dateTime: body.startIso, // UTC ISO(Z)でOK
            timeZone: "Asia/Tokyo",
          },
          end: {
            dateTime: body.endIso,
            timeZone: "Asia/Tokyo",
          },
          attendees: body.attendeeEmail
            ? [
                {
                  email: body.attendeeEmail,
                  displayName: body.attendeeName || undefined,
                },
              ]
            : undefined,

          // Bubble側と紐付けたいならここに入れる（後で検索しやすい）
          extendedProperties: {
            private: {
              employee_id: employeeId ?? "",
              userId: body.userId ?? "",
              requestId: body.requestId ?? "",
            },
          },
        }),
      }
    );

    if (!createRes.ok) {
      const text = await createRes.text();
      console.error("Google Calendar create error:", text);

      // 代表的な失敗原因を返す（デバッグ用）
      return NextResponse.json(
        {
          error: "Google Calendar create failed",
          calendarId,
          employeeId,
          hint:
            "403/404ならサービスアカウントがそのカレンダーに書き込めていません（DWD設定 or 共有設定が必要）",
          raw: text,
        },
        { status: 500 }
      );
    }

    const event = await createRes.json();

    return NextResponse.json(
      {
        ok: true,
        calendarId,
        employeeId,
        event: {
          id: event.id,
          htmlLink: event.htmlLink,
          status: event.status,
          summary: event.summary,
          start: event.start,
          end: event.end,
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "server error", message: String(e) },
      { status: 500 }
    );
  }
}
