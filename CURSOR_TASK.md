# 実装タスク：/meeting/new（面談準備AI）

## 前提・既存コード

```
src/
├── app/
│   ├── api/generate-manual/route.ts  ✅ 実装済み（AWS Bedrock使用）
│   ├── diagnosis/page.tsx            ✅ 実装済み
│   ├── result/page.tsx               ✅ 実装済み（sessionStorageからscores/manual読み込み）
│   ├── login/page.tsx                ✅ 実装済み
│   └── me/page.tsx                   ✅ 実装済み
├── lib/
│   ├── supabase/client.ts            ✅ 実装済み
│   ├── supabase/server.ts            ✅ 実装済み
│   ├── scoring.ts                    ✅ ThemeScore[]型を返す
│   └── data/questions.ts             ✅ themes配列あり
└── middleware.ts                     ✅ 認証ガード済み
```

**重要：AI呼び出しはAWS Bedrockを使用する。**
```ts
// 既存パターン（generate-manual/route.tsを参照）
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"
const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})
// modelId: "anthropic.claude-3-haiku-20240307-v1:0"
```

**診断結果は `diagnoses` テーブルに保存されている（schema.sqlのdiagnostic_resultsとは別）。**

---

## Step 1：Supabase SQL Editor で実行

```sql
-- meeting_prepsにカラム追加
ALTER TABLE meeting_preps
  ADD COLUMN IF NOT EXISTS previous_notes  text,
  ADD COLUMN IF NOT EXISTS recent_behaviors text;

-- マネージャーの日常メモテーブル
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

-- diagnoses テーブルにshared_with_managerがなければ追加
ALTER TABLE diagnoses
  ADD COLUMN IF NOT EXISTS shared_with_manager boolean DEFAULT false;
```

---

## Step 2：作成するファイル一覧

```
src/app/
├── meeting/
│   └── new/
│       └── page.tsx          ← 新規作成（メイン）
└── api/
    └── generate-meeting/
        └── route.ts          ← 新規作成
```

---

## Step 3：/api/generate-meeting/route.ts

```ts
import { NextResponse } from "next/server"
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"
import { createClient } from "@/lib/supabase/server"

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const MEETING_TYPE_LABELS: Record<string, string> = {
  goal:     "目標設定面談",
  feedback: "査定・フィードバック面談",
  "1on1":   "通常1on1",
}

const MEETING_TYPE_HINTS: Record<string, string> = {
  goal:     "この人の内発的動機・自律性スコアを踏まえ、目標設定での言葉の選び方を重視してください。押しつけではなく「一緒に決める」感覚を引き出す面談準備にしてください。",
  feedback: "フィードバックをこの人の受け取り方のクセに合わせて設計してください。特に「避けたほうがいい言い方」を具体的に。評価の結果だけでなく、プロセスをどう言語化するかに重点を置いてください。",
  "1on1":   "今日の1on1の目的は関係構築・状況把握です。この人が話しやすくなる入り方と、コンディション確認に使えるテーマを中心に準備してください。",
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      memberId: string
      manualText: string
      meetingType: string
      previousNotes?: string
      recentBehaviors?: string
      managerNotes?: string
      memberNotes?: string
    }

    const { memberId, manualText, meetingType, previousNotes, recentBehaviors, managerNotes, memberNotes } = body

    if (!manualText || !meetingType) {
      return NextResponse.json({ error: "manualText and meetingType are required" }, { status: 400 })
    }

    const meetingLabel = MEETING_TYPE_LABELS[meetingType] ?? meetingType
    const meetingHint  = MEETING_TYPE_HINTS[meetingType] ?? ""

    const systemPrompt = `あなたは優れたマネジメントコーチです。
部下の「取扱説明書」と提供された情報をもとに、今日の面談でマネージャーが使える具体的な準備情報を生成してください。

【出力ルール】
- 以下の5つのセクションを必ず出力する（見出しはそのまま使う）
- マネージャーに向けた文体で書く
- 前置き・まとめは不要。5セクションのみ出力する

【セクション構成】
✅ この人に響くフレーム
✅ 避けたほうがいい言い方
✅ 具体的な承認フレーズ
✅ なぜあなたに任せたいのか
✅ 面談で扱うと良いテーマ

