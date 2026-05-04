"use client";

import { useState, useCallback, useRef } from "react";
import type { DependencyRecommendation, CircularRiskWarning } from "@/types";
import { getClientCsrfToken } from "@/lib/csrf-client";

// ============================================================================
// Types
// ============================================================================

export interface UseDependencyAnalysisReturn {
  isAnalyzing: boolean;
  recommendations: DependencyRecommendation[];
  circularRisks: CircularRiskWarning[];
  error: string | null;
  /** Non-blocking warning (amber) — analysis failed but modal stays usable */
  warning: string | null;
  analyze: (
    taskIds: string[],
    workspaceId: string,
    projectId?: string,
    sprintId?: string
  ) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 2000;

// ============================================================================
// Hook
// ============================================================================

export function useDependencyAnalysis(): UseDependencyAnalysisReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState<DependencyRecommendation[]>([]);
  const [circularRisks, setCircularRisks] = useState<CircularRiskWarning[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const analyze = useCallback(
    async (
      taskIds: string[],
      workspaceId: string,
      projectId?: string,
      sprintId?: string
    ): Promise<void> => {
      // Cancel any in-flight poll
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Reset state
      setIsAnalyzing(true);
      setError(null);
      setWarning(null);
      setRecommendations([]);
      setCircularRisks([]);

      try {
        // Get CSRF token
        const csrfToken = getClientCsrfToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (csrfToken) {
          headers["x-csrf-token"] = csrfToken;
        }

        // POST to enqueue
        const response = await fetch(
          `/api/workspace/${workspaceId}/dependencies/analyze`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ taskIds, projectId, sprintId }),
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const { taskId } = await response.json();

        // Start polling the generic task status endpoint (US-010)
        const poll = async () => {
          try {
            const statusResponse = await fetch(`/api/tasks/${taskId}`, {
              signal: abortController.signal,
            });

            if (!statusResponse.ok) return;

            const data = await statusResponse.json();

            if (data.status === "complete") {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              const result = data.result || {};
              setRecommendations(result.recommendations || []);
              setCircularRisks(result.circularRisks || []);
              setIsAnalyzing(false);
            } else if (
              data.status === "failed" ||
              data.status === "dead_lettered"
            ) {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              // Non-blocking failure — set warning, not error
              setWarning(
                data.error ||
                  "Analysis could not be completed. You can dismiss and retry."
              );
              setRecommendations([]);
              setCircularRisks([]);
              setIsAnalyzing(false);
            }
            // "queued" / "running" → keep polling
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") return;
            // Transient network errors — keep polling
          }
        };

        // Poll immediately, then every 2s
        poll();
        pollIntervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setIsAnalyzing(false);
          return;
        }
        setError(
          err instanceof Error ? err.message : "Failed to start dependency analysis"
        );
        setIsAnalyzing(false);
      }
    },
    []
  );

  const cancel = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAnalyzing(false);
  }, []);

  const reset = useCallback(() => {
    cancel();
    setRecommendations([]);
    setCircularRisks([]);
    setError(null);
    setWarning(null);
  }, [cancel]);

  return {
    isAnalyzing,
    recommendations,
    circularRisks,
    error,
    warning,
    analyze,
    cancel,
    reset,
  };
}

export default useDependencyAnalysis;
