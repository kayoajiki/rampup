import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理者',
  manager: 'マネージャー',
  member: 'メンバー',
};

const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  member: 'bg-gray-100 text-gray-600',
};

export default async function AdminMembersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('role, org_id, name')
    .eq('id', user.id)
    .single();

  if (!me || me.role !== 'admin') redirect('/');

  const { data: members } = await supabase
    .from('users')
    .select('id, email, name, role, created_at')
    .eq('org_id', me.org_id)
    .order('created_at', { ascending: true });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">rampup</h1>
        <span className="text-sm text-gray-500">{me.name ?? user.email}</span>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">メンバー管理</h2>
            <p className="text-sm text-gray-500 mt-1">{members?.length ?? 0} 名登録中</p>
          </div>
          <button
            disabled
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg opacity-50 cursor-not-allowed"
            title="メンバー招待機能は準備中です"
          >
            ＋ メンバーを招待
          </button>
        </div>

        {/* メンバー一覧 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {members && members.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">名前</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">メールアドレス</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">ロール</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {m.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLOR[m.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p>メンバーがいません</p>
              <p className="text-xs mt-1">「メンバーを招待」からメンバーを追加してください</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
