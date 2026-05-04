import { NextRequest, NextResponse } from "next/server";
import { enhancedMCPService } from "@/lib/mcp/enhanced-service";

/**
 * POST /api/cli/auth/initiate
 * Creates a pending MCP auth token and returns the browser URL
 * the CLI should open for the user to sign in.
 *
 * Body: { redirect_port: number }
 */
export async function POST(request: NextRequest) {
  try {
    // Required: silent fallback would route OAuth callbacks to the wrong host.
    const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL;
    if (!APP_BASE_URL) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_APP_URL is not configured on the server" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const redirectPort = body.redirect_port;

    if (!redirectPort || typeof redirectPort !== "number") {
      return NextResponse.json(
        { error: "redirect_port (number) is required" },
        { status: 400 }
      );
    }

    // Reuse EnhancedMCPService to generate & store a pending token
    const connectionStatus = await enhancedMCPService.checkActiveConnection();

    if (!connectionStatus.authToken) {
      return NextResponse.json(
        { error: "Failed to generate auth token" },
        { status: 500 }
      );
    }

    // Build a browser URL that, after OAuth, will redirect back to the CLI's
    // localhost callback server.
    const cliCallbackUrl = `http://localhost:${redirectPort}/callback`;
    const browserUrl = `${APP_BASE_URL}/signin?mcp_token=${connectionStatus.authToken}&redirect=${encodeURIComponent(
      cliCallbackUrl
    )}`;

    return NextResponse.json({
      token: connectionStatus.authToken,
      browser_url: browserUrl,
    });
  } catch (error) {
    console.error("[CLI Auth Initiate] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
