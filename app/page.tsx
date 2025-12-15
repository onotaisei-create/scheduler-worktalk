// app/page.tsx

import WeeklyCalendar from "./components/WeeklyCalendar";

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default function Page({ searchParams }: PageProps) {
  // ▼ クエリパラメータ取得
  const rawEmployeeId = searchParams?.employee_id;
  const rawUserId = searchParams?.user_id;
  const rawEmbed = searchParams?.embed;
  const rawBg = searchParams?.bg; // ★ 追加（背景色）

  const employeeId =
    typeof rawEmployeeId === "string" ? rawEmployeeId : undefined;
  const userId =
    typeof rawUserId === "string" ? rawUserId : undefined;
  const isEmbed =
    typeof rawEmbed === "string" &&
    (rawEmbed === "1" || rawEmbed.toLowerCase() === "true");

  // ▼ 背景色（bg が 6桁の16進数なら使う／それ以外は白）
  const bgColor =
    typeof rawBg === "string" && /^[0-9a-fA-F]{6}$/.test(rawBg)
      ? `#${rawBg}`
      : "#ffffff";

  return (
    <main
      style={{
        padding: isEmbed ? "0" : "24px",
        fontFamily:
          "'Noto Sans JP', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 12, // 最大14pxルールに合わせたベース
        lineHeight: 1.6,
        backgroundColor: bgColor, // ★ ここで背景色反映
      }}
    >
      {/* カレンダー本体 */}
      <WeeklyCalendar
        employeeId={employeeId}
        userId={userId}
        embed={isEmbed}
        bgColor={bgColor}
      />
    </main>
  );
}
