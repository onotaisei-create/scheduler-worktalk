// app/page.tsx

type PageProps = {
  searchParams?: {
    employee_id?: string;
    user_id?: string;
  };
};

export default function Home({ searchParams }: PageProps) {
  const employeeId = searchParams?.employee_id ?? "(未指定)";
  const userId = searchParams?.user_id ?? "(未指定)";

  return (
    <main style={{ padding: "24px", fontFamily: "system-ui, sans-serif" }}>
      <h1>WorkTalk スケジューラー（仮）</h1>
      <p>employee_id: {employeeId}</p>
      <p>user_id: {userId}</p>

      <hr style={{ margin: "24px 0" }} />

      <p>ここにあとでカレンダーUIを作っていく予定です。</p>
    </main>
  );
}
