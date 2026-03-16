import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      memberId: string;
      content: string;
    };
    const { memberId, content } = body;

    if (!memberId || !content?.trim()) {
      return NextResponse.json(
        { error: "memberId and content are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("member_notes")
      .insert({
        manager_id: user.id,
        member_id: memberId,
        content: content.trim(),
      })
      .select("id, content, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ note: data });
  } catch (error) {
    console.error("member-notes POST error", error);
    return NextResponse.json(
      { error: "failed to save note" },
      { status: 500 }
    );
  }
}