【各セクションのルール】
- 「具体的な承認フレーズ」: recentBehaviorsまたはmemberNotesに行動事実がある場合のみ出力。行動事実と取扱説明書の強みを組み合わせ、60〜100字のそのまま使えるコピーとして書く。行動事実がない場合は「（入力なし）」と書く。
- 「なぜあなたに任せたいのか」: 行動事実と強み・面談タイプを踏まえ、委任・期待の言葉として50〜80字で書く。未来への接続として書くこと。
- 「面談で扱うと良いテーマ」: previousNotesがある場合は1つ目を必ず「前回の約束：[内容] → 完了/未完了の確認」にする。計3項目。`

    const userParts = [
      `【部下の取扱説明書】\n${manualText}`,
      `【面談タイプ】\n${meetingLabel}`,
      meetingHint,
    ]
    if (previousNotes)   userParts.push(`【前回の1on1メモ・アクションアイテム】\n${previousNotes}`)
    if (recentBehaviors) userParts.push(`【最近の具体的な行動・発言】\n${recentBehaviors}`)
    if (memberNotes)     userParts.push(`【マネージャーの日常メモ（直近30日）】\n${memberNotes}`)
    if (managerNotes)    userParts.push(`【気になること】\n${managerNotes}`)

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userParts.join("\n\n") }],
    }

    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    })

    const response = await bedrockClient.send(command)
    const responseBody = JSON.parse(new TextDecoder().decode(response.body))
    const aiOutput = responseBody.content[0].text.trim()

    // meeting_prepsに保存
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    let prepId: string | null = null
    if (user) {
      const { data } = await supabase.from("meeting_preps").insert({
        manager_id:        user.id,
        member_id:         memberId,
        meeting_type:      meetingType,
        previous_notes:    previousNotes ?? null,
        recent_behaviors:  recentBehaviors ?? null,
        manager_notes:     managerNotes ?? null,
        ai_output:         aiOutput,
      }).select("id").single()
      prepId = data?.id ?? null
    }

    return NextResponse.json({ output: aiOutput, prepId })
  } catch (error) {
    console.error("generate-meeting error", error)
    return NextResponse.json({ error: "failed to generate meeting prep" }, { status: 500 })
  }
}
```

---

## Step 4：/meeting/new/page.tsx

以下の仕様で実装すること。

### データフロー
1. ページ読み込み時：ログインユーザーの `manager_member_relationships` からメンバー一覧取得
2. メンバー選択時：そのメンバーの `diagnoses` テーブルから `manual_text`（またはカラム名に合わせる）を取得
3. 「準備する」押下：`/api/generate-meeting` にPOST
4. レスポンスを5セクションに分割して表示
5. 👍/👎：`meeting_preps` の `feedback` カラムを更新

### UI仕様

**入力エリア（出力前）：**
- ページ上部：メンバー選択（ドロップダウン）。diagnoses未完了のメンバーはグレーアウト
- 面談タイプ選択：大きなカードボタン3択（`goal` / `feedback` / `1on1`）
- テキストエリア①：「前回の1on1メモ・アクションアイテム（任意）」placeholder付き
- テキストエリア②：「最近の行動・発言（任意）Slackの発言をそのまま貼ってもOK」
- テキストエリア③：「気になること（任意）」
- 「⚡ 準備する」ボタン（meetingType未選択なら disabled）

**出力エリア（「準備する」押下後・同一画面内スクロール）：**
- ローディング中はスケルトンUI
- 5セクションを順番に表示（`✅ この人に響くフレーム` etc.）
- 「なぜあなたに任せたいのか」セクションのみ📋コピーボタン付き
- 「具体的な承認フレーズ」が「（入力なし）」の場合はセクションごと非表示
- フッター：「📋 全体コピー」「🔄 再生成」ボタン
- フィードバック：「この準備は役に立ちましたか？」→ 👍 / 👎（POSTされたprepIdに対してfeedback更新）
- 最下部：取扱説明書を折りたたみ表示（デフォルト閉じ）

### AI出力のパース方法
```ts
// セクションを分割する
function parseSections(text: string) {
  const sectionNames = [
    "この人に響くフレーム",
    "避けたほうがいい言い方",
    "具体的な承認フレーズ",
    "なぜあなたに任せたいのか",
    "面談で扱うと良いテーマ",
  ]
  // "✅ セクション名" で分割してRecord<string, string>にする
}
```

### Supabaseクエリ例
```ts
// マネージャーの担当メンバー一覧
const { data: members } = await supabase
  .from("manager_member_relationships")
  .select("member_id, users!member_id(id, name, email)")
  .eq("manager_id", userId)

// メンバーの診断結果取得（カラム名は "manual"）
const { data: diagnosis } = await supabase
  .from("diagnoses")
  .select("manual, scores, shared_with_manager")
  .eq("user_id", memberId)
  .order("created_at", { ascending: false })
  .limit(1)
  .single()

// フィードバック更新
await supabase
  .from("meeting_preps")
  .update({ feedback: value }) // 1 or -1
  .eq("id", prepId)
```

### スタイル
既存ページ（result/page.tsx）に合わせてTailwind CSSを使用。
- 背景: `bg-[#FFFFFF]`
- テキスト: `text-[#37352F]`
- アクセント: `bg-[#1A6CF6]`
- ボーダー: `border-[#E9E9E7]`
- サブテキスト: `text-[#9B9A97]`

---

## 確認ポイント

- [x] `diagnoses` テーブルのカラム名は `manual`（generate-manual/route.ts のinsert処理で確認済み）
- [ ] `manager_member_relationships` に自分のデータが入っているか確認（なければテスト用に手動INSERT）
- [ ] AWS Bedrock の環境変数が `.env.local` に設定済みか確認
