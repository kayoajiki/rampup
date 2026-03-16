import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function AppHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("name, role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "member";
  const name = profile?.name ?? user.email;

  return (
    <header className="bg-white border-b border-[#E9E9E7] px-4 py-3 flex items-center justify-between sticky top-0 z-50">
      <Link
        href="/"
        className="text-base font-bold text-[#37352F] tracking-tight"
      >
        rampup
      </Link>

      <nav className="flex items-center gap-1">
        {role === "member" && (
          <>
            <NavLink href="/me">ホーム</NavLink>
            <NavLink href="/diagnosis">診断</NavLink>
            <NavLink href="/result">取扱説明書</NavLink>
            <NavLink href="/story">ストーリー</NavLink>
          </>
        )}

        {role === "manager" && (
          <>
            <NavLink href="/team">チーム</NavLink>
            <NavLink href="/meeting/new">1on1準備</NavLink>
            <NavLink href="/meeting/goal">目標設定</NavLink>
            <NavLink href="/meeting/feedback">査定FB</NavLink>
          </>
        )}

        {role === "admin" && (
          <>
            <NavLink href="/admin/dashboard">ダッシュボード</NavLink>
            <NavLink href="/admin/members">メンバー管理</NavLink>
          </>
        )}

        <span className="mx-2 text-[#E9E9E7]">|</span>
        <span className="text-xs text-[#9B9A97] hidden sm:block">{name}</span>
        <form action={signOut}>
          <button
            type="submit"
            className="ml-2 text-xs text-[#9B9A97] hover:text-[#37352F] transition-colors px-2 py-1 rounded hover:bg-[#F7F6F3]"
          >
            ログアウト
          </button>
        </form>
      </nav>
    </header>
  );
}

function NavLink({
  href,
  children,
}: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm text-[#37352F] hover:bg-[#F7F6F3] px-3 py-1.5 rounded-md transition-colors"
    >
      {children}
    </Link>
  );
}
