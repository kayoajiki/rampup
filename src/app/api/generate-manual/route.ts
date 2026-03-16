import { NextResponse } from "next/server";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { calculateThemeScores } from "@/lib/scoring";
import { themes } from "@/lib/data/questions";
import { createClient } from "@/lib/supabase/server";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

type Answers = Record<number, number>;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { answers?: Answers };

    if (!body.answers || typeof body.answers !== "object") {
      return NextResponse.json({ error: "answers is required" }, { status: 400 });
    }

    const scores = calculateThemeScores(body.answers);

    const scoreLines = scores
      .map((s) => {
        const meta = themes.find((t) => t.id === s.theme);
        const label = meta ? `${meta.label}（${meta.emoji}）` : s.theme;
        return `- ${label}: ${s.score.toFixed(1)}`;
      })
      .join("\n");

    const systemPrompt =
      "あなたは優れた人事コンサルタントです。診断スコアをもとに日本語でコンテンツを作成してください。" +
      "指定されたフォーマットに厳密に従って出力してください。前置きやまとめは不要です。";

    const userPrompt = [
      "【10テーマのスコア（1〜5の平均値）】",
      scoreLines,
      "",
      "以下の2つのセクションを順番に出力してください。",
      "",
      "=== MANUAL ===",
      "この人の「取扱説明書」を8セクション程度に分けてMarkdown形式で作成してください。",
      "各セクションは「## セクション名」の見出しと、その特徴を表す箇条書き3つ（- で始まる）のみ。",
      "箇条書きは1つにつき15〜30文字程度の簡潔な表現で。スコアの数値は含めないこと。",
      "",
      "=== REPORT ===",
      "以下の6セクションで詳細レポートを作成してください。各セクションは見出し行 + 本文（200文字程度の地の文）で。",
      "## 📋 基本スペック",
      "## 💪 得意なこと",
      "## 😰 ストレス反応・疲れのサイン",
      "## 💬 コミュニケーションスタイル",
      "## 🔥 モチベーションの上げ方",
      "## 🤝 チームでの関わり方",
    ].join("\n");

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4000,
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
    const fullText = responseBody.content[0].text.trim();

    // MANUAL と REPORT を分割
    const manualMatch = fullText.match(/=== MANUAL ===([\s\S]*?)=== REPORT ===/);
    const reportMatch = fullText.match(/=== REPORT ===([\s\S]*?)$/);

    const manual = manualMatch ? manualMatch[1].trim() : fullText;
    const report = reportMatch ? reportMatch[1].trim() : "";

    // Supabaseに保存（ログイン済みユーザーのみ）
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("diagnoses").insert({
        user_id: user.id,
        scores,
        manual,
        report,
        shared_with_manager: true,
      });
    }

    return NextResponse.json({ scores, manual, report });
  } catch (error) {
    console.error("generate-manual error", error);
    return NextResponse.json({ error: "failed to generate manual" }, { status: 500 });
  }
}
