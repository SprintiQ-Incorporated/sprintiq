import { NextRequest, NextResponse } from "next/server";
import { validateAPIKey } from "@/lib/cli/validate-api-key";
import { mcpUserValidationService } from "@/lib/mcp/user-validation";

/**
 * GET /api/cli/auth/status
 * Returns the authenticated user's email, workspaces, and key expiry.
 * Requires Bearer API key.
 */
export async function GET(request: NextRequest) {
  try {
    const key = await validateAPIKey(request);

    if (!key) {
      return NextResponse.json(
        { error: "Invalid or expired API key" },
        { status: 401 }
      );
    }

    // Get workspace info
    const validation = await mcpUserValidationService.validateUserByEmail(
      key.email
    );

    const workspaces =
      validation.user?.workspaces.map((w) => ({
        id: w.id,
        workspace_id: w.workspace_id,
        name: w.name,
        role: w.role,
      })) ?? [];

    return NextResponse.json({
      email: key.email,
      user_id: key.userId,
      workspaces,
      expires_at: key.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[CLI Auth Status] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
