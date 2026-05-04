import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { enhancedMCPService } from "@/lib/mcp/enhanced-service";

/**
 * MCP Authentication Callback Handler
 *
 * This endpoint handles the callback after users authenticate with SprintIQ
 * and want to use MCP features.
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const mcpToken = searchParams.get("mcp_token");
    const userEmail = searchParams.get("email");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Handle auth errors from the regular auth callback
    if (error) {
      console.error(
        `[MCP Callback] Auth error received:`,
        error,
        errorDescription
      );

      if (mcpToken) {
        // Mark authentication as failed for this token
        try {
          await enhancedMCPService.updatePendingAuth(mcpToken, {
            status: "failed",
          });
        } catch (updateError) {
          console.error(
            `[MCP Callback] Failed to update auth status:`,
            updateError
          );
        }
      }

      return NextResponse.redirect(
        new URL(
          `/auth/error?message=${encodeURIComponent(
            errorDescription || error
          )}`,
          request.url
        )
      );
    }

    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Get the current session instead of exchanging the code again
    // The code was already exchanged in the regular auth callback
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error("MCP auth callback session error:", sessionError);

      // If we have an MCP token, mark it as failed
      if (mcpToken) {try {
          // Mark authentication as failed for this token
          const authStatus = await enhancedMCPService.checkAuthenticationStatus(
            mcpToken
          );if (authStatus.status === "pending") {
            await enhancedMCPService.updatePendingAuth(mcpToken, {
              status: "failed",
            });
          }
        } catch (updateError) {
          console.error(
            `[MCP Callback] Failed to update auth status:`,
            updateError
          );
        }
      }

      return NextResponse.redirect(
        new URL("/auth/error?message=Authentication%20failed", request.url)
      );
    }

    // Get user email from session
    const email = session.user.email;

    if (!email) {
      console.error("[MCP Callback] No email found in session");
      return NextResponse.redirect(
        new URL("/auth/error?message=Email%20not%20found", request.url)
      );
    }


    // Check if user profile exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    const hasProfile = !!profile;

    // If we have an MCP token, complete the authentication
    if (mcpToken) {try {
        const completion = await enhancedMCPService.completeAuthentication(
          mcpToken,
          email
        );


        if (completion.success) {
          // Success! Redirect to a special page that shows instructions for Cursor
          const successUrl = new URL("/mcp/auth/success", request.url);
          successUrl.searchParams.set("token", mcpToken);
          successUrl.searchParams.set("email", email);
          successUrl.searchParams.set("type", "cursor");

          // Add profile status for user feedback
          if (!hasProfile) {
            successUrl.searchParams.set("warning", "profile_not_found");
          }return NextResponse.redirect(successUrl);
        } else {
          console.error(
            `[MCP Callback] Authentication completion failed:`,
            completion.error
          );
          return NextResponse.redirect(
            new URL(
              `/auth/error?message=${encodeURIComponent(
                completion.error || "Authentication completion failed"
              )}`,
              request.url
            )
          );
        }
      } catch (completionError) {
        console.error(
          `[MCP Callback] Error during completion:`,
          completionError
        );
        return NextResponse.redirect(
          new URL(
            "/auth/error?message=Authentication%20completion%20error",
            request.url
          )
        );
      }
    }

    // Legacy flow - try to establish MCP connection directly
    try {
      const connectionResult = await enhancedMCPService.establishConnection(
        email
      );

      if (!connectionResult.success) {
        console.error("MCP connection failed:", connectionResult.error);
        return NextResponse.redirect(
          new URL(
            `/auth/error?message=${encodeURIComponent(
              connectionResult.error || "MCP connection failed"
            )}`,
            request.url
          )
        );
      }

      // Success! Redirect to MCP success page
      const successUrl = new URL("/mcp/auth/success", request.url);
      successUrl.searchParams.set(
        "connectionId",
        connectionResult.connectionId || ""
      );
      successUrl.searchParams.set("email", email);
      successUrl.searchParams.set("type", "legacy");

      return NextResponse.redirect(successUrl);
    } catch (connectionError) {
      console.error("MCP connection error:", connectionError);
      return NextResponse.redirect(
        new URL("/auth/error?message=MCP%20connection%20error", request.url)
      );
    }
  } catch (error) {
    console.error("MCP auth callback error:", error);
    return NextResponse.redirect(
      new URL("/auth/error?message=Internal%20server%20error", request.url)
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail, action, token } = body;

    switch (action) {
      case "checkAuthStatus":
        if (!token) {
          return NextResponse.json(
            { error: "Token is required for checkAuthStatus" },
            { status: 400 }
          );
        }

        const authStatus = await enhancedMCPService.checkAuthenticationStatus(
          token
        );
        return NextResponse.json({
          success: true,
          authStatus,
        });

      case "checkAuth":
        if (!userEmail) {
          return NextResponse.json(
            { error: "User email is required for checkAuth" },
            { status: 400 }
          );
        }

        const authInfo = await enhancedMCPService.getAuthorizationInfo(
          userEmail
        );
        return NextResponse.json({
          success: true,
          authInfo,
        });

      case "establishConnection":
        if (!userEmail) {
          return NextResponse.json(
            { error: "User email is required for establishConnection" },
            { status: 400 }
          );
        }

        const connectionResult = await enhancedMCPService.establishConnection(
          userEmail
        );
        return NextResponse.json({
          success: connectionResult.success,
          connectionId: connectionResult.connectionId,
          user: connectionResult.user,
          error: connectionResult.error,
          requiresAuthorization: connectionResult.requiresAuthorization,
          authorizationUrl: connectionResult.authorizationUrl,
        });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("MCP auth callback POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
