const rawEmbed = searchParams.embed;
const isEmbed = rawEmbed === "1";

return (
  <main style={{ padding: isEmbed ? 0 : "24px" }}>
    {!isEmbed && (
      <>
        <h1>WorkTalk スケジューラー（仮）</h1>
        ...  // ここが embed のときは表示されない
      </>
    )}

    <WeeklyCalendar employeeId={employeeId} userId={userId} embed={isEmbed} />
  </main>
);
