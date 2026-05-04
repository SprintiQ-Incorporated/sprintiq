"use client";

import type React from "react";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/branding/BrandLockup";
import { Input } from "@/components/ui/input";
import { Lock, AlertCircle, CheckCircle, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRouter } from "next/navigation";

/**
 * Maps Supabase password update error messages to user-friendly messages
 */
function getUpdatePasswordErrorMessage(errorMessage: string): string {
  const lowerCaseError = errorMessage.toLowerCase();

  // Token expired or invalid
  if (lowerCaseError.includes("expired") ||
      lowerCaseError.includes("invalid") ||
      lowerCaseError.includes("token") ||
      lowerCaseError.includes("link")) {
    return "Reset link has expired. Please request a new one.";
  }

  // Password too weak
  if (lowerCaseError.includes("weak") ||
      lowerCaseError.includes("short") ||
      lowerCaseError.includes("characters")) {
    return "Password must be at least 8 characters.";
  }

  // Same password as before
  if (lowerCaseError.includes("same") ||
      lowerCaseError.includes("different")) {
    return "New password must be different from your current password.";
  }

  // Rate limiting
  if (lowerCaseError.includes("rate") ||
      lowerCaseError.includes("limit") ||
      lowerCaseError.includes("too many")) {
    return "Too many attempts. Please try again later.";
  }

  // Network errors
  if (lowerCaseError.includes("network") ||
      lowerCaseError.includes("fetch") ||
      lowerCaseError.includes("connection")) {
    return "Unable to connect. Please check your internet connection and try again.";
  }

  // Default: return the original message
  return errorMessage;
}

/**
 * Calculate password strength
 */
