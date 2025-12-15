// app/page.tsx
// ルートページ

import WeeklyCalendar from "./components/WeeklyCalendar";

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default function Page({ searchParams }: PageProps) {
  // ▼ クエリパラメータ取得
  const rawEmployeeId = searchParams?.employee_id;
  const rawUserId = searchParams?.user_id;
  const rawEmbed = searchParams?.embed;
  const rawBg = searchParams?.bg;

  const employeeId =
    typeof rawEmployeeId === "string" ? rawEmployeeId : undefined;
  const userId = typeof rawUserId === "string" ? rawUserId : undefined;

  const isEmbed =
    typeof rawEmbed === "string" &&
    (rawEmbed === "1" || rawEmbed.toLowerCase() === "true");

  // ▼ bg クエリ（例: ?bg=f5f7ff）を #f5f7ff に変換
  const bgColor =
    typeof rawBg === "string" && /^[0-9a-fA-F]{6}$/.test(rawBg)
      ? `#${rawBg}`
      : "#ffffff";

  return (
    <main
      style={{
        padding: isEmbed ? "0" : "24px",
        fontFamily:
          '"Noto Sans JP", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 12,
        lineHeight: 1.6,
        // ★ ここで背景色を反映
        backgroundColor: bgColor,
        minHeight: "100vh",
      }}
    >
      <WeeklyCalendar
        employeeId={employeeId}
        userId={userId}
        embed={isEmbed}
        bgColor={bgColor} // ★ 下のコンポーネントにも渡しておく
      />
    </main>
  );
}
