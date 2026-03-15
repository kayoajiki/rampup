import { questions, type Theme } from "./data/questions";

export type ThemeScore = {
  theme: Theme;
  score: number;
};

type Answers = Record<number, number>;

export function calculateThemeScores(answers: Answers): ThemeScore[] {
  const themeTotals = new Map<Theme, { sum: number; count: number }>();

  for (const q of questions) {
    const answer = answers[q.id];
    if (typeof answer !== "number") continue;

    const raw = Math.min(Math.max(answer, 1), 5);
    const value = q.rev ? 6 - raw : raw;

    const current = themeTotals.get(q.theme) ?? { sum: 0, count: 0 };
    current.sum += value;
    current.count += 1;
    themeTotals.set(q.theme, current);
  }

  const result: ThemeScore[] = [];

  for (const [theme, { sum, count }] of themeTotals.entries()) {
    if (count === 0) continue;
    const avg = sum / count;
    const rounded = Math.round(avg * 10) / 10;
    result.push({ theme, score: rounded });
  }

  return result;
}

