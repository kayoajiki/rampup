import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import MemberNoteForm from "./MemberNoteForm";

type Note = {
  id: string;
  content: string;
  created_at: string;
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
    .select("manual, shared_with_manager")
    .eq("user_id", memberId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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

  const memberName = member.name ?? member.email;
  const hasManual =
    !!diagnosis?.manual && !!diagnosis?.shared_with_manager;
  const hasDiagnosis = !!diagnosis;

  return (
    <div className="min-h-screen bg-[#F7F6F3] pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/team"
            className="text-sm text-[#9B9A97] hover:text-[#37352F] transition-colors"
          >
            ← チームに戻る
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-[#E9E9E7] p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-[#37352F]">
                {memberName}
              </h1>
              <p className="text-xs text-[#9B9A97] mt-0.5">{member.email}</p>
            </div>
            <StatusBadge
              hasManual={hasManual}
              shared={diagnosis?.shared_with_manager ?? false}
              hasDiagnosis={hasDiagnosis}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E9E9E7] overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-[#E9E9E7]">
            <h2 className="text-sm font-medium text-[#37352F]">
              取扱説明書
            </h2>
          </div>

          {hasManual ? (
            <ManualSection manual={diagnosis!.manual} />
          ) : (
            <div className="px-4 py-6 text-center">
              {diagnosis && !diagnosis.shared_with_manager ? (
                <>
                  <p className="text-sm text-[#9B9A97]">
                    診断済みですが、まだ共有されていません
                  </p>
                  <p className="text-xs text-[#9B9A97] mt-1">
                    メンバーが共有をONにするまでお待ちください
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-[#9B9A97]">
                    まだ診断が完了していません
                  </p>
                  <p className="text-xs text-[#9B9A97] mt-1">
                    メンバーに診断を促してください
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#E9E9E7] overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-[#E9E9E7]">
            <h2 className="text-sm font-medium text-[#37352F]">
              マネージャーメモ
            </h2>
            <p className="text-xs text-[#9B9A97] mt-0.5">
              直近30日分が面談準備AIに自動連携されます
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

      {hasManual && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E9E9E7] px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <Link
              href={`/meeting/new?memberId=${memberId}`}
              className="block w-full bg-[#1A6CF6] text-white text-center text-sm font-medium py-3 rounded-lg hover:bg-[#1A5BE0] transition-colors"
            >
              ⚡ 面談準備する
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  hasManual,
  shared,
  hasDiagnosis,
}: {
  hasManual: boolean;
  shared: boolean;
  hasDiagnosis: boolean;
}) {
  if (hasManual) {
    return (
      <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-full">
        🟢 共有済み
      </span>
    );
  }
  if (hasDiagnosis && !shared) {
    return (
      <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-1 rounded-full">
        🟡 未共有
      </span>
    );
  }
  return (
    <span className="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2 py-1 rounded-full">
      ⚫ 未診断
    </span>
  );
}

function ManualSection({ manual }: { manual: string }) {
  const paragraphs = manual.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="px-4 py-4 space-y-3 max-h-64 overflow-y-auto">
      {paragraphs.map((para, i) => (
        <p
          key={i}
          className="text-sm text-[#37352F] whitespace-pre-wrap leading-relaxed"
        >
          {para}
        </p>
      ))}
    </div>
  );
}
