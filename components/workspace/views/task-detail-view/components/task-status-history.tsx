"use client";

import {
  useTaskStatusHistory,
  formatTimeInStatus,
} from "@/hooks/useTaskStatusHistory";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  History,
  ArrowRight,
  User,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getAvatarInitials } from "@/lib/utils";
import { useState } from "react";
import { getStatusTypeCategory } from "@/lib/constants/statusTypes";

interface TaskStatusHistoryProps {
  taskId: string;
  maxEntries?: number;
}

/**
 * Get badge color classes based on status type
 */
function getStatusBadgeClasses(statusType: string | null): string {
  const category = getStatusTypeCategory(statusType);

  switch (category) {
    case "NOT_STARTED":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    case "COMPLETED":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case "BLOCKED":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
  }
}

export function TaskStatusHistory({
  taskId,
  maxEntries = 10,
}: TaskStatusHistoryProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { data: history, isLoading, error } = useTaskStatusHistory(taskId);

  // Loading state
  if (isLoading) {
    return (
      <Card className="group workspace-header-bg border workspace-border overflow-hidden">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-6 w-6 rounded-md" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 pl-4">
                <Skeleton className="h-3 w-3 rounded-full mt-1" />
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-3 w-3" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  // Error or empty state
  if (error || !history?.length) {
    return (
      <Card className="group workspace-header-bg border workspace-border overflow-hidden hover:border-purple-300/50 dark:hover:border-purple-600/50 transition-all duration-300">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-md flex items-center justify-center shadow-sm">
              <History className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold workspace-sidebar-text">
              Status History
            </span>
          </div>
          <p className="text-sm text-muted-foreground text-center py-4">
            No status changes recorded yet.
          </p>
        </div>
      </Card>
    );
  }

  const displayHistory = history.slice(0, maxEntries);
  const hasMore = history.length > maxEntries;

  return (
    <Card className="group workspace-header-bg border workspace-border overflow-hidden hover:border-purple-300/50 dark:hover:border-purple-600/50 transition-all duration-300 hover:shadow-md relative">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-indigo-50/50 dark:from-purple-900/10 dark:to-indigo-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <Collapsible open={!isCollapsed} onOpenChange={() => setIsCollapsed(!isCollapsed)}>
        <CollapsibleTrigger className="relative w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-md flex items-center justify-center shadow-sm">
              <History className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold workspace-sidebar-text">
              Status History
            </span>
            <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
              {history.length}
            </span>
          </div>
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4 workspace-sidebar-text" />
          ) : (
            <ChevronUp className="h-4 w-4 workspace-sidebar-text" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="relative px-4 pb-4">
            {/* Timeline line */}
            <div className="absolute left-[26px] top-0 bottom-4 w-px bg-gradient-to-b from-purple-300 to-purple-100 dark:from-purple-600 dark:to-purple-900" />

            <div className="space-y-4">
              {displayHistory.map((entry) => (
                <div key={entry.id} className="relative pl-8">
                  {/* Timeline dot */}
                  <div className="absolute left-[5px] top-1.5 w-3 h-3 rounded-full bg-background border-2 border-purple-500 dark:border-purple-400" />

                  <div className="flex flex-col gap-1.5">
                    {/* Status transition */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {entry.fromStatusName && (
                        <>
                          <Badge
                            variant="secondary"
                            className={`text-xs font-medium ${getStatusBadgeClasses(
                              entry.fromStatusType
                            )}`}
                          >
                            {entry.fromStatusName}
                          </Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        </>
                      )}
                      <Badge
                        variant="secondary"
                        className={`text-xs font-medium ${getStatusBadgeClasses(
                          entry.toStatusType
                        )}`}
                      >
                        {entry.toStatusName || "Unknown"}
                      </Badge>
                    </div>

                    {/* Metadata row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {/* Who changed it */}
                      {entry.changedBy ? (
                        <div className="flex items-center gap-1">
                          <Avatar className="h-4 w-4">
                            <AvatarImage
                              src={entry.changedBy.avatarUrl || undefined}
                            />
                            <AvatarFallback className="text-[8px] workspace-component-bg workspace-component-active-color">
                              {getAvatarInitials(entry.changedBy.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{entry.changedBy.fullName || "Unknown"}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>System</span>
                        </div>
                      )}

                      {/* When */}
                      <span>
                        {formatDistanceToNow(new Date(entry.changedAt!), {
                          addSuffix: true,
                        })}
                      </span>

                      {/* Time in previous status */}
                      {entry.timeInStatusMs !== null &&
                        entry.timeInStatusMs > 0 && (
                          <span className="flex items-center gap-1 text-muted-foreground/70">
                            <Clock className="h-3 w-3" />
                            {formatTimeInStatus(entry.timeInStatusMs)} in
                            previous
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <p className="text-xs text-muted-foreground text-center pt-3 mt-2 border-t workspace-border">
                Showing {maxEntries} of {history.length} status changes
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
