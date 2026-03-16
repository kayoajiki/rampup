import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import TeamClient from "./TeamClient";

type MemberStatus = "diagnosed" | "none";

type MemberRow = {
  id: string;
  name: string | null;
  email: string;
  status: MemberStatus;
  hasStory: boolean;
};

export default async function TeamPage() {
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

  const { data: relationships } = await supabase
    .from("manager_member_relationships")
    .select("member_id")
    .eq("manager_id", user.id);

  const memberIds = (relationships ?? []).map((r) => r.member_id);

  if (memberIds.length === 0) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#9B9A97] text-sm">担当メンバーがいません</p>
          <p className="text-[#9B9A97] text-xs mt-1">管理者に連絡してください</p>
        </div>
      </div>
    );
  }

  const { data: members } = await supabase
    .from("users")
    .select("id, name, email")
    .in("id", memberIds);

  const { data: diagnoses } = await supabase
    .from("diagnoses")
    .select("user_id")
    .in("user_id", memberIds)
    .order("created_at", { ascending: false });

  const diagnosisSet = new Set((diagnoses ?? []).map((d) => d.user_id));

  const { data: storyData } = await supabase
    .from("my_stories")
    .select(
      "user_id, will_now, will_career, can_strengths, can_development, must_mission"
    )
    .in("user_id", memberIds);

  const { data: milestoneData } = await supabase
    .from("story_milestones")
    .select("user_id")
    .in("user_id", memberIds);

  const storySet = new Set<string>();
  for (const s of storyData ?? []) {
    if (
      s.will_now ||
      s.will_career ||
      s.can_strengths ||
      s.can_development ||
      s.must_mission
    ) {
      storySet.add(s.user_id);
    }
  }
  for (const m of milestoneData ?? []) {
    storySet.add(m.user_id);
  }

  const memberRows: MemberRow[] = (members ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email ?? "",
    status: diagnosisSet.has(m.id) ? "diagnosed" : "none",
    hasStory: storySet.has(m.id),
  }));

  const statusOrder: Record<MemberStatus, number> = { diagnosed: 0, none: 1 };
  memberRows.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  const diagnosedCount = memberRows.filter(
    (m) => m.status === "diagnosed"
  ).length;

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-[#37352F]">
              チーム（{memberRows.length}名）
            </h1>
            <p className="text-sm text-[#9B9A97] mt-0.5">
              診断済み: {diagnosedCount}/{memberRows.length}名
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E9E9E7] p-4 mb-4">
          <p className="text-xs text-[#9B9A97] mb-3">タップして詳細を確認</p>
          <div className="flex flex-wrap gap-3">
            {memberRows.map((m) => (
              <AvatarChip key={m.id} member={m} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E9E9E7] overflow-hidden">
          {memberRows.map((m, i) => (
            <div
              key={m.id}
              className={`flex items-center justify-between px-4 py-3.5 ${
                i < memberRows.length - 1 ? "border-b border-[#E9E9E7]" : ""
              }`}
            >
              <Link
                href={`/members/${m.id}`}
                className="flex items-center gap-3 hover:opacity-70 transition-opacity"
              >
                <StatusDot status={m.status} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-[#37352F]">
                      {m.name ?? m.email}
                    </p>
                    {m.hasStory && (
                      <span
                        className="text-xs text-[#9B9A97]"
                        title="ストーリー入力済み"
                      >
                        📖
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#9B9A97] mt-0.5">
                    {m.status === "diagnosed" ? "診断済み" : "未診断"}
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-2">
                {m.status === "diagnosed" && (
                  <Link
                    href={`/meeting/new?memberId=${m.id}`}
                    className="text-xs bg-[#1A6CF6] text-white px-3 py-1.5 rounded-md hover:bg-[#1A5BE0] transition-colors"
                  >
                    面談準備 →
                  </Link>
                )}
                {m.status === "none" && (
                  <TeamClient
                    memberName={m.name ?? m.email}
                    memberEmail={m.email}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: MemberStatus }) {
  const colors: Record<MemberStatus, string> = {
    diagnosed: "bg-green-500",
    none: "bg-gray-300",
  };
  return (
    <span
      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors[status]}`}
    />
  );
}

function AvatarChip({ member }: { member: MemberRow }) {
  const initial = (member.name ?? member.email)[0].toUpperCase();
  const bgColors: Record<MemberStatus, string> = {
    diagnosed: "bg-green-100 border-green-300 hover:bg-green-200",
    none: "bg-gray-100 border-gray-200 cursor-default",
  };

  if (member.status === "none") {
    return (
      <div className="flex flex-col items-center gap-1 opacity-50">
        <div
          className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-base font-medium text-[#37352F] ${bgColors[member.status]}`}
        >
          {initial}
        </div>
        <span className="text-[10px] text-[#9B9A97] max-w-[48px] text-center truncate">
          {member.name ?? member.email}
        </span>
      </div>
    );
  }

  return (
    <Link href={`/members/${member.id}`}>
      <div className="flex flex-col items-center gap-1">
        <div
          className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-base font-medium text-[#37352F] ${bgColors[member.status]}`}
        >
          {initial}
        </div>
        <span className="text-[10px] text-[#9B9A97] max-w-[48px] text-center truncate">
          {member.name ?? member.email}
        </span>
      </div>
    </Link>
  );
}

