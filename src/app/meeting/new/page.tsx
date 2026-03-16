"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// ビルド時の静的プリレンダリングではなく、毎リクエストで評価させる
export const dynamic = "force-dynamic";

const SECTION_NAMES = [
  "この人に響くフレーム",
  "避けたほうがいい言い方",
  "具体的な承認フレーズ",
  "なぜあなたに任せたいのか",
  "面談で扱うと良いテーマ",
] as const;

function parseSections(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  // AIの出力形式に応じて「✅ セクション名」と「【セクション名】」両方に対応
  const markers = (name: string) => [`✅ ${name}`, `【${name}】`];

  for (const name of SECTION_NAMES) {
    let start = -1;
    let markLen = 0;
    for (const m of markers(name)) {
      const i = text.indexOf(m);
      if (i !== -1) { start = i; markLen = m.length; break; }
    }
    if (start === -1) continue;

    const contentStart = start + markLen;
    // 次のセクションの開始位置を探す（両形式）
    let end = text.length;
    for (const next of SECTION_NAMES.slice(SECTION_NAMES.indexOf(name) + 1)) {
      for (const m of markers(next)) {
        const i = text.indexOf(m, contentStart);
        if (i !== -1 && i < end) { end = i; break; }
      }
    }
    out[name] = text.slice(contentStart, end).trim();
  }
  return out;
}

type Member = {
  id: string;
  name: string;
  email: string;
  hasDiagnosis: boolean;
  hasShared: boolean;
};


