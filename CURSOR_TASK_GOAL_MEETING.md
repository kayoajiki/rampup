# 実装タスク：`/meeting/goal`（目標設定面談準備）

## プロジェクト概要

- Next.js App Router（Server Components + Client Components）
- Supabase（PostgreSQL + RLS + Auth）
- AWS Bedrock（anthropic.claude-3-haiku-20240307-v1:0）
- Tailwind CSS（カラー：#37352F, #1A6CF6, #E9E9E7, #F7F6F3, #9B9A97）
- createClient は `@/lib/supabase/server` からインポート

## 既存テーブル（参照のみ）
- `users`: id, name, email, role
- `diagnoses`: id, user_id, manual, scores, report, shared_with_manager
- `my_stories`: id, user_id, will_now, will_career, can_strengths, can_development, must_mission
- `story_milestones`: id, user_id, event_year, event_month, event, feeling, motivation
- `manager_member_relationships`: manager_id, member_id
- `meeting_preps`: id, manager_id, member_id, meeting_type, previous_notes, ai_output, post_meeting_notes, manager_expectations

---

## 実装するページ：`/meeting/goal`（目標設定面談準備）

### 思想（重要）
リクルートのWCMフレームワークに基づく目標設定面談の準備AIツール。
- 目標設定面談は「目標を決める場」ではなく「Will（ありたい状態）を語り合う場」
- マネージャーの役割は評価・判定ではなく「接続の設計者」（メンバーのWillと組織のMustをつなぐ）
- AIは「答え」を出すのではなく、マネージャーが「問い」を持って面談に臨めるよう支援する
- 出力は面談中に隣に置いて使える「対話ガイド」（読み物ではなく実用ツール）

### ページの流れ

```
① メンバーを選ぶ（セレクトボックス）
   ↓ 選択後にメンバーのストーリーを自動取得
② メンバーのストーリー（折りたたみ参照パネル）
   - 人生史の転換点リスト（event_year/month + event + motivation）
   - WCM 5項目（will_now, will_career, can_strengths, can_development, must_mission）
   - 取扱説明書（diagnosis.manual）
   ※ストーリー未入力でも取扱説明書のみで生成可能
③ 今期このメンバーへの期待（マネージャーが入力）
   - テキストエリア：「組織・チームとしての期待役割・テーマ」
   - 例プレースホルダー：「新人育成の主担当として、オンボーディングプログラムを設計してほしい。チームの品質基準の引き上げにも取り組んでほしい。」
④ ⚡ 面談ガイドを生成する（ボタン）
⑤ AI出力：5ステージの対話ガイド
   以下のセクション名で出力：
   - ✅ オープニング
   - ✅ Willの深掘り
   - ✅ Mustの伝え方
   - ✅ すり合わせ
   - ✅ 目標の言語化
⑥ 面談後メモ（テキストエリア + 保存ボタン）
   → meeting_preps.post_meeting_notes に保存
   → 次回 /meeting/goal 選択時に previousNotes に自動転記
   → /meeting/feedback でも参照される
```

### AIプロンプト設計

systemPrompt:
```
あなたはリクルートのWCMフレームワークに精通した、優れた人材育成コーチです。
マネージャーが目標設定面談で「メンバーのWillを引き出し、組織のMustと接続する」ための対話ガイドを生成してください。
面談は評価の場ではなく、メンバーが「なぜ今ここにいるのか」を自分の言葉で語れるようになる場です。
マネージャーは「答えを持つ人」ではなく「問いを持つ人」として振る舞うことが重要です。
出力は面談中にそのまま使える実用的なスクリプト形式で、日本語で書いてください。
```

