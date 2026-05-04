import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database-aliases";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Mark sessions stuck in "in_progress" for over 30 minutes as "failed"
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("story_generation_sessions")
    .update({
      status: "failed",
      error_message: "Session timed out (orphaned)",
      completed_at: new Date().toISOString(),
    })
    .eq("status", "in_progress")
    .lt("started_at", thirtyMinutesAgo)
    .select("id");

  if (error) {
    console.error("[cleanup-sessions] Story generation cleanup failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Expire stale claude_code_sessions
  const { data: expiredClaude, error: claudeError } = await supabase
    .from("claude_code_sessions")
    .update({
      status: "failed",
      error_message: "Session expired (no heartbeat for 24 hours)",
      completed_at: new Date().toISOString(),
    })
    .in("status", ["pending", "active"])
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (claudeError) {
    console.error("[cleanup-sessions] Claude code cleanup failed:", claudeError);
  }

  // Active sessions with no heartbeat for 30 minutes — mark as failed
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  // Sessions active for >4 hours with stale heartbeat → abandoned (recoverable)
  const { data: abandonedSessions, error: abandonedError } = await supabase
    .from("claude_code_sessions")
    .update({
      status: "abandoned",
      error_message: "Session abandoned (active for over 4 hours with no recent heartbeat)",
      completed_at: new Date().toISOString(),
    })
    .eq("status", "active")
    .lt("started_at", fourHoursAgo)
    .lt("last_heartbeat_at", thirtyMinAgo)
    .select("id");

  if (abandonedError) {
    console.error("[cleanup-sessions] Abandoned session detection failed:", abandonedError);
  }

  // Shorter sessions with no heartbeat for 30 minutes → failed
  const { data: staleActive, error: staleError } = await supabase
    .from("claude_code_sessions")
    .update({
      status: "failed",
      error_message: "Session timed out (no heartbeat for 30 minutes)",
      completed_at: new Date().toISOString(),
    })
    .eq("status", "active")
    .gte("started_at", fourHoursAgo)
    .lt("last_heartbeat_at", thirtyMinAgo)
    .select("id");

  if (staleError) {
    console.error("[cleanup-sessions] Stale heartbeat cleanup failed:", staleError);
  }

  return NextResponse.json({
    cleaned: data?.length || 0,
    claudeCodeCleaned: expiredClaude?.length || 0,
    staleHeartbeatCleaned: staleActive?.length || 0,
    abandonedSessions: abandonedSessions?.length || 0,
    timestamp: new Date().toISOString(),
  });
}
