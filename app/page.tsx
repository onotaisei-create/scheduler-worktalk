// ✅ この1行を必ず入れる：クエリパラメータを使うので、ページを強制的に動的にする
export const dynamic = 'force-dynamic';

type SearchParams = {
  employee_id?: string;
  user_id?: string;
};

export default function Home({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const employeeId = searchParams?.employee_id ?? '(未指定)';
  const userId = searchParams?.user_id ?? '(未指定)';

  return (
    <main style={{ padding: '24px' }}>
      <h1>WorkTalk スケジューラー（仮）</h1>
      <p>employee_id: {employeeId}</p>
      <p>user_id: {userId}</p>
      <hr />
      <p>ここにあとでカレンダーUIを作っていく予定です。</p>
    </main>
  );
}

