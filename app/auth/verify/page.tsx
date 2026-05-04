import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mail, Zap, CheckCircle, ArrowRight, Home } from "lucide-react";

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-green-900 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
        {/* Left Side - Branding & Info */}
        <div className="text-center lg:text-left space-y-8">
          <Link
            href="/"
            className="inline-flex items-center space-x-3 mb-8 group"
          >
            <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-green-600 rounded-3xl flex items-center justify-center shadow-xl group-hover:shadow-emerald-500/40 transition-all duration-300 group-hover:scale-105">
              <Zap className="h-9 w-9 text-white" />
            </div>
            <span className="text-5xl font-bold bg-gradient-to-r from-white to-emerald-100 bg-clip-text text-transparent">
              SprintiQ
            </span>
          </Link>

          <div className="space-y-6">
            <h1 className="text-5xl lg:text-6xl font-bold bg-gradient-to-r from-white via-emerald-100 to-emerald-200 bg-clip-text text-transparent leading-tight">
              Almost
              <br />
              <span className="text-emerald-300">there!</span>
            </h1>
            <p className="text-emerald-100/90 text-xl leading-relaxed max-w-md mx-auto lg:mx-0">
              We&apos;ve sent you a verification email to complete your registration
              and get started
            </p>
          </div>

          {/* Feature highlights */}
          <div className="hidden lg:block space-y-4 pt-8">
            <div className="flex items-center space-x-3 text-emerald-100">
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
              <span>Secure email verification process</span>
            </div>
            <div className="flex items-center space-x-3 text-emerald-100">
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
              <span>One-click activation</span>
            </div>
            <div className="flex items-center space-x-3 text-emerald-100">
              <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
              <span>Get started in seconds</span>
            </div>
          </div>
        </div>

        {/* Right Side - Verification Info */}
        <div className="w-full max-w-md mx-auto lg:max-w-none">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 lg:p-10 border border-emerald-500/20 hover:border-emerald-500/30 transition-all duration-300">
            <div className="text-center space-y-8">
              {/* Email Icon */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-full flex items-center justify-center border-2 border-emerald-400/30">
                    <Mail className="h-12 w-12 text-emerald-300" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-3">
                    Check your email
                  </h2>
                  <p className="text-emerald-100/80 text-lg leading-relaxed">
                    We&apos;ve sent a verification link to your email address
                  </p>
                </div>

                <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-6 space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-emerald-300 text-sm font-bold">
                        1
                      </span>
                    </div>
                    <p className="text-emerald-100/90 text-sm">
                      Check your email inbox for a message from SprintiQ
                    </p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-emerald-300 text-sm font-bold">
                        2
                      </span>
                    </div>
                    <p className="text-emerald-100/90 text-sm">
                      Click the verification link in the email
                    </p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-emerald-300 text-sm font-bold">
                        3
                      </span>
                    </div>
                    <p className="text-emerald-100/90 text-sm">
                      Start using SprintiQ immediately
                    </p>
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <p className="text-amber-200/90 text-sm">
                    <strong>Can&apos;t find the email?</strong> Check your spam or
                    junk folder, or try searching for &quot;SprintiQ&quot;
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-4 pt-4">
                <Button className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-emerald-500/40 transition-all duration-300 transform hover:scale-[1.02] h-14">
                  Resend Verification Email
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>

                <div className="grid grid-cols-2 gap-4">
                  <Link href="/signin" className="block">
                    <Button
                      variant="outline"
                      className="w-full bg-emerald-950/30 border-emerald-500/30 text-emerald-100 hover:bg-emerald-950/40 hover:border-emerald-400/50 py-3 rounded-xl transition-all duration-200"
                    >
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/" className="block">
                    <Button
                      variant="ghost"
                      className="w-full text-emerald-200 hover:text-white hover:bg-emerald-950/20 py-3 rounded-xl transition-all duration-200"
                    >
                      <Home className="mr-2 h-4 w-4" />
                      Home
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
