// app/components/WeeklyCalendar.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type WeeklyCalendarProps = {
  employeeId?: string;
  userId?: string;
};

const VISIBLE_DAYS = 7;

// 7日分の配列を作る
function buildDays(offset: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(start.getDate() + offset);

  return Array.from({ length: VISIBLE_DAYS }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// 時間帯（とりあえず共通）
const TIME_SLOTS: string[] = [
  "09:00",
  "13:00",
  "16:00",
  "18:00",
  "19:00",
  "20:00",
];

function formatLabel(date: Date, time: string): string {
  const dateText = date.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  return `${dateText} ${time}`;
}

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  employeeId,
  userId,
}) => {
  // 何週目か（左/右矢印で増減）
  const [offset, setOffset] = useState(0);

  // 選択中の日・時間
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null); // "2025-12-04" みたいな文字列
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>("");

  // 埋め込みモードかどうか (?embed=1 のとき true)
  const [isEmbed, setIsEmbed] = useState(false);

  // 初回だけ URL のクエリから embed=1 を読む
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setIsEmbed(params.get("embed") === "1");
  }, []);

  // offset が変わるたびに 7 日分を再計算
  const days = useMemo(() => {
    return buildDays(offset);
  }, [offset]);

  // 日付クリック
  const handleSelectDay = (day: Date) => {
    const key = day.toISOString().slice(0, 10); // "YYYY-MM-DD"
    setSelectedDayKey(key);
    // 日だけ変えたときは時間は維持 or クリア、今回はクリアにしておく
    setSelectedTime(null);
    setSelectedLabel("");
  };

  // 時間クリック
  const handleSelectTime = (day: Date, time: string) => {
    const key = day.toISOString().slice(0, 10);
    setSelectedDayKey(key);
    setSelectedTime(time);
    setSelectedLabel(formatLabel(day, time));
  };

  // 左右の矢印
  const shiftDays = (delta: number) => {
    setOffset((prev) => prev + delta);
  };

  // 現在選択されている Date オブジェクト
  const selectedDate: Date | null = useMemo(() => {
    if (!selectedDayKey) return null;
    return new Date(`${selectedDayKey}T00:00:00`);
  }, [selectedDayKey]);

  // ★ 埋め込みモードのときは、選択が変わるたびに親ウィンドウへ postMessage
  useEffect(() => {
    if (!isEmbed) return;
    if (!selectedDate || !selectedTime) return;
    if (typeof window === "undefined") return;

    const label = formatLabel(selectedDate, selectedTime);
    const dateISO = selectedDayKey!; // "YYYY-MM-DD"

    window.parent?.postMessage(
      {
        type: "worktalk-scheduler-selected",
        payload: {
          label, // 表示用 "12/4(木) 15:00"
          dateISO, // "2025-12-04"
          time: selectedTime,
          employeeId: employeeId ?? null,
          userId: userId ?? null,
        },
      },
      "*"
    );
  }, [isEmbed, selectedDate, selectedTime, selectedDayKey, employeeId, userId]);

  return (
    <section
      style={{
        marginTop: "24px",
        maxWidth: "960px",
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      <h2
        style={{
          fontSize: "18px",
          fontWeight: 600,
          marginBottom: "8px",
        }}
      >
        WeeklyCalendar コンポーネント
      </h2>

      <p style={{ fontSize: "12px", color: "#555", marginBottom: "8px" }}>
        employeeId: {employeeId ?? "（なし）"} / userId: {userId ?? "（なし）"}
      </p>

      {/* 選択中の日時（カレンダーの上に表示） */}
      <p style={{ marginTop: "8px", fontSize: "14px" }}>
        選択中：
        <strong>{selectedLabel || "日程が選択されていません"}</strong>
      </p>

      {/* カレンダー本体 */}
      <div
        style={{
          marginTop: "16px",
          display: "flex",
          alignItems: "stretch",
          gap: "16px",
        }}
      >
        {/* 左ボタン */}
        <button
          type="button"
          onClick={() => shiftDays(-VISIBLE_DAYS)}
          style={{
            width: 40,
            height: 64,
            borderRadius: 20,
            border: "1px solid #ddd",
            backgroundColor: "#fff",
            cursor: "pointer",
          }}
        >
          {"<"}
        </button>

        {/* 日ごとのカラム */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          {days.map((day) => {
            const dayKey = day.toISOString().slice(0, 10);
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
                    fontSize: "14px",
                    fontWeight: 500,
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
                    border: "none",
                    backgroundColor: isSelectedDay ? "#1a73e8" : "#f5f5f5",
                    color: isSelectedDay ? "#fff" : "#111",
                    fontSize: "20px",
                    fontWeight: 700,
                    boxShadow: isSelectedDay
                      ? "0 0 0 1px rgba(26,115,232,0.4)"
                      : "none",
                    position: "relative",
                    cursor: "pointer",
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
                    marginTop: "12px",
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
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
                          minWidth: 120,
                          padding: "10px 8px",
                          borderRadius: 16,
                          border: "1px solid #e0e0e0",
                          backgroundColor: isSelected ? "#e8f0fe" : "#ffffff",
                          color: isSelected ? "#1a73e8" : "#1a73e8",
                          fontSize: "14px",
                          fontWeight: 500,
                          cursor: "pointer",
                          boxShadow: isSelected
                            ? "0 0 0 2px rgba(26,115,232,0.15)"
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
        </div>

        {/* 右ボタン */}
        <button
          type="button"
          onClick={() => shiftDays(VISIBLE_DAYS)}
          style={{
            width: 40,
            height: 64,
            borderRadius: 20,
            border: "1px solid #ddd",
            backgroundColor: "#fff",
            cursor: "pointer",
          }}
        >
          {">"}
        </button>
      </div>

      {/* 下側の「選択日時」とボタン（埋め込みモードではボタンを出さない） */}
      <div style={{ marginTop: "24px" }}>
        {selectedDate && selectedTime ? (
          <>
            <p style={{ fontSize: "14px" }}>選択日時：</p>
            <p
              style={{
                fontSize: "18px",
                fontWeight: 600,
                marginTop: "4px",
              }}
            >
              {formatLabel(selectedDate, selectedTime)}
            </p>

            {!isEmbed && (
              <button
                type="button"
                onClick={() => {
                  // 単体動作用のダミー挙動
                  alert(`この日時で予約します：${formatLabel(
                    selectedDate,
                    selectedTime
                  )}`);
                }}
                style={{
                  marginTop: "12px",
                  padding: "10px 24px",
                  borderRadius: 999,
                  border: "none",
                  backgroundColor: "#1a73e8",
                  color: "#fff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                この日時で予約する（スタンドアロン用）
              </button>
            )}
          </>
        ) : (
          <p style={{ fontSize: "14px", color: "#888" }}>
            日時を選択してください
          </p>
        )}
      </div>
    </section>
  );
};

export default WeeklyCalendar;
