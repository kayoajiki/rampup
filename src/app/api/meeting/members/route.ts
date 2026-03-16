import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: rows } = await supabase
      .from("manager_member_relationships")
      .select("member_id")
      .eq("manager_id", user.id);

    if (!rows?.length) {
      return NextResponse.json({ members: [] });
    }

    const memberIds = rows.map((r) => r.member_id);
    const { data: users } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", memberIds);

    const membersWithDiagnosis = await Promise.all(
      (users ?? []).map(async (u) => {
        const { data: diag } = await supabase
          .from("diagnoses")
          .select("manual, shared_with_manager")
          .eq("user_id", u.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return {
          id: u.id,
          name: u.name ?? "",
          email: u.email ?? "",
          hasDiagnosis: !!diag?.manual,
          hasShared: !!diag?.shared_with_manager,
        };
      })
    );

    return NextResponse.json({
      members: membersWithDiagnosis,
    });
  } catch (error) {
    console.error("meeting/members error", error);
    return NextResponse.json(
      { error: "failed to fetch members" },
      { status: 500 }
    );
  }
}
