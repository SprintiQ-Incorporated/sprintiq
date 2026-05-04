import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/lib/database-aliases";
import { nanoid } from "nanoid";
import { enhancedMCPService } from "@/lib/mcp/enhanced-service";
import { sanitizeDisplayName } from "@/lib/security/sanitize-input";
import { COOKIE_DOMAIN } from "@/lib/cookie-domain";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const mcpToken = requestUrl.searchParams.get("mcp_token");
  const redirectUrl = requestUrl.searchParams.get("redirect");
  const origin = requestUrl.origin;

  const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookiesToSet.push({ name, value, options });
        },
        remove(name: string, options: CookieOptions) {
          cookiesToSet.push({ name, value: "", options });
        },
      },
    }
  );

  const createRedirectWithCookies = (url: URL | string) => {
    const response = NextResponse.redirect(url);
    for (const { name, value, options } of cookiesToSet) {
      response.cookies.set(name, value, { ...options, domain: COOKIE_DOMAIN });
    }
    return response;
  };

  if (code) {
    const { data: sessionData, error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Error exchanging code for session:", error);

      if (mcpToken && redirectUrl) {
        const mcpCallbackUrl = new URL(redirectUrl);
        mcpCallbackUrl.searchParams.set("mcp_token", mcpToken);
        mcpCallbackUrl.searchParams.set("error", "auth_failed");
        mcpCallbackUrl.searchParams.set("error_description", error.message);
        return createRedirectWithCookies(mcpCallbackUrl.toString());
      }

      return createRedirectWithCookies(new URL("/signin?error=auth_error", origin));
    }

    const user = sessionData?.user;

    if (user) {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      const isNewUser = !existingProfile;

      if (isNewUser) {
        // Strip HTML and cap length on the OAuth-provided display name before
        // it flows into profiles.full_name.
        const sanitizedFullName = sanitizeDisplayName(user.user_metadata?.full_name);

        const { error: profileError } = await supabase.from("profiles").upsert({
          id: user.id,
          email: user.email,
          full_name: sanitizedFullName,
        });

        if (profileError) {
          console.error("Error creating profile:", profileError);
        }
      }

      // Handle MCP token flow — mark token completed before redirecting to CLI
      if (mcpToken && redirectUrl && user.email) {
        await enhancedMCPService.completeAuthentication(mcpToken, user.email);
        const mcpCallbackUrl = new URL(redirectUrl);
        mcpCallbackUrl.searchParams.set("mcp_token", mcpToken);
        mcpCallbackUrl.searchParams.set("email", user.email);
        return createRedirectWithCookies(mcpCallbackUrl.toString());
      }

      const { data: workspaces, error: workspaceError } = await supabase
        .from("workspaces")
        .select("workspace_id")
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .limit(1);

      if (workspaceError) {
        console.error(`[Auth Callback] Error querying owned workspaces:`, workspaceError);
      }

      if (workspaces && workspaces.length > 0) {
        return createRedirectWithCookies(
          new URL(`/${workspaces[0].workspace_id}/home`, origin)
        );
      }

      return createRedirectWithCookies(new URL("/setup-workspace", origin));
    }
  }

  return createRedirectWithCookies(new URL("/setup-workspace", origin));
}
