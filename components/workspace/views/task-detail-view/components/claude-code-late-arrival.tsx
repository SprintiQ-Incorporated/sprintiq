"use client";

import { Button } from "@/components/ui/button";
import { Info, X } from "lucide-react";
import type { ClaudeCodeSession } from "@/lib/database-aliases";

interface LateArrivalProps {
  session: ClaudeCodeSession;
  onApply: () => void;
  onDismiss: () => void;
  isResolving: boolean;
}

export function ClaudeCodeLateArrival({
  session: _session,
  onApply,
  onDismiss,
  isResolving,
}: LateArrivalProps) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 flex items-start gap-3">
      <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
          Late Session Completion
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
          A previously abandoned Claude Code session has reported completion. Review and apply
          its results or dismiss.
        </p>
        <div className="flex gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onApply}
            disabled={isResolving}
            className="h-7 text-xs text-blue-600 border-blue-300 hover:bg-blue-100 dark:text-blue-400 dark:border-blue-700"
          >
            Apply Results
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            disabled={isResolving}
            className="h-7 text-xs"
          >
            Dismiss
          </Button>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
