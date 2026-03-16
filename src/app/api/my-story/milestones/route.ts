import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 取得（時系列順）
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await supabase
      .from("story_milestones")
      .select("id, event_year, event_month, event, feeling, motivation")
      .eq("user_id", user.id)
      .order("event_year", { ascending: true })
      .order("event_month", { ascending: true, nullsFirst: true });

    return NextResponse.json({ milestones: data ?? [] });
  } catch (error) {
    console.error("milestones GET error", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

// 追加
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      event_year: number;
      event_month: number | null;
      event: string;
      feeling: string;
      motivation: number;
    };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("story_milestones")
      .insert({
        user_id: user.id,
        event_year: body.event_year,
        event_month: body.event_month ?? null,
        event: body.event.trim(),
        feeling: body.feeling?.trim() || null,
        motivation: body.motivation,
      })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error("milestones POST error", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

// 編集
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id: string;
      event_year: number;
      event_month: number | null;
      event: string;
      feeling: string;
      motivation: number;
    };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("story_milestones")
      .update({
        event_year: body.event_year,
        event_month: body.event_month ?? null,
        event: body.event.trim(),
        feeling: body.feeling?.trim() || null,
        motivation: body.motivation,
      })
      .eq("id", body.id)
      .eq("user_id", user.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("milestones PATCH error", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

// 削除
export async function DELETE(request: Request) {
  try {
    const { id } = (await request.json()) as { id: string };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("story_milestones")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("milestones DELETE error", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

