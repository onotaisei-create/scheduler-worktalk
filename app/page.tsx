// 🔴 これを必ず先頭に追加
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: {
    employee_id?: string | string[]
    user_id?: string | string[]
  }
}

export default function Home({ searchParams }: PageProps) {
  const rawEmployeeId = searchParams?.employee_id
  const rawUserId = searchParams?.user_id

  const employeeId =
    typeof rawEmployeeId === "string" ? rawEmployeeId : "(未指定)"
  const userId =
    typeof rawUserId === "string" ? rawUserId : "(未指定)"

  return (
    <main style={{ padding: "24px" }}>
      <h1>WorkTalk スケジューラー（仮）</h1>

      <p>employee_id: {employeeId}</p>
      <p>user_id: {userId}</p>

      <hr />

      <p>ここにあとでカレンダーUIを作っていく予定です。</p>
    </main>
  )
}
