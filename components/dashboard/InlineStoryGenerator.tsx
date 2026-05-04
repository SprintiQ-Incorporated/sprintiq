"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Save, Sliders, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GeneratedStoriesPanel,
  SettingsDrawer,
  StoryPromptInput,
  type GeneratorSettings,
  type StoryActionPayload,
  type StoryPromptFormState,
  type GeneratedStory,
} from "@/components/story-generator";
import EditStoryModal from "@/components/workspace/ai/edit-story-modal";
import { useGenerateStories } from "@/hooks/useGenerateStories";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import { csrfFetch } from "@/hooks/useCsrfFetch";
import { DEFAULT_WEIGHTS, type UserStory } from "@/types";
import {
  autoSaveStoriesToBacklog,
  type AutoSaveDestination,
  type Space,
} from "@/lib/story-generator/auto-save";
import { calculateSprintSummary } from "@/lib/story-generator/exporters";
import { SprintSummaryBar } from "./SprintSummaryBar";

const DEFAULT_STORY_PREFERENCES = {
  storyPointScale: "fibonacci" as const,
  maxStoryPoints: 8,
};

const DEFAULT_SETTINGS: GeneratorSettings = {
  priorityWeights: DEFAULT_WEIGHTS,
  storyPreferences: DEFAULT_STORY_PREFERENCES,
  selectedPersonas: [],
};

interface InlineStoryGeneratorProps {
  workspaceId: string;
}

