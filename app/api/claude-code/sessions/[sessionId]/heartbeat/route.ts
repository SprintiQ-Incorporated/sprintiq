import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database-aliases";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    let body: { token: string; sequence: number; metrics: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { token, sequence, metrics } = body;
    if (!token || sequence == null) {
      return NextResponse.json(
        { error: "token and sequence are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: session, error } = await supabase
      .from("claude_code_sessions")
      .select(
        "id, session_token, expires_at, status, heartbeat_sequence"
      )
      .eq("id", sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json(
        { accepted: false, error: "Session not found" },
        { status: 404 }
      );
    }

    // Validate token
    if (session.session_token !== token) {
      return NextResponse.json(
        { accepted: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json(
        { accepted: false, error: "Session expired" },
        { status: 401 }
      );
    }

    // Terminal status check
    const terminalStatuses = ["completed", "failed", "stopped", "cancelled"];
    if (terminalStatuses.includes(session.status)) {
      return NextResponse.json({
        accepted: false,
        sessionStatus: session.status,
        lastSequence: session.heartbeat_sequence ?? 0,
      });
    }

    // Idempotency: reject if sequence already processed
    const currentSeq = session.heartbeat_sequence ?? 0;
    if (sequence <= currentSeq) {
      return NextResponse.json({
        accepted: false,
        lastSequence: currentSeq,
        sessionStatus: session.status,
      });
    }

    // Update session
    const { error: updateError } = await supabase
      .from("claude_code_sessions")
      .update({
        last_heartbeat_at: new Date().toISOString(),
        heartbeat_sequence: sequence,
        session_metrics: metrics as unknown as Json,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (updateError) {
      console.error("[heartbeat] Update failed:", updateError);
      return NextResponse.json(
        {
          error: "Failed to update session",
          supabase: {
            code: updateError.code,
            message: updateError.message,
            hint: updateError.hint,
            details: updateError.details,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      accepted: true,
      lastSequence: sequence,
      sessionStatus: "active",
    });
  } catch (error) {
    console.error("[claude-code/sessions/heartbeat] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


