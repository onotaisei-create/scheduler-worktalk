"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

type SelectedSlot = {
  dayIndex: number;
  hour: number;
  iso: string; // 後でAPIに送るとき用
};

export default function Home() {
  const params = useSearchParams();
  const employeeId = params.get("employee_id");
  const userId = params.get("user_id");

  // 今日から7日分の配列を作る
  const today = new Date();
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // 1時間刻みの時間（9:00〜18:00）
  const hours = Array.from({ length: 10 }).map((_, i) => 9 + i); // 9〜18

  // 曜日表示用
  const weekdayLabel = ["日", "月", "火", "水", "木", "金", "土"];

  // 選択中の枠
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);

  // 枠クリック時の処理
  const handleClickSlot = (dayIndex: number, hour: number) => {
    const baseDay = days[dayIndex];
    const slotStart = new Date(baseDay);
    slotStart.setHours(hour, 0, 0, 0);

    setSelectedSlot({
      dayIndex,
      hour,
      iso: slotStart.toISOString(),
    });
  };

  // 選択中の枠の表示用文字列
  let selectedLabel = "まだ選択されていません";
  if (selectedSlot) {
    const d = new Date(selectedSlot.iso);
    const datePart = `${d.getMonth() + 1}月${d.getDate()}日(${
      weekdayLabel[d.getDay()]
    })`;
    const timePart = `${selectedSlot.hour.toString().padStart(2, "0")}:00〜${
      (selectedSlot.hour + 1).toString().padStart(2, "0")
    }:00`;
    selectedLabel = `${datePart} ${timePart}`;
  }

  return (
    <main
      style={{
        padding: "24px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 8 }}>WorkTalk スケジューラー（仮）</h1>

      <p>employee_id: {employeeId ?? "（指定されていません）"}</p>
      <p>user_id: {userId ?? "（指定されていません）"}</p>

      <hr style={{ margin: "24px 0" }} />

      <p style={{ marginBottom: 8, fontWeight: 600 }}>選択中の枠：</p>
      <p style={{ marginBottom: 16 }}>{selectedLabel}</p>

      {/* カレンダー全体のラッパー */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "8px",
        }}
      >
        {/* 各日ごとのカラム */}
        {days.map((day, dayIndex) => {
          const label =
            weekdayLabel[day.getDay()] +
            " " +
            (day.getMonth() + 1) +
            "/" +
            day.getDate();

          return (
            <div
              key={dayIndex}
              style={{
                border: "1px solid #eee",
                borderRadius: 8,
                padding: 8,
                backgroundColor: "#f9fafb",
              }}
            >
              {/* 日付・曜日ヘッダー */}
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                {label}
              </div>

              {/* 時間ボタンたち */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {hours.map((hour) => {
                  const isSelected =
                    selectedSlot?.dayIndex === dayIndex &&
                    selectedSlot?.hour === hour;

                  const bgColor = isSelected ? "#16a34a" : "#2563eb"; // 選択中は緑
                  const textColor = "#ffffff";

                  return (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => handleClickSlot(dayIndex, hour)}
                      style={{
                        borderRadius: 8,
                        border: "none",
                        padding: "6px 0",
                        fontSize: 13,
                        backgroundColor: bgColor,
                        color: textColor,
                        cursor: "pointer",
                      }}
                    >
                      {hour.toString().padStart(2, "0")}:00
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
