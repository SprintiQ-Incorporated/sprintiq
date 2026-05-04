"use client";

import { useState, useCallback, useRef } from "react";
import type { GeneratedStory } from "@/components/story-generator/StoryCard";
import type { PriorityWeights, TeamRecommendation } from "@/types";
import type { Persona } from "@/lib/database-aliases";
import { getClientCsrfToken } from "@/lib/csrf-client";

// ============================================================================
// Types
// ============================================================================

export interface ContextFile {
  name: string;
  type: string;
  size: number;
  content: string;
}

export interface ContextData {
  text: string;
  urls: string[];
  files: ContextFile[];
}

export interface StoryGeneratorInput {
  prompt: string;
  workspaceId: string;
  projectId?: string;
  sprintDuration?: 1 | 2 | 3 | 4;
  teamMembers?: unknown[];
  complexity?: "simple" | "moderate" | "complex";
  useTAWOS?: boolean;
  /**
   * User-tuned weights from SettingsDrawer. If omitted, the API route falls back
   * to DEFAULT_WEIGHTS. Prior to 2026-04-23 this was hardcoded server-side and
   * user selections in the drawer were silently ignored — see full-pipeline
   * audit in the commit message.
   */
  priorityWeights?: PriorityWeights;
  /**
   * User-selected personas from SettingsDrawer. Same provenance as priorityWeights
   * — previously hardcoded to [] server-side.
   */
  selectedPersonas?: Persona[];
  contextData?: ContextData;
  /** Called with completed stories directly from the poll handler — no useEffect chain needed */
  onComplete?: (stories: GeneratedStory[]) => void;
}

export interface GenerationProgress {
  current: number;
  total: number;
  percentage: number;
}

