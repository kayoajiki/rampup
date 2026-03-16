# 修正タスク：既存ファイルの整合性修正

## やること（4点）

1. 診断完了と同時にマネージャーへ自動共有（`shared_with_manager` を廃止）
2. `/story` の取扱説明書参照クエリから共有フラグ条件を削除
3. `/team` のステータス表示を新設計に変更（🟢診断済み / ⚫未診断 / 📖ストーリー入力済み）
4. `meeting_preps` に `manager_expectations` カラムを追加（`/meeting/goal` 向け）

---

## Step 1：Supabase SQL Editor で実行

```sql
-- meeting_preps に今期の期待入力欄を追加
ALTER TABLE meeting_preps
  ADD COLUMN IF NOT EXISTS manager_expectations text;
```

---

## Step 2：/api/generate-manual/route.ts を編集

診断保存時に `shared_with_manager: true` を追加する。

### 変更箇所（line 89〜94）

```ts
// 変更前
await supabase.from("diagnoses").insert({
  user_id: user.id,
  scores,
  manual,
  report,
});

// 変更後
await supabase.from("diagnoses").insert({
  user_id: user.id,
  scores,
  manual,
  report,
  shared_with_manager: true,   // ← 追加：診断完了と同時に自動共有
});
```

---

## Step 3：/api/meeting/member-detail/route.ts を編集

`shared_with_manager` チェックを削除し、診断があれば取扱説明書を返すようにする。

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");
    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: diagnosis } = await supabase
      .from("diagnoses")
      .select("manual")
      .eq("user_id", memberId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: lastPrep } = await supabase
      .from("meeting_preps")
      .select("post_meeting_notes")
      .eq("manager_id", user.id)
      .eq("member_id", memberId)
      .not("post_meeting_notes", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!diagnosis?.manual) {
      return NextResponse.json({
        manual: null,
        hasShared: false,
        lastPostMeetingNotes: null,
      });
    }

    return NextResponse.json({
      manual: diagnosis.manual,
      hasShared: true,
      lastPostMeetingNotes: lastPrep?.post_meeting_notes ?? null,
    });
  } catch (error) {
    console.error("meeting/member-detail error", error);
    return NextResponse.json({ error: "failed to fetch member detail" }, { status: 500 });
  }
}
```

---

## Step 4：/story/page.tsx を編集

取扱説明書参照クエリから `shared_with_manager` フィルタを削除する。

### 変更箇所（line 27〜34）

```ts
// 変更前
const { data: diagnosis } = await supabase
  .from("diagnoses")
  .select("manual")
  .eq("user_id", user.id)
  .eq("shared_with_manager", true)   // ← この行を削除
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

// 変更後
const { data: diagnosis } = await supabase
  .from("diagnoses")
  .select("manual")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
```

---

## Step 5：/result/page.tsx を編集

診断完了後に「マネージャーに共有されました」メッセージを追加する。

### 変更箇所：タイトル直下に追加

```tsx
// 変更前
<h1 className="text-2xl font-bold text-[#37352F] mb-1">あなたの取扱説明書</h1>
<p className="text-sm text-[#9B9A97] mb-8">診断結果をもとに生成しました</p>

// 変更後
<h1 className="text-2xl font-bold text-[#37352F] mb-1">あなたの取扱説明書</h1>
<p className="text-sm text-[#9B9A97] mb-3">診断結果をもとに生成しました</p>
<div className="mb-6 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-2.5">
  <span className="text-green-600 text-sm">✓</span>
  <p className="text-sm text-green-700">マネージャーに共有されました</p>