function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 2) return { score, label: "Fair", color: "bg-orange-500" };
  if (score <= 3) return { score, label: "Good", color: "bg-yellow-500" };
  if (score <= 4) return { score, label: "Strong", color: "bg-emerald-500" };
  return { score, label: "Very Strong", color: "bg-green-500" };
}

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientSupabaseClient();

  // Check for recovery tokens in URL hash and establish session on mount
  useEffect(() => {
    const verifyRecoverySession = async () => {
      setIsVerifyingSession(true);
      setSessionError(null);

      try {
        // First, check if we already have a valid session
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (existingSession) {
          setIsVerifyingSession(false);
          return;
        }

        // Parse hash fragments from URL (Supabase sends tokens in hash)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");
        const errorCode = hashParams.get("error");
        const errorDescription = hashParams.get("error_description");

        // Handle Supabase error in URL (e.g., expired link)
        if (errorCode) {
          console.error("[Update Password] Error in URL:", errorCode, errorDescription);
          setSessionError(
            errorDescription || 
            "Your password reset link has expired or is invalid. Please request a new one."
          );
          setIsVerifyingSession(false);
          return;
        }

        // If we have tokens, try to set the session
        if (accessToken && refreshToken) {
          
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error("[Update Password] Failed to set session:", sessionError);
            setSessionError(
              "Your password reset link has expired or was already used. Please request a new one."
            );
            setIsVerifyingSession(false);
            return;
          }

          if (data.session) {
            // Clear hash from URL for security (without triggering navigation)
            window.history.replaceState(null, "", window.location.pathname);
            setIsVerifyingSession(false);
            return;
          }
        }

        // No tokens and no session - user accessed page directly without valid link
        setSessionError(
          "No valid reset link detected. Please request a new password reset link."
        );
        setIsVerifyingSession(false);
      } catch (err) {
        console.error("[Update Password] Error verifying session:", err);
        setSessionError(
          "An error occurred while verifying your reset link. Please try again or request a new link."
        );
        setIsVerifyingSession(false);
      }
    };

    verifyRecoverySession();
  }, [supabase.auth]);

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);
  const passwordsMatch = password === confirmPassword;
  const isValidPassword = password.length >= 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSuccess(false);

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    if (!isValidPassword) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(getUpdatePasswordErrorMessage(error.message));
      } else {
        setIsSuccess(true);
        // Redirect to signin with success param after a brief delay
        setTimeout(() => {
          router.push("/signin?reset=success");
        }, 2000);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-20">
        <Image
          src="/images/auth-bg.webp"
          alt="Hero Pattern"
          width={1000}
          height={1000}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-60 h-60 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-4000"></div>
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Logo and Header */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center mb-6 sm:mb-8 group"
          >
            <BrandLockup size="lg" variant="light" />
          </Link>
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white via-emerald-100 to-emerald-200 bg-clip-text text-transparent mb-2">
            Create new password
          </h2>
          <p className="text-emerald-100/80 text-sm sm:text-base">
            Enter a new password for your account
          </p>
        </div>

        {/* Update Password Form */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 lg:p-10 border border-emerald-500/20 hover:border-emerald-500/30 transition-all duration-300">
          {/* Session Verification Loading State */}
          {isVerifyingSession ? (
            <div className="text-center space-y-6 py-8">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Verifying your reset link...
                </h3>
                <p className="text-emerald-100/80 text-sm">
                  Please wait while we verify your password reset request.
                </p>
              </div>
            </div>
          ) : sessionError ? (
            /* Session Error State - Invalid/Expired Link */
            <div className="text-center space-y-6 py-4">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="h-8 w-8 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Reset Link Invalid
                </h3>
                <p className="text-emerald-100/80 text-sm mb-6">
                  {sessionError}
                </p>
              </div>
              <div className="space-y-3">
                <Link href="/auth/reset-password">
                  <Button
                    type="button"
                    className="w-full bg-gradient-to-r from-emerald-500 to-green-600 h-11 sm:h-12 hover:from-emerald-600 hover:to-green-700 text-white text-base sm:text-lg font-semibold rounded-xl shadow-lg hover:shadow-emerald-500/40 transition-all duration-300 transform hover:scale-[1.02]"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Request New Reset Link
                  </Button>
                </Link>
                <Link
                  href="/signin"
                  className="block text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors duration-200 hover:underline"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          ) : (
            /* Normal Form State */
            <>
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

          {isSuccess ? (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Password updated!
                </h3>
                <p className="text-emerald-100/80 text-sm">
                  Your password has been successfully updated. Redirecting to sign in...
                </p>
              </div>
              <div className="flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-emerald-400 animate-spin" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* New Password Field */}
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-emerald-100"
                >
                  New Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-emerald-300 group-focus-within:text-emerald-400 transition-colors duration-200" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    className="pl-10 sm:pl-12 pr-10 sm:pr-12 h-12 sm:h-14 bg-emerald-950/30 border-emerald-500/30 text-white placeholder:text-emerald-200/70 rounded-xl focus:border-emerald-400 focus:ring-emerald-400/30 transition-all duration-200 hover:bg-emerald-950/40 hover:border-emerald-400/50 text-sm sm:text-base"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-emerald-300 hover:text-emerald-200 transition-colors duration-200"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {password.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                            level <= passwordStrength.score
                              ? passwordStrength.color
                              : "bg-gray-600"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-emerald-100/60">
                        Password strength:
                      </p>
                      <p className={`text-xs font-medium ${
                        passwordStrength.score <= 1 ? "text-red-400" :
                        passwordStrength.score <= 2 ? "text-orange-400" :
                        passwordStrength.score <= 3 ? "text-yellow-400" :
                        "text-emerald-400"
                      }`}>
                        {passwordStrength.label}
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-xs text-emerald-100/60">
                  Use at least 8 characters with uppercase, lowercase, numbers, and symbols
                </p>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-emerald-100"
                >
                  Confirm Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-emerald-300 group-focus-within:text-emerald-400 transition-colors duration-200" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    className={`pl-10 sm:pl-12 pr-10 sm:pr-12 h-12 sm:h-14 bg-emerald-950/30 border-emerald-500/30 text-white placeholder:text-emerald-200/70 rounded-xl focus:border-emerald-400 focus:ring-emerald-400/30 transition-all duration-200 hover:bg-emerald-950/40 hover:border-emerald-400/50 text-sm sm:text-base ${
                      confirmPassword.length > 0 && !passwordsMatch
                        ? "border-red-500/50 focus:border-red-400"
                        : ""
                    }`}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-emerald-300 hover:text-emerald-200 transition-colors duration-200"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <p className={`text-xs ${passwordsMatch ? "text-emerald-400" : "text-red-400"}`}>
                    {passwordsMatch ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Passwords match
                      </span>
                    ) : (
                      "Passwords do not match"
                    )}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading || !isValidPassword || !passwordsMatch}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 h-11 sm:h-12 hover:from-emerald-600 hover:to-green-700 text-white text-base sm:text-lg font-semibold rounded-xl shadow-lg hover:shadow-emerald-500/40 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    <span>Updating...</span>
                  </div>
                ) : (
                  "Update Password"
                )}
              </Button>

              <div className="text-center pt-2">
                <Link
                  href="/signin"
                  className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors duration-200 hover:underline"
                >
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
