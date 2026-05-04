"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
} from "lucide-react";
import type { DependencyRecommendation } from "@/types";
import { useDependencyAnalysis } from "@/hooks/useDependencyAnalysis";
import { CircularRiskAlert } from "./dependencies-display";
import type { Task } from "@/lib/database-aliases";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import { useQueryClient } from "@tanstack/react-query";

interface TaskDependencyAnalysisModalProps {
  tasks: Task[];
  workspaceId: string;
  projectId?: string;
  sprintId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (dependencies: DependencyRecommendation[]) => Promise<void>;
}

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

// Priority color mapping
const priorityColors: Record<string, string> = {
  critical: "border-red-500 text-red-600",
  high: "border-orange-500 text-orange-600",
  medium: "border-yellow-500 text-yellow-600",
  low: "border-green-500 text-green-600",
  urgent: "border-red-500 text-red-600",
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

export default function TaskDependencyAnalysisModal({
  tasks,
  workspaceId,
  projectId,
  sprintId,
  isOpen,
  onClose,
  onSave,
}: TaskDependencyAnalysisModalProps) {
  // Task selection state (for choosing which tasks to analyze)
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

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
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const { toast } = useEnhancedToast();
  const queryClient = useQueryClient();

  // FIXED: Use ref to track previous isOpen state to prevent render loops
  // The previous implementation had `tasks` in dependency array which caused
  // re-renders when tasks array reference changed (common with parent re-renders)
  const prevIsOpenRef = useRef(false);

  // Calculate total story points for selected tasks
  const totalPoints = useMemo(() => {
    return tasks
      .filter((t) => selectedTaskIds.includes(t.task_id || t.id))
      .reduce((sum, t) => sum + (t.story_points || 0), 0);
  }, [tasks, selectedTaskIds]);

  // Reset state when modal opens (only on open transition, not on tasks change)
  useEffect(() => {
    // Only initialize when transitioning from closed to open
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (isOpen && !wasOpen) {
      // Pre-select all tasks by default
      setSelectedTaskIds(tasks.map(t => t.task_id || t.id));
      resetAnalysis();
      setSelectedRecommendations(new Set());
      setError(null);
      setHasAnalyzed(false);
      setShowResults(false);
    }
  }, [isOpen, tasks, resetAnalysis]);

  const taskMap = new Map(tasks.map(t => [t.task_id || t.id, t]));

  // Toggle task selection
  const toggleTask = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
    // Reset analysis when selection changes
    if (hasAnalyzed) {
      setHasAnalyzed(false);
      setShowResults(false);
      resetAnalysis();
    }
  }, [hasAnalyzed, resetAnalysis]);

  // Select/deselect all tasks
  const handleSelectAllTasks = useCallback(() => {
    if (selectedTaskIds.length === tasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(tasks.map((t) => t.task_id || t.id));
    }
    // Reset analysis when selection changes
    if (hasAnalyzed) {
      setHasAnalyzed(false);
      setShowResults(false);
      resetAnalysis();
    }
  }, [selectedTaskIds.length, tasks, hasAnalyzed, resetAnalysis]);

  // React to hook results — when recommendations arrive, transition to results view
  useEffect(() => {
    if (recommendations.length > 0 && !showResults) {
      const highConfidence = recommendations
        .filter(r => r.confidence >= 80)
        .map(r => `${r.sourceTaskId}-${r.targetTaskId}`);
      setSelectedRecommendations(new Set(highConfidence));
      setHasAnalyzed(true);
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
      setError(null); // Clear any hard error
    }
  }, [analysisWarning]);

  const handleAnalyze = async () => {
    if (selectedTaskIds.length < 2) {
      setError("Select at least 2 tasks to analyze dependencies");
      return;
    }

    setError(null);

    // Enqueue + poll via hook (non-blocking)
    analyze(selectedTaskIds, workspaceId, projectId, sprintId);
  };

  const toggleRecommendation = (rec: DependencyRecommendation) => {
    const key = `${rec.sourceTaskId}-${rec.targetTaskId}`;
    setSelectedRecommendations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    const selectedDeps = recommendations.filter(
      r => selectedRecommendations.has(`${r.sourceTaskId}-${r.targetTaskId}`)
    );

    if (selectedDeps.length === 0) {
      setError("Select at least one dependency to save");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(selectedDeps);
      toast({
        title: "Dependencies saved",
        description: `Successfully saved ${selectedDeps.length} ${selectedDeps.length === 1 ? 'dependency' : 'dependencies'}.`,
      });
      onClose();
    } catch (err) {
      console.error("Error saving dependencies:", err);
      const message = err instanceof Error ? err.message : "Failed to save dependencies";
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

  // Select all/none for recommendations
  const selectAllRecommendations = () => {
    const allKeys = recommendations.map(r => `${r.sourceTaskId}-${r.targetTaskId}`);
    setSelectedRecommendations(new Set(allKeys));
  };

  const selectNoneRecommendations = () => {
    setSelectedRecommendations(new Set());
  };

  // Handle canceling results to go back to selection
  const handleCancelResults = () => {
    setShowResults(false);
    setHasAnalyzed(false);
    resetAnalysis();
    setSelectedRecommendations(new Set());
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { cancelAnalysis(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            Turbo Dependencies
          </DialogTitle>
          <DialogDescription>
            {showResults
              ? `Found ${recommendations.length} potential dependencies`
              : "Select tasks to analyze for dependencies"}
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
            {/* Task Selection - SCROLLABLE */}
            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Select Tasks</h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {tasks.length} available
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllTasks}
                    className="text-xs"
                  >
                    {selectedTaskIds.length === tasks.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                </div>
              </div>

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
                      selected={selectedTaskIds.includes(task.task_id || task.id)}
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
                    <strong>{selectedTaskIds.length}</strong> tasks selected
                  </span>
                  <span>
                    <strong>{totalPoints}</strong> total points
                  </span>
                </div>
                {selectedTaskIds.length >= 2 ? (
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
                disabled={selectedTaskIds.length < 2 || isAnalyzing}
                onClick={handleAnalyze}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing Dependencies...
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
                    The selected tasks appear to be independent and can be worked on in any order.
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
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCancelResults}
                >
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
                        <Check className="mr-2 h-4 w-4" />
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
