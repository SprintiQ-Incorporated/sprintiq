"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  AlertCircle,
  FileText,
  Sparkles,
  Clock,
  Users,
  Target,
} from "lucide-react";
import { TurboLogo, TurboLoading } from "@/components/TurboLogo";
import { StoryCard } from "./StoryCard";
import type { GeneratedStory } from "./StoryCard";
import type { TeamMember, TeamRecommendation } from "@/types";

// ============================================================================
// Types
// ============================================================================

export type StoryAction =
  | "edit"
  | "split"
  | "regenerate"
  | "remove"
  | "assigneeChange";

export interface StoryActionPayload {
  action: StoryAction;
  storyId: string;
  data?: {
    memberId?: string;
  };
}

export interface GeneratedStoriesPanelProps {
  /** List of generated stories */
  stories: GeneratedStory[];
  /** Team members for skill matching */
  teamMembers: TeamMember[];
  /** Whether stories are currently loading */
  isLoading: boolean;
  /** Whether stories are streaming in */
  isStreaming: boolean;
  /** Loading progress percentage (0-100) */
  progress?: number;
  /** Human-readable progress status message from the worker */
  progressMessage?: string | null;
  /** Error that occurred during generation */
  error: Error | null;
  /** Team recommendation when no team is provided */
  teamRecommendation?: TeamRecommendation | null;
  /** Callback to regenerate all stories */
  onRegenerateAll: () => void;
  /** Callback for story actions */
  onStoryAction: (payload: StoryActionPayload) => void;
  /** Callback to add a team member (for skill gap) */
  onAddTeamMember?: () => void;
  /** Callback to adjust story scope (for skill gap) */
  onAdjustScope?: (storyId: string) => void;
  /** Callback to retry after error */
  onRetry?: () => void;
  /** Callback to continue without team (dismiss team recommendation) */
  onContinueWithoutTeam?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SKELETON_COUNT = 3;
const VIRTUALIZATION_THRESHOLD = 20;

// ============================================================================
// Animation Variants
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.25,
      ease: "easeOut" as const,
    },
  },
  exit: {
    opacity: 0,
    x: -50,
    scale: 0.95,
    transition: {
      duration: 0.2,
      ease: "easeIn" as const,
    },
  },
};

// ============================================================================
// Sub-Components
// ============================================================================

function SkeletonCard({ index }: { index: number }) {
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: index * 0.15 }}
    >
      <Card className="overflow-hidden">
        <div className="p-4 flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 flex-1" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-10" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function LoadingState({ progress, progressMessage }: { progress?: number; progressMessage?: string | null }) {
  return (
    <div className="space-y-4">
      {/* Header with Turbo */}
      <div className="flex flex-col items-center justify-center py-6">
        <TurboLoading
          size="xl"
          message={progressMessage || "Turbo is generating your stories..."}
        />
      </div>

      {/* Progress bar */}
      {progress !== undefined && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {progressMessage || `${progress}% complete`}
          </p>
        </div>
      )}

      {/* Skeleton cards */}
      <motion.div
        className="space-y-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <SkeletonCard key={i} index={i} />
        ))}
      </motion.div>
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      {/* Turbo mascot as the main illustration */}
      <div className="relative mb-6">
        <TurboLogo size="2xl" />
        <motion.div
          className="absolute -top-1 -right-1 h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          aria-hidden="true"
        >
          <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400" />
        </motion.div>
      </div>

      {/* Text */}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Turbo is ready to help
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Describe your project above to get started. Turbo will generate user
        stories tailored to your team.
      </p>
    </motion.div>
  );
}

function ErrorState({
  error,
  onRetry,
  partialStories,
}: {
  error: Error;
  onRetry?: () => void;
  partialStories: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Generation Error</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-3">{error.message || "Failed to generate stories. Please try again."}</p>
          {partialStories > 0 && (
            <p className="text-sm opacity-80 mb-3">
              {partialStories} stories were loaded before the error occurred.
            </p>
          )}
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
              Try Again
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </motion.div>
  );
}

function StreamingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center justify-center gap-3 py-4 text-muted-foreground"
    >
      <TurboLogo size="sm" />
      <span className="text-sm">Turbo is generating more stories...</span>
    </motion.div>
  );
}

interface SummaryFooterProps {
  stories: GeneratedStory[];
  teamMembers: TeamMember[];
}

