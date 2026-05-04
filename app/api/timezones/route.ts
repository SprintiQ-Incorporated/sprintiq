import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("timezones")
    .select("id, country, city, label, abbreviation, utc_offset")
    .order("country", { ascending: true })
    .order("city", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
