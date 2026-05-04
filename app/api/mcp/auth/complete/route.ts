import { NextRequest, NextResponse } from "next/server";
import { enhancedMCPService } from "@/lib/mcp/enhanced-service";

/**
 * MCP Token Completion Endpoint
 *
 * Called by the client-side auth flow (email/password sign-in) to mark
 * an MCP auth token as completed before redirecting to the CLI callback.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, email } = body;

    if (!token || !email) {
      return NextResponse.json(
        { error: "token and email are required" },
        { status: 400 }
      );
    }

    const result = await enhancedMCPService.completeAuthentication(
      token,
      email
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to complete authentication" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, email: result.email });
  } catch (error) {
    console.error("[mcp/auth/complete] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
