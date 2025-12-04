// app/components/WeeklyCalendar.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";

type WeeklyCalendarProps = {
  employeeId?: string;
  userId?: string;
  embed?: boolean;
};

const VISIBLE_DAYS = 5;
const TIME_SLOTS = ["09:00", "13:00", "16:00", "18:00", "19:00", "20:00"];

// 日付キー（YYYY-MM-DD）
const dateKey = (d: Date) => d.toISOString().slice(0, 10);

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  employeeId,
  userId,
  embed,
}) => {
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const days = useMemo(() => {
    return Array.from({ length: VISIBLE_DAYS }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [startDate]);

  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // 日付＋時間が揃ったら親（Bubble）へ通知
  useEffect(() => {
    if (!selectedDayKey || !selectedTime) return;

    const [hour, minute] = selectedTime.split(":").map((v) => parseInt(v, 10));
    const start = new Date(selectedDayKey);
    start.setHours(hour, minute, 0, 0);

    // とりあえず 1 時間固定
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const label = start.toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    if (typeof window !== "undefined" && window.parent) {
      window.parent.postMessage(
        {
          type: "WORKTALK_SCHEDULE_SELECTED",
          label,
          startIso: start.toISOString(),
          endIso: end.toISOString(),
          employeeId: employeeId ?? null,
          userId: userId ?? null,
        },
        "*" // ← まずはゆるく許可。後で必要なら origin 絞る
      );
    }
  }, [selectedDayKey, selectedTime, employeeId, userId]);

  const shiftDays = (diff: number) => {
    setStartDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + diff);
      return d;
    });
    setSelectedDayKey(null);
    setSelectedTime(null);
  };

  const handleSelectTime = (day: Date, slot: string) => {
    setSelectedDayKey(dateKey(day));
    setSelectedTime(slot);
  };

  return (
    <section
      style={{
        fontFamily: '"Noto Sans JP", system-ui, -apple-system, BlinkMacSystemFont',
        fontSize: 12,
        color: "#333333",
      }}
    >
      {!embed && (
        <>
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            WeeklyCalendar コンポーネント
          </h2>
          <p style={{ fontSize: 12, marginBottom: 4 }}>
            employeeId: {employeeId ?? "（なし）"} / userId:{" "}
            {userId ?? "（なし）"}
          </p>
          <p style={{ fontSize: 12, marginBottom: 16 }}>
            選択中:{" "}
            {selectedDayKey && selectedTime
              ? "選択済み"
              : "日付と時間を選択してください"}
          </p>
        </>
      )}

      {/* カレンダー全体ラッパー */}
      <div
        style={{
          width: embed ? "100%" : 640,
          maxWidth: "100%",
          margin: "0 auto",
        }}
      >
        {/* 上のナビゲーション */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 16,
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            onClick={() => shiftDays(-VISIBLE_DAYS)}
            style={{
              width: 32,
              height: 32,
              borderRadius: "16px",
              border: "1px solid #e0e0e0",
              backgroundColor: "#ffffff",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            ←
          </button>
          <span style={{ fontSize: 12, color: "#666" }}>日付を選択</span>
          <button
            type="button"
            onClick={() => shiftDays(VISIBLE_DAYS)}
            style={{
              width: 32,
              height: 32,
              borderRadius: "16px",
              border: "1px solid #e0e0e0",
              backgroundColor: "#ffffff",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            →
          </button>
        </div>

        {/* 日付のヘッダ */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 12,
          }}
        >
          {days.map((day) => {
            const dKey = dateKey(day);
            const weekday = day.toLocaleDateString("ja-JP", {
              weekday: "short",
            });
            const dayNum = day.getDate();
            const isSelected = dKey === selectedDayKey;

            return (
              <div
                key={dKey}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#666666",
                  }}
                >
                  {weekday}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDayKey(dKey);
                    setSelectedTime(null);
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "20px",
                    border: "1px solid #e0e0e0",
                    backgroundColor: isSelected ? "#1a73e8" : "#ffffff",
                    color: isSelected ? "#ffffff" : "#333333",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {dayNum}
                </button>
              </div>
            );
          })}
        </div>

        {/* 時間ボタン一覧 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          {days.map((day) => {
            const dKey = dateKey(day);
            const isSelectedDay = selectedDayKey === dKey;

            return (
              <div
                key={dKey + "-times"}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {TIME_SLOTS.map((slot) => {
                  const isSelected =
                    isSelectedDay && selectedTime === slot;

                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => handleSelectTime(day, slot)}
                      style={{
                        width: "100%",
                        minHeight: 32,
                        borderRadius: 16,
                        border: "1px solid #e0e0e0",
                        backgroundColor: isSelected ? "#e8f0fe" : "#ffffff",
                        color: "#1a73e8",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WeeklyCalendar;
