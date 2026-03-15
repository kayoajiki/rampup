import { NextResponse } from "next/server";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { themes } from "@/lib/data/questions";
import type { ThemeScore } from "@/lib/scoring";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { scores?: ThemeScore[] };

    if (!body.scores || !Array.isArray(body.scores)) {
      return NextResponse.json({ error: "scores is required" }, { status: 400 });
    }

    const scoreLines = body.scores
      .map((s) => {
        const meta = themes.find((t) => t.id === s.theme);
        const label = meta ? `${meta.label}（${meta.emoji}）` : s.theme;
        return `- ${label}: ${s.score.toFixed(1)}`;
      })
      .join("\n");

    const systemPrompt =
      "あなたは優れた人事コンサルタントです。診断スコアをもとに、この人の詳細レポートを日本語で作成してください。" +
      "各セクションは「## 絵文字 セクション名」の見出し行で始め、その直後に180〜220文字程度の地の文を1段落で書いてください。" +
      "文章は「この人は〜」や「あなたは〜」のように人物を主語にした自然な語り口で書いてください。" +
      "スコアの数値・箇条書き・改行による列挙は一切使わず、すべて連続した文章（地の文）で書いてください。" +
      "前置きや総括のセクションは不要です。指定した6セクションのみ出力してください。";

    const userPrompt = [
      "【10テーマのスコア（1〜5の平均値）】",
      scoreLines,
      "",
      "以下の6つのセクションで詳細レポートを作成してください。",
      "各セクションは「## 絵文字 セクション名」の見出し行の後に、180〜220文字の地の文を1段落で書いてください。",
      "箇条書き・改行列挙は禁止です。すべて連続した文章で書いてください。",
      "",
      "## 📋 基本スペック",
      "## 💪 得意なこと",
      "## 😰 ストレス反応・疲れのサイン",
      "## 💬 コミュニケーションスタイル",
      "## 🔥 モチベーションの上げ方",
      "## 🤝 チームでの関わり方",
    ].join("\n");

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

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const reportText = responseBody.content[0].text.trim();

    return NextResponse.json({ report: reportText });
  } catch (error) {
    console.error("generate-report error", error);
    return NextResponse.json({ error: "failed to generate report" }, { status: 500 });
  }
}
