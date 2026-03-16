"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type WcmValues = {
  will_now: string;
  will_career: string;
  can_strengths: string;
  can_development: string;
  must_mission: string;
};

type Milestone = {
  id: string;
  event_year: number;
  event_month: number | null;
  event: string;
  feeling: string;
  motivation: number;
};

type Props = {
  initialWcm: WcmValues;
  initialMilestones: Milestone[];
  diagnosisManual: string | null;
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

const MOTIVATION_OPTIONS = [
  { value: 1, emoji: "😔", label: "非常に苦しかった" },
  { value: 2, emoji: "😟", label: "苦しかった" },
  { value: 3, emoji: "😐", label: "普通" },
  { value: 4, emoji: "😊", label: "充実していた" },
  { value: 5, emoji: "😍", label: "非常に充実していた" },
] as const;

function motivationLabel(v: number): string {
  return MOTIVATION_OPTIONS.find((o) => o.value === v)?.label ?? "";
}

function MotivationGraph({ milestones }: { milestones: Milestone[] }) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    motivation: number;
  } | null>(null);

  if (milestones.length < 2) {
    return (
      <p className="text-xs text-[#9B9A97] text-center py-6">
        転換点を2つ以上追加するとグラフが表示されます
      </p>
    );
  }

  const W = 560;
  const H = 160;
  const padL = 28;
  const padR = 16;
  const padT = 12;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const points = milestones.map((m, i) => ({
    x: padL + (innerW / (milestones.length - 1)) * i,
    y: padT + innerH - ((m.motivation - 1) / 4) * innerH,
    label: m.event_month ? `${m.event_year}/${m.event_month}` : `${m.event_year}`,
    motivation: m.motivation,
    event: m.event,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  const yTicks = [5, 4, 3, 2, 1].map((v) => ({
    v,
    y: padT + innerH - ((v - 1) / 4) * innerH,
  }));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 160 }}
        onMouseLeave={() => setTooltip(null)}
      >
        {yTicks.map(({ v, y }) => (
          <g key={v}>
            <line
              x1={padL}
              y1={y}
              x2={W - padR}
              y2={y}
              stroke="#E9E9E7"
              strokeWidth={1}
            />
            <text
              x={padL - 4}
              y={y + 4}
              textAnchor="end"
              fontSize={9}
              fill="#9B9A97"
            >
              {v}
            </text>
          </g>
        ))}
        <path
          d={pathD}
          fill="none"
          stroke="#1A6CF6"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={5}
              fill="#1A6CF6"
              style={{ cursor: "pointer" }}
              onMouseEnter={() =>
                setTooltip({
                  x: p.x,
                  y: p.y,
                  label: p.event,
                  motivation: p.motivation,
                })
              }
            />
            <text
              x={p.x}
              y={H - padB + 12}
              textAnchor="middle"
              fontSize={8}
              fill="#9B9A97"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>

      {tooltip && (
        <div
          className="absolute bg-[#37352F] text-white text-xs rounded px-2 py-1 pointer-events-none z-10 max-w-[180px]"
          style={{
            left: `${(tooltip.x / W) * 100}%`,
            top: `${(tooltip.y / H) * 100}%`,
            transform: "translate(-50%, -110%)",
          }}
        >
          <p className="font-medium">{tooltip.label}</p>
          <p className="text-[#9B9A97]">
            {MOTIVATION_OPTIONS.find((o) => o.value === tooltip.motivation)
              ?.emoji}{" "}
            {motivationLabel(tooltip.motivation)}
          </p>
        </div>
      )}
    </div>
  );
}

const MILESTONE_SUGGESTIONS = [
  "入社・転職・異動",
  "昇進・役割変化",
  "チャレンジした仕事",
  "大きな失敗・挫折",
  "メンターとの出会い",
  "プライベートの転機",
] as const;

function MilestoneForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<Milestone>;
  onSave: (values: Omit<Milestone, "id">) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [year, setYear] = useState(initial?.event_year?.toString() ?? "");
  const [month, setMonth] = useState(initial?.event_month?.toString() ?? "");
  const [event, setEvent] = useState(initial?.event ?? "");
  const [feeling, setFeeling] = useState(initial?.feeling ?? "");
  const [motivation, setMotivation] = useState(initial?.motivation ?? 3);

  const handleSave = async () => {
    if (!year || !event.trim()) return;
    await onSave({
      event_year: parseInt(year, 10),
      event_month: month ? parseInt(month, 10) : null,
      event: event.trim(),
      feeling: feeling.trim(),
      motivation,
    });
  };

  return (
    <div className="space-y-3 py-3 border-t border-[#E9E9E7]">
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs text-[#9B9A97] mb-1">年 *</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2020"
            min={1990}
            max={2030}
            className="w-full text-sm border border-[#E9E9E7] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1A6CF6] bg-[#FAFAFA]"
          />
        </div>
        <div className="w-20">
          <label className="block text-xs text-[#9B9A97] mb-1">
            月（任意）
          </label>
          <input
            type="number"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="4"
            min={1}
            max={12}
            className="w-full text-sm border border-[#E9E9E7] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1A6CF6] bg-[#FAFAFA]"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-[#9B9A97] mb-1">
          出来事・転換点 *
        </label>
        <input
          type="text"
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          placeholder="例：チームリーダーに初めて任命された"
          className="w-full text-sm border border-[#E9E9E7] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1A6CF6] bg-[#FAFAFA]"
        />
        <div className="flex flex-wrap gap-1 mt-1.5">
          {MILESTONE_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setEvent(s)}
              className="text-xs text-[#9B9A97] border border-[#E9E9E7] rounded-full px-2 py-0.5 hover:border-[#1A6CF6] hover:text-[#1A6CF6] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-[#9B9A97] mb-1">
          そのときの感情・気づき（任意）
        </label>
        <textarea
          value={feeling}
          onChange={(e) => setFeeling(e.target.value)}
          placeholder="自分の意思決定でチームが動くことに達成感を覚えた。責任の重さも感じた。"
          rows={2}
          className="w-full text-sm border border-[#E9E9E7] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1A6CF6] bg-[#FAFAFA] resize-none"
        />
      </div>

      <div>
        <label className="block text-xs text-[#9B9A97] mb-2">
          モチベーション
        </label>
        <div className="flex gap-2">
          {MOTIVATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMotivation(opt.value)}
              title={opt.label}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border transition-colors ${
                motivation === opt.value
                  ? "border-[#1A6CF6] bg-blue-50"
                  : "border-[#E9E9E7] bg-[#FAFAFA] hover:border-[#1A6CF6]"
              }`}
            >
              <span className="text-xl">{opt.emoji}</span>
              <span
                className={`text-xs ${
                  motivation === opt.value
                    ? "text-[#1A6CF6] font-bold"
                    : "text-[#9B9A97]"
                }`}
              >
                {opt.value}
              </span>
            </button>
          ))}
        </div>
        {motivation && (
          <p className="mt-1.5 text-xs text-[#9B9A97]">
            {motivationLabel(motivation)}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!year || !event.trim() || saving}
          className="text-sm bg-[#1A6CF6] text-white px-4 py-1.5 rounded-lg disabled:opacity-40 hover:bg-[#1A5BE0] transition-colors"
        >
          {saving ? "保存中..." : initial?.id ? "更新する" : "追加する"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-[#9B9A97] px-4 py-1.5 rounded-lg hover:bg-[#F7F6F3] transition-colors"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}

function MilestoneRow({
  milestone,
  onEdit,
  onDelete,
}: {
  milestone: Milestone;
  onEdit: (m: Milestone) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-2 py-2.5 border-b border-[#F0F0EE] last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs text-[#9B9A97] shrink-0">
            {milestone.event_year}年
            {milestone.event_month ? `${milestone.event_month}月` : ""}
          </span>
          <span className="text-xs font-medium text-[#37352F] truncate">
            {milestone.event}
          </span>
        </div>
        {milestone.feeling && (
          <p className="text-xs text-[#9B9A97] line-clamp-1">
            {milestone.feeling}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-[#1A6CF6] font-bold">
          {milestone.motivation}
        </span>
        <span className="text-xs text-[#9B9A97]">
          ― {motivationLabel(milestone.motivation)}
        </span>
        <button
          type="button"
          onClick={() => onEdit(milestone)}
          className="text-xs text-[#9B9A97] hover:text-[#1A6CF6] transition-colors px-1"
        >
          編集
        </button>
        <button
          type="button"
          onClick={() => onDelete(milestone.id)}
          className="text-xs text-[#9B9A97] hover:text-red-400 transition-colors px-1"
        >
          削除
        </button>
      </div>
    </div>
  );
}

const WCM_SECTIONS = [
  {
    block: "Will",
    color: "bg-pink-50 border-pink-200",
    labelColor: "text-pink-600",
    fields: [
      {
        key: "will_now" as const,
        number: "①",
        label: "今の仕事で実現したいこと",
        placeholder:
          "このチームで、メンバーが自分らしく働けるような環境を作りたい。\n仕事を通じて、人の可能性が広がる瞬間に関わっていきたい。",
        hint: "「なぜ今の会社・チームにいるのか」「仕事でいちばん充実感を覚える瞬間は何か」を手がかりに書いてみてください。",
      },
      {
        key: "will_career" as const,
        number: "②",
        label: "2〜3年後のキャリアイメージ",
        placeholder:
          "人材育成や組織開発に関わる専門職として、より広い範囲で貢献できるようになりたい。",
        hint: "「理想の状態」でも「なんとなくのイメージ」でもOK。具体的でなくても大丈夫です。",
      },
    ],
  },
  {
    block: "Can",
    color: "bg-blue-50 border-blue-200",
    labelColor: "text-blue-600",
    fields: [
      {
        key: "can_strengths" as const,
        number: "③",
        label: "強み・課題の整理",
        placeholder:
          "【強み】情報を整理して伝えるのが得意。人の話を丁寧に聞ける。\n【課題】意思決定に時間がかかることがある。大人数の場では発言しにくい。",
        hint: "「強み」と「課題」を分けて書くと整理しやすいです。取扱説明書の内容と重なってもOK。",
      },
      {
        key: "can_development" as const,
        number: "④",
        label: "能力開発のための具体的な行動目標",
        placeholder:
          "週1回はチームの議論でファシリテーター役を担う。\n月1冊、組織開発に関する本を読む。",
        hint: "「Willを実現するために、今期伸ばしたいスキル・習慣」を書いてください。",
      },
    ],
  },
  {
    block: "Must",
    color: "bg-green-50 border-green-200",
    labelColor: "text-green-600",
    fields: [
      {
        key: "must_mission" as const,
        number: "⑤",
        label: "担うミッションと役割行動",
        placeholder:
          "新規メンバーのオンボーディングを担当し、早期戦力化を支援する。\nチームの品質基準の策定と、メンバーへの浸透。",
        hint: "肩書きではなく「期待されていること・果たすべき役割」を書くと、面談準備AIがより具体的なアドバイスを生成できます。",
      },
    ],
  },
] as const;

export default function StoryForm({
  initialWcm,
  initialMilestones,
  diagnosisManual,
}: Props) {
  const [wcm, setWcm] = useState<WcmValues>(initialWcm);
  const [wcmStatus, setWcmStatus] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const debouncedWcm = useDebounce(wcm, 1500);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const hasContent = Object.values(debouncedWcm).some((v) => v.trim());
    if (!hasContent) return;

    setWcmStatus("saving");
    fetch("/api/my-story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(debouncedWcm),
    })
      .then((r) => {
        if (r.ok) {
          setWcmStatus("saved");
          setTimeout(() => setWcmStatus("idle"), 2000);
        } else {
          setWcmStatus("idle");
        }
      })
      .catch(() => setWcmStatus("idle"));
  }, [debouncedWcm]);

  const [milestones, setMilestones] =
    useState<Milestone[]>(initialMilestones);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMilestone, setEditingMilestone] =
    useState<Milestone | null>(null);
  const [addSaving, setAddSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const sortMilestones = (arr: Milestone[]) =>
    [...arr].sort((a, b) =>
      a.event_year !== b.event_year
        ? a.event_year - b.event_year
        : (a.event_month ?? 0) - (b.event_month ?? 0)
    );

  const handleAdd = useCallback(
    async (values: Omit<Milestone, "id">) => {
      setAddSaving(true);
      try {
        const res = await fetch("/api/my-story/milestones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (res.ok) {
          const { id } = (await res.json()) as { id: string };
          setMilestones((prev) =>
            sortMilestones([...prev, { id, ...values }])
          );
          setShowAddForm(false);
        }
      } finally {
        setAddSaving(false);
      }
    },
    []
  );

  const handleEditSave = useCallback(
    async (values: Omit<Milestone, "id">) => {
      if (!editingMilestone) return;
      setEditSaving(true);
      try {
        const res = await fetch("/api/my-story/milestones", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingMilestone.id, ...values }),
        });
        if (res.ok) {
          setMilestones((prev) =>
            sortMilestones(
              prev.map((m) =>
                m.id === editingMilestone.id ? { id: m.id, ...values } : m
              )
            )
          );
          setEditingMilestone(null);
        }
      } finally {
        setEditSaving(false);
      }
    },
    [editingMilestone]
  );

  const handleDelete = useCallback(async (id: string) => {
    await fetch("/api/my-story/milestones", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#E9E9E7] overflow-hidden bg-white">
        <div className="px-5 py-4 border-b border-[#E9E9E7]">
          <h2 className="text-sm font-semibold text-[#37352F]">
            人生史・転換点
          </h2>
          <p className="text-xs text-[#9B9A97] mt-0.5">
            キャリアの転換点を記録して、Willの背景を深めましょう
          </p>
        </div>

        <div className="px-5 pt-4 pb-2">
          <p className="text-xs text-[#9B9A97] mb-2">モチベーショングラフ</p>
          <MotivationGraph milestones={milestones} />
        </div>

        <div className="px-5">
          {milestones.map((m) =>
            editingMilestone?.id === m.id ? (
              <MilestoneForm
                key={m.id}
                initial={m}
                onSave={handleEditSave}
                onCancel={() => setEditingMilestone(null)}
                saving={editSaving}
              />
            ) : (
              <MilestoneRow
                key={m.id}
                milestone={m}
                onEdit={setEditingMilestone}
                onDelete={handleDelete}
              />
            )
          )}
        </div>

        <div className="px-5 pb-4">
          {showAddForm ? (
            <MilestoneForm
              onSave={handleAdd}
              onCancel={() => setShowAddForm(false)}
              saving={addSaving}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="mt-2 text-sm text-[#1A6CF6] hover:underline"
            >
              + 転換点を追加
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[#E9E9E7] overflow-hidden bg-white">
        <div className="px-5 py-4 border-b border-[#E9E9E7] flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#37352F]">
              Will-Can-Mustシート
            </h2>
            <p className="text-xs text-[#9B9A97] mt-0.5">
              入力した内容はマネージャーとの目標設定面談の準備に活かされます
            </p>
          </div>
          <span className="text-xs text-[#9B9A97] mt-0.5 shrink-0">
            {wcmStatus === "saving"
              ? "保存中..."
              : wcmStatus === "saved"
              ? "保存済み ✓"
              : ""}
          </span>
        </div>

        {WCM_SECTIONS.map(({ block, color, labelColor, fields }) => (
          <div key={block} className="border-b border-[#E9E9E7]">
            <div className="px-5 pt-4 pb-1">
              <span
                className={`text-xs font-bold tracking-widest px-2 py-0.5 rounded border ${color} ${labelColor}`}
              >
                {block}
              </span>
            </div>
            {fields.map(({ key, number, label, placeholder, hint }) => (
              <div key={key} className="px-5 py-3">
                <label className="block text-xs font-medium text-[#37352F] mb-1.5">
                  {number} {label}
                </label>
                <textarea
                  value={wcm[key]}
                  onChange={(e) =>
                    setWcm((p) => ({ ...p, [key]: e.target.value }))
                  }
                  onFocus={() => setFocusedKey(key)}
                  onBlur={() => setFocusedKey(null)}
                  placeholder={placeholder}
                  rows={3}
                  className="w-full text-sm text-[#37352F] placeholder:text-[#C8C7C4] bg-[#FAFAFA] border border-[#E9E9E7] rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#1A6CF6] focus:bg-white transition-colors leading-relaxed"
                />
                {focusedKey === key && (
                  <p className="mt-1.5 text-xs text-[#9B9A97] leading-relaxed">
                    💡 {hint}
                  </p>
                )}

                {key === "can_strengths" && diagnosisManual && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setShowManual((p) => !p)}
                      className="text-xs text-[#9B9A97] hover:text-[#1A6CF6] transition-colors"
                    >
                      {showManual ? "▲" : "▼"} 取扱説明書を参照する
                    </button>
                    {showManual && (
                      <div className="mt-2 bg-[#F7F6F3] rounded-lg px-3 py-2 text-xs text-[#37352F] leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {diagnosisManual}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        <div className="px-5 py-3">
          <p className="text-xs text-[#9B9A97]">
            編集すると自動で保存されます
          </p>
        </div>
      </div>
    </div>
  );
}