export interface UseGenerateStoriesReturn {
  stories: GeneratedStory[];
  isLoading: boolean;
  isStreaming: boolean;
  error: Error | null;
  progress: GenerationProgress | null;
  progressMessage: string | null;
  teamRecommendation: TeamRecommendation | null;
  generationSessionId: string | null;
  generate: (input: StoryGeneratorInput) => Promise<void>;
  cancel: () => void;
  regenerateStory: (storyId: string) => Promise<GeneratedStory | null>;
  reset: () => void;
  updateStory: (storyId: string, updates: Partial<GeneratedStory>) => void;
  removeStory: (storyId: string) => void;
  splitStory: (storyId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 2000;

// ============================================================================
// Hook Implementation
// ============================================================================

export function useGenerateStories(): UseGenerateStoriesReturn {
  const [stories, setStories] = useState<GeneratedStory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [teamRecommendation, setTeamRecommendation] = useState<TeamRecommendation | null>(null);
  const [generationSessionId, setGenerationSessionId] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onCompleteRef = useRef<((stories: GeneratedStory[]) => void) | null>(null);

  // -------------------------------------------------------------------------
  // Generate Stories (POST → poll)
  // -------------------------------------------------------------------------

  const generate = useCallback(async (input: StoryGeneratorInput): Promise<void> => {
    // Cancel any existing poll
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Store onComplete in ref so poll closure always has the latest
    onCompleteRef.current = input.onComplete || null;

    // Reset state
    setIsLoading(true);
    setIsStreaming(false);
    setError(null);
    setProgress(null);
    setProgressMessage(null);
    setStories([]);
    setTeamRecommendation(null);
    setGenerationSessionId(null);

    try {
      // Get CSRF token
      const csrfToken = getClientCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrfToken) {
        headers["x-csrf-token"] = csrfToken;
      }

      // POST to enqueue
      const response = await fetch(
        `/api/workspace/${input.workspaceId}/generate-stories`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            prompt: input.prompt,
            projectId: input.projectId,
            sprintDuration: input.sprintDuration || 2,
            teamMembers: input.teamMembers || [],
            complexity: input.complexity || "moderate",
            useTAWOS: input.useTAWOS ?? true,
            antiPatternPrevention: true,
            priorityWeights: input.priorityWeights,
            selectedPersonas: input.selectedPersonas,
            contextData: input.contextData || null,
          }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const { sessionId } = await response.json();
      setGenerationSessionId(sessionId);

      // Start polling
      const poll = async () => {
        try {
          const statusResponse = await fetch(
            `/api/workspace/${input.workspaceId}/generate-stories/${sessionId}/status`,
            { signal: abortController.signal }
          );

          if (!statusResponse.ok) return;

          const status = await statusResponse.json();

          setProgress({
            current: status.progress ?? 0,
            total: 100,
            percentage: status.progress ?? 0,
          });
          setProgressMessage(status.progressMessage || null);

          if (status.status === "completed") {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            const completedStories: GeneratedStory[] = status.stories || [];
            setStories(completedStories);
            setTeamRecommendation(status.teamRecommendation || null);
            setIsStreaming(false);
            setIsLoading(false);
            setProgress(null);

            // Fire onComplete callback directly — no useEffect chain needed
            if (completedStories.length > 0) {
              onCompleteRef.current?.(completedStories);
            }
          } else if (status.status === "failed") {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setError(new Error(status.error || "Generation failed"));
            setIsStreaming(false);
            setIsLoading(false);
            setProgress(null);
          }
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
          // Network errors during polling are transient — keep polling
        }
      };

      // Poll immediately, then every 2s
      setIsStreaming(true);
      poll();
      pollIntervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    } catch (err) {
      setIsStreaming(false);
      if (err instanceof Error && err.name === "AbortError") {
        setIsLoading(false);
        return;
      }
      setError(err instanceof Error ? err : new Error("Generation failed"));
      setIsLoading(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Cancel
  // -------------------------------------------------------------------------

  const cancel = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsStreaming(false);
    setProgress(null);
    setProgressMessage(null);
  }, []);

  // -------------------------------------------------------------------------
  // Regenerate Single Story
  // -------------------------------------------------------------------------

  const regenerateStory = useCallback(
    async (storyId: string): Promise<GeneratedStory | null> => {
      const existingStory = stories.find((s) => s.id === storyId);
      if (!existingStory) return null;

      try {
        const csrfToken = getClientCsrfToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (csrfToken) {
          headers["x-csrf-token"] = csrfToken;
        }

        const response = await fetch(`/api/stories/${storyId}/regenerate`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: existingStory.title,
            role: existingStory.role,
            want: existingStory.want,
            benefit: existingStory.benefit,
            tags: existingStory.tags,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to regenerate story");
        }

        const newStory: GeneratedStory = await response.json();
        setStories((prev) =>
          prev.map((s) => (s.id === storyId ? { ...newStory, id: storyId } : s))
        );
        return newStory;
      } catch (err) {
        console.error("Failed to regenerate story:", err);
        return null;
      }
    },
    [stories]
  );

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  const reset = useCallback(() => {
    cancel();
    setStories([]);
    setError(null);
    setProgress(null);
    setProgressMessage(null);
    setTeamRecommendation(null);
    setGenerationSessionId(null);
  }, [cancel]);

  // -------------------------------------------------------------------------
  // Story Utilities
  // -------------------------------------------------------------------------

  const updateStory = useCallback(
    (storyId: string, updates: Partial<GeneratedStory>) => {
      setStories((prev) =>
        prev.map((s) => (s.id === storyId ? { ...s, ...updates } : s))
      );
    },
    []
  );

  const removeStory = useCallback((storyId: string) => {
    setStories((prev) => prev.filter((s) => s.id !== storyId));
  }, []);

  const splitStory = useCallback((storyId: string) => {
    setStories((prev) => {
      const index = prev.findIndex((s) => s.id === storyId);
      if (index === -1) return prev;

      const original = prev[index];
      const criteria = original.acceptanceCriteria;
      const midpoint = Math.ceil(criteria.length / 2);

      const story1: GeneratedStory = {
        ...original,
        id: `${original.id}_split_1`,
        title: `${original.title} (Part 1)`,
        acceptanceCriteria: criteria.slice(0, midpoint),
        storyPoints: Math.ceil(original.storyPoints / 2),
        estimatedHours: Math.ceil(original.estimatedHours / 2),
      };

      const story2: GeneratedStory = {
        ...original,
        id: `${original.id}_split_2`,
        title: `${original.title} (Part 2)`,
        acceptanceCriteria: criteria.slice(midpoint),
        storyPoints: Math.floor(original.storyPoints / 2),
        estimatedHours: Math.floor(original.estimatedHours / 2),
      };

      const next = [...prev];
      next.splice(index, 1, story1, story2);
      return next;
    });
  }, []);

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    stories,
    isLoading,
    isStreaming,
    error,
    progress,
    progressMessage,
    teamRecommendation,
    generationSessionId,
    generate,
    cancel,
    regenerateStory,
    reset,
    updateStory,
    removeStory,
    splitStory,
  };
}

export default useGenerateStories;