export function InlineStoryGenerator({ workspaceId }: InlineStoryGeneratorProps) {
  const router = useRouter();
  const { toast } = useEnhancedToast();

  const [settings, setSettings] = useState<GeneratorSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);

  const [autoSaveDestination, setAutoSaveDestination] = useState<AutoSaveDestination>({
    type: "existing",
    spaceId: null,
    projectId: null,
    spaceName: null,
    projectName: null,
  });
  // The generation-complete callback is captured by useGenerateStories at submit
  // time, so it reads a stale `autoSaveDestination` from its closure. A ref mirror
  // lets that callback see the destination the user actually picked.
  const autoSaveDestinationRef = useRef<AutoSaveDestination>(autoSaveDestination);
  const updateAutoSaveDestination = useCallback((next: AutoSaveDestination) => {
    autoSaveDestinationRef.current = next;
    setAutoSaveDestination(next);
  }, []);

  const [autoSaveStatus, setAutoSaveStatus] = useState<{
    isSaving: boolean;
    success: boolean | null;
    error: string | null;
    savedCount: number;
  }>({ isSaving: false, success: null, error: null, savedCount: 0 });

  const {
    stories,
    isLoading,
    isStreaming,
    error,
    progress,
    progressMessage,
    teamRecommendation,
    generate,
    cancel,
    regenerateStory,
    reset: resetStories,
    updateStory,
    removeStory,
    splitStory,
  } = useGenerateStories();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchSpaces = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoadingSpaces(true);
    try {
      const response = await csrfFetch(`/api/workspace/${workspaceId}/spaces`);
      if (response.ok) {
        const data = await response.json();
        setSpaces(data.spaces || []);
      }
    } catch (err) {
      console.error("Error fetching spaces:", err);
    } finally {
      setIsLoadingSpaces(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (spaces.length === 0 && !isLoadingSpaces) {
      fetchSpaces();
    }
  }, [spaces.length, isLoadingSpaces, fetchSpaces]);

  const summary = useMemo(() => calculateSprintSummary(stories), [stories]);
  const showSummaryBar = stories.length > 0 && !isLoading && !isStreaming;

  const hasCustomSettings = useMemo(() => {
    const weights = settings.priorityWeights;
    const prefs = settings.storyPreferences;
    const weightsChanged =
      weights.businessValue !== DEFAULT_WEIGHTS.businessValue ||
      weights.userImpact !== DEFAULT_WEIGHTS.userImpact ||
      weights.complexity !== DEFAULT_WEIGHTS.complexity ||
      weights.risk !== DEFAULT_WEIGHTS.risk ||
      weights.dependencies !== DEFAULT_WEIGHTS.dependencies;
    const prefsChanged =
      prefs.storyPointScale !== DEFAULT_STORY_PREFERENCES.storyPointScale ||
      prefs.maxStoryPoints !== DEFAULT_STORY_PREFERENCES.maxStoryPoints;
    const personasSelected = settings.selectedPersonas.length > 0;
    return weightsChanged || prefsChanged || personasSelected;
  }, [settings]);

  const runAutoSave = useCallback(
    async (
      storiesToSave: GeneratedStory[],
      destination: AutoSaveDestination
    ) => {
      setAutoSaveStatus({ isSaving: true, success: null, error: null, savedCount: 0 });

      const result = await autoSaveStoriesToBacklog({
        workspaceId,
        stories: storiesToSave,
        destination,
        onDestinationResolved: updateAutoSaveDestination,
        onSpacesChanged: fetchSpaces,
        onToast: toast,
      });

      if (!result.success) {
        setAutoSaveStatus({
          isSaving: false,
          success: false,
          error: result.error ?? "Failed to save stories",
          savedCount: 0,
        });
        toast({
          title: "Failed to save stories",
          description: result.error ?? "Failed to save stories",
          variant: "destructive",
        });
        return result;
      }

      setAutoSaveStatus({
        isSaving: false,
        success: true,
        error: null,
        savedCount: result.savedCount,
      });
      toast({
        title: "Stories saved",
        description: `${result.savedCount} ${result.savedCount === 1 ? "story" : "stories"} saved to Turbo Tasks!`,
      });
      return result;
    },
    [workspaceId, fetchSpaces, toast, updateAutoSaveDestination]
  );

  const handleGenerationComplete = useCallback(
    async (completedStories: GeneratedStory[]) => {
      // PHASE_7_NOOP: was GTM dataLayer event push, OSS has no marketing telemetry

      const currentDestination = autoSaveDestinationRef.current;
      const hasExistingDest =
        currentDestination.type === "existing" &&
        currentDestination.projectId &&
        currentDestination.spaceId;
      const hasHybridDest =
        currentDestination.type === "hybrid" &&
        currentDestination.spaceId &&
        currentDestination.newProjectName;
      const hasNewDest =
        currentDestination.type === "new" &&
        currentDestination.newPortfolioName &&
        currentDestination.newProjectName;

      let effectiveDestination = currentDestination;

      if (!hasExistingDest && !hasHybridDest && !hasNewDest) {
        const defaultSpace = spaces[0];
        const defaultProject = defaultSpace?.projects?.[0];
        if (!defaultSpace || !defaultProject) {
          toast({
            title: "No project found",
            description: "Please create a project first.",
            variant: "destructive",
          });
          return;
        }
        effectiveDestination = {
          type: "existing",
          spaceId: defaultSpace.space_id,
          projectId: defaultProject.project_id,
          spaceName: defaultSpace.name,
          projectName: defaultProject.name,
        };
        updateAutoSaveDestination(effectiveDestination);
      }

      const result = await runAutoSave(completedStories, effectiveDestination);
      if (!result.success || result.savedTasks.length === 0) return;

      if (result.resolvedDestination.spaceId && result.resolvedDestination.projectId) {
        router.push(
          `/${workspaceId}/space/${result.resolvedDestination.spaceId}/project/${result.resolvedDestination.projectId}`
        );
      }
    },
    [
      runAutoSave,
      workspaceId,
      spaces,
      toast,
      router,
      updateAutoSaveDestination,
    ]
  );

  const handleSubmit = useCallback(
    async (formState: StoryPromptFormState) => {
      // PHASE_7_NOOP: was GTM dataLayer event push, OSS has no marketing telemetry

      const selectedSpace = spaces.find((s) => s.space_id === formState.selectedSpaceId);
      const selectedProject = selectedSpace?.projects.find(
        (p) => p.project_id === formState.selectedProjectId
      );

      updateAutoSaveDestination({
        type: formState.destinationType,
        spaceId: formState.selectedSpaceId,
        projectId: formState.selectedProjectId,
        spaceName: selectedSpace?.name || null,
        projectName: selectedProject?.name || null,
        newPortfolioName: formState.newPortfolioName,
        newProjectName: formState.newProjectName,
      });
      setAutoSaveStatus({ isSaving: false, success: null, error: null, savedCount: 0 });

      // Content is pre-read in StoryPromptInput so the budget indicator could
      // track char/byte usage live. Aggregate budget enforcement happens there
      // at upload time — by the time we're here, uploadedFiles is already
      // within the 100k chars + 200KB caps.
      const contextFiles = formState.uploadedFiles.map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
        content: f.content,
      }));

      await generate({
        prompt: formState.prompt,
        workspaceId,
        projectId: formState.selectedProjectId || undefined,
        sprintDuration: formState.sprintDuration as 1 | 2 | 3 | 4,
        teamMembers: [],
        complexity: "moderate",
        useTAWOS: true,
        priorityWeights: settings.priorityWeights,
        selectedPersonas: settings.selectedPersonas,
        onComplete: handleGenerationComplete,
        contextData:
          contextFiles.length > 0
            ? { text: "", urls: [], files: contextFiles }
            : undefined,
      });
    },
    [generate, workspaceId, settings, spaces, handleGenerationComplete, updateAutoSaveDestination]
  );

  const handleRegenerateAll = useCallback(async () => {
    resetStories();
  }, [resetStories]);

  const handleStoryAction = useCallback(
    async (payload: StoryActionPayload) => {
      switch (payload.action) {
        case "edit":
          setEditingStoryId(payload.storyId);
          break;
        case "split":
          splitStory(payload.storyId);
          toast({
            title: "Story split",
            description: "The story has been split into two smaller stories.",
          });
          break;
        case "regenerate":
          await regenerateStory(payload.storyId);
          break;
        case "remove":
          removeStory(payload.storyId);
          break;
        case "assigneeChange":
          break;
      }
    },
    [regenerateStory, removeStory, splitStory, toast]
  );

  const handleEditSave = useCallback(
    (updatedStory: UserStory) => {
      if (editingStoryId) {
        updateStory(editingStoryId, {
          title: updatedStory.title,
          role: updatedStory.role,
          want: updatedStory.want,
          benefit: updatedStory.benefit,
          acceptanceCriteria: updatedStory.acceptanceCriteria,
          storyPoints: updatedStory.storyPoints,
          priority: updatedStory.priority,
          tags: updatedStory.tags,
          assignedTeamMember: updatedStory.assignedTeamMember,
        });
        setEditingStoryId(null);
      }
    },
    [editingStoryId, updateStory]
  );

  return (
    <section
      id="inline-story-generator"
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-md p-5 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" aria-hidden />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Generate Stories
          </h2>
        </div>
        <Button
          id="story-settings-button"
          variant="outline"
          size="sm"
          onClick={() => setIsSettingsOpen(true)}
          className={cn(
            "flex items-center gap-2 border-2 transition-colors",
            hasCustomSettings
              ? "border-primary/30 bg-primary/5 hover:border-primary/50 hover:bg-primary/10"
              : "border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 dark:border-indigo-700 dark:hover:border-indigo-500 dark:hover:bg-indigo-950"
          )}
        >
          <Sliders
            className={cn(
              "h-4 w-4",
              hasCustomSettings ? "text-primary" : "text-indigo-600 dark:text-indigo-400"
            )}
          />
          <span className="text-slate-700 dark:text-slate-200">Settings</span>
          {hasCustomSettings && (
            <Badge
              variant="secondary"
              className="ml-1 text-xs py-0 px-1.5 bg-primary/10 text-primary"
            >
              Customized
            </Badge>
          )}
        </Button>
      </div>

      <StoryPromptInput
        onSubmit={handleSubmit}
        onCancel={cancel}
        isLoading={isLoading || isStreaming}
        availableSpaces={spaces}
        isLoadingSpaces={isLoadingSpaces}
        placeholder="Describe the feature you want to build. Example: 'Build a user authentication system with email login and password reset.'"
        textareaRef={textareaRef as React.RefObject<HTMLTextAreaElement>}
        workspaceId={workspaceId}
      />

      {autoSaveStatus.isSaving && (
        <div className="mt-4 flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Saving stories to Turbo Tasks...
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Your stories will be saved automatically
            </p>
          </div>
        </div>
      )}

      {autoSaveStatus.success === true && (
        <div className="mt-4 flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              {autoSaveStatus.savedCount}{" "}
              {autoSaveStatus.savedCount === 1 ? "story" : "stories"} saved to Turbo Tasks!
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {autoSaveDestination.projectName ? (
                <>
                  Saved to <strong>{autoSaveDestination.projectName}</strong> in{" "}
                  {autoSaveDestination.spaceName}
                </>
              ) : (
                "Stories are now available in your project's Turbo Tasks"
              )}
            </p>
          </div>
        </div>
      )}

      {autoSaveStatus.success === false && autoSaveStatus.error && (
        <div className="mt-4 flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Failed to save stories
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">{autoSaveStatus.error}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runAutoSave(stories, autoSaveDestination)}
            className="text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900"
          >
            <Save className="h-4 w-4 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {(isLoading || isStreaming || stories.length > 0 || error) && (
        <div className="mt-4">
          <GeneratedStoriesPanel
            stories={stories}
            teamMembers={[]}
            isLoading={isLoading}
            isStreaming={isStreaming}
            progress={progress?.percentage}
            progressMessage={progressMessage}
            error={error}
            teamRecommendation={teamRecommendation}
            onRegenerateAll={handleRegenerateAll}
            onStoryAction={handleStoryAction}
          />
        </div>
      )}

      <div className="mt-4">
        <SprintSummaryBar summary={summary} stories={stories} isVisible={showSummaryBar} />
      </div>

      <SettingsDrawer
        settings={settings}
        onApply={setSettings}
        workspaceId={workspaceId}
        storageKey="sprintiq_dashboard_generator_settings"
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />

      <EditStoryModal
        story={
          editingStoryId
            ? ((stories.find((s) => s.id === editingStoryId) as unknown as UserStory) ?? null)
            : null
        }
        isOpen={!!editingStoryId}
        onClose={() => setEditingStoryId(null)}
        onSave={handleEditSave}
      />
    </section>
  );
}

export default InlineStoryGenerator;
