import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ exists: false });
    }

    // 直近2件取得して、2番目（前回）を返す
    const { data } = await supabase
      .from("diagnoses")
      .select("scores, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(2);

    if (!data || data.length < 2) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({ exists: true, scores: data[1].scores, created_at: data[1].created_at });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
