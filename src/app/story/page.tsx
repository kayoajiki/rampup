import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StoryForm from "./StoryForm";

export default async function StoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: wcm } = await supabase
    .from("my_stories")
    .select(
      "will_now, will_career, can_strengths, can_development, must_mission"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: milestones } = await supabase
    .from("story_milestones")
    .select("id, event_year, event_month, event, feeling, motivation")
    .eq("user_id", user.id)
    .order("event_year", { ascending: true })
    .order("event_month", { ascending: true, nullsFirst: true });

  const { data: diagnosis } = await supabase
    .from("diagnoses")
    .select("manual")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-[#37352F]">
            私のストーリー
          </h1>
          <p className="text-sm text-[#9B9A97] mt-1">
            過去の経験を振り返り、これからのWillとMustを整理しましょう
          </p>
        </div>

        <StoryForm
          initialWcm={{
            will_now: wcm?.will_now ?? "",
            will_career: wcm?.will_career ?? "",
            can_strengths: wcm?.can_strengths ?? "",
            can_development: wcm?.can_development ?? "",
            must_mission: wcm?.must_mission ?? "",
          }}
          initialMilestones={milestones ?? []}
          diagnosisManual={diagnosis?.manual ?? null}
        />
      </div>
    </div>
  );
}

