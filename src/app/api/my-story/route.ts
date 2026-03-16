import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      will_now: string;
      will_career: string;
      can_strengths: string;
      can_development: string;
      must_mission: string;
    };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("my_stories")
      .upsert(
        {
          user_id: user.id,
          will_now: body.will_now.trim() || null,
          will_career: body.will_career.trim() || null,
          can_strengths: body.can_strengths.trim() || null,
          can_development: body.can_development.trim() || null,
          must_mission: body.must_mission.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("my-story POST error", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

