import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import MemberNoteForm from "./MemberNoteForm";

type Note = {
  id: string;
  content: string;
  created_at: string;
};

type MeetingPrep = {
  id: string;
  meeting_type: string;
  created_at: string;
  post_meeting_notes: string | null;
};

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: memberId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "manager") redirect("/me");

  const { data: rel } = await supabase
    .from("manager_member_relationships")
    .select("member_id")
    .eq("manager_id", user.id)
    .eq("member_id", memberId)
    .single();
  if (!rel) notFound();

  const { data: member } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("id", memberId)
    .single();
  if (!member) notFound();

  const { data: diagnosis } = await supabase
    .from("diagnoses")
    .select("manual")
    .eq("user_id", memberId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: wcm } = await supabase
    .from("my_stories")
    .select(
      "will_now, will_career, can_strengths, can_development, must_mission"
    )
    .eq("user_id", memberId)
    .maybeSingle();

  const { data: milestones } = await supabase
    .from("story_milestones")
    .select("event_year, event_month, event, motivation")
    .eq("user_id", memberId)
    .order("event_year", { ascending: true })
    .order("event_month", { ascending: true, nullsFirst: true });

  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: notes } = await supabase
    .from("member_notes")
    .select("id, content, created_at")
    .eq("manager_id", user.id)
    .eq("member_id", memberId)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false });

  const { data: meetingPreps } = await supabase
    .from("meeting_preps")
    .select("id, meeting_type, created_at, post_meeting_notes")
    .eq("manager_id", user.id)
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(5);

  const memberName = member.name ?? member.email;
  const hasManual = !!diagnosis?.manual;
  const hasWcm = wcm && Object.values(wcm).some((v) => v);
  const hasMilestones = (milestones ?? []).length > 0;
  const hasStory = hasWcm || hasMilestones;

  const MEETING_TYPE_LABELS: Record<string, string> = {
    "1on1": "1on1",
    goal: "目標設定",
    feedback: "査定FB",
  };

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Link
          href="/team"
          className="text-sm text-[#9B9A97] hover:text-[#37352F] transition-colors"
        >
          ← チームに戻る
        </Link>

        <div className="bg-white rounded-xl border border-[#E9E9E7] p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-[#37352F]">
                {memberName}
              </h1>
              <p className="text-xs text-[#9B9A97] mt-0.5">{member.email}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className={`text-xs px-2 py-1 rounded-full border ${
                  hasManual
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-gray-50 text-gray-500 border-gray-200"
                }`}
              >
                {hasManual ? "🟢 診断済み" : "⚫ 未診断"}
              </span>
              {hasStory && (
                <span className="text-xs text-[#9B9A97]">
                  📖 ストーリー入力済み
                </span>
              )}
            </div>
          </div>
        </div>

        {hasManual && (
          <div className="bg-white rounded-xl border border-[#E9E9E7] px-4 py-3">
            <p className="text-xs text-[#9B9A97] mb-2.5">面談準備</p>
            <div className="grid grid-cols-3 gap-2">
              <Link
                href={`/meeting/new?memberId=${memberId}`}
                className="text-center text-xs font-medium text-[#1A6CF6] bg-blue-50 border border-blue-200 rounded-lg py-2.5 hover:bg-blue-100 transition-colors"
              >
                1on1準備
              </Link>
              <Link
                href={`/meeting/goal?memberId=${memberId}`}
                className="text-center text-xs font-medium text-[#37352F] bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg py-2.5 hover:bg-gray-100 transition-colors"
              >
                目標設定
              </Link>
              <Link
                href={`/meeting/feedback?memberId=${memberId}`}
                className="text-center text-xs font-medium text-[#37352F] bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg py-2.5 hover:bg-gray-100 transition-colors"
              >
                査定FB
              </Link>
            </div>
          </div>
        )}

        {hasStory && (
          <details className="bg-white rounded-xl border border-[#E9E9E7] overflow-hidden group">
            <summary className="px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-[#F7F6F3] transition-colors list-none">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#37352F]">
                  ストーリー
                </span>
                <div className="flex gap-1">
                  {hasWcm && (
                    <span className="text-xs text-[#9B9A97] bg-[#F7F6F3] px-1.5 py-0.5 rounded">
                      WCM
                    </span>
                  )}
                  {hasMilestones && (
                    <span className="text-xs text-[#9B9A97] bg-[#F7F6F3] px-1.5 py-0.5 rounded">
                      人生史
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-[#9B9A97]">▼</span>
            </summary>

            <div className="border-t border-[#E9E9E7] px-4 py-4 space-y-4">
              {hasMilestones && (
                <div>
                  <p className="text-xs font-medium text-[#9B9A97] mb-2">
                    人生史・転換点
                  </p>
                  <div className="space-y-1">
                    {(milestones ?? []).map((m, i) => (
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

              {hasWcm && (
                <div>
                  <p className="text-xs font-medium text-[#9B9A97] mb-2">
                    Will-Can-Must
                  </p>
                  {[
                    {
                      label: "① 今の仕事で実現したいこと",
                      value: wcm?.will_now,
                    },
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
                        <p className="text-sm text-[#37352F] leading-relaxed whitespace-pre-wrap">
                          {f.value}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </details>
        )}

        {hasManual && (
          <details className="bg-white rounded-xl border border-[#E9E9E7] overflow-hidden">
            <summary className="px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-[#F7F6F3] transition-colors list-none">
              <span className="text-sm font-medium text-[#37352F]">
                取扱説明書
              </span>
              <span className="text-xs text-[#9B9A97]">▼</span>
            </summary>
            <div className="border-t border-[#E9E9E7] px-4 py-4 max-h-72 overflow-y-auto">
              {diagnosis!.manual!
                .split(/\n{2,}/)
                .filter(Boolean)
                .map((para, i) => (
                  <p
                    key={i}
                    className="text-sm text-[#37352F] whitespace-pre-wrap leading-relaxed mb-3 last:mb-0"
                  >
                    {para}
                  </p>
                ))}
            </div>
          </details>
        )}

        {!hasManual && (
          <div className="bg-white rounded-xl border border-[#E9E9E7] px-4 py-6 text-center">
            <p className="text-sm text-[#9B9A97]">まだ診断が完了していません</p>
            <p className="text-xs text-[#9B9A97] mt-1">
              メンバーに診断を促してください
            </p>
          </div>
        )}

        {(meetingPreps ?? []).length > 0 && (
          <details className="bg-white rounded-xl border border-[#E9E9E7] overflow-hidden">
            <summary className="px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-[#F7F6F3] transition-colors list-none">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#37352F]">
                  面談履歴
                </span>
                <span className="text-xs text-[#9B9A97] bg-[#F7F6F3] px-1.5 py-0.5 rounded">
                  {(meetingPreps ?? []).length}件
                </span>
              </div>
              <span className="text-xs text-[#9B9A97]">▼</span>
            </summary>
            <div className="border-t border-[#E9E9E7]">
              {(meetingPreps ?? []).map((prep: MeetingPrep, i: number) => (
                <div
                  key={prep.id}
                  className={`px-4 py-3 ${
                    i < (meetingPreps ?? []).length - 1
                      ? "border-b border-[#E9E9E7]"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-[#37352F]">
                      {MEETING_TYPE_LABELS[prep.meeting_type] ??
                        prep.meeting_type}
                    </span>
                    <span className="text-xs text-[#9B9A97]">
                      {new Date(prep.created_at).toLocaleDateString("ja-JP", {
                        month: "numeric",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  {prep.post_meeting_notes && (
                    <p className="text-xs text-[#9B9A97] line-clamp-2 leading-relaxed">
                      {prep.post_meeting_notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="bg-white rounded-xl border border-[#E9E9E7] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E9E9E7]">
            <h2 className="text-sm font-medium text-[#37352F]">
              マネージャーメモ
            </h2>
            <p className="text-xs text-[#9B9A97] mt-0.5">
              直近30日分が1on1準備AIに自動連携されます
            </p>
          </div>
          <div className="px-4 py-3 border-b border-[#E9E9E7]">
            <MemberNoteForm memberId={memberId} />
          </div>
          <div>
            {(notes ?? []).length === 0 ? (
              <p className="px-4 py-4 text-sm text-[#9B9A97] text-center">
                まだメモがありません
              </p>
            ) : (
              (notes ?? []).map((note: Note) => (
                <div
                  key={note.id}
                  className="px-4 py-3 border-b border-[#E9E9E7] last:border-b-0"
                >
                  <p className="text-xs text-[#9B9A97] mb-1">
                    {new Date(note.created_at).toLocaleDateString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-sm text-[#37352F] whitespace-pre-wrap">
                    {note.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