userPrompt（動的生成）:
```
【メンバーの取扱説明書】
{manual ?? "未取得"}

【メンバーのWill-Can-Must】
①今の仕事で実現したいこと: {will_now ?? "未入力"}
②2〜3年後のキャリアイメージ: {will_career ?? "未入力"}
③強み・課題の整理: {can_strengths ?? "未入力"}
④能力開発のための具体的な行動目標: {can_development ?? "未入力"}
⑤担うミッションと役割行動: {must_mission ?? "未入力"}

【人生史・転換点】
{milestones.length > 0 ? milestones.map(m => `${m.event_year}年${m.event_month ? m.event_month + '月' : ''}: ${m.event}（モチベーション${m.motivation}/5）`).join('\n') : "未入力"}

【今期マネージャーからの期待（Must）】
{managerExpectations}

【前回の面談メモ】
{previousNotes ?? "なし"}

以下の5つのセクションを順番に出力してください。各セクションは「✅ セクション名」で始めてください。

✅ オープニング
面談の目的を共有する言葉と、関係性を温めるための問いかけを2〜3個書いてください。
このメンバーの特性（取扱説明書）を踏まえたトーンで。

✅ Willの深掘り
メンバーの人生史とWCMを踏まえた、Willを引き出すための具体的な問いかけを3〜4個書いてください。
抽象的な質問ではなく、このメンバーの実際の経験・転換点に基づいた問いにしてください。
Willが曖昧なときの深掘り質問も1〜2個添えてください。

✅ Mustの伝え方
マネージャーからの期待（Must）を押しつけにならず、メンバーのWillと接続しながら伝えるためのスクリプトを書いてください。
「だからこそあなたに期待している」という文脈で伝えられるよう、WillとMustの接続仮説も示してください。

✅ すり合わせ
WillとMustの接続点を一緒に探すための問いかけと、目標のたたき台（2〜3案）を書いてください。
たたき台はメンバーが「自分の言葉で語れる」ものになるよう、WillとMustの交点から導いてください。

✅ 目標の言語化
面談の締めくくりに使う問いかけと、目標を「自分の言葉で語れているか」のチェックポイントを書いてください。
「今期が終わった時、どんな自分でいたいですか？」の問いを軸に。
```

### ファイル構成

```
src/app/
├── meeting/
│   └── goal/
│       ├── page.tsx          ← 新規（Server Component：メンバーリスト取得）
│       └── GoalMeetingForm.tsx ← 新規（Client Component：全UI）
└── api/
    └── generate-goal-meeting/
        └── route.ts          ← 新規（POST：AI生成）
```

### AppHeader.tsx の確認

マネージャーナビはすでに以下になっているはず（変更不要）：
```tsx
<NavLink href="/meeting/goal">目標設定</NavLink>
```

---

## Step 1：Supabase SQL Editor で実行

meeting_preps テーブルの `manager_expectations` カラムはすでに追加済み。
追加のSQLは不要。

---

## Step 2：/api/generate-goal-meeting/route.ts（新規）

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

type Milestone = {
  event_year: number
  event_month: number | null
  event: string
  motivation: number
}

