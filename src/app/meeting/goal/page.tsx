import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GoalMeetingForm from "./GoalMeetingForm";

export default async function GoalMeetingPage() {
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

  const { data: members } = await supabase
    .from("users")
    .select("id, name, email")
    .in("id", memberIds.length > 0 ? memberIds : [""]);

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-[#37352F]">
            目標設定面談準備
          </h1>
          <p className="text-sm text-[#9B9A97] mt-1">
            メンバーのWillを引き出し、組織のMustと接続する対話ガイドを生成します
          </p>
        </div>
        <GoalMeetingForm members={members ?? []} managerId={user.id} />
      </div>
    </div>
  );
}

