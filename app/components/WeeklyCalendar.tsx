// app/components/WeeklyCalendar.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";

type WeeklyCalendarProps = {
  employeeId?: string;
  userId?: string;
  embed?: boolean;
  bgColor?: string; // 初期値として受け取る（なくてもよい）
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

// 今日（00:00に丸めた値）を取得
const getToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// 同じ日かどうか
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  employeeId,
  userId,
  embed,
  bgColor: bgColorProp = "#ffffff",
}) => {
  // ▼ URLから読んだ値（props が来ない場合の保険）
  const [employeeIdFromUrl, setEmployeeIdFromUrl] = useState<string | null>(
    null
  );
  const [userIdFromUrl, setUserIdFromUrl] = useState<string | null>(null);
  const [embedFromUrl, setEmbedFromUrl] = useState<boolean | null>(null);

  // ▼ 背景色（初期値は props／URL から上書きする）
  const [bgColor, setBgColor] = useState<string>(bgColorProp);

  // ▼ URL のクエリを読み取る（employee_id / user_id / embed / bg）
  useEffect(() => {
    if (typeof window === "undefined") return;

    const sp = new URLSearchParams(window.location.search);

    // employee_id（Bubble iframe から渡ってくる）
    const rawEmp = sp.get("employee_id") || sp.get("employeeId");
    if (rawEmp && /^emp_[a-zA-Z0-9_-]+$/.test(rawEmp)) {
      setEmployeeIdFromUrl(rawEmp);
    } else {
      setEmployeeIdFromUrl(null);
    }

    // user_id
    const rawUser = sp.get("user_id") || sp.get("userId");
    if (rawUser) setUserIdFromUrl(rawUser);
    else setUserIdFromUrl(null);

    // embed
    const rawEmbed = sp.get("embed");
    if (rawEmbed === "1" || rawEmbed === "true") setEmbedFromUrl(true);
    else if (rawEmbed === "0" || rawEmbed === "false") setEmbedFromUrl(false);
    else setEmbedFromUrl(null);

    // bg
    let color = bgColorProp;
    try {
      const rawBg = sp.get("bg");
      if (rawBg) {
        let hex = rawBg.trim();
        if (!hex.startsWith("#")) hex = `#${hex}`;

        // 3桁 -> 6桁
        if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
          const r = hex[1];
          const g = hex[2];
          const b = hex[3];
          hex = `#${r}${r}${g}${g}${b}${b}`;
        }

        if (/^#[0-9a-fA-F]{6}$/.test(hex)) color = hex;
      }
    } catch (e) {
      console.error(e);
    }

    setBgColor(color);

    // ページ全体の背景も揃える
    if (typeof document !== "undefined") {
      document.body.style.backgroundColor = color;
      document.documentElement.style.backgroundColor = color;
    }
  }, [bgColorProp]);

  // ✅ 実際に使う employeeId / userId / embed（props優先、なければURL）
  const effectiveEmployeeId = employeeId ?? employeeIdFromUrl ?? undefined;
  const effectiveUserId = userId ?? userIdFromUrl ?? undefined;
  const effectiveEmbed = embed ?? embedFromUrl ?? false;

  const [busyList, setBusyList] = useState<BusySlot[]>([]);

  // 現在時刻（クライアント側でだけセットする）
  const [nowMs, setNowMs] = useState<number | null>(null);

  // 範囲計算用の「今日」
  const [todayBase] = useState<Date>(() => getToday());

  // 今日から2週間後
  const twoWeeksLater = useMemo(() => {
    const d = new Date(todayBase);
    d.setDate(d.getDate() + 14);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [todayBase]);

  // 表示開始日
  const [startDate, setStartDate] = useState<Date>(() => getToday());

  const days = useMemo(
    () =>
      Array.from({ length: VISIBLE_DAYS }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        d.setHours(0, 0, 0, 0);
        return d;
      }),
    [startDate]
  );

  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // 日付＋時間が揃ったら親（Bubble）へ通知
  useEffect(() => {
    if (!selectedDayKey || !selectedTime) return;

    const [hour, minute] = selectedTime.split(":").map((v) => Number(v));
    const [y, m, d] = selectedDayKey.split("-").map((v) => Number(v));
    const start = new Date(y, m - 1, d, hour, minute, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const label = start.toLocaleString("ja-JP", {
      month: "numeric",
      weekday: "short",
      day: "numeric",
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
          employeeId: effectiveEmployeeId ?? null,
          userId: effectiveUserId ?? null,
        },
        "*"
      );
    }
  }, [selectedDayKey, selectedTime, effectiveEmployeeId, effectiveUserId]);

  // 表示している 5 日分の busy を取得（employee_id を必ず反映）
  useEffect(() => {
    const fetchBusy = async () => {
      try {
        const timeMin = new Date(startDate);
        timeMin.setHours(0, 0, 0, 0);

        const timeMax = new Date(startDate);
        timeMax.setDate(timeMax.getDate() + VISIBLE_DAYS);
        timeMax.setHours(23, 59, 59, 999);

        const params = new URLSearchParams({
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
        });

        if (effectiveEmployeeId) {
          params.set("employee_id", effectiveEmployeeId);
        }

        const res = await fetch(`/api/freebusy?${params.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          console.error("freebusy fetch error");
          setBusyList([]); // 失敗時は一旦空にして誤選択を防ぎたいならここで全disableにする等も可能
          return;
        }

        const data = await res.json();
        setBusyList(data.busy ?? []);
      } catch (e) {
        console.error(e);
        setBusyList([]);
      }
    };

    fetchBusy();
  }, [startDate, effectiveEmployeeId]);

  // マウント後に現在時刻をセット（SSR とのズレをなくす）
  useEffect(() => {
    setNowMs(Date.now());

    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  // 高さを親(Bubble)に伝える
  useEffect(() => {
    if (typeof window === "undefined") return;

    const doc = document.documentElement;
    const body = document.body;

    const height = Math.max(
      doc.scrollHeight,
      doc.offsetHeight,
      body.scrollHeight,
      body.offsetHeight
    );

    window.parent?.postMessage(
      {
        type: "WORKTALK_SCHEDULER_HEIGHT",
        height,
      },
      "*"
    );
  }, [days, busyList, selectedDayKey, selectedTime]);

  // 日付をスライド（今日〜2週間の範囲にクランプ）
  const shiftDays = (diff: number) => {
    setStartDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + diff);
      next.setHours(0, 0, 0, 0);

      const minStart = new Date(todayBase);
      const maxStart = new Date(twoWeeksLater);
      maxStart.setDate(maxStart.getDate() - (VISIBLE_DAYS - 1));
      maxStart.setHours(0, 0, 0, 0);

      if (next < minStart) return minStart;
      if (next > maxStart) return maxStart;
      return next;
    });
    setSelectedDayKey(null);
    setSelectedTime(null);
  };

  const handleSelectTime = (day: Date, slot: string) => {
    const dKey = dateKey(day);

    if (selectedDayKey === dKey && selectedTime === slot) {
      setSelectedDayKey(null);
      setSelectedTime(null);

      if (typeof window !== "undefined" && window.parent) {
        window.parent.postMessage(
          {
            type: "WORKTALK_SCHEDULE_SELECTED",
            label: "",
            startIso: "",
            endIso: "",
            employeeId: effectiveEmployeeId ?? null,
            userId: effectiveUserId ?? null,
          },
          "*"
        );
      }
      return;
    }

    setSelectedDayKey(dKey);
    setSelectedTime(slot);
  };

  const currentYear =
    days.length > 0 ? days[0].getFullYear() : todayBase.getFullYear();

  return (
    <section
      style={{
        fontFamily:
          '"Noto Sans JP", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 12,
        color: "#333333",
        backgroundColor: bgColor,
        minHeight: "100vh",
      }}
    >
      {/* 年表示 */}
      <div
        style={{
          textAlign: "center",
          fontSize: 13,
          color: "#666666",
          marginBottom: 4,
        }}
      >
        {currentYear}年
      </div>

      <div
        style={{
          width: effectiveEmbed ? "100%" : 640,
          maxWidth: "100%",
          margin: "0 auto",
        }}
      >
        {/* ナビゲーション */}
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
          <span style={{ fontSize: 13, color: "#666" }}>日付を選択</span>
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

        {/* 日付ヘッダ */}
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
            const isSelected = dKey === selectedDayKey && selectedTime !== null;

            const todayLocal = getToday();
            const isToday = isSameDay(day, todayLocal);
            const isFirstOfMonth = day.getDate() === 1;
            const showMonthLabel = isToday || isFirstOfMonth;

            const weekday = day.toLocaleDateString("ja-JP", {
              weekday: "short",
            });
            const dayNum = day.getDate();

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
                    height: 16,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#666666",
                    visibility: showMonthLabel ? "visible" : "hidden",
                  }}
                >
                  {showMonthLabel ? `${day.getMonth() + 1}月` : ""}
                </div>

                <div style={{ fontSize: 13, color: "#666666" }}>{weekday}</div>

                <button
                  type="button"
                  onClick={(e) => e.preventDefault()}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "20px",
                    border: "1px solid #e0e0e0",
                    backgroundColor: isSelected ? "#1a73e8" : "#ffffff",
                    color: isSelected ? "#ffffff" : "#333333",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "default",
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
                  const slotDate = buildDateTime(day, slot);

                  // nowMs が null の間は「過去扱いしない」
                  const isPastTime =
                    nowMs !== null && slotDate.getTime() <= nowMs;

                  const busy = isBusySlot(day, slot, busyList);

                  // 「過去」または「busy」なら disabled
                  const disabled = isPastTime || busy;

                  const isSelected = isSelectedDay && selectedTime === slot;

                  let bg = "#ffffff";
                  let textColor = "#1a73e8";

                  if (disabled) {
                    bg = "#f5f5f5";
                    textColor = "#cccccc";
                  } else if (isSelected) {
                    bg = "#1a73e8";
                    textColor = "#ffffff";
                  }

                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (disabled) return;
                        handleSelectTime(day, slot);
                      }}
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
