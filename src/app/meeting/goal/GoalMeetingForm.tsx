"use client";

import { useState, useEffect, useCallback } from "react";

type Member = { id: string; name: string | null; email: string };

type WcmData = {
  will_now: string | null;
  will_career: string | null;
  can_strengths: string | null;
  can_development: string | null;
  must_mission: string | null;
} | null;

type MilestoneData = {
  event_year: number;
  event_month: number | null;
  event: string;
  motivation: number;
}[];

type MemberDetail = {
  manual: string | null;
  wcm: WcmData;
  milestones: MilestoneData;
  lastPostMeetingNotes: string | null;
};

const SECTION_NAMES = [
  "オープニング",
  "Willの深掘り",
  "Mustの伝え方",
  "すり合わせ",
  "目標の言語化",
] as const;

function parseSections(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of SECTION_NAMES) {
    const markers = [`✅ ${name}`, `【${name}】`];
    let start = -1;
    let markLen = 0;
    for (const m of markers) {
      const i = text.indexOf(m);
      if (i !== -1) {
        start = i;
        markLen = m.length;
        break;
      }
    }
    if (start === -1) continue;
    const contentStart = start + markLen;
    let end = text.length;
    for (const next of SECTION_NAMES.slice(SECTION_NAMES.indexOf(name) + 1)) {
      for (const m of [`✅ ${next}`, `【${next}】`]) {
        const i = text.indexOf(m, contentStart);
        if (i !== -1 && i < end) {
          end = i;
          break;
        }
      }
    }
    out[name] = text.slice(contentStart, end).trim();
  }
  return out;
}

const SECTION_COLORS: Record<string, string> = {
  オープニング: "border-l-gray-300",
  Willの深掘り: "border-l-pink-400",
  Mustの伝え方: "border-l-green-400",
  すり合わせ: "border-l-blue-400",
  目標の言語化: "border-l-purple-400",
};

