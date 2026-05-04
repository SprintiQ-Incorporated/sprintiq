import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const filter = searchParams.get("filter");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    let query = supabase
      .from("insights")
      .select("*", { count: "exact" })
      .eq("published", true); // Only show published insights

    // Apply search filter
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,author.ilike.%${search}%`
      );
    }

    // Apply category filter
    if (filter && filter !== "all") {
      query = query.eq("category", filter);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Order by featured first, then by post_date desc
    query = query
      .order("featured", { ascending: false })
      .order("post_date", { ascending: false });

    const { data: insights, error, count } = await query;

    if (error) {
      console.error("Error fetching insights:", error);
      return NextResponse.json(
        { error: "Failed to fetch insights" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      insights: insights || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Error in insights GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
