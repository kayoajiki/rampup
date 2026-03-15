"use client";

import { useCallback, useMemo, useState } from "react";
import { questions, labels, themes } from "@/lib/data/questions";

type Answers = Record<number, number>;

const TOTAL = questions.length;

export default function DiagnosisPage() {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);

  const question = questions[index];

  const currentTheme = useMemo(
    () => themes.find((t) => t.id === question.theme),
    [question.theme],
  );

  const handleSelect = useCallback(
    (value: number) => {
      setAnswers((prev) => ({ ...prev, [question.id]: value }));

      const isLast = index === TOTAL - 1;
      if (!isLast) {
        setTimeout(() => {
          setIndex((prev) => Math.min(prev + 1, TOTAL - 1));
        }, 150);
      }
    },
    [index, question.id],
  );

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/generate-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      if (!res.ok) {
        // TODO: エラーメッセージ表示
        return;
      }

      const data = await res.json();
      sessionStorage.setItem("rampup_result", JSON.stringify(data));
      window.location.href = "/result";
    } finally {
      setSubmitting(false);
    }
  }, [answers, submitting]);

  const selected = answers[question.id];
  const isLast = index === TOTAL - 1;
  const progress = Math.round(((index + 1) / TOTAL) * 100);

  return (
    <main className="min-h-screen bg-[#FFFFFF]">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-6">
        {/* 上部: 進捗バー + テキスト */}
        <header className="sticky top-0 z-10 -mx-4 mb-6 bg-[#FFFFFF] px-4 pb-4">
          <div className="h-1 w-full overflow-hidden rounded-full bg-[#F7F6F3]">
            <div
              className="h-full rounded-full bg-[#1A6CF6] transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            {index > 0 ? (
              <button
                type="button"
                onClick={() => setIndex((prev) => prev - 1)}
                className="text-sm text-[#9B9A97] hover:text-[#37352F] transition-colors duration-150"
              >
                ← 戻る
              </button>
            ) : (
              <span />
            )}
            <span className="text-sm text-[#9B9A97]">{index + 1} / {TOTAL}</span>
          </div>
        </header>

        {/* 中央: テーマラベル + 質問文 */}
        <section className="flex flex-1 flex-col justify-center gap-4 text-center">
          {currentTheme && (
            <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-[#F7F6F3] px-3 py-1 text-xs text-[#9B9A97]">
              <span>{currentTheme.emoji}</span>
              <span>{currentTheme.label}</span>
            </div>
          )}
          <p className="px-2 text-xl font-medium text-[#37352F]">
            {question.text}
          </p>
        </section>

        {/* 下部: 選択肢 + 最後の問のボタン */}
        <section className="mt-6 space-y-4 pb-4">
          <div className="space-y-2">
            {labels.map((label, i) => {
              const value = i + 1;
              const active = selected === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleSelect(value)}
                  className={[
                    "w-full rounded-lg border px-4 py-3 text-left text-sm transition-all duration-150",
                    active
                      ? "border-[#1A6CF6] bg-[#EEF4FF] text-[#1A6CF6]"
                      : "border-[#E9E9E7] bg-[#F7F6F3] text-[#37352F] hover:bg-[#F1F5FF]",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {isLast && (
            <button
              type="button"
              disabled={!selected || submitting}
              onClick={handleSubmit}
              className={[
                "mt-2 w-full rounded-lg px-4 py-3 text-center text-sm font-medium transition-all duration-150",
                !selected || submitting
                  ? "cursor-not-allowed bg-[#F7F6F3] text-[#9B9A97]"
                  : "bg-[#1A6CF6] text-white hover:bg-[#1A5BE0]",
              ].join(" ")}
            >
              {submitting ? "診断中..." : "診断する"}
            </button>
          )}
        </section>
      </div>
    </main>
  );
}

