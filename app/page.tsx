// app/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import WeeklyCalendar from "./components/WeeklyCalendar";

export default function Page() {
  const searchParams = useSearchParams();

  // URL から ?employee_id= と ?user_id= を取得
  const employeeId = searchParams.get("employee_id") ?? undefined;
  const userId = searchParams.get("user_id") ?? undefined;

  return (
    <main style={{ padding: "24px" }}>
      <h1>WorkTalk スケジューラー（仮）</h1>
      <p>ここにあとでカレンダーUIを作っていく予定です。</p>

      {/* ページ側の表示 */}
      <p>employee_id: {employeeId ?? "（未指定）"}</p>
      <p>user_id: {userId ?? "（未指定）"}</p>

      {/* WeeklyCalendar に渡す */}
      <WeeklyCalendar employeeId={employeeId} userId={userId} />
    </main>
  );
}


