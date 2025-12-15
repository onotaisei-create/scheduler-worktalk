// app/page.tsx
import WeeklyCalendar from "./components/WeeklyCalendar";

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default function Page({ searchParams }: PageProps) {
  const rawEmployeeId = searchParams?.employee_id;
  const rawUserId = searchParams?.user_id;
  const rawEmbed = searchParams?.embed;
  const rawBgParam = searchParams?.bg;

  const employeeId =
    typeof rawEmployeeId === "string" ? rawEmployeeId : undefined;
  const userId = typeof rawUserId === "string" ? rawUserId : undefined;

  const isEmbed =
    typeof rawEmbed === "string" &&
    (rawEmbed === "1" || rawEmbed.toLowerCase() === "true");

  const rawBg =
    typeof rawBgParam === "string" ? rawBgParam.replace(/^#/, "") : undefined;

  const bgColor =
    typeof rawBg === "string" && /^[0-9a-fA-F]{6}$/.test(rawBg)
      ? `#${rawBg}`
      : "#ffffff";

  return (
    <main
      style={{
        padding: isEmbed ? "0" : "24px",
        fontFamily:
          '"Noto Sans JP", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 12,
        lineHeight: 1.6,
        backgroundColor: bgColor,
        minHeight: "100vh",
      }}
    >
      <WeeklyCalendar
        employeeId={employeeId}
        userId={userId}
        embed={isEmbed}
        bgColor={bgColor}
      />
    </main>
  );
}