export default function GoalMeetingForm({
  members,
}: {
  members: Member[];
  managerId: string;
}) {
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberDetail, setMemberDetail] = useState<MemberDetail | null>(null);
  const [showStory, setShowStory] = useState(false);
  const [managerExpectations, setManagerExpectations] = useState("");
  const [previousNotes, setPreviousNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<Record<string, string>>({});
  const [prepId, setPrepId] = useState<string | null>(null);
  const [postMeetingNotes, setPostMeetingNotes] = useState("");
  const [postNotesSaving, setPostNotesSaving] = useState(false);
  const [postNotesSaved, setPostNotesSaved] = useState(false);

  useEffect(() => {
    if (!selectedMemberId) {
      setMemberDetail(null);
      setPreviousNotes("");
      return;
    }
    setMemberDetail(null);
    fetch(
      `/api/goal-meeting/member-detail?memberId=${encodeURIComponent(
        selectedMemberId
      )}`
    )
      .then((r) => r.json())
      .then((data: MemberDetail) => {
        setMemberDetail(data);
        if (data.lastPostMeetingNotes) {
          setPreviousNotes(data.lastPostMeetingNotes);
        }
      })
      .catch(() => {
        setMemberDetail(null);
      });
  }, [selectedMemberId]);

  const handleGenerate = useCallback(async () => {
    if (!selectedMemberId || !managerExpectations.trim() || loading) return;
    setLoading(true);
    setSections({});
    setPrepId(null);
    setPostMeetingNotes("");
    setPostNotesSaved(false);
    setPostNotesSaving(false);
    try {
      const res = await fetch("/api/generate-goal-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selectedMemberId,
          managerExpectations,
          manual: memberDetail?.manual ?? null,
          wcm: memberDetail?.wcm ?? null,
          milestones: memberDetail?.milestones ?? [],
          previousNotes: previousNotes || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSections(parseSections(data.aiOutput));
        setPrepId(data.prepId ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedMemberId, managerExpectations, memberDetail, previousNotes, loading]);

  const handleSavePostNotes = useCallback(async () => {
    if (!prepId || !postMeetingNotes.trim()) return;
    setPostNotesSaving(true);
    try {
      const res = await fetch(`/api/meeting-preps/${prepId}/post-notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postMeetingNotes }),
      });
      if (res.ok) setPostNotesSaved(true);
    } finally {
      setPostNotesSaving(false);
    }
  }, [prepId, postMeetingNotes]);

  const wcm = memberDetail?.wcm;
  const milestones = memberDetail?.milestones ?? [];
  const hasStory = wcm && Object.values(wcm).some((v) => v);
  const hasMilestones = milestones.length > 0;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-[#E9E9E7] px-5 py-4">
        <label className="block text-xs font-medium text-[#9B9A97] mb-2">
          メンバーを選ぶ
        </label>
        <select
          value={selectedMemberId}
          onChange={(e) => {
            setSelectedMemberId(e.target.value);
            setSections({});
            setPrepId(null);
            setPostMeetingNotes("");
            setPostNotesSaved(false);
            setManagerExpectations("");
          }}
          className="w-full text-sm text-[#37352F] border border-[#E9E9E7] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1A6CF6] bg-[#FAFAFA]"
        >
          <option value="">-- メンバーを選択 --</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name ?? m.email}
            </option>
          ))}
        </select>
      </div>

      {selectedMemberId && memberDetail && (
        <div className="bg-white rounded-xl border border-[#E9E9E7] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowStory((p) => !p)}
            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#F7F6F3] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#37352F]">
                メンバーのストーリー
              </span>
              <div className="flex gap-1">
                {hasStory && (
                  <span className="text-xs text-[#9B9A97] bg-[#F7F6F3] px-1.5 py-0.5 rounded">
                    WCM
                  </span>
                )}
                {hasMilestones && (
                  <span className="text-xs text-[#9B9A97] bg-[#F7F6F3] px-1.5 py-0.5 rounded">
                    人生史
                  </span>
                )}
                {memberDetail.manual && (
                  <span className="text-xs text-[#9B9A97] bg-[#F7F6F3] px-1.5 py-0.5 rounded">
                    取扱説明書
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs text-[#9B9A97]">
              {showStory ? "▲ 閉じる" : "▼ 開く"}
            </span>
          </button>

          {showStory && (
            <div className="border-t border-[#E9E9E7] px-5 py-4 space-y-4 text-sm">
              {hasMilestones && (
                <div>
                  <p className="text-xs font-medium text-[#9B9A97] mb-2">
                    人生史・転換点
                  </p>
                  <div className="space-y-1">
                    {milestones.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs text-[#37352F]"
                      >
                        <span className="text-[#9B9A97] shrink-0">
                          {m.event_year}年
                          {m.event_month ? `${m.event_month}月` : ""}
                        </span>
                        <span>{m.event}</span>
                        <span className="text-[#9B9A97] ml-auto shrink-0">
                          モチベ {m.motivation}/5
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hasStory && (
                <div>
                  <p className="text-xs font-medium text-[#9B9A97] mb-2">
                    Will-Can-Must
                  </p>
                  {[
                    { label: "① 今の仕事で実現したいこと", value: wcm?.will_now },
                    {
                      label: "② 2〜3年後のキャリアイメージ",
                      value: wcm?.will_career,
                    },
                    {
                      label: "③ 強み・課題の整理",
                      value: wcm?.can_strengths,
                    },
                    {
                      label: "④ 能力開発のための行動目標",
                      value: wcm?.can_development,
                    },
                    {
                      label: "⑤ 担うミッションと役割行動",
                      value: wcm?.must_mission,
                    },
                  ]
                    .filter((f) => f.value)
                    .map((f, i) => (
                      <div key={i} className="mb-2">
                        <p className="text-xs text-[#9B9A97]">{f.label}</p>
                        <p className="text-xs text-[#37352F] leading-relaxed whitespace-pre-wrap">
                          {f.value}
                        </p>
                      </div>
                    ))}
                </div>
              )}

              {memberDetail.manual && (
                <div>
                  <p className="text-xs font-medium text-[#9B9A97] mb-2">
                    取扱説明書
                  </p>
                  <p className="text-xs text-[#37352F] leading-relaxed whitespace-pre-wrap line-clamp-6">
                    {memberDetail.manual}
                  </p>
                </div>
              )}

              {!hasStory && !hasMilestones && !memberDetail.manual && (
                <p className="text-xs text-[#9B9A97]">
                  このメンバーはまだストーリーを入力していません。取扱説明書もありません。
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {selectedMemberId && memberDetail && (
        <div className="bg-white rounded-xl border border-[#E9E9E7] px-5 py-4">
          <label className="block text-xs font-medium text-[#9B9A97] mb-2">
            前回の面談メモ
          </label>
          <textarea
            value={previousNotes}
            onChange={(e) => setPreviousNotes(e.target.value)}
            placeholder="前回の目標設定面談で話したこと、決めたことなど"
            rows={3}
            className="w-full text-sm text-[#37352F] placeholder:text-[#C8C7C4] bg-[#FAFAFA] border border-[#E9E9E7] rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#1A6CF6] focus:bg-white transition-colors"
          />
          {memberDetail.lastPostMeetingNotes &&
            previousNotes === memberDetail.lastPostMeetingNotes && (
              <p className="mt-1 text-xs text-[#9B9A97]">
                前回の面談メモを引き継ぎました（編集できます）
              </p>
            )}
        </div>
      )}

      {selectedMemberId && (
        <div className="bg-white rounded-xl border border-[#E9E9E7] px-5 py-4">
          <label className="block text-xs font-medium text-[#37352F] mb-1.5">
            今期このメンバーへの期待
            <span className="text-red-400 ml-1">*</span>
          </label>
          <p className="text-xs text-[#9B9A97] mb-2">
            組織・チームとしての期待役割・テーマを書いてください。これがMustとしてAIの生成に使われます。
          </p>
          <textarea
            value={managerExpectations}
            onChange={(e) => setManagerExpectations(e.target.value)}
            placeholder="例：新人育成の主担当として、オンボーディングプログラムを設計してほしい。チームの品質基準の引き上げにも取り組んでほしい。"
            rows={4}
            className="w-full text-sm text-[#37352F] placeholder:text-[#C8C7C4] bg-[#FAFAFA] border border-[#E9E9E7] rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#1A6CF6] focus:bg-white transition-colors"
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!managerExpectations.trim() || loading}
            className="mt-3 w-full bg-[#1A6CF6] text-white rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-[#1A5BE0] transition-colors"
          >
            {loading ? "生成中..." : "⚡ 面談ガイドを生成する"}
          </button>
        </div>
      )}

      {Object.keys(sections).length > 0 && (
        <div className="bg-white rounded-xl border border-[#E9E9E7] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E9E9E7]">
            <h2 className="text-sm font-semibold text-[#37352F]">
              面談ガイド
            </h2>
            <p className="text-xs text-[#9B9A97] mt-0.5">
              面談中にこの画面を参照しながら対話を進めてください
            </p>
          </div>

          {SECTION_NAMES.filter((name) => sections[name]).map((name) => (
            <div
              key={name}
              className={`border-b border-[#E9E9E7] last:border-0 px-5 py-4 border-l-4 ${
                SECTION_COLORS[name] ?? "border-l-gray-200"
              }`}
            >
              <h3 className="text-xs font-bold text-[#37352F] mb-2">
                {name}
              </h3>
              <p className="text-sm text-[#37352F] leading-relaxed whitespace-pre-wrap">
                {sections[name]}
              </p>
            </div>
          ))}

          {prepId && (
            <div className="px-5 py-4 border-t border-[#E9E9E7]">
              <h3 className="text-sm font-medium text-[#37352F] mb-1">
                面談後メモ
              </h3>
              <p className="text-xs text-[#9B9A97] mb-2">
                合意した目標・決定事項を記録してください。次回の目標設定面談と査定FBに引き継がれます。
              </p>
              <textarea
                value={postMeetingNotes}
                onChange={(e) => setPostMeetingNotes(e.target.value)}
                placeholder="合意した目標、面談で決めたこと、次回確認したいことなど"
                rows={4}
                className="w-full rounded-lg border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] placeholder:text-[#9B9A97] focus:outline-none focus:ring-2 focus:ring-[#1A6CF6]/30 resize-none"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSavePostNotes}
                  disabled={
                    !postMeetingNotes.trim() ||
                    postNotesSaving ||
                    postNotesSaved
                  }
                  className="text-sm bg-[#1A6CF6] text-white px-4 py-1.5 rounded-lg disabled:opacity-40 hover:bg-[#1A5BE0] transition-colors"
                >
                  {postNotesSaved
                    ? "保存しました ✓"
                    : postNotesSaving
                    ? "保存中..."
                    : "保存する"}
                </button>
                {postNotesSaved && (
                  <p className="text-xs text-[#9B9A97]">
                    次回の面談準備に引き継がれます
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

