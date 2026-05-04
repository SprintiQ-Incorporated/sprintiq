"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Link2,
  AlertTriangle,
  Check,
  Sparkles,
  ChevronUp,
  ChevronDown,
  CheckCircle,
  XCircle,
  Save,
  GitBranch,
} from "lucide-react";
import type { DependencyRecommendation } from "@/types";
import { useDependencyAnalysis } from "@/hooks/useDependencyAnalysis";
import { CircularRiskAlert } from "./dependencies-display";
import type { Task } from "@/lib/database-aliases";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import { useQueryClient } from "@tanstack/react-query";
import { csrfFetch } from "@/hooks/useCsrfFetch";

interface TurboDependenciesModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  projectId: string;
  workspaceId: string;
  sprintId?: string;
}

// Priority color mapping for badges
const priorityColors: Record<string, string> = {
  critical: "border-red-500 text-red-600",
  high: "border-orange-500 text-orange-600",
  medium: "border-yellow-500 text-yellow-600",
  low: "border-green-500 text-green-600",
  urgent: "border-red-500 text-red-600",
};

// Dependency type configuration
const dependencyTypeIcons = {
  blocks: ArrowRight,
  is_blocked_by: ArrowLeft,
  relates_to: Link2,
};

const dependencyTypeLabels = {
  blocks: "blocks",
  is_blocked_by: "is blocked by",
  relates_to: "relates to",
};

