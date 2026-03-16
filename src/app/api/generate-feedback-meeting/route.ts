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
  evaluationRank: string;
  evaluationComment: string;
  difficultToSay: string;
  manual: string | null;
  wcm: {
    will_now: string | null;
    will_career: string | null;
    can_strengths: string | null;
    can_development: string | null;
    must_mission: string | null;
  } | null;
  milestones: Milestone[];
  goalMeetingNotes: string | null;
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
      evaluationRank,
      evaluationComment,
      difficultToSay,
      manual,
      wcm,
      milestones,
      goalMeetingNotes,
    } = body;

    if (!memberId || !evaluationRank || !evaluationComment?.trim()) {
      return NextResponse.json(
        { error: "memberId, evaluationRank, evaluationComment are required" },
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

    const systemPrompt = `あなたは人材育成と評価面談の専門コーチです。
マネージャーが査定フィードバック面談で「評価結果をメンバーのWillと接続しながら届け、次期への意欲を引き出す」ための対話ガイドを生成してください。
評価FBは評価を告知する場ではなく、「あなたの成長を信じている」というメッセージを伝える場です。
取扱説明書（コミュニケーションスタイル・響くフレーム）を最大限活用し、このメンバーに届く伝え方を設計してください。
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

【今期の合意目標（目標設定面談のメモ）】
${goalMeetingNotes ?? "なし"}

【今期の評価】
評価ランク: ${evaluationRank}
評価コメント: ${evaluationComment}
伝えにくいこと: ${difficultToSay?.trim() || "特になし"}

以下の5つのセクションを順番に出力してください。各セクションは「✅ セクション名」で始めてください。

✅ オープニング
面談を始める言葉と、今期を「自分の言葉で振り返る」よう促す問いかけを2〜3個書いてください。
このメンバーの特性（取扱説明書）を踏まえ、安心して話せる雰囲気を作るトーンで。
マネージャーが評価を語る前に、必ずメンバー自身の自己評価・振り返りを聞くことから始めてください。
「今期を振り返って、自分では何が一番の仕事だったと思う？」という形の問いを起点に。

✅ 成果の承認と言語化
今期の具体的な行動・成果事実を踏まえ、「なぜそれができたか（どの行動・強みが結果を生んだか）」を一緒に言語化するプロセスを設計してください。
承認のフレーズ（3〜4個）に加えて、「なぜできたと思う？」「そのとき何を意識していた？」という深掘り問いも書いてください。
取扱説明書の「この人に響くフレーム」を必ず参照し、この人の自信を深める承認の言葉を選んでください。
評価ランクに関係なく、成果事実に基づいて誠実に認める言葉を使ってください。

✅ 評価の届け方
評価結果（${evaluationRank}）を「評価の事実＋その意味」として届けるスクリプトを書いてください。
「〇〇という行動が、〇〇という結果につながった。だからこの評価になった」というFACTベースの伝え方で。
メンバーのWillと接続しながら「あなたのWillという視点でこの評価を見ると」という文脈も加えてください。
評価が期待以下の場合も「事実として振り返り、次の成長テーマを見つける」という建設的な文脈に繋げてください。
「伝えにくいこと」がある場合は、それを事実ベースで安全に届けるフレーズも含めてください。

✅ 振り返りの深掘り
メンバーが自分の言葉で今期を振り返り、「次の成長テーマ」を自分で言語化できるよう促す問いかけを3〜4個書いてください。
合意目標との照合：「目標に対して、何ができて、何が課題として残ったか」を一緒に確認する問いを含めてください。
成果が出た場合：「同じことをもっと大きなスケールでやるとしたら何が必要だと思う？」のような次のQを高める問いも。
成果が出なかった場合：責める問いではなく「もし同じ状況が来たら何を変えてみたい？」という前向きな問いで。

✅ 次期への橋渡し
今期の振り返りを踏まえ、メンバーが「次期の成長テーマ」を自分の言葉で語れるよう促すクロージングを書いてください。
「今期の経験で得た〇〇があるから、次期はこれができるはず」という今期→次期の橋渡しスクリプトで。
メンバー自身に「次期、どんな自分でいたいか？」を問いかけ、自分の言葉で語る場を作ってください。
マネージャーとして「あなたの成長を応援している」という姿勢で締めくくる一言も添えてください。`;

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
        meeting_type: "feedback",
        manager_expectations: `評価ランク: ${evaluationRank}\n${evaluationComment}`,
        previous_notes: goalMeetingNotes ?? null,
        ai_output: aiOutput,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ aiOutput, prepId: prep.id });
  } catch (error) {
    console.error("generate-feedback-meeting error", error);
    return NextResponse.json(
      { error: "failed to generate" },
      { status: 500 }
    );
  }
}

