import { NextResponse } from "next/server";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { createClient } from "@/lib/supabase/server";

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

type Milestone = {
  event_year: number;
  event_month: number | null;
  event: string;
  motivation: number;
};

type RequestBody = {
  memberId: string;
  managerExpectations: string;
  manual: string | null;
  wcm: {
    will_now: string | null;
    will_career: string | null;
    can_strengths: string | null;
    can_development: string | null;
    must_mission: string | null;
  } | null;
  milestones: Milestone[];
  previousNotes: string | null;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as RequestBody;
    const {
      memberId,
      managerExpectations,
      manual,
      wcm,
      milestones,
      previousNotes,
    } = body;

    if (!memberId || !managerExpectations?.trim()) {
      return NextResponse.json(
        { error: "memberId and managerExpectations are required" },
        { status: 400 }
      );
    }

    const milestonesText =
      milestones.length > 0
        ? milestones
            .map(
              (m) =>
                `${m.event_year}年${
                  m.event_month ? m.event_month + "月" : ""
                }: ${m.event}（モチベーション${m.motivation}/5）`
            )
            .join("\n")
        : "未入力";

    const systemPrompt = `あなたはリクルートのWCMフレームワークに精通した、優れた人材育成コーチです。
マネージャーが目標設定面談で「メンバーのWillを引き出し、組織のMustと接続する」ための対話ガイドを生成してください。
面談は評価の場ではなく、メンバーが「なぜ今ここにいるのか」を自分の言葉で語れるようになる場です。
マネージャーは「答えを持つ人」ではなく「問いを持つ人」として振る舞うことが重要です。
出力は面談中にそのまま使える実用的なスクリプト形式で、日本語で書いてください。`;

    const userPrompt = `【メンバーの取扱説明書】
${manual ?? "未取得"}

【メンバーのWill-Can-Must】
①今の仕事で実現したいこと: ${wcm?.will_now ?? "未入力"}
②2〜3年後のキャリアイメージ: ${wcm?.will_career ?? "未入力"}
③強み・課題の整理: ${wcm?.can_strengths ?? "未入力"}
④能力開発のための具体的な行動目標: ${
      wcm?.can_development ?? "未入力"
    }
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
「今期が終わった時、どんな自分でいたいですか？」の問いを軸に。`;

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
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
      .single();

    if (error) throw error;

    return NextResponse.json({ aiOutput, prepId: prep.id });
  } catch (error) {
    console.error("generate-goal-meeting error", error);
    return NextResponse.json(
      { error: "failed to generate" },
      { status: 500 }
    );
  }
}

