"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Check,
  X,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  Loader2,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PriorityBadge, PriorityLevel } from "@/components/workspace/shared/priority-badge";
import { useQueryClient } from "@tanstack/react-query";
import { fetchWithCsrf } from "@/lib/csrf-client";
import { csrfFetch } from "@/hooks/useCsrfFetch";
import { createClientSupabaseClient } from "@/lib/supabase/client";

// Types
interface PriorityRecommendation {
  id: string;
  task_id: string;
  title: string;
  current_priority: string | null;
  recommended_priority: PriorityLevel;
  confidence: number;
  reasoning: string;
  factors: {
    business_value: number;
    user_impact: number;
    complexity: number;
    risk: number;
    dependencies: number;
  };
}

interface PriorityUpdate {
  id: string;
  task_id: string;
  priority: PriorityLevel;
  ai_confidence: number;
  ai_reasoning: string;
}

interface RecommendationState {
  accepted: boolean;
  skipped: boolean;
}

interface AIPriorityRecommendationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  sprintId?: string;
  onPrioritiesApplied?: (updates: PriorityUpdate[]) => void;
}

export function AIPriorityRecommendationsModal({
  isOpen,
  onClose,
  projectId,
  sprintId,
  onPrioritiesApplied,
}: AIPriorityRecommendationsModalProps) {
  const params = useParams();
  const workspaceId = (params?.workspaceId as string) || "";
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<PriorityRecommendation[]>([]);
  const [states, setStates] = useState<Record<string, RecommendationState>>({});

  // Apply result data to component state
  const applyResultData = useCallback((recs: PriorityRecommendation[]) => {
    setRecommendations(recs);
    const initialStates: Record<string, RecommendationState> = {};
    recs.forEach((rec: PriorityRecommendation) => {
      initialStates[rec.id] = { accepted: false, skipped: false };
    });
    setStates(initialStates);
  }, []);

  // Fetch recommendations
  const fetchRecommendations = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    setError(null);

    // Resolve workspace UUID from slug for tracking
    const supabase = createClientSupabaseClient();
    const { data: _workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    try {
      const params = new URLSearchParams();
      if (projectId) params.set("projectId", projectId);
      if (sprintId) params.set("sprintId", sprintId);

      const response = await csrfFetch(
        `/api/workspace/${workspaceId}/ai/priority-recommendations?${params.toString()}`
      );

      if (response.status !== 200 && response.status !== 202) {
        throw new Error("Failed to fetch recommendations");
      }

      const data = await response.json();

      // 200 = cache hit — data is immediately available
      if (response.status === 200 && data.success && data.data?.recommendations) {
        const recs = data.data.recommendations as PriorityRecommendation[];
        applyResultData(recs);

        queryClient.invalidateQueries({
          queryKey: ['project-ai-tool-status', projectId],
        });
        setIsLoading(false);
        return;
      }

      // 202 = cache miss, task enqueued — poll for result
      if (response.status === 202 && data.taskId) {
        const POLL_INTERVAL = 2000;
        const MAX_POLLS = 30;

        const poll = async (): Promise<boolean> => {
          try {
            const pollRes = await fetch(`/api/tasks/${data.taskId}`);
            if (!pollRes.ok) return false;

            const pollData = await pollRes.json();
            if (pollData.status === "complete" && pollData.result) {
              const recs = (pollData.result.recommendations || []) as PriorityRecommendation[];
              applyResultData(recs);

              queryClient.invalidateQueries({
                queryKey: ['project-ai-tool-status', projectId],
              });
              return true;
            }
            if (pollData.status === "failed") {
              throw new Error(pollData.error || "Analysis failed. Please try again.");
            }
          } catch (e) {
            if (e instanceof Error && e.message !== "Analysis failed. Please try again.") {
              return false;
            }
            throw e;
          }
          return false;
        };

        for (let i = 0; i < MAX_POLLS; i++) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL));
          const done = await poll();
          if (done) {
            setIsLoading(false);
            return;
          }
        }

        // Polling budget exhausted
        setError(
          "Analysis is still processing. Click Try Again to check for results."
        );
        setIsLoading(false);
        return;
      }

      throw new Error(data.error || "Failed to fetch recommendations");
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      setIsLoading(false);
    }
  }, [workspaceId, projectId, sprintId, queryClient, applyResultData]);

  // Fetch on open
  useEffect(() => {
    if (isOpen && workspaceId) {
      fetchRecommendations();
    }
  }, [isOpen, workspaceId, fetchRecommendations]);

  // Action handlers
  const handleAccept = useCallback((id: string) => {
    setStates((prev) => ({
      ...prev,
      [id]: { accepted: true, skipped: false },
    }));
  }, []);

  const handleSkip = useCallback((id: string) => {
    setStates((prev) => ({
      ...prev,
      [id]: { accepted: false, skipped: true },
    }));
  }, []);

  const handleUndo = useCallback((id: string) => {
    setStates((prev) => ({
      ...prev,
      [id]: { accepted: false, skipped: false },
    }));
  }, []);

  const handleAcceptAll = useCallback(() => {
    const newStates: Record<string, RecommendationState> = {};
    recommendations.forEach((rec) => {
      newStates[rec.id] = { accepted: true, skipped: false };
    });
    setStates(newStates);
  }, [recommendations]);

  const handleReanalyze = useCallback(() => {
    // Clear states and refetch
    setStates({});
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Apply accepted recommendations
  const handleApply = useCallback(async () => {
    const acceptedRecs = recommendations.filter((rec) => states[rec.id]?.accepted);

    if (acceptedRecs.length === 0) return;

    setIsApplying(true);

    try {
      const response = await fetchWithCsrf(
        `/api/workspace/${workspaceId}/ai/priority-recommendations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recommendations: acceptedRecs.map((rec) => ({
              id: rec.id,
              priority: rec.recommended_priority,
              confidence: rec.confidence,
              reasoning: rec.reasoning,
            })),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to apply recommendations");
      }

      const data = await response.json();

      if (data.success) {
        // Build updates for callback
        const updates: PriorityUpdate[] = acceptedRecs.map((rec) => ({
          id: rec.id,
          task_id: rec.task_id,
          priority: rec.recommended_priority,
          ai_confidence: rec.confidence,
          ai_reasoning: rec.reasoning,
        }));

        onPrioritiesApplied?.(updates);
        onClose();
      } else {
        throw new Error(data.error || "Failed to apply recommendations");
      }
    } catch (err) {
      console.error("Error applying recommendations:", err);
      setError(err instanceof Error ? err.message : "Failed to apply recommendations");
    } finally {
      setIsApplying(false);
    }
  }, [recommendations, states, workspaceId, onPrioritiesApplied, onClose]);

  // Computed stats
  const stats = useMemo(() => {
    const accepted = Object.values(states).filter((s) => s.accepted).length;
    const skipped = Object.values(states).filter((s) => s.skipped).length;
    const pending = recommendations.length - accepted - skipped;

    const acceptedRecs = recommendations.filter((rec) => states[rec.id]?.accepted);
    const highPriorityCount = acceptedRecs.filter(
      (rec) => rec.recommended_priority === "critical" || rec.recommended_priority === "high"
    ).length;

    const avgConfidence =
      acceptedRecs.length > 0
        ? acceptedRecs.reduce((sum, rec) => sum + rec.confidence, 0) / acceptedRecs.length
        : 0;

    return { accepted, skipped, pending, highPriorityCount, avgConfidence };
  }, [recommendations, states]);

  return (
    <Dialog open={isOpen} onOpenChange={() => !isApplying && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 dark:from-purple-900 dark:via-pink-900 dark:to-orange-900 rounded-lg flex-shrink-0">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl">Turbo Prioritize</DialogTitle>
              <DialogDescription>
                Review AI-suggested priority levels for your stories. Accept, skip, or reanalyze.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Stats Bar */}
        <div className="flex flex-wrap items-center gap-4 py-3 px-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium">
              Accepted: <span className="text-emerald-600">{stats.accepted}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">
              Pending: <span className="text-blue-600">{stats.pending}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">
              Skipped: <span className="text-gray-500">{stats.skipped}</span>
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReanalyze}
              disabled={isLoading || isApplying}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reanalyze
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAcceptAll}
              disabled={isLoading || isApplying || recommendations.length === 0}
            >
              <Check className="h-4 w-4 mr-1" />
              Accept All
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex gap-4">
          {/* Recommendations List */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {isLoading ? (
              // Loading skeleton
              <>
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="p-4">
                    <div className="flex items-start gap-4">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  </Card>
                ))}
              </>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                <p className="text-lg font-medium text-red-700 dark:text-red-300">{error}</p>
                <Button variant="outline" onClick={handleReanalyze} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Sparkles className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-600">No tasks to analyze</p>
                <p className="text-sm text-gray-500 mt-1">
                  Add some tasks to your project or sprint first.
                </p>
              </div>
            ) : (
              recommendations.map((rec) => {
                const state = states[rec.id] || { accepted: false, skipped: false };

                return (
                  <Card
                    key={rec.id}
                    className={cn(
                      "transition-all",
                      state.accepted && "ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30",
                      state.skipped && "opacity-50"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Priority Change Indicator */}
                        <div className="flex flex-col items-center gap-1 pt-1">
                          <PriorityBadge
                            priority={rec.current_priority as PriorityLevel}
                            size="sm"
                            showLabel={false}
                          />
                          <ArrowRight className="h-3 w-3 text-gray-400" />
                          <PriorityBadge
                            priority={rec.recommended_priority}
                            size="sm"
                            showLabel={false}
                            aiApplied
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="text-sm font-medium truncate">{rec.title}</h4>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {rec.task_id}
                              </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {state.accepted ? (
                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                  <Check className="h-3 w-3 mr-1" />
                                  Accepted
                                </Badge>
                              ) : state.skipped ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUndo(rec.id)}
                                  className="text-gray-500"
                                >
                                  <Undo2 className="h-4 w-4 mr-1" />
                                  Undo
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAccept(rec.id)}
                                    className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950"
                                  >
                                    <Check className="h-4 w-4 mr-1" />
                                    Accept
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSkip(rec.id)}
                                    className="text-gray-500"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Priority Change */}
                          <div className="flex items-center gap-2 mt-2">
                            <PriorityBadge
                              priority={rec.current_priority as PriorityLevel}
                              size="sm"
                            />
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                            <PriorityBadge
                              priority={rec.recommended_priority}
                              size="sm"
                              aiApplied
                            />
                            <Badge variant="outline" className="ml-2 text-xs">
                              {Math.round(rec.confidence * 100)}% confident
                            </Badge>
                          </div>

                          {/* Reasoning */}
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                            {rec.reasoning}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Impact Summary Sidebar */}
          <div className="w-64 flex-shrink-0 space-y-4">
            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Impact Summary
                </h3>
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Stories to update
                    </p>
                    <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                      {stats.accepted}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      High priority items
                    </p>
                    <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                      {stats.highPriorityCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Average confidence
                    </p>
                    <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                      {stats.avgConfidence > 0
                        ? `${Math.round(stats.avgConfidence * 100)}%`
                        : "-"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Factor Legend */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">Priority Factors</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-muted-foreground">Critical: Security, blockers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    <span className="text-muted-foreground">High: Core features, revenue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-muted-foreground">Medium: Standard work</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-muted-foreground">Low: Nice-to-have</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isApplying}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={stats.accepted === 0 || isApplying}
            className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white border-0"
          >
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1.5 sm:mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">Turbo ({stats.accepted})</span>
                <span className="sm:hidden">({stats.accepted})</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AIPriorityRecommendationsModal;
