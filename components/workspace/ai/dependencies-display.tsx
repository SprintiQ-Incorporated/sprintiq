"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  GitBranch,
  ArrowRight,
  ArrowLeft,
  Link2,
  X,
  AlertTriangle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { csrfFetch } from "@/hooks/useCsrfFetch";
import type { CircularRiskWarning } from "@/types";
import { cn } from "@/lib/utils";

export interface TaskDependency {
  id: string;
  sourceTaskId: string;
  sourceTaskName: string;
  sourceTaskUrlId: string; // task_id for URL routing
  targetTaskId: string;
  targetTaskName: string;
  targetTaskUrlId: string; // task_id for URL routing
  dependencyType: "blocks" | "is_blocked_by" | "relates_to";
  reason?: string;
  confidence?: number;
}

interface DependenciesDisplayProps {
  taskId: string;
  taskName: string;
  workspaceId: string;
  compact?: boolean;
  showAIButton?: boolean;
  onAnalyzeWithAI?: () => void;
  onDependencyChange?: () => void;
  className?: string;
}

const dependencyTypeConfig = {
  blocks: {
    label: "Blocks",
    icon: ArrowRight,
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    description: "This task must be completed first",
  },
  is_blocked_by: {
    label: "Blocked by",
    icon: ArrowLeft,
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    description: "This task is waiting on another task",
  },
  relates_to: {
    label: "Related to",
    icon: Link2,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    description: "These tasks are related",
  },
};

