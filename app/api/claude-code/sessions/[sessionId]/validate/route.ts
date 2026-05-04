import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    let body: { token: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { token } = body;
    if (!token) {
      return NextResponse.json(
        { error: "token is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: session, error } = await supabase
      .from("claude_code_sessions")
      .select("id, session_token, expires_at, task_id, workspace_id")
      .eq("id", sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    // Check token match
    if (session.session_token !== token) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    return NextResponse.json({
      valid: true,
      task_id: session.task_id,
      workspace_id: session.workspace_id,
    });
  } catch (error) {
    console.error("[claude-code/sessions/validate] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