function SummaryFooter({ stories, teamMembers }: SummaryFooterProps) {
  const summary = useMemo(() => {
    const totalPoints = stories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
    const totalHours = stories.reduce((sum, s) => sum + (s.estimatedHours || 0), 0);

    // Calculate team utilization
    const totalTeamCapacity = teamMembers.reduce(
      (sum, m) => sum + (m.availability || 40),
      0
    );
    const utilization =
      totalTeamCapacity > 0
        ? Math.min(100, Math.round((totalHours / totalTeamCapacity) * 100))
        : 0;

    return { totalPoints, totalHours, utilization };
  }, [stories, teamMembers]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 pt-4 border-t"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
        <div className="flex items-center gap-2 text-sm">
          <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
            <Target className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Total Points</p>
            <p className="font-semibold text-foreground">{summary.totalPoints} SP</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
            <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Total Hours</p>
            <p className="font-semibold text-foreground">{summary.totalHours}h</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
            <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Team Utilization</p>
            <p className="font-semibold text-foreground">{summary.utilization}%</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GeneratedStoriesPanel({
  stories,
  teamMembers,
  isLoading,
  isStreaming,
  progress,
  progressMessage,
  error,
  teamRecommendation,
  onRegenerateAll,
  onStoryAction,
  onAddTeamMember,
  onAdjustScope,
  onRetry,
  onContinueWithoutTeam,
  className,
}: GeneratedStoriesPanelProps) {
  const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  // Handle story expansion
  const handleToggleExpand = useCallback((storyId: string) => {
    setExpandedStoryId((prev) => (prev === storyId ? null : storyId));
  }, []);

  // Create action handlers
  const handleEdit = useCallback(
    (storyId: string) => onStoryAction({ action: "edit", storyId }),
    [onStoryAction]
  );

  const handleSplit = useCallback(
    (storyId: string) => onStoryAction({ action: "split", storyId }),
    [onStoryAction]
  );

  const handleRegenerate = useCallback(
    (storyId: string) => onStoryAction({ action: "regenerate", storyId }),
    [onStoryAction]
  );

  const handleRemove = useCallback(
    (storyId: string) => onStoryAction({ action: "remove", storyId }),
    [onStoryAction]
  );

  const handleAssigneeChange = useCallback(
    (storyId: string, memberId: string) =>
      onStoryAction({ action: "assigneeChange", storyId, data: { memberId } }),
    [onStoryAction]
  );

  // Simple virtualization for large lists
  const shouldVirtualize = stories.length > VIRTUALIZATION_THRESHOLD;
  const visibleStories = useMemo(() => {
    if (!shouldVirtualize) return stories;
    return stories.slice(visibleRange.start, visibleRange.end);
  }, [stories, shouldVirtualize, visibleRange]);

  // Handle scroll for virtualization
  useEffect(() => {
    if (!shouldVirtualize || !containerRef.current) return;

    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const scrollTop = container.scrollTop;
      const itemHeight = 80; // Approximate collapsed card height
      const viewportHeight = container.clientHeight;

      const start = Math.max(0, Math.floor(scrollTop / itemHeight) - 5);
      const end = Math.min(
        stories.length,
        Math.ceil((scrollTop + viewportHeight) / itemHeight) + 5
      );

      setVisibleRange({ start, end });
    };

    const container = containerRef.current;
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [shouldVirtualize, stories.length]);

  // Determine current state
  const hasStories = stories.length > 0;
  const showLoading = isLoading && !hasStories;
  const showEmpty = !isLoading && !isStreaming && !hasStories && !error;
  const showError = error !== null;
  const showStories = hasStories;

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* MOBILE-04 FIX: Added sticky positioning for header on mobile */}
      <CardHeader className="pb-4 sticky top-0 bg-card z-10 border-b border-transparent md:relative md:border-none">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            {showLoading ? (
              <span className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-500" aria-hidden="true" />
                Generating Stories
              </span>
            ) : hasStories ? (
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-500" aria-hidden="true" />
                Generated Sprint Plan
                <span className="text-sm font-normal text-muted-foreground">
                  ({stories.length} {stories.length === 1 ? "story" : "stories"})
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                Story Generator
              </span>
            )}
          </CardTitle>

          {hasStories && !isLoading && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerateAll}
              disabled={isStreaming}
              className="text-muted-foreground"
            >
              <RefreshCw
                className={cn("h-3 w-3 mr-1", isStreaming && "animate-spin")}
                aria-hidden="true"
              />
              Regenerate All
            </Button>
          )}
        </div>

        {/* Progress bar during loading */}
        {isLoading && progress !== undefined && (
          <div className="mt-3 space-y-1">
            <Progress value={progress} className="h-1.5" />
            <p className="text-xs text-muted-foreground text-right">{progress}%</p>
          </div>
        )}
      </CardHeader>

      <CardContent
        ref={containerRef}
        className={cn(
          "space-y-3",
          shouldVirtualize && "max-h-[600px] overflow-y-auto"
        )}
      >
        {/* Loading State */}
        {showLoading && <LoadingState progress={progress} progressMessage={progressMessage} />}

        {/* Empty State */}
        {showEmpty && <EmptyState />}

        {/* Error State */}
        {showError && (
          <ErrorState
            error={error}
            onRetry={onRetry}
            partialStories={stories.length}
          />
        )}

        {/* Stories List */}
        {showStories && (
          <>
            {/* Virtualization spacer for items before visible range */}
            {shouldVirtualize && visibleRange.start > 0 && (
              <div style={{ height: visibleRange.start * 80 }} />
            )}

            <AnimatePresence mode="popLayout">
              {visibleStories.map((story, index) => (
                <motion.div
                  key={story.id}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  layout
                  transition={{ delay: index * 0.05 }}
                >
                  <StoryCard
                    story={story}
                    teamMembers={teamMembers}
                    isExpanded={expandedStoryId === story.id}
                    onToggleExpand={handleToggleExpand}
                    onEdit={handleEdit}
                    onSplit={handleSplit}
                    onRegenerate={handleRegenerate}
                    onRemove={handleRemove}
                    onAssigneeChange={handleAssigneeChange}
                    onAddTeamMember={onAddTeamMember}
                    onAdjustScope={onAdjustScope}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Virtualization spacer for items after visible range */}
            {shouldVirtualize && visibleRange.end < stories.length && (
              <div style={{ height: (stories.length - visibleRange.end) * 80 }} />
            )}

            {/* Streaming indicator */}
            <AnimatePresence>
              {isStreaming && <StreamingIndicator />}
            </AnimatePresence>

            {/* Summary Footer */}
            {!isLoading && !isStreaming && (
              <SummaryFooter stories={stories} teamMembers={teamMembers} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default GeneratedStoriesPanel;