export function DependenciesDisplay({
  taskId,
  taskName: _taskName,
  workspaceId,
  compact = false,
  showAIButton = false,
  onAnalyzeWithAI,
  onDependencyChange,
  className,
}: DependenciesDisplayProps) {
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    fetchDependencies();
  }, [taskId]);

  const fetchDependencies = async () => {
    setLoading(true);
    try {
      const supabase = createClientSupabaseClient();

      // Fetch dependencies where this task is either source or target
      const { data: deps, error } = await supabase
        .from("task_dependencies")
        .select("*")
        .or(`source_task_id.eq.${taskId},target_task_id.eq.${taskId}`);

      if (error) {
        // Table might not exist yet - this is fine, just show empty
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setDependencies([]);
          setLoading(false);
          return;
        }
        console.error("Error fetching dependencies:", error);
        setDependencies([]);
        return;
      }

      if (!deps || deps.length === 0) {
        setDependencies([]);
        setLoading(false);
        return;
      }

      // Collect all unique task IDs to fetch their names
      const taskIds = new Set<string>();
      deps.forEach((dep: any) => {
        taskIds.add(dep.source_task_id);
        taskIds.add(dep.target_task_id);
      });

      // Fetch task names for all related tasks
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select("id, name, task_id")
        .in("id", Array.from(taskIds));

      // Create a map of task ID to task info
      const taskMap = new Map<string, { name: string; task_id: string }>();
      if (!tasksError && tasks) {
        tasks.forEach((task: any) => {
          taskMap.set(task.id, { name: task.name, task_id: task.task_id || task.id });
        });
      }

      // Transform the data with actual task names
      const transformedDeps: TaskDependency[] = deps.map((dep: any) => {
        const sourceTask = taskMap.get(dep.source_task_id);
        const targetTask = taskMap.get(dep.target_task_id);

        return {
          id: dep.id,
          sourceTaskId: dep.source_task_id,
          sourceTaskName: sourceTask?.name || dep.source_task_id,
          sourceTaskUrlId: sourceTask?.task_id || dep.source_task_id,
          targetTaskId: dep.target_task_id,
          targetTaskName: targetTask?.name || dep.target_task_id,
          targetTaskUrlId: targetTask?.task_id || dep.target_task_id,
          dependencyType: dep.dependency_type,
          reason: dep.reason,
          confidence: dep.confidence,
        };
      });

      setDependencies(transformedDeps);
    } catch (error) {
      console.error("Error fetching dependencies:", error);
      setDependencies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDependency = async (depId: string) => {
    setRemoving(depId);
    try {
      const response = await csrfFetch(`/api/workspace/${workspaceId}/dependencies/save`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependencyIds: [depId] }),
      });

      if (response.ok) {
        setDependencies(deps => deps.filter(d => d.id !== depId));
        onDependencyChange?.();
      }
    } catch (error) {
      console.error("Error removing dependency:", error);
    } finally {
      setRemoving(null);
    }
  };

  // Categorize dependencies
  // Tasks that THIS task blocks (this task is the blocker/source, must complete first)
  // When source=thisTask and type="blocks", this task blocks the target tasks
  const tasksThisBlocks = dependencies.filter(
    d => d.sourceTaskId === taskId && d.dependencyType === "blocks"
  );
  // Tasks that BLOCK this task (this task is blocked/target, waiting on others)
  // When target=thisTask and type="blocks", the source tasks block this task
  const tasksBlockingThis = dependencies.filter(
    d => d.targetTaskId === taskId && d.dependencyType === "blocks"
  );
  // Also check for explicit "is_blocked_by" type (legacy support)
  const legacyBlockedBy = dependencies.filter(
    d => d.sourceTaskId === taskId && d.dependencyType === "is_blocked_by"
  );
  const relatedTasks = dependencies.filter(
    d => d.dependencyType === "relates_to"
  );

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading dependencies...</span>
      </div>
    );
  }

  if (compact) {
    return (
      <TooltipProvider>
        <div className={cn("flex items-center gap-2", className)}>
          {dependencies.length > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="flex items-center gap-1 cursor-help">
                  <GitBranch className="h-3 w-3" />
                  {dependencies.length}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-1">
                  {tasksBlockingThis.length > 0 && (
                    <p className="text-xs">
                      <span className="font-medium text-orange-500">Blocked by:</span>{" "}
                      {tasksBlockingThis.map(d => d.sourceTaskName).join(", ")}
                    </p>
                  )}
                  {tasksThisBlocks.length > 0 && (
                    <p className="text-xs">
                      <span className="font-medium text-red-500">Blocks:</span>{" "}
                      {tasksThisBlocks.map(d => d.targetTaskName).join(", ")}
                    </p>
                  )}
                  {legacyBlockedBy.length > 0 && (
                    <p className="text-xs">
                      <span className="font-medium text-orange-500">Blocked by:</span>{" "}
                      {legacyBlockedBy.map(d => d.targetTaskName).join(", ")}
                    </p>
                  )}
                  {relatedTasks.length > 0 && (
                    <p className="text-xs">
                      <span className="font-medium text-blue-500">Related:</span>{" "}
                      {relatedTasks.map(d =>
                        d.sourceTaskId === taskId ? d.targetTaskName : d.sourceTaskName
                      ).join(", ")}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ) : showAIButton ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={onAnalyzeWithAI}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Analyze
            </Button>
          ) : null}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">Dependencies</h4>
          {dependencies.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {dependencies.length}
            </Badge>
          )}
        </div>
        {showAIButton && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onAnalyzeWithAI}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            AI Analyze
          </Button>
        )}
      </div>

      {dependencies.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No dependencies defined for this task.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Tasks that block THIS task (upstream blockers) */}
          {tasksBlockingThis.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" />
                This task is blocked by:
              </p>
              {tasksBlockingThis.map(dep => (
                <DependencyItem
                  key={dep.id}
                  dependency={dep}
                  taskName={dep.sourceTaskName}
                  taskUrlId={dep.sourceTaskUrlId}
                  workspaceId={workspaceId}
                  type="is_blocked_by"
                  removing={removing === dep.id}
                  onRemove={() => handleRemoveDependency(dep.id)}
                />
              ))}
            </div>
          )}

          {/* Tasks that THIS task blocks (downstream dependencies) */}
          {tasksThisBlocks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                <ArrowRight className="h-3 w-3" />
                This task blocks:
              </p>
              {tasksThisBlocks.map(dep => (
                <DependencyItem
                  key={dep.id}
                  dependency={dep}
                  taskName={dep.targetTaskName}
                  taskUrlId={dep.targetTaskUrlId}
                  workspaceId={workspaceId}
                  type="blocks"
                  removing={removing === dep.id}
                  onRemove={() => handleRemoveDependency(dep.id)}
                />
              ))}
            </div>
          )}

          {/* Legacy blocked by tasks (for backwards compatibility) */}
          {legacyBlockedBy.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" />
                This task is blocked by:
              </p>
              {legacyBlockedBy.map(dep => (
                <DependencyItem
                  key={dep.id}
                  dependency={dep}
                  taskName={dep.targetTaskName}
                  taskUrlId={dep.targetTaskUrlId}
                  workspaceId={workspaceId}
                  type="is_blocked_by"
                  removing={removing === dep.id}
                  onRemove={() => handleRemoveDependency(dep.id)}
                />
              ))}
            </div>
          )}

          {/* Related Tasks */}
          {relatedTasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                Related to:
              </p>
              {relatedTasks.map(dep => (
                <DependencyItem
                  key={dep.id}
                  dependency={dep}
                  taskName={dep.sourceTaskId === taskId ? dep.targetTaskName : dep.sourceTaskName}
                  taskUrlId={dep.sourceTaskId === taskId ? dep.targetTaskUrlId : dep.sourceTaskUrlId}
                  workspaceId={workspaceId}
                  type="relates_to"
                  removing={removing === dep.id}
                  onRemove={() => handleRemoveDependency(dep.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface DependencyItemProps {
  dependency: TaskDependency;
  taskName: string;
  taskUrlId: string;
  workspaceId: string;
  type: "blocks" | "is_blocked_by" | "relates_to";
  removing: boolean;
  onRemove: () => void;
}

function DependencyItem({ dependency, taskName, taskUrlId, workspaceId, type, removing, onRemove }: DependencyItemProps) {
  const config = dependencyTypeConfig[type];

  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 group">
      <div className="flex items-center gap-2 min-w-0">
        <config.icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        <Link
          href={`/${workspaceId}/task/${taskUrlId}`}
          className="text-sm truncate hover:text-primary hover:underline transition-colors"
        >
          {taskName}
        </Link>
        {dependency.confidence && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {dependency.confidence}%
          </Badge>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onRemove}
        disabled={removing}
      >
        {removing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <X className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
}

// Compact badge for use in task cards/list views
export function DependencyBadge({
  taskId,
  className,
}: {
  taskId: string;
  className?: string;
}) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const supabase = createClientSupabaseClient();
        const { count: depCount, error } = await supabase
          .from("task_dependencies")
          .select("*", { count: "exact", head: true })
          .or(`source_task_id.eq.${taskId},target_task_id.eq.${taskId}`);

        if (!error && depCount !== null) {
          setCount(depCount);
        } else {
          // Table might not exist or other error - just show nothing
          setCount(0);
        }
      } catch {
        // Silently fail if table doesn't exist
        setCount(0);
      }
    };

    fetchCount();
  }, [taskId]);

  if (count === null || count === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "flex items-center gap-1 cursor-help text-xs",
              className
            )}
          >
            <GitBranch className="h-3 w-3" />
            {count}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{count} dependencies</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Circular risk warning component
export function CircularRiskAlert({
  warnings,
  className,
}: {
  warnings: CircularRiskWarning[];
  className?: string;
}) {
  if (warnings.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {warnings.map((warning, index) => (
        <div
          key={index}
          className={cn(
            "flex items-start gap-2 p-3 rounded-md",
            warning.severity === "high"
              ? "bg-red-100 dark:bg-red-900/30"
              : warning.severity === "medium"
              ? "bg-orange-100 dark:bg-orange-900/30"
              : "bg-yellow-100 dark:bg-yellow-900/30"
          )}
        >
          <AlertTriangle
            className={cn(
              "h-4 w-4 flex-shrink-0 mt-0.5",
              warning.severity === "high"
                ? "text-red-600"
                : warning.severity === "medium"
                ? "text-orange-600"
                : "text-yellow-600"
            )}
          />
          <div className="space-y-1">
            <p className="text-sm font-medium">{warning.description}</p>
            <p className="text-xs text-muted-foreground">
              {warning.suggestedResolution}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default DependenciesDisplay;
