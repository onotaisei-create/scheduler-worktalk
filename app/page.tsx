// app/page.tsx
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WeeklyCalendar from "./components/WeeklyCalendar";

// 実際の画面本体（useSearchParams を使う方）
function PageContent() {
  const searchParams = useSearchParams();

  // URL の ?employee_id= / ?user_id= を取得
  const employeeId = searchParams.get("employee_id") ?? undefined;
  const userId = searchParams.get("user_id") ?? undefined;

  // ?embed=1 が付いていたら「埋め込みモード」
  const isEmbed = searchParams.get("embed") === "1";

  // ーーーーーーーーーーーーーーーー
  //  埋め込みモード（Bubble 用）
  // ーーーーーーーーーーーーーーーー
  if (isEmbed) {
    return (
      <main
        style={{
          padding: 0,
          margin: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
          backgroundColor: "transparent",
        }}
      >
        <WeeklyCalendar employeeId={employeeId} userId={userId} />
      </main>
    );
  }

  // ーーーーーーーーーーーーーーーー
  //  通常モード（デバッグ用）
  // ーーーーーーーーーーーーーーーー
  return (
    <main style={{ padding: "24px" }}>
      <h1>WorkTalk スケジューラー（仮）</h1>
      <p>ここにあとでカレンダーUIを作っていく予定です。</p>

      {/* ページ側の表示（デバッグ用） */}
      <p>employee_id: {employeeId ?? "（未指定）"}</p>
      <p>user_id: {userId ?? "（未指定）"}</p>

      {/* カレンダー本体 */}
      <WeeklyCalendar employeeId={employeeId} userId={userId} />
    </main>
  );
}

// useSearchParams を使う PageContent 全体を Suspense で包む
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageContent />
    </Suspense>
  );
}