type RequestBody = {
  memberId: string
  managerExpectations: string
  manual: string | null
  wcm: {
    will_now: string | null
    will_career: string | null
    can_strengths: string | null
    can_development: string | null
    must_mission: string | null
  } | null
  milestones: Milestone[]
  previousNotes: string | null
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json() as RequestBody
    const { memberId, managerExpectations, manual, wcm, milestones, previousNotes } = body

    if (!memberId || !managerExpectations?.trim()) {
      return NextResponse.json({ error: "memberId and managerExpectations are required" }, { status: 400 })
    }

    // AIプロンプト構築
    const milestonesText = milestones.length > 0
      ? milestones.map(m => `${m.event_year}年${m.event_month ? m.event_month + '月' : ''}: ${m.event}（モチベーション${m.motivation}/5）`).join('\n')
      : "未入力"

    const systemPrompt = `あなたはリクルートのWCMフレームワークに精通した、優れた人材育成コーチです。
マネージャーが目標設定面談で「メンバーのWillを引き出し、組織のMustと接続する」ための対話ガイドを生成してください。
面談は評価の場ではなく、メンバーが「なぜ今ここにいるのか」を自分の言葉で語れるようになる場です。
マネージャーは「答えを持つ人」ではなく「問いを持つ人」として振る舞うことが重要です。
出力は面談中にそのまま使える実用的なスクリプト形式で、日本語で書いてください。`

    const userPrompt = `【メンバーの取扱説明書】
${manual ?? "未取得"}

【メンバーのWill-Can-Must】
①今の仕事で実現したいこと: ${wcm?.will_now ?? "未入力"}
②2〜3年後のキャリアイメージ: ${wcm?.will_career ?? "未入力"}
③強み・課題の整理: ${wcm?.can_strengths ?? "未入力"}
④能力開発のための具体的な行動目標: ${wcm?.can_development ?? "未入力"}
⑤担うミッションと役割行動: ${wcm?.must_mission ?? "未入力"}

【人生史・転換点】
${milestonesText}

【今期マネージャーからの期待（Must）】
${managerExpectations}

【前回の面談メモ】
${previousNotes ?? "なし"}

以下の5つのセクションを順番に出力してください。各セクションは「✅ セクション名」で始めてください。

✅ オープニング
面談の目的を共有する言葉と、関係性を温めるための問いかけを2〜3個書いてください。
このメンバーの特性（取扱説明書）を踏まえたトーンで。

✅ Willの深掘り
メンバーの人生史とWCMを踏まえた、Willを引き出すための具体的な問いかけを3〜4個書いてください。
抽象的な質問ではなく、このメンバーの実際の経験・転換点に基づいた問いにしてください。
Willが曖昧なときの深掘り質問も1〜2個添えてください。

✅ Mustの伝え方
マネージャーからの期待（Must）を押しつけにならず、メンバーのWillと接続しながら伝えるためのスクリプトを書いてください。
「だからこそあなたに期待している」という文脈で伝えられるよう、WillとMustの接続仮説も示してください。

✅ すり合わせ
WillとMustの接続点を一緒に探すための問いかけと、目標のたたき台（2〜3案）を書いてください。
たたき台はメンバーが「自分の言葉で語れる」ものになるよう、WillとMustの交点から導いてください。

✅ 目標の言語化
面談の締めくくりに使う問いかけと、目標を「自分の言葉で語れているか」のチェックポイントを書いてください。
「今期が終わった時、どんな自分でいたいですか？」の問いを軸に。`

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
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

    // meeting_preps に保存
    const { data: prep, error } = await supabase
      .from("meeting_preps")
      .insert({
        manager_id: user.id,
        member_id: memberId,
        meeting_type: "goal",
        manager_expectations: managerExpectations.trim(),
        previous_notes: previousNotes ?? null,
        ai_output: aiOutput,
      })
      .select("id")
      .single()

    if (error) throw error

    return NextResponse.json({ aiOutput, prepId: prep.id })
  } catch (error) {
    console.error("generate-goal-meeting error", error)
    return NextResponse.json({ error: "failed to generate" }, { status: 500 })
  }
}
```

---

## Step 3：/meeting/goal/page.tsx（Server Component）

```tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import GoalMeetingForm from "./GoalMeetingForm"

export default async function GoalMeetingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()
  if (profile?.role !== "manager") redirect("/me")

  const { data: relationships } = await supabase
    .from("manager_member_relationships")
    .select("member_id")
    .eq("manager_id", user.id)

  const memberIds = (relationships ?? []).map((r) => r.member_id)

  const { data: members } = await supabase
    .from("users")
    .select("id, name, email")
    .in("id", memberIds.length > 0 ? memberIds : [""])

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-[#37352F]">目標設定面談準備</h1>
          <p className="text-sm text-[#9B9A97] mt-1">
            メンバーのWillを引き出し、組織のMustと接続する対話ガイドを生成します
          </p>
        </div>
        <GoalMeetingForm members={members ?? []} managerId={user.id} />
      </div>
    </div>
  )
}
```

---

## Step 4：/meeting/goal/GoalMeetingForm.tsx（Client Component）

このコンポーネントは以下の機能を持つ：
1. メンバー選択セレクトボックス
2. メンバー選択後にストーリー・WCM・前回メモを `/api/goal-meeting/member-detail` から取得して折りたたみパネルで表示
3. 今期の期待入力テキストエリア
4. ⚡ 面談ガイドを生成するボタン
5. AI出力を parseSections でセクション分割して表示（/meeting/new と同じパターン）
6. 面談後メモ入力 + 保存ボタン（/api/meeting-preps/[id]/post-notes PATCHを使用）

**parseSections 関数**（/meeting/new と同じロジック）:
セクション名: ["オープニング", "Willの深掘り", "Mustの伝え方", "すり合わせ", "目標の言語化"]
マーカー: `✅ セクション名` または `【セクション名】`

**メンバーデータ取得API**: `/api/goal-meeting/member-detail?memberId=xxx`
このAPIは以下を返す：
- manual（取扱説明書）
- wcm（my_stories の5項目）
- milestones（story_milestones 時系列順）
- lastPostMeetingNotes（前回の goal meeting の post_meeting_notes）

```tsx
"use client"

