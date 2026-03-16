# 実装タスク：共通ナビゲーション

## やること
全ページ共通のヘッダーナビゲーションを作る。
ロールに応じてメニュー項目を切り替える。ログアウトボタンを全ページに表示する。

## 既存コードの注意点
- `src/app/me/page.tsx` にすでにヘッダーとログアウトボタンが実装されている（後でこれを削除する）
- ログアウトはServer Actionで実装済み（me/page.tsxのsignOut関数を参照）
- スタイルは既存ページに合わせる：bg-white, border-[#E9E9E7], text-[#37352F] など

---

## Step 1：作成するファイル

```
src/
├── components/
│   └── AppHeader.tsx       ← 新規作成（Server Component）
└── app/
    └── layout.tsx          ← 編集（AppHeaderを追加）
```

---

## Step 2：src/components/AppHeader.tsx

ロールを取得してメニューを切り替えるServer Component。

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

async function signOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export default async function AppHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 未ログインはヘッダー非表示（loginページ用）
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'member'
  const name = profile?.name ?? user.email

  return (
    <header className="bg-white border-b border-[#E9E9E7] px-4 py-3 flex items-center justify-between sticky top-0 z-50">
      {/* ロゴ */}
      <Link href="/" className="text-base font-bold text-[#37352F] tracking-tight">
        rampup
      </Link>

      {/* ナビゲーション */}
      <nav className="flex items-center gap-1">
        {/* member メニュー */}
        {(role === 'member') && (
          <>
            <NavLink href="/me">ホーム</NavLink>
            <NavLink href="/diagnosis">診断</NavLink>
            <NavLink href="/result">取扱説明書</NavLink>
          </>
        )}

        {/* manager メニュー */}
        {(role === 'manager') && (
          <>
            <NavLink href="/team">チーム</NavLink>
            <NavLink href="/meeting/new">面談準備</NavLink>
          </>
        )}

        {/* admin メニュー */}
        {(role === 'admin') && (
          <>
            <NavLink href="/admin/dashboard">ダッシュボード</NavLink>
            <NavLink href="/admin/members">メンバー管理</NavLink>
          </>
        )}

        {/* 区切り */}
        <span className="mx-2 text-[#E9E9E7]">|</span>

        {/* ユーザー名 */}
        <span className="text-xs text-[#9B9A97] hidden sm:block">{name}</span>

        {/* ログアウト */}
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
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm text-[#37352F] hover:bg-[#F7F6F3] px-3 py-1.5 rounded-md transition-colors"
    >
      {children}
    </Link>
  )
}
```

---

## Step 3：src/app/layout.tsx を編集

AppHeader を追加する。ただし `/login` ページではヘッダーを出さないため、
AppHeader 内で `user === null` のとき `return null` しているので問題ない。

```tsx
import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/AppHeader";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "rampup",
  description: "面談準備と動機DBのためのプロダクト",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${inter.variable} ${notoSansJp.variable} antialiased`}>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
```

---

## Step 4：me/page.tsx の既存ヘッダーを削除

`src/app/me/page.tsx` の以下の部分を削除する（AppHeaderで代替するため）：

```tsx
// ↓ この <header>...</header> ブロックを削除
<header className="bg-white border-b border-[#E9E9E7] px-6 py-4 flex items-center justify-between">
  <h1 className="text-lg font-semibold text-[#37352F]">rampup</h1>
  <form action={signOut}>
    <button type="submit" ...>ログアウト</button>
  </form>
</header>

// signOut関数も削除（AppHeaderに移動済み）
async function signOut() { ... }
```

---

## 完成後の見え方

### memberでログイン時
```
[ rampup ]  ホーム  診断  取扱説明書  |  test@rampup.dev  ログアウト
```

### managerでログイン時
```
[ rampup ]  チーム  面談準備  |  mane@rampup.dev  ログアウト
```

### 未ログイン（/loginページ）
```
（ヘッダーなし）
```
