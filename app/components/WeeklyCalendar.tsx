// app/components/WeeklyCalendar.tsx
"use client";

import React from "react";

type WeeklyCalendarProps = {
  employeeId?: string;
  userId?: string;
};

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  employeeId,
  userId,
}) => {
  // 今日から7日分の日付を作る
  const today = new Date();
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  return (
    <section style={{ marginTop: "24px" }}>
      <h2>WeeklyCalendar コンポーネント</h2>
      <p>employeeId: {employeeId ?? "（なし）"}</p>
      <p>userId: {userId ?? "（なし）"}</p>

      {/* とりあえず「日付だけ」の週間カレンダー */}
      <div
        style={{
          marginTop: "12px",
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
        }}
      >
        {days.map((day) => (
          <div
            key={day.toISOString()}
            style={{
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "4px",
              fontSize: "12px",
              textAlign: "center",
            }}
          >
            {day.toLocaleDateString("ja-JP", {
              month: "numeric",
              day: "numeric",
              weekday: "short",
            })}
          </div>
        ))}
      </div>
    </section>
  );
};

export default WeeklyCalendar;
