"use client";

import { useState, useEffect } from "react";
import {
  Check,
  X,
  AlertTriangle,
  Clock,
  Loader2,
  StopCircle,
  History,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { getAvatarInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SessionMetricsStrip } from "./session-metrics-strip";
import { SessionCompletionReport } from "./session-completion-report";
import {
  parseSessionMetrics,
  isStaleHeartbeat,
  statusBadgeConfig,
  type SessionStatus,
} from "@/lib/types/claude-code-metrics";
import type { ClaudeCodeSession, Profile } from "@/lib/database-aliases";

interface ClaudeCodeSessionCardProps {
  sessions: ClaudeCodeSession[];
  activeSessions: ClaudeCodeSession[];
  workspaceMembers: Profile[];
  onViewHistory: () => void;
  onCreateSubtask?: (name: string) => void;
}

const statusIcons: Record<string, React.ReactNode> = {
  spinner: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  check: <Check className="h-3.5 w-3.5" />,
  x: <X className="h-3.5 w-3.5" />,
  alert: <AlertTriangle className="h-3.5 w-3.5" />,
  clock: <Clock className="h-3.5 w-3.5" />,
  stop: <StopCircle className="h-3.5 w-3.5" />,
};

function StatusBadge({ status }: { status: string }) {
  const config = statusBadgeConfig[status as SessionStatus] ?? statusBadgeConfig.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        config.color,
        config.bgColor
      )}
    >
      {config.pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              config.color === "text-green-600" ? "bg-green-400" : "bg-yellow-400"
            )}
          />
          <span
            className={cn(
              "relative inline-flex rounded-full h-2 w-2",
              config.color === "text-green-600" ? "bg-green-500" : "bg-yellow-500"
            )}
          />
        </span>
      )}
      {!config.pulse && statusIcons[config.icon]}
      {config.label}
    </span>
  );
}

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="text-xs workspace-text-muted">
      {formatDistanceToNow(new Date(startedAt), { addSuffix: false })}
    </span>
  );
}

function ActiveSessionContent({
  session,
  member,
}: {
  session: ClaudeCodeSession;
  member?: Profile;
}) {
  const metrics = parseSessionMetrics(session.session_metrics);
  const stale = isStaleHeartbeat(session);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={session.status} />
          {member && (
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarImage src={member.avatar_url ?? undefined} alt={member.full_name ?? ""} />
                <AvatarFallback className="text-[10px] workspace-component-bg workspace-component-active-color">
                  {getAvatarInitials(member.full_name, member.email)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">{member.full_name ?? member.email}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs workspace-text-muted">
            Started {formatDistanceToNow(new Date(session.started_at!), { addSuffix: true })}
          </span>
          <ElapsedTimer startedAt={session.started_at ?? ''} />
        </div>
      </div>

      {metrics && <SessionMetricsStrip metrics={metrics} />}

      {stale && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-500/10 px-2.5 py-1.5 rounded-md">
          <AlertCircle className="h-3.5 w-3.5" />
          No heartbeat received for over 2 minutes
        </div>
      )}
    </div>
  );
}

function CompletedSessionContent({
  session,
  member,
  onCreateSubtask,
}: {
  session: ClaudeCodeSession;
  member?: Profile;
  onCreateSubtask?: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const metrics = parseSessionMetrics(session.session_metrics);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={session.status} />
          {member && (
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarImage src={member.avatar_url ?? undefined} alt={member.full_name ?? ""} />
                <AvatarFallback className="text-[10px] workspace-component-bg workspace-component-active-color">
                  {getAvatarInitials(member.full_name, member.email)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">{member.full_name ?? member.email}</span>
            </div>
          )}
        </div>
        <span className="text-xs workspace-text-muted">
          {session.completed_at
            ? formatDistanceToNow(new Date(session.completed_at!), { addSuffix: true })
            : formatDistanceToNow(new Date(session.updated_at!), { addSuffix: true })}
        </span>
      </div>

      {metrics && <SessionMetricsStrip metrics={metrics} />}

      {metrics && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 workspace-text-muted"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide Details" : "View Details"}
          </Button>
          {expanded && (
            <div className="mt-3 pt-3 border-t workspace-border">
              <SessionCompletionReport
                metrics={metrics}
                onCreateSubtask={onCreateSubtask}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ClaudeCodeSessionCard({
  sessions,
  activeSessions: _activeSessions,
  workspaceMembers,
  onViewHistory,
  onCreateSubtask,
}: ClaudeCodeSessionCardProps) {
  if (sessions.length === 0) return null;

  const latestSession = sessions[0];
  const isActive =
    latestSession.status === "active" || latestSession.status === "pending";
  const member = workspaceMembers.find((m) => m.id === latestSession.user_id);

  return (
    <div className="mt-4 px-4 md:px-6">
      <div className="border workspace-border rounded-lg p-4 workspace-secondary-sidebar-bg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <Loader2 className={cn("h-4 w-4", isActive ? "animate-spin text-green-500" : "text-gray-400")} />
            Claude Code Session
          </h4>
          {sessions.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2 workspace-text-muted"
              onClick={onViewHistory}
            >
              <History className="h-3.5 w-3.5 mr-1" />
              View History ({sessions.length})
            </Button>
          )}
        </div>

        {isActive ? (
          <ActiveSessionContent session={latestSession} member={member} />
        ) : (
          <CompletedSessionContent
            session={latestSession}
            member={member}
            onCreateSubtask={onCreateSubtask}
          />
        )}
      </div>
    </div>
  );
}
