// app/components/WeeklyCalendar.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";

type WeeklyCalendarProps = {
  employeeId?: string;
  userId?: string;
  embed?: boolean;
};

const VISIBLE_DAYS = 7;

// 日付ラベル（例: 12/4(木)）
function formatDateLabel(date: Date) {
  return date.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

const timeSlots = ["09:00", "13:00", "16:00", "18:00", "19:00", "20:00"];

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  employeeId,
  userId,
  embed,
}) => {
  const [startOffset, setStartOffset] = useState(0); // 何日後から表示するか
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // 表示する 7 日分の配列
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
      }}
    >
      {/* 埋め込みモードのときはシンプルなヘッダーに */}
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
          alignItems: "stretch",
          marginTop: 4,
        }}
      >
        {/* ← ボタン */}
        <button
          type="button"
          onClick={handlePrev}
          style={{
            flex: "0 0 40px",
            borderRadius: 20,
            border: "1px solid #e0e0e0",
            backgroundColor: "#fff",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          ←
        </button>

        {/* 日＋時間スロット（横スクロール対応） */}
        <div
          style={{
            flex: 1,
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 4,
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
                  flex: "0 0 90px", // ポップアップ内でも収まるように少し細め
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: 8,
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
                    gap: 6,
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
                          padding: "6px 0",
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

        {/* → ボタン */}
        <button
          type="button"
          onClick={handleNext}
          style={{
            flex: "0 0 40px",
            borderRadius: 20,
            border: "1px solid #e0e0e0",
            backgroundColor: "#fff",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          →
        </button>
      </div>
    </section>
  );
};

export default WeeklyCalendar;
