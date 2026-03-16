import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");
    if (!memberId) {
      return NextResponse.json(
        { error: "memberId is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const { data: lastGoalPrep } = await supabase
      .from("meeting_preps")
      .select("post_meeting_notes")
      .eq("manager_id", user.id)
      .eq("member_id", memberId)
      .eq("meeting_type", "goal")
      .not("post_meeting_notes", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      manual: diagnosis?.manual ?? null,
      wcm: wcm ?? null,
      milestones: milestones ?? [],
      goalMeetingNotes: lastGoalPrep?.post_meeting_notes ?? null,
    });
  } catch (error) {
    console.error("feedback-meeting/member-detail error", error);
    return NextResponse.json(
      { error: "failed" },
      { status: 500 }
    );
  }
}

