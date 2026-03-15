"use client";

import { useEffect, useState } from "react";
import { themes } from "@/lib/data/questions";
import type { ThemeScore } from "@/lib/scoring";

type ResultData = {
  scores: ThemeScore[];
  manual: string;
};

function RadarChart({ scores }: { scores: ThemeScore[] }) {
  const cx = 160;
  const cy = 160;
  const r = 115;
  const levels = 5;
  const n = scores.length;

  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const toPoint = (i: number, value: number) => {
    const ratio = value / 5;
    const a = angle(i);
    return { x: cx + r * ratio * Math.cos(a), y: cy + r * ratio * Math.sin(a) };
  };

  const gridPolygon = (level: number) =>
    Array.from({ length: n }, (_, i) => {
      const ratio = level / levels;
      const a = angle(i);
      return `${cx + r * ratio * Math.cos(a)},${cy + r * ratio * Math.sin(a)}`;
    }).join(" ");

  const dataPoints = scores
    .map((s, i) => {
      const p = toPoint(i, s.score);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 320 320" className="w-full max-w-xs mx-auto">
      {/* Grid polygons */}
      {Array.from({ length: levels }, (_, i) => (
        <polygon
          key={i}
          points={gridPolygon(i + 1)}
          fill="none"
          stroke="#E9E9E7"
          strokeWidth="1"
        />
      ))}
      {/* Axes */}
      {Array.from({ length: n }, (_, i) => {
        const p = toPoint(i, 5);
        return (
          <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E9E9E7" strokeWidth="1" />
        );
      })}
      {/* Data polygon */}
      <polygon points={dataPoints} fill="#1A6CF620" stroke="#1A6CF6" strokeWidth="2" />
      {/* Dots */}
      {scores.map((s, i) => {
        const p = toPoint(i, s.score);
        return <circle key={i} cx={p.x} cy={p.y} r="4" fill="#1A6CF6" />;
      })}
      {/* Labels */}
      {scores.map((s, i) => {
        const a = angle(i);
        const lx = cx + (r + 22) * Math.cos(a);
        const ly = cy + (r + 22) * Math.sin(a);
        const meta = themes.find((t) => t.id === s.theme);
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="13">
            {meta?.emoji}
          </text>
        );
      })}
    </svg>
  );
}

type ManualSection = { heading: string; bullets: string[] };

function parseManual(text: string): ManualSection[] {
  const sections: ManualSection[] = [];
  let currentHeading = "";
  let bullets: string[] = [];

  const flush = () => {
    if (currentHeading) {
      sections.push({ heading: currentHeading, bullets: [...bullets] });
      bullets = [];
    }
  };

  for (const line of text.split("\n")) {
    if (line.startsWith("## ") || line.startsWith("# ")) {
      flush();
      currentHeading = line.replace(/^#+\s*/, "").trim();
    } else if (line.startsWith("- ")) {
      bullets.push(line.slice(2).trim());
    }
  }
  flush();
  return sections;
}

function ManualSections({ text }: { text: string }) {
  const sections = parseManual(text);
  if (sections.length === 0) {
    return <p className="text-sm text-[#37352F] leading-relaxed whitespace-pre-wrap">{text}</p>;
  }
  return (
    <div className="grid gap-3">
      {sections.map((s, i) => (
        <div key={i} className="border border-[#E9E9E7] rounded-xl p-4">
          <h3 className="text-sm font-bold text-[#37352F] mb-2">{s.heading}</h3>
          <ul className="space-y-1">
            {s.bullets.map((b, j) => (
              <li key={j} className="flex items-start gap-2 text-sm text-[#37352F]">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#1A6CF6]" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function ResultPage() {
  const [data, setData] = useState<ResultData | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("rampup_result");
    if (raw) setData(JSON.parse(raw));
  }, []);

  if (!data) {
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

  return (
    <main className="min-h-screen bg-[#FFFFFF]">
      <div className="mx-auto max-w-lg px-4 py-8">
        <h1 className="text-2xl font-bold text-[#37352F] mb-1">あなたの取扱説明書</h1>
        <p className="text-sm text-[#9B9A97] mb-8">診断結果をもとに生成しました</p>

        {/* Radar Chart */}
        <section className="mb-8">
          <h2 className="text-base font-semibold text-[#37352F] mb-3">10テーマのスコア</h2>
          <RadarChart scores={data.scores} />
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1">
            {data.scores.map((s) => {
              const meta = themes.find((t) => t.id === s.theme);
              return (
                <div key={s.theme} className="flex items-center gap-1 text-xs">
                  <span>{meta?.emoji}</span>
                  <span className="text-[#9B9A97] truncate">{meta?.label}</span>
                  <span className="font-medium text-[#37352F] ml-auto">{s.score}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Manual */}
        <section className="border-t border-[#E9E9E7] pt-6">
          <h2 className="text-base font-semibold text-[#37352F] mb-4">取扱説明書</h2>
          <ManualSections text={data.manual} />
        </section>

        <div className="mt-10 flex flex-col items-center gap-4">
          <a
            href="/report"
            className="w-full rounded-lg bg-[#1A6CF6] px-4 py-3 text-center text-sm font-medium text-white hover:bg-[#1A5BE0] transition-colors"
          >
            詳細レポートを見る →
          </a>
          <a href="/diagnosis" className="text-sm text-[#9B9A97] hover:text-[#37352F] underline">
            診断をやり直す
          </a>
        </div>
      </div>
    </main>
  );
}
