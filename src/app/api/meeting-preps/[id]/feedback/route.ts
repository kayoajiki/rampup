import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { feedback: number };
    if (body.feedback !== 1 && body.feedback !== -1) {
      return NextResponse.json(
        { error: "feedback must be 1 or -1" },
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
      .update({ feedback: body.feedback })
      .eq("id", id)
      .eq("manager_id", user.id);

    if (error) {
      return NextResponse.json(
        { error: "failed to update feedback" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("feedback update error", error);
    return NextResponse.json(
      { error: "failed to update feedback" },
      { status: 500 }
    );
  }
}
