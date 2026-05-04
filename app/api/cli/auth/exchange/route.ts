import { NextRequest, NextResponse } from "next/server";
import { enhancedMCPService } from "@/lib/mcp/enhanced-service";
import { createAdminClient } from "@/lib/supabase/server";
import crypto from "crypto";

/**
 * POST /api/cli/auth/exchange
 * Exchanges a completed MCP auth token + email for a long-lived CLI API key.
 *
 * Body: { token: string, email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, email } = body;

    if (!token || !email) {
      return NextResponse.json(
        { error: "token and email are required" },
        { status: 400 }
      );
    }

    // Verify the MCP token is completed and matches the email
    const authStatus =
      await enhancedMCPService.checkAuthenticationStatus(token);

    if (authStatus.status !== "completed") {
      return NextResponse.json(
        {
          error: "Token is not completed",
          status: authStatus.status,
        },
        { status: 401 }
      );
    }

    if (authStatus.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: "Email does not match token" },
        { status: 401 }
      );
    }

    // Look up the user
    const supabase = createAdminClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    // Generate a new CLI API key (plaintext returned once, hash stored)
    const plainKey = `sprintiq_cli_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(plainKey).digest("hex");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    const { error: insertError } = await supabase
      .from("cli_api_keys")
      .insert({
        key_hash: keyHash,
        email: email.toLowerCase().trim(),
        user_id: profile?.id ?? null,
        expires_at: expiresAt.toISOString(),
        client_info: {
          created_via: "cli_auth_exchange",
          created_at: new Date().toISOString(),
        },
      });

    if (insertError) {
      console.error("[CLI Auth Exchange] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create API key" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      api_key: plainKey,
      email: email.toLowerCase().trim(),
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[CLI Auth Exchange] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
