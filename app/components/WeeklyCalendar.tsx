// app/components/WeeklyCalendar.tsx
"use client";

import React, { useMemo, useState } from "react";

type WeeklyCalendarProps = {
  employeeId?: string;
  userId?: string;
  embed?: boolean;
};

const VISIBLE_DAYS = 5;
const SLOT_MINUTES = 60; // 1枠の長さ（分）

const timeSlots = ["09:00", "13:00", "16:00", "18:00", "19:00", "20:00"];
const weekdayLabelJa = ["日", "月", "火", "水", "木", "金", "土"];

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  employeeId,
  userId,
  embed,
}) => {
  // 左端の日付（常に 0:00 に正規化）
  const [anchorDate, setAnchorDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // 選択中の日時
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const selectedDayKey = selectedDay ? selectedDay.toDateString() : "";

  // 画面に表示する 5 日間
  const days = useMemo(() => {
    const base = new Date(anchorDate);
    base.setHours(0, 0, 0, 0);

    return Array.from({ length: VISIBLE_DAYS }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i); // ※ここが超重要：i 日だけ足す
      return d;
    });
  }, [anchorDate]);

  // ---- 日付ナビゲーション ----
  const shiftDays = (diff: number) => {
    setAnchorDate((prev) => {
      const d = new Date(prev);
      d.setDate(prev.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  };

  // ---- 日付＋時間選択 ----
  const handleSelectTime = (day: Date, time: string) => {
    const [hour, minute] = time.split(":").map(Number);

    // day をベースに開始日時を作る（ここで day が 1 日ズレていなければ OK）
    const start = new Date(day);
    start.setHours(hour, minute, 0, 0);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + SLOT_MINUTES);

    setSelectedDay(day);
    setSelectedTime(time);

    const label = `${start.getMonth() + 1}/${start.getDate()}(${
      weekdayLabelJa[start.getDay()]
    }) ${time}`;

    // Bubble 側 hidden input を更新
    if (typeof window !== "undefined" && window.parent) {
      const doc = window.parent.document;

      const labelInput = doc.getElementById(
        "wt_selected_label_input"
      ) as HTMLInputElement | null;
      const startInput = doc.getElementById(
        "wt_start_iso"
      ) as HTMLInputElement | null;
      const endInput = doc.getElementById(
        "wt_end_iso"
      ) as HTMLInputElement | null;

      if (labelInput) labelInput.value = label;
      if (startInput) startInput.value = start.toISOString();
      if (endInput) endInput.value = end.toISOString();
    }
  };

  // 選択中ラベル
  const selectedLabel =
    selectedDay && selectedTime
      ? `${selectedDay.getMonth() + 1}/${selectedDay.getDate()}(${
          weekdayLabelJa[selectedDay.getDay()]
        }) ${selectedTime}`
      : "まだ選択されていません";

  // ここから下は UI（レイアウト）は変えていません
  return (
    <div
      style={{
        fontFamily: '"Noto Sans JP", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: "14px",
        color: "#333",
        width: "100%",
      }}
    >
      {/* 上部のヘッダーなど（必要ならここに任意のテキストを入れる） */}

      {/* 選択中の表示 */}
      <p
        style={{
          marginTop: "16px",
          marginBottom: "8px",
          fontSize: "12px",
        }}
      >
        選択日時: {selectedLabel}
      </p>

      {/* 日付 + カレンダー本体 */}
      <div
        style={{
          marginTop: "16px",
          padding: embed ? "0 0 16px" : "16px 0 24px",
          borderRadius: embed ? 0 : 16,
        }}
      >
        {/* 日付を選択ヘッダー + ナビ */}
        <div
          style={{
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <button
            type="button"
            onClick={() => shiftDays(-VISIBLE_DAYS)}
            style={{
              width: 32,
              height: 32,
              borderRadius: "999px",
              border: "1px solid #e0e0e0",
              backgroundColor: "#fff",
              cursor: "pointer",
            }}
          >
            ←
          </button>
          <span style={{ fontSize: "14px" }}>日付を選択</span>
          <button
            type="button"
            onClick={() => shiftDays(VISIBLE_DAYS)}
            style={{
              width: 32,
              height: 32,
              borderRadius: "999px",
              border: "1px solid #e0e0e0",
              backgroundColor: "#fff",
              cursor: "pointer",
            }}
          >
            →
          </button>
        </div>

        {/* 日付・時間スロット一覧 */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            justifyContent: "space-between",
          }}
        >
          {days.map((day) => {
            const dayKey = day.toDateString();
            const isSelectedDay = selectedDayKey === dayKey;

            const weekday = day.toLocaleDateString("ja-JP", {
              weekday: "short",
            });
            const dayNum = day.getDate();

            return (
              <div
                key={dayKey}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {/* 曜日 */}
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 500,
                    marginBottom: "4px",
                  }}
                >
                  {weekday}
                </div>

                {/* 日付の丸 */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "999px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isSelectedDay ? "#1a73e8" : "#f5f5f5",
                    color: isSelectedDay ? "#fff" : "#333",
                    fontWeight: 600,
                    fontSize: "16px",
                    position: "relative",
                  }}
                >
                  {dayNum}
                </div>

                {/* 時間ボタン一覧 */}
                <div
                  style={{
                    marginTop: "12px",
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {timeSlots.map((slot) => {
                    const isSelected =
                      isSelectedDay && selectedTime === slot;

                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => handleSelectTime(day, slot)} // ← ここが超重要
                        style={{
                          width: "100%",
                          minWidth: 120,
                          padding: "10px 8px",
                          borderRadius: 16,
                          border: "1px solid #e0e0e0",
                          backgroundColor: isSelected ? "#e8f0fe" : "#ffffff",
                          color: "#1a73e8",
                          fontSize: "14px",
                          fontWeight: isSelected ? 600 : 500,
                          cursor: "pointer",
                          boxShadow: isSelected
                            ? "0 0 2px rgba(26,115,232,0.4)"
                            : "none",
                          textAlign: "center",
                        }}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeeklyCalendar;
