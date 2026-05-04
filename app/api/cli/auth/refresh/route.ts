import { NextRequest, NextResponse } from "next/server";
import { validateAPIKey } from "@/lib/cli/validate-api-key";
import { createAdminClient } from "@/lib/supabase/server";
import crypto from "crypto";

/**
 * POST /api/cli/auth/refresh
 * Issues a new CLI API key if the current one is within 7 days of expiry.
 * Revokes the old key. Requires Bearer API key.
 */
export async function POST(request: NextRequest) {
  try {
    const key = await validateAPIKey(request);

    if (!key) {
      return NextResponse.json(
        { error: "Invalid or expired API key" },
        { status: 401 }
      );
    }

    // Only allow refresh within 7 days of expiry
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    if (key.expiresAt > sevenDaysFromNow) {
      return NextResponse.json(
        {
          error: "Key is not yet eligible for refresh",
          expires_at: key.expiresAt.toISOString(),
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Generate new key
    const plainKey = `sprintiq_cli_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(plainKey).digest("hex");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    // Revoke old key and insert new one
    const { error: revokeError } = await supabase
      .from("cli_api_keys")
      .update({ revoked: true, revoked_at: new Date().toISOString() })
      .eq("id", key.id);

    if (revokeError) {
      console.error("[CLI Auth Refresh] Revoke error:", revokeError);
      return NextResponse.json(
        { error: "Failed to revoke old key" },
        { status: 500 }
      );
    }

    const { error: insertError } = await supabase
      .from("cli_api_keys")
      .insert({
        key_hash: keyHash,
        email: key.email,
        user_id: key.userId,
        expires_at: expiresAt.toISOString(),
        client_info: {
          created_via: "cli_auth_refresh",
          previous_key_id: key.id,
          created_at: new Date().toISOString(),
        },
      });

    if (insertError) {
      console.error("[CLI Auth Refresh] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create new key" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      api_key: plainKey,
      email: key.email,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[CLI Auth Refresh] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
