import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ insight_id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();

    // Await params to get the insight_id
    const { insight_id } = await params;

    const { data: insight, error } = await supabase
      .from("insights")
      .select("*")
      .eq("insight_id", insight_id)
      .eq("published", true)
      .single();

    if (error || !insight) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }

    return NextResponse.json({ insight });
  } catch (error) {
    console.error("Error fetching insight:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
