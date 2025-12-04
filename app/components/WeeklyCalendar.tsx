// app/components/WeeklyCalendar.tsx
"use client";

import React, { useMemo, useState } from "react";

type WeeklyCalendarProps = {
  employeeId?: string;
  userId?: string;
  embed?: boolean; // 埋め込みモードかどうか
};

const VISIBLE_DAYS = 7;
const TIME_SLOTS = ["09:00", "13:00", "16:00", "18:00", "19:00", "20:00"];

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  employeeId,
  userId,
  embed = false,
}) => {
  // 今日を起点に表示開始日を管理
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // 表示する 7 日分を作成
  const days = useMemo(
    () =>
      Array.from({ length: VISIBLE_DAYS }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        return d;
      }),
    [startDate]
  );

  const shiftDays = (offset: number) => {
    setStartDate((prev) => {
      const d = new Date(prev);
      d.setDate(prev.getDate() + offset);
      return d;
    });
    setSelectedDay(null);
    setSelectedTime(null);
  };

  const handleSelectDay = (day: Date) => {
    setSelectedDay(day);
    setSelectedTime(null);
  };

  const handleSelectTime = (day: Date, time: string) => {
    setSelectedDay(day);
    setSelectedTime(time);
  };

  const selectedLabel =
    selectedDay && selectedTime
      ? `${selectedDay.toLocaleDateString("ja-JP", {
          month: "numeric",
          day: "numeric",
          weekday: "short",
        })} ${selectedTime}`
      : selectedDay
      ? `${selectedDay.toLocaleDateString("ja-JP", {
          month: "numeric",
          day: "numeric",
          weekday: "short",
        })} 時間未選択`
      : "日程が選択されていません";

  return (
    <section
      style={{
        marginTop: embed ? 0 : 16,
        fontFamily:
          "'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* 埋め込みじゃないときだけヘッダー表示 */}
      {!embed && (
        <>
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            WeeklyCalendar コンポーネント
          </h2>
          <p
            style={{
              fontSize: 11,
              color: "#555",
              marginBottom: 4,
            }}
          >
            employeeId: {employeeId ?? "（なし）"} / userId:{" "}
            {userId ?? "（なし）"}
          </p>
        </>
      )}

      {/* 選択中の日時は埋め込みでも出す */}
      <p style={{ fontSize: 13, marginTop: embed ? 0 : 4 }}>
        選択中: <strong>{selectedLabel}</strong>
      </p>

      {/* カレンダー全体（ポップアップ幅に合わせて縮む） */}
      <div
        style={{
          marginTop: 12,
          width: "100%",
          overflowX: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 8,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* ←ボタン */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={() => shiftDays(-VISIBLE_DAYS)}
              style={{
                width: 32,
                height: 48,
                borderRadius: 16,
                border: "1px solid #e0e0e0",
                backgroundColor: "#fff",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {"<"}
            </button>
          </div>

          {/* 日ごとのカラム */}
          {days.map((day) => {
            const dayKey = day.toDateString();
            const isSelectedDay =
              selectedDay && selectedDay.toDateString() === dayKey;

            const weekday = day.toLocaleDateString("ja-JP", {
              weekday: "short",
            });
            const dayNum = day.getDate();

            return (
              <div
                key={dayKey}
                style={{
                  flex: 1,
                  minWidth: 0, // ★ 幅が狭いポップアップでも縮む
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {/* 曜日 */}
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    marginBottom: 2,
                  }}
                >
                  {weekday}
                </div>

                {/* 日付の丸 */}
                <button
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isSelectedDay ? "#1a73e8" : "#f5f5f5",
                    color: isSelectedDay ? "#ffffff" : "#222222",
                    border: "none",
                    fontSize: 14, // 最大14px
                    fontWeight: 600,
                    cursor: "pointer",
                    position: "relative",
                  }}
                >
                  {dayNum}
                  {isSelectedDay && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: -5,
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        backgroundColor: "#f97316",
                      }}
                    />
                  )}
                </button>

                {/* 時間ボタン一覧 */}
                <div
                  style={{
                    marginTop: 8,
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
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
                          minWidth: 0,
                          padding: "6px 0",
                          margin: 0,
                          borderRadius: 14,
                          border: "1px solid #e0e0e0",
                          backgroundColor: isSelected
                            ? "#e8f0ff"
                            : "#ffffff",
                          color: isSelected ? "#1a73e8" : "#222222",
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          boxShadow: isSelected
                            ? "0 0 0 1px rgba(26,115,232,0.35)"
                            : "none",
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

          {/* →ボタン */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={() => shiftDays(VISIBLE_DAYS)}
              style={{
                width: 32,
                height: 48,
                borderRadius: 16,
                border: "1px solid #e0e0e0",
                backgroundColor: "#fff",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {">"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WeeklyCalendar;