</div>
```

---

## Step 6：/team/page.tsx を全面更新

ステータスを `"diagnosed" | "none"` の2種に整理し、ストーリー入力状況を `hasStory` で別管理する。

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import TeamClient from "./TeamClient";

type MemberStatus = "diagnosed" | "none";

type MemberRow = {
  id: string;
  name: string | null;
  email: string;
  status: MemberStatus;
  hasStory: boolean;
};

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "manager") redirect("/me");

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

  const { data: members } = await supabase
    .from("users")
    .select("id, name, email")
    .in("id", memberIds);

  // 診断状況
  const { data: diagnoses } = await supabase
    .from("diagnoses")
    .select("user_id")
    .in("user_id", memberIds)
    .order("created_at", { ascending: false });

  const diagnosisSet = new Set((diagnoses ?? []).map((d) => d.user_id));

  // ストーリー入力状況（WCM or 転換点が1件以上）
  const { data: storyData } = await supabase
    .from("my_stories")
    .select("user_id, will_now, will_career, can_strengths, can_development, must_mission")
    .in("user_id", memberIds);

  const { data: milestoneData } = await supabase
    .from("story_milestones")
    .select("user_id")
    .in("user_id", memberIds);

  const storySet = new Set<string>();
  for (const s of storyData ?? []) {
    if (s.will_now || s.will_career || s.can_strengths || s.can_development || s.must_mission) {
      storySet.add(s.user_id);
    }
  }
  for (const m of milestoneData ?? []) {
    storySet.add(m.user_id);
  }

  const memberRows: MemberRow[] = (members ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email ?? "",
    status: diagnosisSet.has(m.id) ? "diagnosed" : "none",
    hasStory: storySet.has(m.id),
  }));

  const statusOrder: Record<MemberStatus, number> = { diagnosed: 0, none: 1 };
  memberRows.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  const diagnosedCount = memberRows.filter((m) => m.status === "diagnosed").length;

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-[#37352F]">
              チーム（{memberRows.length}名）
            </h1>
            <p className="text-sm text-[#9B9A97] mt-0.5">
              診断済み: {diagnosedCount}/{memberRows.length}名
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E9E9E7] p-4 mb-4">
          <p className="text-xs text-[#9B9A97] mb-3">タップして詳細を確認</p>
          <div className="flex flex-wrap gap-3">
            {memberRows.map((m) => (
              <AvatarChip key={m.id} member={m} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E9E9E7] overflow-hidden">
          {memberRows.map((m, i) => (
            <div
              key={m.id}
              className={`flex items-center justify-between px-4 py-3.5 ${
                i < memberRows.length - 1 ? "border-b border-[#E9E9E7]" : ""
              }`}
            >
              <Link
                href={`/members/${m.id}`}
                className="flex items-center gap-3 hover:opacity-70 transition-opacity"
              >
                <StatusDot status={m.status} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-[#37352F]">
                      {m.name ?? m.email}
                    </p>
                    {m.hasStory && (
                      <span className="text-xs text-[#9B9A97]" title="ストーリー入力済み">
                        📖
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#9B9A97] mt-0.5">
                    {m.status === "diagnosed" ? "診断済み" : "未診断"}
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-2">
                {m.status === "diagnosed" && (
                  <Link
                    href={`/meeting/new?memberId=${m.id}`}
                    className="text-xs bg-[#1A6CF6] text-white px-3 py-1.5 rounded-md hover:bg-[#1A5BE0] transition-colors"
                  >
                    面談準備 →
                  </Link>
                )}
                {m.status === "none" && (
                  <TeamClient
                    memberName={m.name ?? m.email}
                    memberEmail={m.email}
                  />
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
  const colors: Record<MemberStatus, string> = {
    diagnosed: "bg-green-500",
    none: "bg-gray-300",
  };
  return (
    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors[status]}`} />
  );
}

function AvatarChip({ member }: { member: MemberRow }) {
  const initial = (member.name ?? member.email)[0].toUpperCase();
  const bgColors: Record<MemberStatus, string> = {
    diagnosed: "bg-green-100 border-green-300 hover:bg-green-200",
    none: "bg-gray-100 border-gray-200 cursor-default",
  };

  if (member.status === "none") {
    return (
      <div className="flex flex-col items-center gap-1 opacity-50">
        <div
          className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-base font-medium text-[#37352F] ${bgColors[member.status]}`}
        >
          {initial}
        </div>
        <span className="text-[10px] text-[#9B9A97] max-w-[48px] text-center truncate">
          {member.name ?? member.email}
        </span>
      </div>
    );
  }

  return (
    <Link href={`/members/${member.id}`}>
      <div className="flex flex-col items-center gap-1">
        <div
          className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-base font-medium text-[#37352F] ${bgColors[member.status]}`}
        >
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

## 変更サマリー

| ファイル | 変更内容 |
|---|---|
| `api/generate-manual/route.ts` | `shared_with_manager: true` を insert に追加 |
| `api/meeting/member-detail/route.ts` | `shared_with_manager` チェックを削除 |
| `story/page.tsx` | 取扱説明書クエリから `.eq("shared_with_manager", true)` を削除 |
| `result/page.tsx` | 「マネージャーに共有されました」バナーを追加 |
| `team/page.tsx` | ステータスを2種に整理、ストーリー入力状況（📖）を追加 |
| Supabase SQL | `meeting_preps` に `manager_expectations` カラム追加 |

## 注意点

- `AvatarChip` のリンク先を `/meeting/new` から `/members/[id]` に変更している（チームページからはハブページ経由が自然なため）
- `diagnosedCount` の表示文言を「面談準備OK」→「診断済み」に変更
- ストーリーの 📖 バッジはアイコンのみ（名前の横に小さく）、title 属性でホバー時に「ストーリー入力済み」と表示
