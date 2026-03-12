import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">セットアップ中です。管理者にお問い合わせください。</p>
      </div>
    );
  }

  if (profile.role === 'admin') redirect('/admin/members');
  if (profile.role === 'manager') redirect('/team');
  if (profile.role === 'member') redirect('/me');

  return null;
}
