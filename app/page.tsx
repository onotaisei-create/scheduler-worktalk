// app/page.tsx

import WeeklyCalendar from "./components/WeeklyCalendar";

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default function Page({ searchParams }: PageProps) {
  // クエリパラメータ取得
  const rawEmployeeId = searchParams?.employee_id;
  const rawUserId = searchParams?.user_id;
  const rawEmbed = searchParams?.embed;

  const employeeId =
    typeof rawEmployeeId === "string" ? rawEmployeeId : undefined;
  const userId = typeof rawUserId === "string" ? rawUserId : undefined;
  const isEmbed =
    typeof rawEmbed === "string" &&
    (rawEmbed === "1" || rawEmbed.toLowerCase() === "true");

  return (
    <main
      style={{
        padding: isEmbed ? "0" : "24px",
        fontFamily:
          "'Noto Sans JP', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 12, // 最大でも 14px ルールに合わせる
        lineHeight: 1.6,
      }}
    >
      {/* iframe 埋め込みじゃないときだけタイトルなどを表示 */}
      {!isEmbed && (
        <>
          <h1
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            WorkTalk スケジューラー（仮）
          </h1>
          <p style={{ marginBottom: 16 }}>
            ここにあとでカレンダーUIを作っていく予定です。
          </p>
          <p style={{ marginBottom: 4 }}>
            employee_id: {employeeId ?? "（未指定）"}
          </p>
          <p style={{ marginBottom: 16 }}>
            user_id: {userId ?? "（未指定）"}
          </p>
        </>
      )}

      {/* カレンダー本体 */}
      <WeeklyCalendar
        employeeId={employeeId}
        userId={userId}
        embed={isEmbed}
      />
    </main>
  );
}
