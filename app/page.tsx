// app/page.tsx

// ✅ この1行で「このページは毎回動的にレンダリングする」と宣言
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: {
    [key: string]: string | string[] | undefined;
  };
}

export default function Page({ searchParams }: PageProps) {
  const employeeId =
    typeof searchParams?.employee_id === 'string'
      ? searchParams.employee_id
      : '(未指定)';

  const userId =
    typeof searchParams?.user_id === 'string'
      ? searchParams.user_id
      : '(未指定)';

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

