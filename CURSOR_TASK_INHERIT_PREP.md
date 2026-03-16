# 実装タスク：前回の面談準備を引き継ぐ機能

## やること
`/meeting/new` でメンバーを選択したとき、そのメンバーへの直近の面談準備（`meeting_preps`）があれば
「前回の面談準備（X日前・1on1）を引き継ぐ」バナーを表示する。
クリックで `previousNotes` テキストエリアに前回の「面談で扱うと良いテーマ」セクションを自動転記する。

---

## 変更ファイル

```
src/app/
├── api/meeting/member-detail/route.ts   ← 編集（lastPrepを追加）
└── meeting/new/page.tsx                 ← 編集（バナーUI追加）
```

---

## Step 1：src/app/api/meeting/member-detail/route.ts を編集

`lastPrep`（直近の面談準備）を返すよう拡張する。

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

    // 診断結果（変更なし）
    const { data: diagnosis } = await supabase
      .from("diagnoses")
      .select("manual, shared_with_manager")
      .eq("user_id", memberId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 前回の面談準備を取得（追加）
    const { data: lastPrep } = await supabase
      .from("meeting_preps")
      .select("id, meeting_type, ai_output, created_at")
      .eq("manager_id", user.id)
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!diagnosis?.manual || !diagnosis.shared_with_manager) {
      return NextResponse.json({ manual: null, hasShared: false, lastPrep: null });
    }

    return NextResponse.json({
      manual: diagnosis.manual,
      hasShared: true,
      lastPrep: lastPrep ?? null,
    });
  } catch (error) {
    console.error("meeting/member-detail error", error);
    return NextResponse.json({ error: "failed to fetch member detail" }, { status: 500 });
  }
}
```

---

## Step 2：src/app/meeting/new/page.tsx を編集

### 追加する型・state

```tsx
// 型定義（MemberStatusなどの下に追加）
type LastPrep = {
  id: string;
  meeting_type: string;
  ai_output: string;
  created_at: string;
} | null;

// stateに追加
const [lastPrep, setLastPrep] = useState<LastPrep>(null);
```

### useEffectの修正

メンバー選択時に `lastPrep` も取得するよう既存のuseEffectを修正する：

```tsx
useEffect(() => {
  if (!selectedMemberId) {
    setManual(null);
    setLastPrep(null);
    return;
  }
  setManual(null);
  setLastPrep(null);
  fetch(`/api/meeting/member-detail?memberId=${encodeURIComponent(selectedMemberId)}`)
    .then((r) => r.json())
    .then((data) => {
      setManual(data.manual ?? null);
      setLastPrep(data.lastPrep ?? null);
    });
}, [selectedMemberId]);
```

### 「引き継ぐ」バナーと inheritLastPrep 関数

```tsx
// parseSectionsと同じ関数を使ってテーマセクションを抽出
const inheritLastPrep = useCallback(() => {
  if (!lastPrep?.ai_output) return;
  const sections = parseSections(lastPrep.ai_output);
  const theme = sections["面談で扱うと良いテーマ"];
  if (theme) {
    setPreviousNotes(theme);
  }
}, [lastPrep]);

// 日付フォーマット用（コンポーネント内に追加）
function daysAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "今日";
  if (days === 1) return "昨日";
  return `${days}日前`;
}

const MEETING_TYPE_LABELS: Record<string, string> = {
  goal: "目標設定面談",
  feedback: "査定・フィードバック面談",
  "1on1": "通常1on1",
};
```

### バナーのJSX

**メンバー選択ドロップダウンの直後**（面談タイプ選択の前）に追加する：

```tsx
{/* 前回の面談準備バナー */}
{lastPrep && (
  <div className="mb-6 flex items-center justify-between bg-[#F0F5FF] border border-[#C7D9FF] rounded-lg px-4 py-3">
    <div>
      <p className="text-xs font-medium text-[#1A6CF6]">
        前回の面談準備があります
      </p>
      <p className="text-xs text-[#9B9A97] mt-0.5">
        {daysAgo(lastPrep.created_at)}・{MEETING_TYPE_LABELS[lastPrep.meeting_type] ?? lastPrep.meeting_type}
      </p>
    </div>
    <button
      type="button"
      onClick={inheritLastPrep}
      className="text-xs text-[#1A6CF6] font-medium hover:underline ml-4 shrink-0"
    >
      引き継ぐ →
    </button>
  </div>
)}
```

---

## 完成後の動作

1. `/meeting/new` でメンバーを選択
2. そのメンバーへの面談準備履歴があれば青いバナーが出現
   ```
   ┌────────────────────────────────────────────┐
   │  前回の面談準備があります          引き継ぐ → │
   │  3日前・通常1on1                            │
   └────────────────────────────────────────────┘
   ```
3. 「引き継ぐ →」をクリック → 「前回の1on1メモ・アクションアイテム」に前回の「面談で扱うと良いテーマ」が自動転記される
4. 転記後はそのまま編集して「⚡ 準備する」で新しい面談準備を生成

---

## 注意点

- `parseSections` は既存の関数をそのまま使う（`✅` と `【】` 両形式対応済み）
- `daysAgo` と `MEETING_TYPE_LABELS` は page.tsx 内のどこかに定義する（コンポーネントの外でも中でも可）
- `inheritLastPrep` は `previousNotes` をセットするだけ。「引き継いだ」という状態管理は不要（シンプルに）
- バナーは `lastPrep` が null のときは非表示（何も表示しない）
