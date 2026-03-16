import { NextResponse } from "next/server";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { createClient } from "@/lib/supabase/server";

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const MEETING_TYPE_LABELS: Record<string, string> = {
  goal: "目標設定面談",
  feedback: "査定・フィードバック面談",
  "1on1": "通常1on1",
};

const MEETING_TYPE_HINTS: Record<string, string> = {
  goal:
    "この人の内発的動機・自律性スコアを踏まえ、目標設定での言葉の選び方を重視してください。押しつけではなく「一緒に決める」感覚を引き出す面談準備にしてください。",
  feedback:
    "フィードバックをこの人の受け取り方のクセに合わせて設計してください。特に「避けたほうがいい言い方」を具体的に。評価の結果だけでなく、プロセスをどう言語化するかに重点を置いてください。",
  "1on1":
    "今日の1on1の目的は関係構築・状況把握です。この人が話しやすくなる入り方と、コンディション確認に使えるテーマを中心に準備してください。",
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      memberId: string;
      manualText: string;
      meetingType: string;
      previousNotes?: string;
      recentBehaviors?: string;
      managerNotes?: string;
    };

    const {
      memberId,
      manualText,
      meetingType,
      previousNotes,
      recentBehaviors,
      managerNotes,
    } = body;

    if (!manualText || !meetingType) {
      return NextResponse.json(
        { error: "manualText and meetingType are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 直近30日の member_notes を取得
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: notes } = await supabase
      .from("member_notes")
      .select("content, created_at")
      .eq("manager_id", user.id)
      .eq("member_id", memberId)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false });
    const memberNotes =
      notes?.map((n) => `[${n.created_at}] ${n.content}`).join("\n") ?? "";

    const meetingLabel = MEETING_TYPE_LABELS[meetingType] ?? meetingType;
    const meetingHint = MEETING_TYPE_HINTS[meetingType] ?? "";

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
- 「面談で扱うと良いテーマ」: previousNotesがある場合は1つ目を必ず「前回の約束：[内容] → 完了/未完了の確認」にする。計3項目。`;

    const userParts = [
      `【部下の取扱説明書】\n${manualText}`,
      `【面談タイプ】\n${meetingLabel}`,
      meetingHint,
    ];
    if (previousNotes)
      userParts.push(`【前回の1on1メモ・アクションアイテム】\n${previousNotes}`);
    if (recentBehaviors)
      userParts.push(`【最近の具体的な行動・発言】\n${recentBehaviors}`);
    if (memberNotes)
      userParts.push(`【マネージャーの日常メモ（直近30日）】\n${memberNotes}`);
    if (managerNotes) userParts.push(`【気になること】\n${managerNotes}`);

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userParts.join("\n\n") }],
    };

    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const aiOutput = responseBody.content[0].text.trim();

    const { data: prep } = await supabase
      .from("meeting_preps")
      .insert({
        manager_id: user.id,
        member_id: memberId,
        meeting_type: meetingType,
        previous_notes: previousNotes ?? null,
        recent_behaviors: recentBehaviors ?? null,
        manager_notes: managerNotes ?? null,
        ai_output: aiOutput,
      })
      .select("id")
      .single();

    return NextResponse.json({
      output: aiOutput,
      prepId: prep?.id ?? null,
    });
  } catch (error) {
    console.error("generate-meeting error", error);
    return NextResponse.json(
      { error: "failed to generate meeting prep" },
      { status: 500 }
    );
  }
}
