"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface AnalyticsBreadcrumbProps {
  workspaceId: string;
  currentPage: string;
  parentPage?: {
    name: string;
    href: string;
  };
}

export function AnalyticsBreadcrumb({
  workspaceId,
  currentPage,
  parentPage,
}: AnalyticsBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-sm mb-4">
      <Link
        href={`/${workspaceId}/home`}
        className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        <Home className="w-4 h-4" />
        <span>Home</span>
      </Link>
      <ChevronRight className="w-4 h-4 text-slate-400" />
      <Link
        href={`/${workspaceId}/analytics`}
        className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        Analytics
      </Link>
      {parentPage && (
        <>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <Link
            href={parentPage.href}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            {parentPage.name}
          </Link>
        </>
      )}
      <ChevronRight className="w-4 h-4 text-slate-400" />
      <span className="text-slate-900 dark:text-white font-medium">
        {currentPage}
      </span>
    </nav>
  );
}
