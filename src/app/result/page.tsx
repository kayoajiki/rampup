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

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: number) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key} className="list-disc pl-5 space-y-1 mb-4">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm text-[#37352F] leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, idx) => {
    if (line.startsWith("## ")) {
      flushList(idx);
      elements.push(
        <h2 key={idx} className="font-bold text-lg text-[#37352F] mt-6 mb-2 border-b border-[#E9E9E7] pb-1">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      flushList(idx);
      elements.push(
        <h3 key={idx} className="font-semibold text-base text-[#37352F] mt-4 mb-1">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
    } else if (line.trim() === "") {
      flushList(idx);
    } else {
      flushList(idx);
      elements.push(
        <p key={idx} className="text-sm text-[#37352F] mb-3 leading-relaxed">
          {line}
        </p>
      );
    }
  });

  flushList(lines.length);
  return <div>{elements}</div>;
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
          <Markdown text={data.manual} />
        </section>

        <div className="mt-10 text-center">
          <a href="/diagnosis" className="text-sm text-[#9B9A97] hover:text-[#37352F] underline">
            診断をやり直す
          </a>
        </div>
      </div>
    </main>
  );
}
