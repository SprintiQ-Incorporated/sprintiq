"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Terminal,
  Square,
  Copy,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { ClaudeCodeSession } from "@/lib/database-aliases";

interface ClaudeCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: ClaudeCodeSession[];
  activeSessions: ClaudeCodeSession[];
  isCreating: boolean;
  isStopping: boolean;
  onStartSession: () => Promise<{ sessionId: string; token: string; taskId: string } | null>;
  onStopSession: (sessionId: string) => void;
  taskMarkdown: string;
}

const statusColors: Record<string, string> = {
  pending:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  active:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  completed:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  stopped:
    "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  abandoned:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  cancelled:
    "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

export function ClaudeCodeDialog({
  open,
  onOpenChange,
  sessions,
  activeSessions,
  isCreating,
  isStopping,
  onStartSession,
  onStopSession,
  taskMarkdown,
}: ClaudeCodeDialogProps) {
  const [showFallback, setShowFallback] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleStartSession = useCallback(async () => {
    setShowFallback(false);
    const launchData = await onStartSession();
    if (!launchData) return;

    try {
      const res = await fetch("http://localhost:19847/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: launchData.sessionId,
          token: launchData.token,
          task_id: launchData.taskId,
        }),
      });
      if (!res.ok) throw new Error("Launch failed");
      // CLI is handling it — session status updates via Realtime
    } catch {
      // Watch server not running
      setShowFallback(true);
    }
  }, [onStartSession]);

  const handleCopyContext = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(taskMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy to clipboard");
    }
  }, [taskMarkdown]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-amber-600 rounded-md flex items-center justify-center shadow-sm">
              <Terminal className="w-4 h-4 text-white" />
            </div>
            Code with Claude
          </DialogTitle>
          <DialogDescription>
            Launch a Claude Code session to work on this task in your terminal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Active Sessions */}
          {activeSessions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Active Sessions</h4>
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 rounded-lg border workspace-border workspace-header-bg"
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          statusColors[session.status] ?? statusColors.pending
                        }`}
                      >
                        {session.status}
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Started{" "}
                        {format(
                          parseISO(session.started_at ?? ''),
                          "MMM d 'at' h:mm a"
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onStopSession(session.id)}
                    disabled={isStopping}
                    className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    {isStopping ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Square className="w-3 h-3 mr-1" />
                    )}
                    Stop
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Start New Session */}
          <Button
            onClick={handleStartSession}
            disabled={isCreating}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white"
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Terminal className="w-4 h-4 mr-2" />
            )}
            {isCreating ? "Starting Session..." : "Start New Session"}
          </Button>

          {/* Fallback UI - CLI not installed */}
          {showFallback && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    SprintIQ CLI not running
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    Install the CLI and run <code className="font-mono">sprintiq watch</code> to launch
                    Claude Code sessions directly from your browser.
                  </p>
                </div>
              </div>

              <div className="bg-gray-900 rounded-md p-3 font-mono text-xs text-green-400 space-y-1">
                <p className="text-gray-500"># First time? Install the CLI</p>
                <p>$ npm install -g @sprintiq/cli</p>
                <p className="text-gray-500"># Then authenticate</p>
                <p>$ sprintiq auth login</p>
                <p className="text-gray-500"># Start the bridge from your project root</p>
                <p>$ cd your-project</p>
                <p>$ sprintiq watch</p>
                <p className="text-gray-500"># Or specify the directory explicitly</p>
                <p>$ sprintiq watch --dir /path/to/your-project</p>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                Once set up, run{" "}
                <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">sprintiq watch</code>
                {" "}from your project directory before clicking Start New Session.
                Verify with{" "}
                <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">curl localhost:19847/health</code>.
              </p>

              <div className="border-t border-amber-200 dark:border-amber-800 pt-2 mt-2 space-y-1">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  Troubleshooting
                </p>
                <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-disc pl-4">
                  <li>
                    <strong>claude not found:</strong> Claude Code must be installed globally
                    (<code className="font-mono text-[10px] bg-amber-100 dark:bg-amber-900/40 px-0.5 rounded">npm i -g @anthropic-ai/claude-code</code>)
                    and available in your PATH.
                  </li>
                  <li>
                    <strong>Mac/Linux:</strong> Uses <code className="font-mono text-[10px] bg-amber-100 dark:bg-amber-900/40 px-0.5 rounded">/bin/sh</code> to
                    launch. Ensure <code className="font-mono text-[10px] bg-amber-100 dark:bg-amber-900/40 px-0.5 rounded">claude</code> is
                    in your shell PATH (run <code className="font-mono text-[10px] bg-amber-100 dark:bg-amber-900/40 px-0.5 rounded">which claude</code> to verify).
                  </li>
                  <li>
                    <strong>Windows:</strong> Uses <code className="font-mono text-[10px] bg-amber-100 dark:bg-amber-900/40 px-0.5 rounded">cmd.exe</code> to
                    resolve npm shims. Run <code className="font-mono text-[10px] bg-amber-100 dark:bg-amber-900/40 px-0.5 rounded">where claude</code> to
                    verify it&apos;s installed.
                  </li>
                </ul>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyContext}
                className="w-full"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                )}
                {copied ? "Copied!" : "Copy Task Context"}
              </Button>
            </div>
          )}

          {/* Recent Sessions */}
          {sessions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Recent Sessions
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {sessions
                  .filter(
                    (s) => s.status !== "pending" && s.status !== "active"
                  )
                  .slice(0, 5)
                  .map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded text-xs"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full font-medium ${
                            statusColors[session.status] ?? statusColors.pending
                          }`}
                        >
                          {session.status}
                        </span>
                        {session.conflict_detected && !session.conflict_resolved_at && (
                          <span title="Conflict needs resolution">
                            <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
                          </span>
                        )}
                        {session.is_late_arrival && (
                          <span
                            className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-medium"
                            title="Late arrival"
                          >
                            late
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground">
                        {format(
                          parseISO(session.created_at ?? ''),
                          "MMM d 'at' h:mm a"
                        )}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
