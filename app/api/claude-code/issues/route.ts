import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("task_id");

    if (!taskId) {
      return NextResponse.json(
        { error: "task_id is required" },
        { status: 400 }
      );
    }

    const { data: issues, error } = await supabase
      .from("claude_code_issues")
      .select("*")
      .eq("task_id", taskId)
      .eq("status", "detected")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching issues:", error);
      return NextResponse.json(
        { error: "Failed to fetch issues" },
        { status: 500 }
      );
    }

    return NextResponse.json({ issues: issues ?? [] });
  } catch (error) {
    console.error("Issues API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
