import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

async function signOut() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export default async function MePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .single();

  const name = profile?.name ?? user.email;

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <header className="bg-white border-b border-[#E9E9E7] px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[#37352F]">rampup</h1>
        <form action={signOut}>
          <button type="submit" className="text-sm text-[#9B9A97] hover:text-[#37352F] transition-colors duration-150">
            ログアウト
          </button>
        </form>
      </header>
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-[#9B9A97] text-sm mb-2">ようこそ</p>
        <p className="text-2xl font-medium text-[#37352F] mb-8">{name}</p>
        <Link
          href="/diagnosis"
          className="inline-block bg-[#1A6CF6] text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-[#1A5BE0] transition-colors duration-150"
        >
          診断をはじめる
        </Link>
      </div>
    </div>
  );
}
