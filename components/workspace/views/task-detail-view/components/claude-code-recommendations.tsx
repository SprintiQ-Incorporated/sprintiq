"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Bug,
  Shield,
  Zap,
  AlertTriangle,
  ArrowUpRight,
  X,
  FileCode,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTaskIssues, usePromoteIssue, useDismissIssue } from "@/hooks/useAnalytics";

interface ClaudeCodeRecommendationsProps {
  taskId: string;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  bug: { icon: Bug, color: "text-red-600 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-500/20" },
  security: { icon: Shield, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-500/20" },
  performance: { icon: Zap, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-500/20" },
  style: { icon: FileCode, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-500/20" },
  warning: { icon: AlertTriangle, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-500/20" },
};

const severityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400",
};

export function ClaudeCodeRecommendations({ taskId }: ClaudeCodeRecommendationsProps) {
  const { data, isLoading } = useTaskIssues(taskId);
  const promoteMutation = usePromoteIssue();
  const dismissMutation = useDismissIssue();

  const issues = data?.issues ?? [];

  if (isLoading || issues.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 px-4 md:px-6">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        Claude Code Recommendations
        <span className="text-xs font-normal px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded">
          {issues.length}
        </span>
      </h3>

      <div className="space-y-2">
        {issues.map((issue) => {
          const config = typeConfig[issue.issue_type] ?? typeConfig.warning;
          const TypeIcon = config.icon;
          const isPromoting = promoteMutation.isPending && promoteMutation.variables?.issueId === issue.id;
          const isDismissing = dismissMutation.isPending && dismissMutation.variables === issue.id;

          return (
            <div
              key={issue.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50"
            >
              <div className={cn("p-1.5 rounded-md shrink-0", config.bgColor)}>
                <TypeIcon className={cn("h-3.5 w-3.5", config.color)} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={cn(
                    "text-[10px] font-medium uppercase px-1.5 py-0.5 rounded",
                    severityColors[issue.severity ?? 'low'] ?? severityColors.low
                  )}>
                    {issue.severity}
                  </span>
                  {issue.suggested_points != null && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      ~{issue.suggested_points}pts
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                  {issue.title}
                </p>
                {issue.file_path && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {issue.file_path}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                  disabled={isPromoting || isDismissing}
                  onClick={() => promoteMutation.mutate({ issueId: issue.id })}
                >
                  {isPromoting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                      Promote
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  disabled={isPromoting || isDismissing}
                  onClick={() => dismissMutation.mutate(issue.id)}
                >
                  {isDismissing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
