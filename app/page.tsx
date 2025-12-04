// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import WeeklyCalendar from "./components/WeeklyCalendar";

type Ids = {
  employeeId?: string;
  userId?: string;
};

export default function Page() {
  const [ids, setIds] = useState<Ids>({});

  useEffect(() => {
    // ブラウザの URL からクエリパラメータを読む
    const params = new URLSearchParams(window.location.search);
    const employeeId = params.get("employee_id") ?? undefined;
    const userId = params.get("user_id") ?? undefined;

    setIds({ employeeId, userId });
  }, []);

  return (
    <main style={{ padding: "24px" }}>
      <h1>WorkTalk スケジューラー（仮）</h1>
      <p>ここにあとでカレンダーUIを作っていく予定です。</p>

      {/* ページの表示 */}
      <p>employee_id: {ids.employeeId ?? "（未指定）"}</p>
      <p>user_id: {ids.userId ?? "（未指定）"}</p>

      {/* WeeklyCalendar に渡す */}
      <WeeklyCalendar employeeId={ids.employeeId} userId={ids.userId} />
    </main>
  );
}
