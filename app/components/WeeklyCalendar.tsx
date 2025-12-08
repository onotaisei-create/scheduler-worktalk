// app/components/WeeklyCalendar.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";

type WeeklyCalendarProps = {
  employeeId?: string;
  userId?: string;
  embed?: boolean;
};

// 忙しい時間帯のリスト（freeBusy のレスポンスそのまま持つ）
type BusySlot = { start: string; end: string };

const VISIBLE_DAYS = 5;

// 09:00〜20:00 を 1時間刻みで生成
const TIME_SLOTS = Array.from({ length: 12 }, (_, i) => {
  const hour = 9 + i; // 9,10,...,20
  return `${hour.toString().padStart(2, "0")}:00`;
});

// 指定の日付 + "HH:MM" から Date を作る（ローカル時間）
const buildDateTime = (day: Date, time: string) => {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
};

// その枠が busyList と重なっているか？
const isBusySlot = (day: Date, time: string, busy: BusySlot[]) => {
  if (!busy.length) return false;

  const slotStart = buildDateTime(day, time);
  const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000); // 1時間枠

  // 区間が少しでも重なっていれば busy とみなす
  return busy.some(({ start, end }) => {
    const busyStart = new Date(start);
    const busyEnd = new Date(end);
    return slotStart < busyEnd && slotEnd > busyStart;
  });
};

// 日付キー (YYYY-MM-DD)
const dateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  employeeId,
  userId,
  embed,
}) => {
  // ←★ ここに busyList の state を置く（コンポーネントの「中」）
  const [busyList, setBusyList] = useState<BusySlot[]>([]);

  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const days = useMemo(
    () =>
      Array.from({ length: VISIBLE_DAYS }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [startDate]
  );

  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // ここから下は、今まで入っていた useEffect や JSX をそのまま続けてOK
  // （busyList を使って disabled 判定しているところもこのままで動きます）

  // …既存の useEffect / JSX 以下はそのまま…

  // 例：Bubble へ postMessage している useEffect や、
  // freebusy を fetch して setBusyList している useEffect など

  // 日付＋時間が揃ったら親（Bubble）へ通知
  // 日時 + 情報を親画面（Bubble）へ通知
useEffect(() => {
  if (!selectedDayKey || !selectedTime) return;

  // 時刻（"09:00" みたいな文字列）を数値に
  const [hour, minute] = selectedTime.split(":").map((v) => Number(v));

  // YYYY-MM-DD を分解して「ローカル日時」を作る
  const [y, m, d] = selectedDayKey.split("-").map((v) => Number(v));
  const start = new Date(y, m - 1, d, hour, minute, 0, 0); // ← ローカル基準

  // ★ ここで必ず 1 時間固定イベントにする
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  // ラベル（Bubble に表示する "12/7(日) 18:00" みたいな文字）
  const label = start.toLocaleString("ja-JP", {
    month: "numeric",
    weekday: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Bubble 側へ postMessage
  if (typeof window !== "undefined" && window.parent) {
    window.parent.postMessage(
      {
        type: "WORKTALK_SCHEDULE_SELECTED",
        label,
        startIso: start.toISOString(), // 例: 2025-12-07T09:00:00.000Z (JST 18:00)
        endIso: end.toISOString(),     // 例: 2025-12-07T10:00:00.000Z (JST 19:00)
        employeeId: employeeId ?? null,
        userId: userId ?? null,
      },
      "*"
    );
  }
}, [selectedDayKey, selectedTime, employeeId, userId]);

// 表示している 5 日分の busy を取得
useEffect(() => {
  const fetchBusy = async () => {
    try {
      const timeMin = new Date(startDate);
      timeMin.setHours(0, 0, 0, 0);

      const timeMax = new Date(startDate);
      timeMax.setDate(timeMax.getDate() + VISIBLE_DAYS);
      timeMax.setHours(23, 59, 59, 999);

      const res = await fetch(
        `/api/freebusy?timeMin=${encodeURIComponent(
          timeMin.toISOString()
        )}&timeMax=${encodeURIComponent(timeMax.toISOString())}`
      );

      if (!res.ok) {
        console.error("freebusy fetch error");
        return;
      }

      const data = await res.json();
      setBusyList(data.busy ?? []);
    } catch (e) {
      console.error(e);
    }
  };

  fetchBusy();
}, [startDate]);



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
  const isSelected = isSelectedDay && selectedTime === slot;
  const disabled = isBusySlot(day, slot, busyList);

  const bg = isSelected
    ? "#1a73e8"
    : disabled
    ? "#f5f5f5"
    : "#ffffff";

  const textColor = isSelected
    ? "#ffffff"
    : disabled
    ? "#cccccc"
    : "#1a73e8";

  return (
    <button
      key={slot}
      type="button"
      onClick={() => {
        if (disabled) return; // 埋まっている枠はクリック無効
        handleSelectTime(day, slot);
      }}
      disabled={disabled}
      style={{
        width: "100%",
        minHeight: 32,
        borderRadius: 16,
        border: "1px solid #e0e0e0",
        backgroundColor: bg,
        color: textColor,
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
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
