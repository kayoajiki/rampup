# 実装タスク：/team（チームホーム）

## やること
マネージャーが担当メンバーの診断状況を一覧で把握し、
面談準備へ最短で入れるチームホームページを作る。

## 前提・既存コード
- `diagnoses` テーブルのカラム名は `manual`・`scores`・`shared_with_manager`・`user_id`
- `manager_member_relationships` テーブルで担当メンバーを管理済み
- メンバー情報は `users` テーブル（`id`, `name`, `email`, `role`）
- `/meeting/new?memberId=[id]` でメンバー選択済みの面談準備画面へ遷移できる
- スタイルは既存ページに合わせる：bg-white, border-[#E9E9E7], text-[#37352F] など

---

## Step 1：作成するファイル

```
src/app/
└── team/
    └── page.tsx    ← 新規作成
```

---

## Step 2：src/app/team/page.tsx

Server Component（データ取得）＋ Client Component（インタラクション）の構成。

### データフロー
1. ログインユーザー（manager）の `manager_member_relationships` からメンバーID一覧取得
2. メンバーの `users` 情報取得
3. メンバーごとに `diagnoses` テーブルから最新の診断結果を取得し、ステータスを判定

### ステータス判定ロジック
| ステータス | 条件 | バッジ色 |
|-----------|------|---------|
| `shared` | 診断あり & `shared_with_manager = true` | 🟢 グリーン |
| `diagnosed` | 診断あり & `shared_with_manager = false` | 🟡 イエロー |
| `none` | 診断なし | ⚫ グレー |

### ソート順
グリーン → イエロー → グレー の順で表示（対応が必要な人が下になるよう）

---

## Step 3：コード全文

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import TeamClient from "./TeamClient";

type MemberStatus = "shared" | "diagnosed" | "none";

type MemberRow = {
  id: string;
  name: string | null;
  email: string;
  status: MemberStatus;
};

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ロール確認
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "manager") redirect("/me");

  // 担当メンバー一覧取得
  const { data: relationships } = await supabase
    .from("manager_member_relationships")
    .select("member_id")
    .eq("manager_id", user.id);

  const memberIds = (relationships ?? []).map((r) => r.member_id);

  if (memberIds.length === 0) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#9B9A97] text-sm">担当メンバーがいません</p>
          <p className="text-[#9B9A97] text-xs mt-1">管理者に連絡してください</p>
        </div>
      </div>
    );
  }

  // メンバー情報取得
  const { data: members } = await supabase
    .from("users")
    .select("id, name, email")
    .in("id", memberIds);

  // 診断状況取得（shared_with_manager が true のもの）
  const { data: diagnoses } = await supabase
    .from("diagnoses")
    .select("user_id, shared_with_manager")
    .in("user_id", memberIds)
    .order("created_at", { ascending: false });

  // メンバーごとのステータスを判定（最新の診断結果を使う）
  const diagnosisMap: Record<string, { shared: boolean }> = {};
  for (const d of diagnoses ?? []) {
    if (!diagnosisMap[d.user_id]) {
      diagnosisMap[d.user_id] = { shared: d.shared_with_manager };
    }
  }

  const memberRows: MemberRow[] = (members ?? []).map((m) => {
    const diag = diagnosisMap[m.id];
    let status: MemberStatus = "none";
    if (diag) {
      status = diag.shared ? "shared" : "diagnosed";
    }
    return { id: m.id, name: m.name, email: m.email, status };
  });

  // ソート: shared → diagnosed → none
  const statusOrder: Record<MemberStatus, number> = {
    shared: 0,
    diagnosed: 1,
    none: 2,
  };
  memberRows.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  const sharedCount = memberRows.filter((m) => m.status === "shared").length;

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-[#37352F]">
              チーム（{memberRows.length}名）
            </h1>
            <p className="text-sm text-[#9B9A97] mt-0.5">
              面談準備OK: {sharedCount}/{memberRows.length}名
            </p>
          </div>
        </div>

        {/* アバターチップ（上部：面談準備への最短経路） */}
        <div className="bg-white rounded-xl border border-[#E9E9E7] p-4 mb-4">
          <p className="text-xs text-[#9B9A97] mb-3">タップして面談準備を開始</p>
          <div className="flex flex-wrap gap-3">
            {memberRows.map((m) => (
              <AvatarChip key={m.id} member={m} />
            ))}
          </div>
        </div>

        {/* メンバー一覧 */}
        <div className="bg-white rounded-xl border border-[#E9E9E7] overflow-hidden">
          {memberRows.map((m, i) => (
            <div
              key={m.id}
              className={`flex items-center justify-between px-4 py-3.5 ${
                i < memberRows.length - 1 ? "border-b border-[#E9E9E7]" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <StatusDot status={m.status} />
                <div>
                  <p className="text-sm font-medium text-[#37352F]">
                    {m.name ?? m.email}
                  </p>
                  <p className="text-xs text-[#9B9A97] mt-0.5">
                    {m.status === "shared" && "診断済み・共有済み"}
                    {m.status === "diagnosed" && "診断済み・未共有"}
                    {m.status === "none" && "未診断"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {m.status === "shared" && (
                  <Link
                    href={`/meeting/new?memberId=${m.id}`}
                    className="text-xs bg-[#1A6CF6] text-white px-3 py-1.5 rounded-md hover:bg-[#1A5BE0] transition-colors"
                  >
                    面談準備 →
                  </Link>
                )}
                {m.status === "none" && (
                  <TeamClient memberName={m.name ?? m.email} memberEmail={m.email} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: MemberStatus }) {
  const colors = {
    shared: "bg-green-500",
    diagnosed: "bg-yellow-400",
    none: "bg-gray-300",
  };
  return (
    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors[status]}`} />
  );
}

function AvatarChip({ member }: { member: MemberRow }) {
  const initial = (member.name ?? member.email)[0].toUpperCase();
  const bgColors = {
    shared: "bg-green-100 border-green-300 hover:bg-green-200",
    diagnosed: "bg-yellow-50 border-yellow-300 hover:bg-yellow-100",
    none: "bg-gray-100 border-gray-200 cursor-default",
  };

  if (member.status !== "shared") {
    return (
      <div
        className={`flex flex-col items-center gap-1 opacity-50`}
        title={member.status === "diagnosed" ? "未共有のため面談準備不可" : "未診断"}
      >
        <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-base font-medium text-[#37352F] ${bgColors[member.status]}`}>
          {initial}
        </div>
        <span className="text-[10px] text-[#9B9A97] max-w-[48px] text-center truncate">
          {member.name ?? member.email}
        </span>
      </div>
    );
  }

  return (
    <Link href={`/meeting/new?memberId=${member.id}`}>
      <div className="flex flex-col items-center gap-1">
        <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-base font-medium text-[#37352F] ${bgColors[member.status]}`}>
          {initial}
        </div>
        <span className="text-[10px] text-[#9B9A97] max-w-[48px] text-center truncate">
          {member.name ?? member.email}
        </span>
      </div>
    </Link>
  );
}
```

---

## Step 4：src/app/team/TeamClient.tsx（「促す」ボタン）

「促す」はクライアントコンポーネントで実装する（クリップボードAPI使用のため）。

```tsx
"use client";

import { useState } from "react";

type Props = {
  memberName: string;
  memberEmail: string;
};

export default function TeamClient({ memberName, memberEmail }: Props) {
  const [copied, setCopied] = useState(false);

  const message = `${memberName}さん、rampupの診断をお願いします！あなたの特性を活かした関わりができるよう、ぜひやってみてください。`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
        copied
          ? "bg-green-50 border-green-300 text-green-700"
          : "border-[#E9E9E7] text-[#9B9A97] hover:border-[#37352F] hover:text-[#37352F]"
      }`}
    >
      {copied ? "コピーしました ✓" : "促す"}
    </button>
  );
}
```

---

## Step 5：/meeting/new でmemberIdを受け取る対応

`/meeting/new` は現在 `searchParams` を使っていない可能性がある。
**URLパラメータ `memberId` が渡ってきたら、メンバー選択ドロップダウンをその値でデフォルト選択にする。**

```tsx
// page.tsx の先頭に追加（"use client" コンポーネントの場合 useSearchParams を使う）
import { useSearchParams } from "next/navigation";

const searchParams = useSearchParams();
const preselectedMemberId = searchParams.get("memberId") ?? "";

// membersを取得した後、初期値を設定
const [selectedMemberId, setSelectedMemberId] = useState(preselectedMemberId);
```

---

## 完成後の見え方

```
チーム（5名）
面談準備OK: 3/5名

タップして面談準備を開始
[山田] [田中] [鈴木]  ← グリーン（タップで面談準備へ）
[佐藤] [高橋]         ← グレー（薄表示・タップ不可）

─── メンバー一覧 ───────────────────────────
● 山田花子  診断済み・共有済み           [面談準備 →]
● 田中一郎  診断済み・共有済み           [面談準備 →]
● 鈴木美咲  診断済み・共有済み           [面談準備 →]
● 佐藤 健   診断済み・未共有
● 高橋由美  未診断                       [促す]
```

---

## 注意点

- `diagnoses` テーブルのカラム名は `manual`（`manual_text` ではない）
- `diagnostic_results` テーブル（schema.sqlに記載）は**使わない**。実際のデータは `diagnoses` テーブルにある
- メール送信機能（`/api/notifications/send-reminder`）はMVPでは実装しない。「促す」はクリップボードコピーのみ
- `shared_with_manager` が `false` のメンバー（🟡イエロー）は面談準備ボタンを出さない。メンバー本人がresultページで共有ONにするのを待つ
