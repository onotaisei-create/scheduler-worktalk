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
        marginTop: embed ? 0 : 24,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* 埋め込みじゃないときだけヘッダー表示 */}
      {!embed && (
        <>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            WeeklyCalendar コンポーネント
          </h2>
          <p style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
            employeeId: {employeeId ?? "（なし）"} / userId:{" "}
            {userId ?? "（なし）"}
          </p>
        </>
      )}

      {/* 選択中の日時は埋め込みでも出す */}
      <p style={{ fontSize: 14, marginTop: embed ? 0 : 8 }}>
        選択中: <strong>{selectedLabel}</strong>
      </p>

      {/* カレンダー全体（横スクロール対応ラッパー） */}
      <div
        style={{
          marginTop: 16,
          width: "100%",
          overflowX: "auto",
          paddingBottom: embed ? 8 : 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 16,
            minWidth: 720, // 7列の最低幅。狭くしたければ 680 とかにしてもOK
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
                width: 40,
                height: 64,
                borderRadius: 20,
                border: "1px solid #e0e0e0",
                backgroundColor: "#fff",
                cursor: "pointer",
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
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {/* 曜日 */}
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    marginBottom: 4,
                  }}
                >
                  {weekday}
                </div>

                {/* 日付の丸 */}
                <button
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isSelectedDay ? "#1a73e8" : "#f5f5f5",
                    color: isSelectedDay ? "#ffffff" : "#222222",
                    border: "none",
                    fontSize: 20,
                    fontWeight: 700,
                    cursor: "pointer",
                    position: "relative",
                  }}
                >
                  {dayNum}
                  {isSelectedDay && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: -6,
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: "#f97316",
                      }}
                    />
                  )}
                </button>

                {/* 時間ボタン一覧 */}
                <div
                  style={{
                    marginTop: 12,
                    width: "100%",
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
                          minWidth: 0, // ここがポイント：列に合わせて縮む
                          padding: "10px 0",
                          margin: 0,
                          borderRadius: 16,
                          border: "1px solid #e0e0e0",
                          backgroundColor: isSelected
                            ? "#e8f0ff"
                            : "#ffffff",
                          color: isSelected ? "#1a73e8" : "#222222",
                          fontSize: 16,
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
                width: 40,
                height: 64,
                borderRadius: 20,
                border: "1px solid #e0e0e0",
                backgroundColor: "#fff",
                cursor: "pointer",
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
