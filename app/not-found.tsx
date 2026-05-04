"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { BrandLockup } from "@/components/branding/BrandLockup";

export default function NotFound() {
  const router = useRouter();
  const handleBack = () => {
    router.back();
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-60 h-60 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-4000"></div>
      </div>

      <div className="max-w-2xl w-full text-center relative z-10">
        <div className="animate-fade-in-up">
          <Link
            href="/"
            className="inline-flex items-center mb-8 group"
          >
            <BrandLockup size="lg" variant="light" />
          </Link>

          <div className="space-y-6">
            <h1 className="text-9xl font-bold bg-gradient-to-r from-white via-emerald-100 to-emerald-200 bg-clip-text text-transparent animate-bounce-gentle">
              404
            </h1>
            <h2 className="text-3xl font-bold text-white mb-4">
              Page Not Found
            </h2>
            <p className="text-emerald-100/90 text-lg leading-relaxed max-w-md mx-auto">
              Oops! The page you&apos;re looking for seems to have sprinted away.
              Let&apos;s get you back on track.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            <Button
              onClick={handleBack}
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white py-6 px-8 text-lg font-semibold rounded-xl shadow-lg hover:shadow-emerald-500/40 transition-all duration-300 transform hover:scale-[1.02]"
            >
              <div className="flex items-center space-x-2">
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Home</span>
              </div>
            </Button>

            <div className="text-emerald-100/80 text-sm">
              Need help?{" "}
              <a
                href="https://github.com/SprintiQ-Incorporated/sprintiq/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors duration-200 hover:underline"
              >
                File an issue
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