import { useState, useEffect, useCallback } from "react"

type Member = { id: string; name: string | null; email: string }
type WcmData = {
  will_now: string | null
  will_career: string | null
  can_strengths: string | null
  can_development: string | null
  must_mission: string | null
} | null
type MilestoneData = {
  event_year: number
  event_month: number | null
  event: string
  motivation: number
}[]

type MemberDetail = {
  manual: string | null
  wcm: WcmData
  milestones: MilestoneData
  lastPostMeetingNotes: string | null
}

const SECTION_NAMES = ["オープニング", "Willの深掘り", "Mustの伝え方", "すり合わせ", "目標の言語化"]

function parseSections(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of SECTION_NAMES) {
    const markers = [`✅ ${name}`, `【${name}】`]
    let start = -1; let markLen = 0
    for (const m of markers) {
      const i = text.indexOf(m)
      if (i !== -1) { start = i; markLen = m.length; break }
    }
    if (start === -1) continue
    const contentStart = start + markLen
    let end = text.length
    for (const next of SECTION_NAMES.slice(SECTION_NAMES.indexOf(name) + 1)) {
      for (const m of [`✅ ${next}`, `【${next}】`]) {
        const i = text.indexOf(m, contentStart)
        if (i !== -1 && i < end) { end = i; break }
      }
    }
    out[name] = text.slice(contentStart, end).trim()
  }
  return out
}

const SECTION_COLORS: Record<string, string> = {
  "オープニング":   "border-l-gray-300",
  "Willの深掘り":  "border-l-pink-400",
  "Mustの伝え方":  "border-l-green-400",
  "すり合わせ":    "border-l-blue-400",
  "目標の言語化":  "border-l-purple-400",
}

