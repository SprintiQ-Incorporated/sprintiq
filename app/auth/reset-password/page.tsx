"use client";

import type React from "react";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/branding/BrandLockup";
import { Input } from "@/components/ui/input";
import { Mail, AlertCircle, CheckCircle, ArrowLeft, Loader2 } from "lucide-react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Maps Supabase password reset error messages to user-friendly messages
 */
function getResetErrorMessage(errorMessage: string): string {
  const lowerCaseError = errorMessage.toLowerCase();

  // User not found
  if (lowerCaseError.includes("user not found") ||
      lowerCaseError.includes("no user") ||
      lowerCaseError.includes("unable to validate")) {
    return "No account found with this email address. Please check your email or sign up.";
  }

  // Rate limiting
  if (lowerCaseError.includes("rate") ||
      lowerCaseError.includes("limit") ||
      lowerCaseError.includes("too many") ||
      lowerCaseError.includes("security purposes")) {
    return "Too many reset attempts. Please try again later.";
  }

  // Invalid email format
  if (lowerCaseError.includes("invalid") && lowerCaseError.includes("email")) {
    return "Please enter a valid email address.";
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

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClientSupabaseClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSuccess(false);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) {
        setError(getResetErrorMessage(error.message));
      } else {
        setIsSuccess(true);
      }
    } catch {
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
            Reset your password
          </h2>
          <p className="text-emerald-100/80 text-sm sm:text-base">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        {/* Reset Password Form */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 lg:p-10 border border-emerald-500/20 hover:border-emerald-500/30 transition-all duration-300">
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
                  Check your email
                </h3>
                <p className="text-emerald-100/80 text-sm">
                  We&apos;ve sent a password reset link to{" "}
                  <span className="font-medium text-emerald-300">{email}</span>.
                  Please check your inbox and follow the instructions.
                </p>
              </div>
              <div className="pt-4 space-y-3">
                <p className="text-emerald-100/60 text-xs">
                  Didn&apos;t receive the email? Check your spam folder or try again.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsSuccess(false);
                    setEmail("");
                  }}
                  className="w-full bg-emerald-950/30 border-emerald-500/30 text-white hover:bg-emerald-950/40 hover:text-emerald-300 hover:border-emerald-400/50 rounded-xl transition-all duration-200"
                >
                  Try another email
                </Button>
              </div>
              <Link
                href="/signin"
                className="inline-flex items-center text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors duration-200 hover:underline"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-emerald-100"
                >
                  Email address
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-emerald-300 group-focus-within:text-emerald-400 transition-colors duration-200" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    className="pl-10 sm:pl-12 h-12 sm:h-14 bg-emerald-950/30 border-emerald-500/30 text-white placeholder:text-emerald-200/70 rounded-xl focus:border-emerald-400 focus:ring-emerald-400/30 transition-all duration-200 hover:bg-emerald-950/40 hover:border-emerald-400/50 text-sm sm:text-base"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 h-11 sm:h-12 hover:from-emerald-600 hover:to-green-700 text-white text-base sm:text-lg font-semibold rounded-xl shadow-lg hover:shadow-emerald-500/40 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    <span>Sending...</span>
                  </div>
                ) : (
                  "Send Reset Link"
                )}
              </Button>

              <div className="text-center pt-2">
                <Link
                  href="/signin"
                  className="inline-flex items-center text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors duration-200 hover:underline"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
