"use client";

import type React from "react";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Zap, Mail, Lock, AlertCircle, Eye, EyeOff, CheckCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BrandLockup } from "@/components/branding/BrandLockup";

/**
 * Maps Supabase auth error messages to user-friendly messages
 */
function getAuthErrorMessage(errorMessage: string): string {
  const lowerCaseError = errorMessage.toLowerCase();

  if (lowerCaseError.includes("invalid login credentials") ||
      lowerCaseError.includes("invalid credentials")) {
    return "Incorrect email or password. Please try again.";
  }

  if (lowerCaseError.includes("email not confirmed") ||
      lowerCaseError.includes("email is not confirmed")) {
    return "Please verify your email before signing in. Check your inbox for a verification link.";
  }

  if (lowerCaseError.includes("rate") ||
      lowerCaseError.includes("limit") ||
      lowerCaseError.includes("too many")) {
    return "Too many sign-in attempts. Please try again later.";
  }

  if (lowerCaseError.includes("user not found") ||
      lowerCaseError.includes("no user")) {
    return "No account found with this email.";
  }

  if (lowerCaseError.includes("network") ||
      lowerCaseError.includes("fetch") ||
      lowerCaseError.includes("connection")) {
    return "Unable to connect. Please check your internet connection and try again.";
  }

  return errorMessage;
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mcpToken, setMcpToken] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);
  const [inactivitySignOut, setInactivitySignOut] = useState(false);
  const { signIn } = useAuth();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("mcp_token");
    const redirect = searchParams.get("redirect");
    const verified = searchParams.get("verified");
    const reset = searchParams.get("reset");
    const reason = searchParams.get("reason");

    if (token) setMcpToken(token);
    if (redirect) setRedirectUrl(redirect);
    if (verified === "true") setEmailVerified(true);
    if (reset === "success") setPasswordReset(true);
    if (reason === "inactivity") setInactivitySignOut(true);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await signIn(
        email,
        password,
        mcpToken ?? undefined,
        redirectUrl ?? undefined
      );
      if (error) {
        const errorMessage = typeof error === "string" ? error : error.message || "An error occurred";
        setError(getAuthErrorMessage(errorMessage));
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8 border border-emerald-500/20">
          {/* Co-branded lockup */}
          <div className="flex justify-center mb-6">
            <BrandLockup size="lg" variant="light" />
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
              {mcpToken ? "MCP Authorization" : "Sign in to SprintiQ Turbo"}
            </h1>
            {mcpToken && (
              <p className="text-emerald-100/80 text-sm">
                Authorize SprintiQ Turbo to work with your MCP client
              </p>
            )}
          </div>

          {emailVerified && (
            <Alert className="mb-6 bg-emerald-500/10 border-emerald-500/20 backdrop-blur-sm">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <AlertDescription className="text-emerald-300 text-sm">
                Your email has been verified! You can now sign in to your account.
              </AlertDescription>
            </Alert>
          )}

          {passwordReset && (
            <Alert className="mb-6 bg-emerald-500/10 border-emerald-500/20 backdrop-blur-sm">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <AlertDescription className="text-emerald-300 text-sm">
                Password updated successfully! You can now sign in with your new password.
              </AlertDescription>
            </Alert>
          )}

          {inactivitySignOut && (
            <Alert className="mb-6 bg-amber-500/10 border-amber-500/20 backdrop-blur-sm">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <AlertDescription className="text-amber-300 text-sm">
                You were signed out due to inactivity. Please sign in again to continue.
              </AlertDescription>
            </Alert>
          )}

          {mcpToken && (
            <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center space-x-2 text-blue-300">
                <Zap className="h-4 w-4" />
                <span className="text-sm font-medium">MCP Integration</span>
              </div>
              <p className="text-xs text-blue-200 mt-1">
                This will allow your MCP client to access SprintiQ Turbo features
              </p>
            </div>
          )}

          {error && (
            <Alert
              variant="destructive"
              className="mb-6 bg-red-500/10 border-red-500/20 backdrop-blur-sm"
            >
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300 text-sm">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-emerald-100"
              >
                Email address
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-300 group-focus-within:text-emerald-400 transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="pl-10 h-11 bg-emerald-950/30 border-emerald-500/30 text-white placeholder:text-emerald-200/70 rounded-xl focus:border-emerald-400 focus:ring-emerald-400/30"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-emerald-100"
              >
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-300 group-focus-within:text-emerald-400 transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="pl-10 pr-10 h-11 bg-emerald-950/30 border-emerald-500/30 text-white placeholder:text-emerald-200/70 rounded-xl focus:border-emerald-400 focus:ring-emerald-400/30"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-300 hover:text-emerald-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  className="border-emerald-400/50 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                />
                <label
                  htmlFor="remember"
                  className="text-sm text-emerald-100/90 cursor-pointer"
                >
                  Remember me
                </label>
              </div>
              <Link
                href="/auth/reset-password"
                className="text-sm text-emerald-400 hover:text-emerald-300 font-medium hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-emerald-500 to-green-600 h-11 hover:from-emerald-600 hover:to-green-700 text-white text-base font-semibold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </div>
              ) : mcpToken ? (
                "Authorize & Sign In"
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-emerald-100/50 mt-6">
            © 2026 SprintiQ Incorporated
          </p>
        </div>
      </div>
    </div>
  );
}

function SignInLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
        <p className="text-emerald-100/80">Loading...</p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInLoading />}>
      <SignInForm />
    </Suspense>
  );
}
