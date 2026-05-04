import { NextRequest, NextResponse } from "next/server";
import { validateAPIKey } from "@/lib/cli/validate-api-key";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/cli/auth/revoke
 * Marks the current CLI API key as revoked.
 * Requires Bearer API key.
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

    const supabase = createAdminClient();

    const { error } = await supabase
      .from("cli_api_keys")
      .update({
        revoked: true,
        revoked_at: new Date().toISOString(),
      })
      .eq("id", key.id);

    if (error) {
      console.error("[CLI Auth Revoke] Error:", error);
      return NextResponse.json(
        { error: "Failed to revoke key" },
        { status: 500 }
      );
    }

    return NextResponse.json({ revoked: true });
  } catch (error) {
    console.error("[CLI Auth Revoke] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
