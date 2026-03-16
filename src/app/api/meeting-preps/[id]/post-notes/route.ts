import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { postMeetingNotes: string };
    const { postMeetingNotes } = body;

    if (!postMeetingNotes?.trim()) {
      return NextResponse.json(
        { error: "postMeetingNotes is required" },
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

    const { error } = await supabase
      .from("meeting_preps")
      .update({ post_meeting_notes: postMeetingNotes.trim() })
      .eq("id", id)
      .eq("manager_id", user.id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("post-notes PATCH error", error);
    return NextResponse.json(
      { error: "failed to save" },
      { status: 500 }
    );
  }
}