export default function GoalMeetingForm({
  members,
  managerId,
}: {
  members: Member[]
  managerId: string
}) {
  const [selectedMemberId, setSelectedMemberId] = useState("")
  const [memberDetail, setMemberDetail] = useState<MemberDetail | null>(null)
  const [showStory, setShowStory] = useState(false)
  const [managerExpectations, setManagerExpectations] = useState("")
  const [previousNotes, setPreviousNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [aiOutput, setAiOutput] = useState("")
  const [prepId, setPrepId] = useState<string | null>(null)
  const [sections, setSections] = useState<Record<string, string>>({})
  const [postMeetingNotes, setPostMeetingNotes] = useState("")
  const [postNotesSaving, setPostNotesSaving] = useState(false)
  const [postNotesSaved, setPostNotesSaved] = useState(false)

  // メンバー選択時にデータ取得
  useEffect(() => {
    if (!selectedMemberId) {
      setMemberDetail(null)
      setPreviousNotes("")
      return
    }
    setMemberDetail(null)
    fetch(`/api/goal-meeting/member-detail?memberId=${encodeURIComponent(selectedMemberId)}`)
      .then((r) => r.json())
      .then((data: MemberDetail) => {
        setMemberDetail(data)
        if (data.lastPostMeetingNotes) {
          setPreviousNotes(data.lastPostMeetingNotes)
        }
      })
  }, [selectedMemberId])

  // AI生成
  const handleGenerate = useCallback(async () => {
    if (!selectedMemberId || !managerExpectations.trim() || loading) return
    setLoading(true)
    setAiOutput("")
    setSections({})
    setPrepId(null)
    try {
      const res = await fetch("/api/generate-goal-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selectedMemberId,
          managerExpectations,
          manual: memberDetail?.manual ?? null,
          wcm: memberDetail?.wcm ?? null,
          milestones: memberDetail?.milestones ?? [],
          previousNotes: previousNotes || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setAiOutput(data.aiOutput)
        setSections(parseSections(data.aiOutput))
        setPrepId(data.prepId)
      }
    } finally {
      setLoading(false)
    }
  }, [selectedMemberId, managerExpectations, memberDetail, previousNotes, loading])

  // 面談後メモ保存
  const handleSavePostNotes = useCallback(async () => {
    if (!prepId || !postMeetingNotes.trim()) return
    setPostNotesSaving(true)
    try {
      const res = await fetch(`/api/meeting-preps/${prepId}/post-notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postMeetingNotes }),
      })
      if (res.ok) setPostNotesSaved(true)
    } finally {
      setPostNotesSaving(false)
    }
  }, [prepId, postMeetingNotes])

  const wcm = memberDetail?.wcm
  const milestones = memberDetail?.milestones ?? []
  const hasStory = wcm && Object.values(wcm).some(v => v)
  const hasMilestones = milestones.length > 0

  return (
    <div className="space-y-4">

      {/* メンバー選択 */}
      <div className="bg-white rounded-xl border border-[#E9E9E7] px-5 py-4">
        <label className="block text-xs font-medium text-[#9B9A97] mb-2">メンバーを選ぶ</label>
        <select
          value={selectedMemberId}
          onChange={(e) => {
            setSelectedMemberId(e.target.value)
            setAiOutput("")
            setSections({})
            setPrepId(null)
            setPostMeetingNotes("")
            setPostNotesSaved(false)
            setManagerExpectations("")
          }}
          className="w-full text-sm text-[#37352F] border border-[#E9E9E7] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1A6CF6] bg-[#FAFAFA]"
        >
          <option value="">-- メンバーを選択 --</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
          ))}
        </select>
      </div>

      {/* メンバーのストーリー（折りたたみ） */}
      {selectedMemberId && memberDetail && (
        <div className="bg-white rounded-xl border border-[#E9E9E7] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowStory((p) => !p)}
            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#F7F6F3] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#37352F]">メンバーのストーリー</span>
              <div className="flex gap-1">
                {hasStory && <span className="text-xs text-[#9B9A97] bg-[#F7F6F3] px-1.5 py-0.5 rounded">WCM</span>}
                {hasMilestones && <span className="text-xs text-[#9B9A97] bg-[#F7F6F3] px-1.5 py-0.5 rounded">人生史</span>}
                {memberDetail.manual && <span className="text-xs text-[#9B9A97] bg-[#F7F6F3] px-1.5 py-0.5 rounded">取扱説明書</span>}
              </div>
            </div>
            <span className="text-xs text-[#9B9A97]">{showStory ? "▲ 閉じる" : "▼ 開く"}</span>
          </button>

          {showStory && (
            <div className="border-t border-[#E9E9E7] px-5 py-4 space-y-4 text-sm">
              {/* 人生史 */}
              {hasMilestones && (
                <div>
                  <p className="text-xs font-medium text-[#9B9A97] mb-2">人生史・転換点</p>
                  <div className="space-y-1">
                    {milestones.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-[#37352F]">
                        <span className="text-[#9B9A97] shrink-0">
                          {m.event_year}年{m.event_month ? `${m.event_month}月` : ""}
                        </span>
                        <span>{m.event}</span>
                        <span className="text-[#9B9A97] ml-auto shrink-0">モチベ {m.motivation}/5</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WCM */}
              {hasStory && (
                <div>
                  <p className="text-xs font-medium text-[#9B9A97] mb-2">Will-Can-Must</p>
                  {[
                    { label: "① 今の仕事で実現したいこと", value: wcm?.will_now },
                    { label: "② 2〜3年後のキャリアイメージ", value: wcm?.will_career },
                    { label: "③ 強み・課題の整理", value: wcm?.can_strengths },
                    { label: "④ 能力開発のための行動目標", value: wcm?.can_development },
                    { label: "⑤ 担うミッションと役割行動", value: wcm?.must_mission },
                  ].filter(f => f.value).map((f, i) => (
                    <div key={i} className="mb-2">
                      <p className="text-xs text-[#9B9A97]">{f.label}</p>
                      <p className="text-xs text-[#37352F] leading-relaxed whitespace-pre-wrap">{f.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 取扱説明書 */}
              {memberDetail.manual && (
                <div>
                  <p className="text-xs font-medium text-[#9B9A97] mb-2">取扱説明書</p>
                  <p className="text-xs text-[#37352F] leading-relaxed whitespace-pre-wrap line-clamp-6">
                    {memberDetail.manual}
                  </p>
                </div>
              )}

              {!hasStory && !hasMilestones && !memberDetail.manual && (
                <p className="text-xs text-[#9B9A97]">
                  このメンバーはまだストーリーを入力していません。取扱説明書もありません。
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 前回の面談メモ（自動転記） */}
      {selectedMemberId && memberDetail && (
        <div className="bg-white rounded-xl border border-[#E9E9E7] px-5 py-4">
          <label className="block text-xs font-medium text-[#9B9A97] mb-2">
            前回の面談メモ
          </label>
          <textarea
            value={previousNotes}
            onChange={(e) => setPreviousNotes(e.target.value)}
            placeholder="前回の目標設定面談で話したこと、決めたことなど"
            rows={3}
            className="w-full text-sm text-[#37352F] placeholder:text-[#C8C7C4] bg-[#FAFAFA] border border-[#E9E9E7] rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#1A6CF6] focus:bg-white transition-colors"
          />
          {memberDetail.lastPostMeetingNotes && previousNotes === memberDetail.lastPostMeetingNotes && (
            <p className="mt-1 text-xs text-[#9B9A97]">前回の面談メモを引き継ぎました（編集できます）</p>
          )}
        </div>
      )}

      {/* 今期の期待入力 */}
      {selectedMemberId && (
        <div className="bg-white rounded-xl border border-[#E9E9E7] px-5 py-4">
          <label className="block text-xs font-medium text-[#37352F] mb-1.5">
            今期このメンバーへの期待
            <span className="text-red-400 ml-1">*</span>
          </label>
          <p className="text-xs text-[#9B9A97] mb-2">
            組織・チームとしての期待役割・テーマを書いてください。これがMustとしてAIの生成に使われます。
          </p>
          <textarea
            value={managerExpectations}
            onChange={(e) => setManagerExpectations(e.target.value)}
            placeholder="例：新人育成の主担当として、オンボーディングプログラムを設計してほしい。チームの品質基準の引き上げにも取り組んでほしい。"
            rows={4}
            className="w-full text-sm text-[#37352F] placeholder:text-[#C8C7C4] bg-[#FAFAFA] border border-[#E9E9E7] rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#1A6CF6] focus:bg-white transition-colors"
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!managerExpectations.trim() || loading}
            className="mt-3 w-full bg-[#1A6CF6] text-white rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-[#1A5BE0] transition-colors"
          >
            {loading ? "生成中..." : "⚡ 面談ガイドを生成する"}
          </button>
        </div>
      )}

      {/* AI出力 */}
      {Object.keys(sections).length > 0 && (
        <div className="bg-white rounded-xl border border-[#E9E9E7] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E9E9E7]">
            <h2 className="text-sm font-semibold text-[#37352F]">面談ガイド</h2>
            <p className="text-xs text-[#9B9A97] mt-0.5">面談中にこの画面を参照しながら対話を進めてください</p>
          </div>

          {SECTION_NAMES.filter((name) => sections[name]).map((name) => (
            <div key={name} className={`border-b border-[#E9E9E7] last:border-0 px-5 py-4 border-l-4 ${SECTION_COLORS[name] ?? "border-l-gray-200"}`}>
              <h3 className="text-xs font-bold text-[#37352F] mb-2">{name}</h3>
              <p className="text-sm text-[#37352F] leading-relaxed whitespace-pre-wrap">{sections[name]}</p>
            </div>
          ))}

          {/* 面談後メモ */}
          {prepId && (
            <div className="px-5 py-4 border-t border-[#E9E9E7]">
              <h3 className="text-sm font-medium text-[#37352F] mb-1">面談後メモ</h3>
              <p className="text-xs text-[#9B9A97] mb-2">
                合意した目標・決定事項を記録してください。次回の目標設定面談と査定FBに引き継がれます。
              </p>
              <textarea
                value={postMeetingNotes}
                onChange={(e) => setPostMeetingNotes(e.target.value)}
                placeholder="合意した目標、面談で決めたこと、次回確認したいことなど"
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
                  <p className="text-xs text-[#9B9A97]">次回の面談準備に引き継がれます</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

---

## Step 5：/api/goal-meeting/member-detail/route.ts（新規）

メンバーのストーリー全情報 + 前回の目標設定面談メモを返す。

```ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get("memberId")
    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // 取扱説明書
    const { data: diagnosis } = await supabase
      .from("diagnoses")
      .select("manual")
      .eq("user_id", memberId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // WCM
    const { data: wcm } = await supabase
      .from("my_stories")
      .select("will_now, will_career, can_strengths, can_development, must_mission")
      .eq("user_id", memberId)
      .maybeSingle()

    // 人生史（時系列順）
    const { data: milestones } = await supabase
      .from("story_milestones")
      .select("event_year, event_month, event, motivation")
      .eq("user_id", memberId)
      .order("event_year", { ascending: true })
      .order("event_month", { ascending: true, nullsFirst: true })

    // 前回の目標設定面談メモ
    const { data: lastPrep } = await supabase
      .from("meeting_preps")
      .select("post_meeting_notes")
      .eq("manager_id", user.id)
      .eq("member_id", memberId)
      .eq("meeting_type", "goal")
      .not("post_meeting_notes", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      manual: diagnosis?.manual ?? null,
      wcm: wcm ?? null,
      milestones: milestones ?? [],
      lastPostMeetingNotes: lastPrep?.post_meeting_notes ?? null,
    })
  } catch (error) {
    console.error("goal-meeting/member-detail error", error)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }
}
```

---

## 完成後の動作フロー

```
① メンバー選択
  → ストーリー・WCM・前回メモを自動取得
  → 「前回の面談メモ」に自動転記（編集可）

② 「メンバーのストーリー」パネル（折りたたみ）
  → 人生史 / WCM / 取扱説明書を確認

③ 「今期の期待」を入力
  → 組織・チームとしてのMustを記述

④ ⚡ 面談ガイドを生成する
  → 5ステージの対話ガイドが表示

⑤ 面談中：ガイドを参照しながら対話
  オープニング → Willの深掘り → Mustの伝え方
  → すり合わせ → 目標の言語化

⑥ 面談後：「面談後メモ」に合意目標を記録
  → 次回の目標設定面談に自動引き継ぎ
  → /meeting/feedback でも参照
```

---

## 注意点

- `meeting_type = "goal"` で meeting_preps に保存することで 1on1（"1on1"）と区別する
- ストーリー未入力でも取扱説明書だけで生成可能（未入力項目は "未入力" として渡す）
- parseSections は /meeting/new と同じロジックを使う（コピーして使ってよい）
- 左ボーダーの色分け：オープニング=グレー、Will=ピンク、Must=グリーン、すり合わせ=ブルー、目標=パープル
- 面談後メモの保存は既存の `/api/meeting-preps/[id]/post-notes` PATCH エンドポイントを流用
- 前回メモの引き継ぎは `meeting_type = "goal"` のみ（1on1のメモは引き継がない）
