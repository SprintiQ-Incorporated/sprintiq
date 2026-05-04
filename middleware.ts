import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase/server";
import { debugLog } from "@/lib/debug-logger";
import { COOKIE_DOMAIN } from "@/lib/cookie-domain";

const CSRF_TOKEN_NAME = 'csrf_token';
const CSRF_CLIENT_TOKEN_NAME = 'csrf_client';

function generateCsrfToken(): string {
  return crypto.randomUUID();
}

function ensureCsrfTokens(request: NextRequest, response: NextResponse): void {
  const existingServerToken = request.cookies.get(CSRF_TOKEN_NAME)?.value;
  const existingClientToken = request.cookies.get(CSRF_CLIENT_TOKEN_NAME)?.value;

  const needsNewTokens = !existingServerToken ||
                         !existingClientToken ||
                         existingServerToken !== existingClientToken;

  if (needsNewTokens) {
    const token = generateCsrfToken();

    response.cookies.set(CSRF_TOKEN_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
      domain: COOKIE_DOMAIN,
    });

    response.cookies.set(CSRF_CLIENT_TOKEN_NAME, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
      domain: COOKIE_DOMAIN,
    });
  }
}

/**
 * Create a redirect response that preserves cookies through the redirect.
 *
 * NextResponse.redirect() does NOT automatically forward request cookies.
 * When Supabase's access token is still valid, getUser()/getSession() doesn't
 * set new cookies — it just validates existing ones. So the response has no
 * auth cookies to copy, and the redirect would lose them.
 *
 * This helper copies:
 * 1. Any NEW cookies set on the response (e.g., refreshed tokens)
 * 2. Existing Supabase auth cookies from the request (if not already on response)
 */
function redirectWithCookies(url: URL, sourceResponse: NextResponse, request: NextRequest): NextResponse {
  const redirectResponse = NextResponse.redirect(url);

  const responseCookies = sourceResponse.cookies.getAll();
  const requestCookies = request.cookies.getAll();

  responseCookies.forEach(cookie => {
    redirectResponse.cookies.set(cookie);
  });

  const supabaseAuthCookies = requestCookies.filter(c => c.name.startsWith('sb-'));

  supabaseAuthCookies.forEach(cookie => {
    if (!redirectResponse.cookies.get(cookie.name)) {
      redirectResponse.cookies.set(cookie.name, cookie.value, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        domain: COOKIE_DOMAIN,
      });
    }
  });

  return redirectResponse;
}

const publicRoutes = [
  "/signin",
  "/auth/callback",
  "/auth/verify",
  "/auth/reset-password",
  "/auth/update-password",
  "/access-denied",
  "/mcp/auth/success",
];

const workspaceRoutePattern = /^\/w_[a-f0-9]{8}\/.*$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static files pass through without auth (belt-and-suspenders with matcher)
  if (
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/site.webmanifest" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    debugLog('[middleware] API route detected:', pathname, request.method);
  }

  // Public routes and API routes still need CSRF tokens but don't require auth.
  // API handlers do their own getUser() checks; doing one here triggers token
  // refreshes that flood Supabase with 429s when many handlers fire in parallel.
  if (
    publicRoutes.some((route) => pathname === route) ||
    pathname.startsWith("/api/")
  ) {
    const response = NextResponse.next();
    ensureCsrfTokens(request, response);
    return response;
  }

  const response = NextResponse.next();
  const supabase = createMiddlewareSupabaseClient(request, response);

  // getSession() decodes the JWT locally and only contacts Supabase when
  // expired. getUser() would round-trip on every protected page load and
  // cause 429 floods on parallel API calls. API handlers remain authoritative.
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    const redirectUrl = new URL("/signin", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return redirectWithCookies(redirectUrl, response, request);
  }

  ensureCsrfTokens(request, response);

  // Workspace routes (/w_xxxxxxxx/...) — pass through; ownership is enforced
  // by route handlers via requireOwner() / workspace.owner_id checks.
  if (workspaceRoutePattern.test(pathname)) {
    return response;
  }

  if (pathname.startsWith("/setup-workspace")) {
    return response;
  }

  // /dashboard and /workspace are redirect helpers — find the user's workspace
  // and route them to it, otherwise send to setup-workspace.
  if (pathname === "/dashboard" || pathname === "/workspace") {
    const { data: ownedWorkspaces } = await supabase
      .from("workspaces")
      .select("workspace_id")
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .limit(1);

    if (ownedWorkspaces && ownedWorkspaces.length > 0) {
      return redirectWithCookies(
        new URL(`/${ownedWorkspaces[0].workspace_id}/home`, request.url),
        response,
        request
      );
    }
    return redirectWithCookies(new URL("/setup-workspace", request.url), response, request);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|sitemap\\.xml|sitemap-index\\.xml|robots\\.txt|site\\.webmanifest).*)",
  ],
};
