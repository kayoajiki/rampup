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

    // 前回の1on1メモ
    const { data: lastPrep } = await supabase
      .from("meeting_preps")
      .select("post_meeting_notes")
      .eq("manager_id", user.id)
      .eq("member_id", memberId)
      .eq("meeting_type", "1on1")
      .not("post_meeting_notes", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 今期の合意目標（目標設定面談の最新メモ）
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

    if (!diagnosis?.manual) {
      return NextResponse.json({
        manual: null,
        hasShared: false,
        lastPostMeetingNotes: null,
        goalMeetingNotes: null,
      });
    }

    return NextResponse.json({
      manual: diagnosis.manual,
      hasShared: true,
      lastPostMeetingNotes: lastPrep?.post_meeting_notes ?? null,
      goalMeetingNotes: lastGoalPrep?.post_meeting_notes ?? null,
    });
  } catch (error) {
    console.error("meeting/member-detail error", error);
    return NextResponse.json(
      { error: "failed to fetch member detail" },
      { status: 500 }
    );
  }
}
