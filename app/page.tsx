// app/page.tsx
import WeeklyCalendar from "./components/WeeklyCalendar";

type SearchParams = {
  employee_id?: string;
  user_id?: string;
};

type HomeProps = {
  searchParams?: SearchParams;
};

export default function Home({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const employeeId =
    typeof searchParams?.employee_id === "string"
      ? searchParams.employee_id
      : undefined;

  const userId =
    typeof searchParams?.user_id === "string"
      ? searchParams.user_id
      : undefined;

  return (
    <main style={{ padding: "24px" }}>
      <h1>WorkTalk スケジューラー（仮）</h1>
      <p>ここにあとでカレンダーUIを作っていく予定です。</p>

      <p>employee_id: {employeeId ?? "（未指定）"}</p>
      <p>user_id: {userId ?? "（未指定）"}</p>

      {/* ↓ これを追加 ↓ */}
      <WeeklyCalendar employeeId={employeeId} userId={userId} />
    </main>
  );
}
