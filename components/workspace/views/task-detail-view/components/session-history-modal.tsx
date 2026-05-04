"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { getAvatarInitials } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SessionCompletionReport } from "./session-completion-report";
import {
  parseSessionMetrics,
  statusBadgeConfig,
  type SessionStatus,
} from "@/lib/types/claude-code-metrics";
import type { ClaudeCodeSession, Profile } from "@/lib/database-aliases";

interface SessionHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: ClaudeCodeSession[];
  workspaceMembers: Profile[];
  onCreateSubtask?: (name: string) => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}

export function SessionHistoryModal({
  open,
  onOpenChange,
  sessions,
  workspaceMembers,
  onCreateSubtask,
}: SessionHistoryModalProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Session History ({sessions.length})</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 mt-4">
          {sessions.map((session) => {
            const metrics = parseSessionMetrics(session.session_metrics);
            const member = workspaceMembers.find(
              (m) => m.id === session.user_id
            );
            const config =
              statusBadgeConfig[session.status as SessionStatus] ??
              statusBadgeConfig.pending;
            const isExpanded = expandedId === session.id;

            return (
              <div
                key={session.id}
                className="border workspace-border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : session.id)
                  }
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium",
                        config.color,
                        config.bgColor
                      )}
                    >
                      {config.label}
                    </span>

                    {member && (
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarImage
                            src={member.avatar_url ?? undefined}
                            alt={member.full_name ?? ""}
                          />
                          <AvatarFallback className="text-[10px] workspace-component-bg workspace-component-active-color">
                            {getAvatarInitials(
                              member.full_name,
                              member.email
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs">
                          {member.full_name ?? member.email}
                        </span>
                      </div>
                    )}

                    <span className="text-xs workspace-text-muted">
                      {formatDistanceToNow(new Date(session.started_at!), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs workspace-text-muted">
                    {metrics && (
                      <>
                        <span>{formatDuration(metrics.durationMs)}</span>
                        <span>{metrics.files.changed} files</span>
                      </>
                    )}
                  </div>
                </button>

                {isExpanded && metrics && (
                  <div className="px-3 pb-3 border-t workspace-border pt-3">
                    <SessionCompletionReport
                      metrics={metrics}
                      onCreateSubtask={onCreateSubtask}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
