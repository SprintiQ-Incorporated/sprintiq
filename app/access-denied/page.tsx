"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/branding/BrandLockup";
import { AlertCircle, ArrowLeft, Trash2, HelpCircle } from "lucide-react";
import { Suspense } from "react";

type ErrorReason = "workspace_deleted" | "generic";

interface ErrorConfig {
  icon: React.ReactNode;
  title: string;
  description: string;
  alertMessage: string;
  primaryAction: {
    label: string;
    href: string;
  };
  secondaryMessage?: string;
}

function getErrorConfig(reason: ErrorReason): ErrorConfig {
  const configs: Record<ErrorReason, ErrorConfig> = {
    workspace_deleted: {
      icon: <Trash2 className="w-10 h-10 text-gray-400" />,
      title: "Workspace Not Found",
      description:
        "The workspace you're trying to access has been deleted or no longer exists.",
      alertMessage:
        "If you believe this is an error, file an issue on GitHub.",
      primaryAction: {
        label: "Create New Workspace",
        href: "/setup-workspace",
      },
      secondaryMessage: "Need help recovering your data?",
    },
    generic: {
      icon: <HelpCircle className="w-10 h-10 text-emerald-400" />,
      title: "Access Unavailable",
      description:
        "We're unable to grant access to this resource at the moment.",
      alertMessage:
        "This may be a temporary issue. Try refreshing the page or signing in again.",
      primaryAction: {
        label: "Back to Home",
        href: "/",
      },
      secondaryMessage: "Still having trouble?",
    },
  };

  return configs[reason] || configs.generic;
}

function getIconBackground(reason: ErrorReason): string {
  const backgrounds: Record<ErrorReason, string> = {
    workspace_deleted: "bg-gray-500/20",
    generic: "bg-emerald-500/20",
  };
  return backgrounds[reason] || backgrounds.generic;
}

function ErrorPageContent() {
  const searchParams = useSearchParams();
  const reason = (searchParams.get("reason") as ErrorReason) || "generic";
  const config = getErrorConfig(reason);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-60 h-60 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-4000"></div>
      </div>

      <div className="max-w-2xl w-full text-center relative z-10">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 lg:p-12 border border-emerald-500/20">
          {/* Co-branded lockup */}
          <div className="mb-8 flex justify-center">
            <Link href="/" className="inline-flex items-center">
              <BrandLockup size="lg" variant="light" />
            </Link>
          </div>

          <div className="mb-6">
            <div
              className={`mx-auto w-20 h-20 ${getIconBackground(reason)} rounded-full flex items-center justify-center`}
            >
              {config.icon}
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              {config.title}
            </h1>
            <p className="text-emerald-100/90 text-lg leading-relaxed">
              {config.description}
            </p>
          </div>

          <div className="mb-8 bg-white/5 border border-white/10 backdrop-blur-sm flex gap-3 items-start p-4 rounded-lg">
            <AlertCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <span className="text-emerald-100/80 flex-1 text-left text-sm">
              {config.alertMessage}
            </span>
          </div>

          <div className="space-y-4">
            <Button
              asChild
              className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-emerald-500/40 transition-all duration-300 transform hover:scale-[1.02] h-14"
            >
              <Link href={config.primaryAction.href}>
                {reason === "generic" && <ArrowLeft className="w-5 h-5 mr-2" />}
                {config.primaryAction.label}
              </Link>
            </Button>

            {config.secondaryMessage && (
              <div className="text-center">
                <p className="text-emerald-100/80 text-sm">
                  {config.secondaryMessage}{" "}
                  <a
                    href="https://github.com/SprintiQ-Incorporated/sprintiq/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors duration-200 hover:underline"
                  >
                    File an issue
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center">
          <div className="animate-pulse text-emerald-400">Loading...</div>
        </div>
      }
    >
      <ErrorPageContent />
    </Suspense>
  );
}