export default function MeetingNewPage() {
  const searchParams = useSearchParams();
  const preselectedMemberId = searchParams.get("memberId") ?? "";

  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] =
    useState<string>(preselectedMemberId);
  const [manual, setManual] = useState<string | null>(null);
  const [lastPostMeetingNotes, setLastPostMeetingNotes] = useState<string | null>(null);
  const [goalMeetingNotes, setGoalMeetingNotes] = useState<string | null>(null);
  const meetingType = "1on1";
  const [previousNotes, setPreviousNotes] = useState("");
  const [recentBehaviors, setRecentBehaviors] = useState("");
  const [managerNotes, setManagerNotes] = useState("");
  const [postMeetingNotes, setPostMeetingNotes] = useState("");
  const [postNotesSaved, setPostNotesSaved] = useState(false);
  const [postNotesSaving, setPostNotesSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<Record<string, string> | null>(null);
  const [prepId, setPrepId] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<number | null>(null);
  const [membersLoading, setMembersLoading] = useState(true);

  useEffect(() => {
    fetch("/api/meeting/members")
      .then((r) => r.json())
      .then((data) => {
        setMembers(data.members ?? []);
        setMembersLoading(false);
      })
      .catch(() => setMembersLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedMemberId) {
      setManual(null);
      setLastPostMeetingNotes(null);
      setGoalMeetingNotes(null);
      setPreviousNotes("");
      return;
    }
    setManual(null);
    setLastPostMeetingNotes(null);
    setGoalMeetingNotes(null);
    fetch(
      `/api/meeting/member-detail?memberId=${encodeURIComponent(selectedMemberId)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setManual(data.manual ?? null);
        const notes = data.lastPostMeetingNotes ?? null;
        setLastPostMeetingNotes(notes);
        if (notes) setPreviousNotes(notes);
        setGoalMeetingNotes(data.goalMeetingNotes ?? null);
      });
  }, [selectedMemberId]);

  const handleSavePostNotes = useCallback(async () => {
    if (!prepId || !postMeetingNotes.trim()) return;
    setPostNotesSaving(true);
    try {
      const res = await fetch(
        `/api/meeting-preps/${prepId}/post-notes`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postMeetingNotes }),
        }
      );
      if (res.ok) setPostNotesSaved(true);
    } finally {
      setPostNotesSaving(false);
    }
  }, [prepId, postMeetingNotes]);

  const canPrepare = !!manual && !loading;

  const handlePrepare = useCallback(async () => {
    if (!manual || !selectedMemberId) return;
    setLoading(true);
    setSections(null);
    setPrepId(null);
    setFeedbackSent(null);
    setPostMeetingNotes("");
    setPostNotesSaved(false);
    setPostNotesSaving(false);
    try {
      const res = await fetch("/api/generate-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selectedMemberId,
          manualText: manual,
          meetingType,
          previousNotes: previousNotes || undefined,
          recentBehaviors: recentBehaviors || undefined,
          managerNotes: managerNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setSections(parseSections(data.output));
      setPrepId(data.prepId ?? null);
      document.getElementById("output-area")?.scrollIntoView({ behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  }, [
    manual,
    selectedMemberId,
    previousNotes,
    recentBehaviors,
    managerNotes,
  ]);

  const handleFeedback = useCallback(
    async (value: 1 | -1) => {
      if (!prepId) return;
      try {
        const res = await fetch(`/api/meeting-preps/${prepId}/feedback`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: value }),
        });
        if (res.ok) setFeedbackSent(value);
      } catch {
        // ignore
      }
    },
    [prepId]
  );

  const copyAll = useCallback(() => {
    if (!sections) return;
    const text = SECTION_NAMES.map(
      (n) => `✅ ${n}\n${sections[n] ?? ""}`
    ).join("\n\n");
    void navigator.clipboard.writeText(text);
  }, [sections]);

  const copySection = useCallback((name: string) => {
    const text = sections?.[name];
    if (text) void navigator.clipboard.writeText(text);
  }, [sections]);

  return (
    <main className="min-h-screen bg-[#FFFFFF]">
      <div className="mx-auto max-w-lg px-4 py-8">
        <h1 className="text-2xl font-bold text-[#37352F] mb-1">1on1準備</h1>
        <p className="text-sm text-[#9B9A97] mb-6">
          メンバーを選んで、AIが今日の1on1の準備文を生成します
        </p>

        {/* メンバー選択 */}
        <section className="mb-6">
          <label className="block text-sm font-medium text-[#37352F] mb-2">
            メンバー
          </label>
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="w-full rounded-lg border border-[#E9E9E7] bg-white px-3 py-2.5 text-[#37352F] text-sm focus:outline-none focus:ring-2 focus:ring-[#1A6CF6]/30 focus:border-[#1A6CF6]"
          >
            <option value="">選択してください</option>
            {members.map((m) => (
              <option
                key={m.id}
                value={m.id}
                disabled={!m.hasDiagnosis || !m.hasShared}
                className={!m.hasDiagnosis || !m.hasShared ? "text-[#9B9A97]" : ""}
              >
                {m.name || m.email || m.id}
                {!m.hasDiagnosis
                  ? "（診断未完了）"
                  : !m.hasShared
                    ? "（未共有）"
                    : ""}
              </option>
            ))}
          </select>
          {membersLoading && (
            <p className="mt-1 text-xs text-[#9B9A97]">読み込み中...</p>
          )}
        </section>

        {/* テキストエリア */}
        <section className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#37352F] mb-1">
              前回の1on1メモ・アクションアイテム（任意）
            </label>
            <textarea
              value={previousNotes}
              onChange={(e) => setPreviousNotes(e.target.value)}
              placeholder="前回の約束やフォロー事項をメモ"
              rows={2}
              className="w-full rounded-lg border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] placeholder:text-[#9B9A97] focus:outline-none focus:ring-2 focus:ring-[#1A6CF6]/30"
            />
            {lastPostMeetingNotes &&
              previousNotes === lastPostMeetingNotes && (
                <p className="mt-1 text-xs text-[#9B9A97]">
                  前回の面談メモを引き継ぎました（編集できます）
                </p>
              )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#37352F] mb-1">
              最近の行動・発言（任意）
            </label>
            <textarea
              value={recentBehaviors}
              onChange={(e) => setRecentBehaviors(e.target.value)}
              placeholder="Slackの発言をそのまま貼ってもOK"
              rows={2}
              className="w-full rounded-lg border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] placeholder:text-[#9B9A97] focus:outline-none focus:ring-2 focus:ring-[#1A6CF6]/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#37352F] mb-1">
              気になること（任意）
            </label>
            <textarea
              value={managerNotes}
              onChange={(e) => setManagerNotes(e.target.value)}
              placeholder="面談で確認したいこと"
              rows={2}
              className="w-full rounded-lg border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] placeholder:text-[#9B9A97] focus:outline-none focus:ring-2 focus:ring-[#1A6CF6]/30"
            />
          </div>
        </section>

        <button
          type="button"
          onClick={handlePrepare}
          disabled={!canPrepare}
          className="w-full rounded-lg bg-[#1A6CF6] px-4 py-3 text-center text-sm font-medium text-white hover:bg-[#1A5BE0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ⚡ 準備する
        </button>

        {/* 出力エリア */}
        <div id="output-area" className="mt-10 scroll-mt-6">
          {loading && (
            <div className="space-y-4">
              {SECTION_NAMES.map((name) => (
                <div
                  key={name}
                  className="rounded-xl border border-[#E9E9E7] p-4 animate-pulse"
                >
                  <div className="h-4 w-32 bg-[#E9E9E7] rounded mb-3" />
                  <div className="h-3 bg-[#E9E9E7] rounded w-full mb-2" />
                  <div className="h-3 bg-[#E9E9E7] rounded w-4/5" />
                </div>
              ))}
            </div>
          )}

          {!loading && sections && (
            <>
              <div className="space-y-4">
                {SECTION_NAMES.map((name) => {
                  const content = sections[name];
                  if (
                    name === "具体的な承認フレーズ" &&
                    (content === "（入力なし）" || !content?.trim())
                  )
                    return null;
                  return (
                    <div
                      key={name}
                      className="rounded-xl border border-[#E9E9E7] p-4"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className="text-sm font-bold text-[#37352F]">
                          ✅ {name}
                        </h3>
                        {name === "なぜあなたに任せたいのか" && content && (
                          <button
                            type="button"
                            onClick={() => copySection(name)}
                            className="shrink-0 rounded p-1.5 text-[#9B9A97] hover:bg-[#E9E9E7] hover:text-[#37352F]"
                            title="コピー"
                          >
                            📋
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-[#37352F] leading-relaxed whitespace-pre-wrap">
                        {content || "—"}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyAll}
                  className="rounded-lg border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] hover:bg-[#F7F7F5]"
                >
                  📋 全体コピー
                </button>
                <button
                  type="button"
                  onClick={handlePrepare}
                  className="rounded-lg border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] hover:bg-[#F7F7F5]"
                >
                  🔄 再生成
                </button>
              </div>

              {prepId && (
                <div className="mt-6 pt-6 border-t border-[#E9E9E7]">
                  <p className="text-sm text-[#37352F] mb-2">
                    この準備は役に立ちましたか？
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleFeedback(1)}
                      disabled={feedbackSent !== null}
                      className={`rounded-lg border px-4 py-2 text-sm ${
                        feedbackSent === 1
                          ? "border-[#1A6CF6] bg-[#1A6CF6]/10 text-[#1A6CF6]"
                          : "border-[#E9E9E7] bg-white text-[#37352F] hover:bg-[#F7F7F5]"
                      } disabled:opacity-70`}
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFeedback(-1)}
                      disabled={feedbackSent !== null}
                      className={`rounded-lg border px-4 py-2 text-sm ${
                        feedbackSent === -1
                          ? "border-[#1A6CF6] bg-[#1A6CF6]/10 text-[#1A6CF6]"
                          : "border-[#E9E9E7] bg-white text-[#37352F] hover:bg-[#F7F7F5]"
                      } disabled:opacity-70`}
                    >
                      👎
                    </button>
                  </div>
                </div>
              )}

              {goalMeetingNotes && (
                <details className="mt-6 group">
                  <summary className="cursor-pointer list-none rounded-lg border border-[#E9E9E7] p-3 text-sm font-medium text-[#37352F] hover:bg-[#F7F7F5]">
                    <span className="inline-block mr-2">▶</span>
                    📋 今期の合意目標
                  </summary>
                  <div className="mt-2 rounded-lg border border-[#E9E9E7] p-4">
                    <p className="text-xs text-[#9B9A97] mb-2">目標設定面談で記録した内容</p>
                    <pre className="text-sm text-[#37352F] whitespace-pre-wrap font-sans leading-relaxed">
                      {goalMeetingNotes}
                    </pre>
                  </div>
                </details>
              )}

              {prepId && (
                <div className="mt-6 pt-6 border-t border-[#E9E9E7]">
                  <h3 className="text-sm font-medium text-[#37352F] mb-1">
                    面談後メモ
                  </h3>
                  <p className="text-xs text-[#9B9A97] mb-2">
                    議事録・Slackログをそのまま貼ってください。次回の面談準備に自動で引き継がれます。
                  </p>
                  <textarea
                    value={postMeetingNotes}
                    onChange={(e) => setPostMeetingNotes(e.target.value)}
                    placeholder="今日の面談で話したこと、決めたこと、次回確認したいことなど"
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
                        次回の面談準備に自動で引き継がれます
                      </p>
                    )}
                  </div>
                </div>
              )}

              {manual && (
                <details className="mt-8 group">
                  <summary className="cursor-pointer list-none rounded-lg border border-[#E9E9E7] p-3 text-sm font-medium text-[#37352F] hover:bg-[#F7F7F5]">
                    <span className="inline-block mr-2">▶</span>
                    取扱説明書
                  </summary>
                  <div className="mt-2 rounded-lg border border-[#E9E9E7] p-4">
                    <pre className="text-sm text-[#37352F] whitespace-pre-wrap font-sans">
                      {manual}
                    </pre>
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
