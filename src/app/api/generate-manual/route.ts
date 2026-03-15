import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { calculateThemeScores } from "@/lib/scoring";
import { themes } from "@/lib/data/questions";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type Answers = Record<number, number>;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { answers?: Answers };

    if (!body.answers || typeof body.answers !== "object") {
      return NextResponse.json(
        { error: "answers is required" },
        { status: 400 },
      );
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
      "あなたは優れた人事コンサルタントです。診断スコアをもとに、この人の「取扱説明書」を日本語で作成してください。" +
      "前置きやまとめは書かず、見出しと本文のみをMarkdown形式で出力してください。";

    const userPrompt = [
      "【10テーマのスコア（1〜5の平均値、小数第1位）】",
      scoreLines,
      "",
      "上記のスコアに基づいて、この人の取扱説明書を8セクション程度に分けてMarkdownで出力してください。",
    ].join("\n");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const manualText =
      message.content
        .filter((c) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n")
        .trim() || "";

    return NextResponse.json({
      scores,
      manual: manualText,
    });
  } catch (error) {
    console.error("generate-manual error", error);
    return NextResponse.json(
      { error: "failed to generate manual" },
      { status: 500 },
    );
  }
}