// Task Selection Card Component (matches Sprint Planner pattern)
function TaskSelectionCard({
  task,
  selected,
  onToggle,
}: {
  task: Task;
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const priority = (task.priority || "medium").toLowerCase();
  const priorityColorClass = priorityColors[priority] || priorityColors.medium;

  return (
    <div
      className={cn(
        "border rounded-lg p-3 cursor-pointer transition-all",
        selected
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
          : "hover:border-muted-foreground/30"
      )}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <Checkbox checked={selected} className="mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium truncate">{task.name}</h4>
            <Badge variant="secondary" className="shrink-0">
              {task.story_points || 0} SP
            </Badge>
            {task.priority && (
              <Badge
                variant="outline"
                className={cn("shrink-0 text-xs capitalize", priorityColorClass)}
              >
                {task.priority}
              </Badge>
            )}
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {task.description}
            </p>
          )}
          {expanded && task.description && (
            <div className="mt-2 text-sm text-muted-foreground">
              <p className="font-medium text-xs mb-1">Full Description:</p>
              <p className="text-xs whitespace-pre-wrap">{task.description}</p>
            </div>
          )}
        </div>
        {task.description && task.description.length > 60 && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export function TurboDependenciesModal({
  isOpen,
  onClose,
  tasks,
  projectId,
  workspaceId,
  sprintId,
}: TurboDependenciesModalProps) {
  // Task selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Analysis state (delegated to async hook)
  const {
    isAnalyzing,
    recommendations,
    circularRisks,
    error: analysisError,
    warning: analysisWarning,
    analyze,
    cancel: cancelAnalysis,
    reset: resetAnalysis,
  } = useDependencyAnalysis();

  const [isSaving, setIsSaving] = useState(false);
  const [selectedRecommendations, setSelectedRecommendations] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const { toast } = useEnhancedToast();
  const queryClient = useQueryClient();

  // Calculate if all tasks are selected
  const allSelected = selectedIds.size === tasks.length && tasks.length > 0;

  // Calculate total story points for selected tasks
  const totalPoints = useMemo(() => {
    return tasks
      .filter((t) => selectedIds.has(t.task_id || t.id))
      .reduce((sum, t) => sum + (t.story_points || 0), 0);
  }, [tasks, selectedIds]);

  // Task map for quick lookups
  const taskMap = useMemo(() => {
    return new Map(tasks.map((t) => [t.task_id || t.id, t]));
  }, [tasks]);

  // Reset state when modal opens with new tasks
  useEffect(() => {
    if (isOpen) {
      // Pre-select all tasks by default
      setSelectedIds(new Set(tasks.map((t) => t.task_id || t.id)));
      resetAnalysis();
      setSelectedRecommendations(new Set());
      setError(null);
      setShowResults(false);
    }
  }, [isOpen, tasks, resetAnalysis]);

  // Toggle all tasks selection
  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map((t) => t.task_id || t.id)));
    }
    // Reset analysis when selection changes
    if (showResults) {
      setShowResults(false);
      resetAnalysis();
      setSelectedRecommendations(new Set());
    }
  }, [allSelected, tasks, showResults, resetAnalysis]);

  // Toggle single task selection
  const toggleTask = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      setSelectedIds(next);
      // Reset analysis when selection changes
      if (showResults) {
        setShowResults(false);
        resetAnalysis();
        setSelectedRecommendations(new Set());
      }
    },
    [selectedIds, showResults, resetAnalysis]
  );

  // React to hook results — when recommendations arrive, transition to results view
  useEffect(() => {
    if (recommendations.length > 0 && !showResults) {
      const highConfidence = recommendations
        .filter((r) => r.confidence >= 80)
        .map((r) => `${r.sourceTaskId}-${r.targetTaskId}`);
      setSelectedRecommendations(new Set(highConfidence));
      setShowResults(true);

    }
  }, [recommendations, circularRisks, showResults, projectId, queryClient]);

  // React to analysis errors from the hook
  useEffect(() => {
    if (analysisError) {
      setError(analysisError);
    }
  }, [analysisError]);

  // React to non-blocking warnings
  useEffect(() => {
    if (analysisWarning) {
      setError(null);
    }
  }, [analysisWarning]);

  // Analyze dependencies
  const handleAnalyze = async () => {
    if (selectedIds.size < 2) {
      setError("Select at least 2 tasks to analyze dependencies");
      return;
    }

    setError(null);

    // Enqueue + poll via hook (non-blocking)
    analyze(Array.from(selectedIds), workspaceId, projectId, sprintId);
  };

  // Toggle recommendation selection
  const toggleRecommendation = (rec: DependencyRecommendation) => {
    const key = `${rec.sourceTaskId}-${rec.targetTaskId}`;
    setSelectedRecommendations((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Select all/none for recommendations
  const selectAllRecommendations = () => {
    const allKeys = recommendations.map(
      (r) => `${r.sourceTaskId}-${r.targetTaskId}`
    );
    setSelectedRecommendations(new Set(allKeys));
  };

  const selectNoneRecommendations = () => {
    setSelectedRecommendations(new Set());
  };

  // Save dependencies
  const handleSave = async () => {
    const selectedDeps = recommendations.filter((r) =>
      selectedRecommendations.has(`${r.sourceTaskId}-${r.targetTaskId}`)
    );

    if (selectedDeps.length === 0) {
      setError("Select at least one dependency to save");
      return;
    }

    setIsSaving(true);
    try {
      const response = await csrfFetch(
        `/api/workspace/${workspaceId}/dependencies/save`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependencies: selectedDeps }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save dependencies");
      }

      toast({
        title: "Dependencies saved",
        description: `Successfully saved ${selectedDeps.length} ${
          selectedDeps.length === 1 ? "dependency" : "dependencies"
        }.`,
      });
      onClose();
    } catch (err) {
      console.error("Error saving dependencies:", err);
      const message =
        err instanceof Error ? err.message : "Failed to save dependencies";
      setError(message);
      toast({
        title: "Failed to save dependencies",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Go back to selection view
  const handleBack = () => {
    setShowResults(false);
    resetAnalysis();
    setSelectedRecommendations(new Set());
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { cancelAnalysis(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-emerald-500" />
            Turbo Dependencies
          </DialogTitle>
          <DialogDescription>
            {showResults
              ? `Found ${recommendations.length} potential dependencies`
              : `Analyze ${tasks.length} tasks for dependencies`}
          </DialogDescription>
        </DialogHeader>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Non-blocking warning (analysis failed but modal stays usable) */}
        {analysisWarning && !error && (
          <div className="mx-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-600 dark:text-amber-400">{analysisWarning}</p>
          </div>
        )}

        {/* Task Selection View */}
        {!showResults && (
          <>
            {/* Selection Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-2 border-b">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} of {tasks.length} selected
              </span>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>

            {/* Task List - SCROLLABLE */}
            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No tasks available.</p>
                  <p className="text-sm mt-1">
                    Add some tasks first to analyze dependencies.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <TaskSelectionCard
                      key={task.id}
                      task={task}
                      selected={selectedIds.has(task.task_id || task.id)}
                      onToggle={() => toggleTask(task.task_id || task.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Summary Footer - FIXED BOTTOM */}
            <div className="flex-shrink-0 border-t px-6 py-4 bg-background">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4 sm:gap-6 text-sm flex-wrap">
                  <span>
                    <strong>{selectedIds.size}</strong> tasks selected
                  </span>
                  <span>
                    <strong>{totalPoints}</strong> total points
                  </span>
                </div>
                {selectedIds.size >= 2 ? (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Ready to analyze
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <XCircle className="h-4 w-4" />
                    Need at least 2 tasks
                  </div>
                )}
              </div>

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                size="lg"
                disabled={selectedIds.size < 2 || isAnalyzing}
                onClick={handleAnalyze}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Turbo
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {/* Results View */}
        {showResults && (
          <>
            {/* Circular Risk Warnings */}
            {circularRisks.length > 0 && (
              <div className="px-6">
                <CircularRiskAlert warnings={circularRisks} />
              </div>
            )}

            {/* Recommendations - SCROLLABLE */}
            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
              {recommendations.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">
                      Dependencies Found ({recommendations.length})
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectAllRecommendations}
                        className="text-xs"
                      >
                        Select All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectNoneRecommendations}
                        className="text-xs"
                      >
                        Select None
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {recommendations.map((rec) => {
                      const key = `${rec.sourceTaskId}-${rec.targetTaskId}`;
                      const isSelected = selectedRecommendations.has(key);
                      const sourceTask = taskMap.get(rec.sourceTaskId);
                      const targetTask = taskMap.get(rec.targetTaskId);
                      const Icon = dependencyTypeIcons[rec.dependencyType];

                      return (
                        <div
                          key={key}
                          className={cn(
                            "p-3 rounded-lg border transition-colors cursor-pointer",
                            isSelected
                              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
                              : "hover:border-muted-foreground/30"
                          )}
                          onClick={() => toggleRecommendation(rec)}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleRecommendation(rec)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm truncate max-w-[180px]">
                                  {sourceTask?.name || rec.sourceTaskId}
                                </span>
                                <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                                  <Icon className="w-3 h-3" />
                                  <span className="text-xs">
                                    {dependencyTypeLabels[rec.dependencyType]}
                                  </span>
                                </div>
                                <span className="font-medium text-sm truncate max-w-[180px]">
                                  {targetTask?.name || rec.targetTaskId}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {rec.reason}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    rec.confidence >= 90
                                      ? "border-green-500 text-green-600"
                                      : rec.confidence >= 80
                                      ? "border-blue-500 text-blue-600"
                                      : "border-orange-500 text-orange-600"
                                  )}
                                >
                                  {rec.confidence}% confidence
                                </Badge>
                                {rec.suggestedOrder && (
                                  <Badge variant="secondary" className="text-xs">
                                    Order: {rec.suggestedOrder}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Check className="w-12 h-12 text-green-500 mb-4" />
                  <h4 className="font-medium mb-2">No Dependencies Detected</h4>
                  <p className="text-sm text-muted-foreground">
                    The selected tasks appear to be independent and can be worked
                    on in any order.
                  </p>
                </div>
              )}
            </div>

            {/* Save Confirmation Footer - FIXED BOTTOM */}
            <div className="flex-shrink-0 border-t px-6 py-4 bg-background">
              {recommendations.length > 0 && (
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm">
                    <strong>{selectedRecommendations.size}</strong> of{" "}
                    {recommendations.length} dependencies selected to save
                  </span>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleBack}>
                  Back
                </Button>
                {recommendations.length > 0 ? (
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={isSaving || selectedRecommendations.size === 0}
                    onClick={handleSave}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Dependencies
                      </>
                    )}
                  </Button>
                ) : (
                  <Button className="flex-1" onClick={onClose}>
                    Done
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default TurboDependenciesModal;
