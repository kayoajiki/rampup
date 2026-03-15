"use client";

import { useEffect, useState } from "react";
import { themes } from "@/lib/data/questions";
import type { ThemeScore } from "@/lib/scoring";

type Section = {
  heading: string;
  body: string;
};

type PreviousData = {
  scores: ThemeScore[];
  created_at: string;
};

function parseReport(text: string): Section[] {
  const sections: Section[] = [];
  const lines = text.split("\n");
  let currentHeading = "";
  let bodyLines: string[] = [];

  const flush = () => {
    if (currentHeading) {
      sections.push({ heading: currentHeading, body: bodyLines.join("\n").trim() });
      bodyLines = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("## ") || line.startsWith("# ")) {
      flush();
      currentHeading = line.replace(/^#+\s*/, "").trim();
    } else {
      bodyLines.push(line);
    }
  }
  flush();
  return sections;
}

function ChangeSection({ current, previous }: { current: ThemeScore[]; previous: PreviousData }) {
  const month = new Date(previous.created_at).toLocaleDateString("ja-JP", { month: "long" });

  return (
    <section className="border border-[#E9E9E7] rounded-xl p-5">
      <h2 className="text-base font-bold text-[#37352F] mb-1">📈 前回との変化</h2>
      <p className="text-xs text-[#9B9A97] mb-4">前回（{month}）との比較</p>
      <div className="space-y-2">
        {current.map((cur) => {
          const prev = previous.scores.find((p) => p.theme === cur.theme);
          if (!prev) return null;
          const diff = Math.round((cur.score - prev.score) * 10) / 10;
          const meta = themes.find((t) => t.id === cur.theme);
          const isUp = diff > 0;
          const isDown = diff < 0;

          return (
            <div key={cur.theme} className="flex items-center gap-2 text-sm">
              <span className="w-4 text-center">{meta?.emoji}</span>
              <span className="flex-1 text-[#9B9A97] text-xs">{meta?.label}</span>
              <span className="text-[#37352F] w-6 text-right">{prev.score}</span>
              <span className="text-[#9B9A97] text-xs">→</span>
              <span className="text-[#37352F] w-6 text-right">{cur.score}</span>
              <span className={[
                "w-12 text-right text-xs font-medium",
                isUp ? "text-green-600" : isDown ? "text-red-500" : "text-[#9B9A97]",
              ].join(" ")}>
                {isUp ? `↑ +${diff}` : isDown ? `↓ ${diff}` : "－"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function ReportPage() {
  const [report, setReport] = useState<string | null>(null);
  const [currentScores, setCurrentScores] = useState<ThemeScore[] | null>(null);
  const [previous, setPrevious] = useState<PreviousData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("rampup_result");
    if (!raw) {
      setError(true);
      setLoading(false);
      return;
    }
    const { report, scores } = JSON.parse(raw) as { report?: string; scores?: ThemeScore[] };
    if (report) setReport(report);
    else setError(true);
    if (scores) setCurrentScores(scores);
    setLoading(false);

    // 前回の診断を取得
    fetch("/api/previous-diagnosis")
      .then((res) => res.json())
      .then((data) => {
        if (data.exists) setPrevious({ scores: data.scores, created_at: data.created_at });
      })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#FFFFFF] gap-4">
        <div className="w-8 h-8 border-2 border-[#1A6CF6] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#9B9A97]">レポートを読み込み中です…</p>
      </main>
    );
  }

  if (error || !report) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#FFFFFF]">
        <p className="text-sm text-[#9B9A97]">
          データが見つかりません。{" "}
          <a href="/diagnosis" className="text-[#1A6CF6] underline">
            診断をやり直す
          </a>
        </p>
      </main>
    );
  }

  const sections = parseReport(report);

  return (
    <main className="min-h-screen bg-[#FFFFFF]">
      <div className="mx-auto max-w-lg px-4 py-8">
        <a href="/result" className="text-sm text-[#9B9A97] hover:text-[#37352F]">
          ← 診断結果に戻る
        </a>

        <h1 className="text-2xl font-bold text-[#37352F] mt-4 mb-1">詳細レポート</h1>
        <p className="text-sm text-[#9B9A97] mb-8">あなたの特性をより深く読み解きます</p>

        {sections.length > 0 ? (
          <div className="space-y-8">
            {sections.map((section, i) => (
              <section key={i} className="border border-[#E9E9E7] rounded-xl p-5">
                <h2 className="text-base font-bold text-[#37352F] mb-3">{section.heading}</h2>
                <p className="text-sm text-[#37352F] leading-relaxed whitespace-pre-wrap">
                  {section.body}
                </p>
              </section>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#37352F] leading-relaxed whitespace-pre-wrap">{report}</p>
        )}

        {/* 前回との変化（2回目以降のみ表示） */}
        {previous && currentScores && (
          <div className="mt-8">
            <ChangeSection current={currentScores} previous={previous} />
          </div>
        )}

        <div className="mt-10 text-center">
          <a href="/diagnosis" className="text-sm text-[#9B9A97] hover:text-[#37352F] underline">
            診断をやり直す
          </a>
        </div>
      </div>
    </main>
  );
}
