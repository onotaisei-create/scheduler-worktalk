'use client';

import { useEffect, useState } from 'react';

export default function Page() {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // ブラウザのURLからクエリパラメータを読む
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const emp = params.get('employee_id');
    const user = params.get('user_id');

    setEmployeeId(emp);
    setUserId(user);
  }, []);

  const employeeLabel = employeeId ?? '(未指定)';
  const userLabel = userId ?? '(未指定)';

  return (
    <main style={{ padding: '24px' }}>
      <h1>WorkTalk スケジューラー（仮）</h1>
      <p>employee_id: {employeeLabel}</p>
      <p>user_id: {userLabel}</p>
      <hr />
      <p>ここにあとでカレンダーUIを作っていく予定です。</p>
    </main>
  );
}

