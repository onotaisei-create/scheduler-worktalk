// app/components/WeeklyCalendar.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";

type WeeklyCalendarProps = {
  employeeId?: string;
  userId?: string;
  embed?: boolean;
};

// 表示する日数（5日固定）
const VISIBLE_DAYS = 5;

// 日付ラベル（例: 12/4(木)）
function formatDateLabel(date: Date) {
  return date.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

// 時間スロット
const timeSlots = ["09:00", "13:00", "16:00", "18:00", "19:00", "20:00"];

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  employeeId,
  userId,
  embed,
}) => {
  const [startOffset, setStartOffset] = useState(0); // 何日後から表示するか
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // 表示する VISIBLE_DAYS 日分の配列
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    today.setDate(today.getDate() + startOffset);

    const arr: Date[] = [];
    for (let i = 0; i < VISIBLE_DAYS; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [startOffset]);

  // 週が変わったら選択をリセット（先頭の日をデフォルト）
  useEffect(() => {
    if (days.length > 0) {
      setSelectedDayKey(days[0].toDateString());
      setSelectedTime(null);
    }
  }, [days]);

  const selectedDate = useMemo(
    () => days.find((d) => d.toDateString() === selectedDayKey) || null,
    [days, selectedDayKey]
  );

  const selectedLabel =
    selectedDate && selectedTime
      ? `${formatDateLabel(selectedDate)} ${selectedTime}`
      : "日付と時間を選択してください";

  const handlePrev = () => {
    setStartOffset((prev) => prev - VISIBLE_DAYS);
  };

  const handleNext = () => {
    setStartOffset((prev) => prev + VISIBLE_DAYS);
  };

  const handleSelectDay = (day: Date) => {
    setSelectedDayKey(day.toDateString());
    setSelectedTime(null);
  };

  const handleSelectTime = (slot: string) => {
    setSelectedTime(slot);
  };

  return (
    <section
      style={{
        fontFamily:
          "'Noto Sans JP', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 12,
        maxWidth: "100%",
        boxSizing: "border-box",
        paddingBottom: embed ? 8 : 16, // 下が切れないように少し余白
      }}
    >
      {/* 埋め込みじゃないときだけヘッダー表示 */}
      {!embed && (
        <>
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              margin: "0 0 8px",
            }}
          >
            WeeklyCalendar コンポーネント
          </h2>
          <p style={{ fontSize: 11, margin: 0, marginBottom: 4 }}>
            employeeId: {employeeId ?? "（なし）"} / userId:{" "}
            {userId ?? "（なし）"}
          </p>
        </>
      )}

      {/* 選択中の表示 */}
      <p
        style={{
          margin: embed ? "0 0 8px" : "8px 0 8px",
          fontSize: 12,
        }}
      >
        選択中: <strong>{selectedLabel}</strong>
      </p>

      {/* ナビゲーション ＋ 日付の行 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center", // ★ ボタンの高さが伸びないように
          marginTop: 4,
        }}
      >
        {/* ← ボタン（小さめ丸ボタン） */}
        <button
          type="button"
          onClick={handlePrev}
          style={{
            flex: "0 0 32px",
            width: 32,
            height: 32,
            borderRadius: 16,
            border: "1px solid #e0e0e0",
            backgroundColor: "#fff",
            cursor: "pointer",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ←
        </button>

        {/* 日＋時間スロット（5日分） */}
        <div
          style={{
            flex: 1,
            display: "flex",
            overflowX: "hidden", // 5日だけ表示
            paddingBottom: 4,
            justifyContent: "space-between",
          }}
        >
          {days.map((day) => {
            const isSelectedDay = day.toDateString() === selectedDayKey;
            const weekdayLabel = day.toLocaleDateString("ja-JP", {
              weekday: "short",
            });
            const dayNum = day.getDate();

            return (
              <div
                key={day.toISOString()}
                style={{
                  flex: "0 0 19%", // 5列でちょうど埋まるくらい
                  maxWidth: "20%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: 6,
                }}
              >
                {/* 曜日 */}
                <div
                  style={{
                    textAlign: "center",
                    fontSize: 11,
                    marginBottom: 2,
                  }}
                >
                  {weekdayLabel}
                </div>

                {/* 日付の丸 */}
                <button
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 9999,
                    margin: "0 auto 4px",
                    border: isSelectedDay
                      ? "1px solid #1a73e8"
                      : "1px solid #e0e0e0",
                    backgroundColor: isSelectedDay ? "#1a73e8" : "#fff",
                    color: isSelectedDay ? "#fff" : "#222",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    boxShadow: isSelectedDay
                      ? "0 0 0 1px rgba(26,115,232,0.2)"
                      : "none",
                  }}
                >
                  {dayNum}
                </button>

                {/* 時間スロット */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {timeSlots.map((slot) => {
                    const isSelectedTime =
                      isSelectedDay && selectedTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          handleSelectDay(day);
                          handleSelectTime(slot);
                        }}
                        style={{
                          width: "100%",
                          padding: "4px 0",
                          borderRadius: 9999,
                          border: isSelectedTime
                            ? "1px solid #1a73e8"
                            : "1px solid #e0e0e0",
                          backgroundColor: isSelectedTime ? "#1a73e8" : "#fff",
                          color: isSelectedTime ? "#fff" : "#1a73e8",
                          fontSize: 12,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
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

        {/* → ボタン（小さめ丸ボタン） */}
        <button
          type="button"
          onClick={handleNext}
          style={{
            flex: "0 0 32px",
            width: 32,
            height: 32,
            borderRadius: 16,
            border: "1px solid #e0e0e0",
            backgroundColor: "#fff",
            cursor: "pointer",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          →
        </button>
      </div>
    </section>
  );
};

export default WeeklyCalendar;
