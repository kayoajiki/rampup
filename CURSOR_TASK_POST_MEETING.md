# 実装タスク：面談後メモ＋自動引き継ぎ

## やること
- 面談準備の出力エリアに「面談後メモ」欄を追加（議事録・Slackログを貼れる）
- 保存した内容が次回同じメンバーの準備時に「前回の1on1メモ」へ自動転記される
- 既存の「青いバナー＋引き継ぐボタン」は削除する

## 変更・新規ファイル

```
src/app/
├── api/meeting/member-detail/route.ts      ← 編集
├── api/meeting-preps/[id]/post-notes/
│   └── route.ts                            ← 新規（PATCH）
└── meeting/new/page.tsx                    ← 編集
```

---

## Step 1：Supabase SQL Editor で実行

```sql
ALTER TABLE meeting_preps
  ADD COLUMN IF NOT EXISTS post_meeting_notes text;
```

---

## Step 2：api/meeting/member-detail/route.ts を編集

`lastPrep` の代わりに `lastPostMeetingNotes`（前回の面談後メモのみ）を返すよう変更する。

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
      .select("manual, shared_with_manager")
      .eq("user_id", memberId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 前回の面談後メモを取得（post_meeting_notesがあるものの中で最新）
    const { data: lastPrep } = await supabase
      .from("meeting_preps")
      .select("post_meeting_notes")
      .eq("manager_id", user.id)
      .eq("member_id", memberId)
      .not("post_meeting_notes", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!diagnosis?.manual || !diagnosis.shared_with_manager) {
      return NextResponse.json({ manual: null, hasShared: false, lastPostMeetingNotes: null });
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

## Step 3：api/meeting-preps/[id]/post-notes/route.ts（新規）

面談後メモを保存するPATCHエンドポイント。

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { postMeetingNotes } = await request.json() as { postMeetingNotes: string };

    if (!postMeetingNotes?.trim()) {
      return NextResponse.json({ error: "postMeetingNotes is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase
      .from("meeting_preps")
      .update({ post_meeting_notes: postMeetingNotes.trim() })
      .eq("id", id)
      .eq("manager_id", user.id); // 自分の準備のみ更新可

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("post-notes PATCH error", error);
    return NextResponse.json({ error: "failed to save" }, { status: 500 });
  }
}
```

---

## Step 4：meeting/new/page.tsx を編集

### 削除するもの
- `LastPrep` 型
- `daysAgo` 関数
- `MEETING_TYPE_LABELS` 定数
- `lastPrep` state と `setLastPrep`
- `inheritLastPrep` 関数
- 青いバナーのJSX（`{lastPrep && ( <div className="mb-6 flex ...`）

### 追加・変更するstate

```tsx
// 追加
const [lastPostMeetingNotes, setLastPostMeetingNotes] = useState<string | null>(null);
const [postMeetingNotes, setPostMeetingNotes] = useState("");
const [postNotesSaved, setPostNotesSaved] = useState(false);
const [postNotesSaving, setPostNotesSaving] = useState(false);
```

### useEffect の修正（メンバー選択時）

```tsx
useEffect(() => {
  if (!selectedMemberId) {
    setManual(null);
    setLastPostMeetingNotes(null);
    setPreviousNotes("");
    return;
  }
  setManual(null);
  setLastPostMeetingNotes(null);
  fetch(`/api/meeting/member-detail?memberId=${encodeURIComponent(selectedMemberId)}`)
    .then((r) => r.json())
    .then((data) => {
      setManual(data.manual ?? null);
      const notes = data.lastPostMeetingNotes ?? null;
      setLastPostMeetingNotes(notes);
      if (notes) setPreviousNotes(notes); // 自動転記
    });
}, [selectedMemberId]);
```

### 面談後メモ保存ハンドラ

```tsx
const handleSavePostNotes = useCallback(async () => {
  if (!prepId || !postMeetingNotes.trim()) return;
  setPostNotesSaving(true);
  try {
    const res = await fetch(`/api/meeting-preps/${prepId}/post-notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postMeetingNotes }),
    });
    if (res.ok) {
      setPostNotesSaved(true);
    }
  } finally {
    setPostNotesSaving(false);
  }
}, [prepId, postMeetingNotes]);
```

### 「前回の1on1メモ」テキストエリアの下に追記ラベルを追加

テキストエリアの下（`</div>` の直前）に以下を追加：

```tsx
{lastPostMeetingNotes && previousNotes === lastPostMeetingNotes && (
  <p className="mt-1 text-xs text-[#9B9A97]">前回の面談メモを引き継ぎました（編集できます）</p>
)}
```

### 出力エリアに「面談後メモ」セクションを追加

👍/👎 フィードバックブロックの**直後**（取扱説明書の折りたたみの前）に追加：

```tsx
{prepId && (
  <div className="mt-6 pt-6 border-t border-[#E9E9E7]">
    <h3 className="text-sm font-medium text-[#37352F] mb-1">面談後メモ</h3>
    <p className="text-xs text-[#9B9A97] mb-2">
      議事録・Slackログをそのまま貼ってください。次回の面談準備に自動で引き継がれます。
    </p>
    <textarea
      value={postMeetingNotes}
      onChange={(e) => setPostMeetingNotes(e.target.value)}
      placeholder="今日の面談で話したこと、決めたこと、次回確認したいことなど"
      rows={4}
      className="w-full rounded-lg border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] placeholder:text-[#9B9A97] focus:outline-none focus:ring-2 focus:ring-[#1A6CF6]/30 resize-none"
    />
    <div className="mt-2 flex items-center gap-3">
      <button
        type="button"
        onClick={handleSavePostNotes}
        disabled={!postMeetingNotes.trim() || postNotesSaving || postNotesSaved}
        className="text-sm bg-[#1A6CF6] text-white px-4 py-1.5 rounded-lg disabled:opacity-40 hover:bg-[#1A5BE0] transition-colors"
      >
        {postNotesSaved ? "保存しました ✓" : postNotesSaving ? "保存中..." : "保存する"}
      </button>
      {postNotesSaved && (
        <p className="text-xs text-[#9B9A97]">次回の面談準備に自動で引き継がれます</p>
      )}
    </div>
  </div>
)}
```

---

## 完成後の動作フロー

```
【初回】
メンバー選択 → 前回メモなし → 「前回の1on1メモ」は空
⚡ 準備する → AI出力表示 → 👍/👎
面談後メモ欄に議事録を貼る → 「保存する」→ 「保存しました ✓」

【2回目以降】
メンバー選択 → 「前回の1on1メモ」に前回の面談後メモが自動転記
               └ 「前回の面談メモを引き継ぎました（編集できます）」
⚡ 準備する → AI出力表示（前回のメモを踏まえた内容に）
面談後メモ欄に今回の議事録を入力 → 「保存する」
```

---

## 注意点

- `post_meeting_notes` カラムを追加するStep 1のSQLを先に実行すること
- `previousNotes` の自動転記はあくまで初期値。ユーザーが自由に編集・削除できる
- `postNotesSaved` は一度 `true` になったらボタンを disabled のままにする（再保存ボタンは不要）
- `handleSavePostNotes` は `prepId` がある（AI出力済み）ときのみ動作する
