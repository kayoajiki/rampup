# 実装タスク：/members/[id]（メンバー詳細 + マネージャーメモ）

## やること
マネージャーが特定メンバーの取扱説明書を確認し、メモを追加できるページを作る。
面談準備への固定ボタンで最短2タップで面談準備へ入れる。

## 前提・既存コード
- `diagnoses` テーブルのカラム：`user_id`, `manual`, `scores`, `shared_with_manager`, `created_at`
- `users` テーブルのカラム：`id`, `name`, `email`, `role`
- `manager_member_relationships` で担当関係を管理済み
- スタイル：bg-white, border-[#E9E9E7], text-[#37352F], accent: #1A6CF6

---

## Step 1：Supabase SQL Editor で実行

```sql
-- マネージャーの日常メモテーブル（未作成の場合）
CREATE TABLE IF NOT EXISTS member_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id  uuid REFERENCES users,
  member_id   uuid REFERENCES users,
  content     text NOT NULL,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE member_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member_notes: manager self" ON member_notes
  FOR ALL USING (manager_id = auth.uid());
```

---

## Step 2：作成・編集するファイル

```
src/app/
├── members/
│   └── [id]/
│       ├── page.tsx          ← 新規作成（Server Component）
│       └── MemberNoteForm.tsx ← 新規作成（Client Component）
└── api/
    └── member-notes/
        └── route.ts          ← 新規作成（POST）
```

また、`/team/page.tsx` のメンバー一覧行をリンクにする（後述）。

---

## Step 3：/api/member-notes/route.ts

```ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const { memberId, content } = await request.json() as {
      memberId: string
      content: string
    }

    if (!memberId || !content?.trim()) {
      return NextResponse.json({ error: "memberId and content are required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("member_notes")
      .insert({
        manager_id: user.id,
        member_id:  memberId,
        content:    content.trim(),
      })
      .select("id, content, created_at")
      .single()

    if (error) throw error

    return NextResponse.json({ note: data })
  } catch (error) {
    console.error("member-notes POST error", error)
    return NextResponse.json({ error: "failed to save note" }, { status: 500 })
  }
}
```

---

## Step 4：/members/[id]/page.tsx

```tsx
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import MemberNoteForm from "./MemberNoteForm"

type Note = {
  id: string
  content: string
  created_at: string
}

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: memberId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // ロール確認（managerのみ）
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()
  if (profile?.role !== "manager") redirect("/me")

  // 担当メンバーか確認
  const { data: rel } = await supabase
    .from("manager_member_relationships")
    .select("member_id")
    .eq("manager_id", user.id)
    .eq("member_id", memberId)
    .single()
  if (!rel) notFound()

  // メンバー情報
  const { data: member } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("id", memberId)
    .single()
  if (!member) notFound()

  // 診断結果（最新）
  const { data: diagnosis } = await supabase
    .from("diagnoses")
    .select("manual, shared_with_manager")
    .eq("user_id", memberId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  // マネージャーメモ（直近30日・新しい順）
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: notes } = await supabase
    .from("member_notes")
    .select("id, content, created_at")
    .eq("manager_id", user.id)
    .eq("member_id", memberId)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })

  const memberName = member.name ?? member.email
  const hasManual = !!diagnosis?.manual && diagnosis.shared_with_manager

  return (
    <div className="min-h-screen bg-[#F7F6F3] pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* ヘッダー */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/team" className="text-sm text-[#9B9A97] hover:text-[#37352F] transition-colors">
            ← チームに戻る
          </Link>
        </div>

        {/* プロフィールサマリー */}
        <div className="bg-white rounded-xl border border-[#E9E9E7] p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-[#37352F]">{memberName}</h1>
              <p className="text-xs text-[#9B9A97] mt-0.5">{member.email}</p>
            </div>
            <StatusBadge hasManual={hasManual} shared={diagnosis?.shared_with_manager ?? false} />
          </div>
        </div>

        {/* 取扱説明書 */}
        <div className="bg-white rounded-xl border border-[#E9E9E7] overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-[#E9E9E7]">
            <h2 className="text-sm font-medium text-[#37352F]">取扱説明書</h2>
          </div>

          {hasManual ? (
            <ManualSection manual={diagnosis!.manual} />
          ) : (
            <div className="px-4 py-6 text-center">
              {diagnosis && !diagnosis.shared_with_manager ? (
                <>
                  <p className="text-sm text-[#9B9A97]">診断済みですが、まだ共有されていません</p>
                  <p className="text-xs text-[#9B9A97] mt-1">メンバーが共有をONにするまでお待ちください</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-[#9B9A97]">まだ診断が完了していません</p>
                  <p className="text-xs text-[#9B9A97] mt-1">メンバーに診断を促してください</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* マネージャーメモ */}
        <div className="bg-white rounded-xl border border-[#E9E9E7] overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-[#E9E9E7]">
            <h2 className="text-sm font-medium text-[#37352F]">マネージャーメモ</h2>
            <p className="text-xs text-[#9B9A97] mt-0.5">直近30日分が面談準備AIに自動連携されます</p>
          </div>

          {/* メモ追加フォーム */}
          <div className="px-4 py-3 border-b border-[#E9E9E7]">
            <MemberNoteForm memberId={memberId} />
          </div>

          {/* メモ一覧 */}
          <div>
            {(notes ?? []).length === 0 ? (
              <p className="px-4 py-4 text-sm text-[#9B9A97] text-center">まだメモがありません</p>
            ) : (
              (notes ?? []).map((note: Note) => (
                <div key={note.id} className="px-4 py-3 border-b border-[#E9E9E7] last:border-b-0">
                  <p className="text-xs text-[#9B9A97] mb-1">
                    {new Date(note.created_at).toLocaleDateString("ja-JP", {
                      month: "numeric",
                      day:   "numeric",
                    })}
                  </p>
                  <p className="text-sm text-[#37352F] whitespace-pre-wrap">{note.content}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* 面談準備ボタン（固定） */}
      {hasManual && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E9E9E7] px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <Link
              href={`/meeting/new?memberId=${memberId}`}
              className="block w-full bg-[#1A6CF6] text-white text-center text-sm font-medium py-3 rounded-lg hover:bg-[#1A5BE0] transition-colors"
            >
              ⚡ 面談準備する
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({
  hasManual,
  shared,
}: {
  hasManual: boolean
  shared: boolean
}) {
  if (hasManual) {
    return (
      <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-full">
        🟢 共有済み
      </span>
    )
  }
  if (shared === false && !hasManual) {
    return (
      <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-1 rounded-full">
        🟡 未共有
      </span>
    )
  }
  return (
    <span className="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2 py-1 rounded-full">
      ⚫ 未診断
    </span>
  )
}

function ManualSection({ manual }: { manual: string }) {
  // 段落ごとに分割して表示
  const paragraphs = manual.split(/\n{2,}/).filter(Boolean)

  return (
    <div className="px-4 py-4 space-y-3 max-h-64 overflow-y-auto">
      {paragraphs.map((para, i) => (
        <p key={i} className="text-sm text-[#37352F] whitespace-pre-wrap leading-relaxed">
          {para}
        </p>
      ))}
    </div>
  )
}
```

---

## Step 5：/members/[id]/MemberNoteForm.tsx

```tsx
"use client"

import { useState } from "react"

export default function MemberNoteForm({ memberId }: { memberId: string }) {
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    setSaving(true)
    try {
      const res = await fetch("/api/member-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, content }),
      })
      if (res.ok) {
        setContent("")
        setSaved(true)
        setTimeout(() => {
          setSaved(false)
          // ページをリロードしてメモ一覧を更新
          window.location.reload()
        }, 800)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="気づいたことをメモ...（Slackコピペ・箇条書きOK）"
        className="flex-1 text-sm border border-[#E9E9E7] rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#1A6CF6] text-[#37352F] placeholder:text-[#9B9A97]"
        rows={2}
      />
      <button
        type="submit"
        disabled={!content.trim() || saving}
        className="text-xs bg-[#1A6CF6] text-white px-3 py-2 rounded-lg disabled:opacity-40 hover:bg-[#1A5BE0] transition-colors self-end"
      >
        {saved ? "✓" : saving ? "..." : "追加"}
      </button>
    </form>
  )
}
```

---

## Step 6：/team/page.tsx の修正（メンバー名をリンクにする）

`/team/page.tsx` のメンバー一覧行を `/members/[id]` へのリンクにする。

現在のメンバー行（名前・ステータス部分）を `<Link>` で囲む：

```tsx
// 変更前：<div className="flex items-center gap-3">
// 変更後：
<Link href={`/members/${m.id}`} className="flex items-center gap-3 hover:opacity-70 transition-opacity">
  <StatusDot status={m.status} />
  <div>
    <p className="text-sm font-medium text-[#37352F]">{m.name ?? m.email}</p>
    <p className="text-xs text-[#9B9A97] mt-0.5">
      {m.status === "shared" && "診断済み・共有済み"}
      {m.status === "diagnosed" && "診断済み・未共有"}
      {m.status === "none" && "未診断"}
    </p>
  </div>
</Link>
```

また、`/team/page.tsx` の先頭の import に `Link` がすでにある場合は追加不要。

---

## 完成後の動作

1. `/team` のメンバー名をクリック → `/members/[memberId]` へ遷移
2. 取扱説明書が表示（共有済みの場合）
3. メモ入力 → 「追加」→ 一覧に追加される
4. 画面下の「⚡ 面談準備する」→ `/meeting/new?memberId=[id]` へ遷移（メンバー事前選択済み）

---

## 注意点

- `params` は Next.js 15 では `Promise<{ id: string }>` のため `await params` が必要
- `member_notes` テーブルがまだない場合は Step 1 のSQLを先に実行すること
- メモ追加後は `window.location.reload()` でページ更新（Server Componentのリフレッシュのため）
- 取扱説明書は `max-h-64 overflow-y-auto` で高さを制限し、スクロール表示
