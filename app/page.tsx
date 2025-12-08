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

      {/* カレンダー本体 */}
      <WeeklyCalendar
        employeeId={employeeId}
        userId={userId}
        embed={isEmbed}
      />
    </main>
  );
}
