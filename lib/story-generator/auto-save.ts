import { createClientSupabaseClient } from "@/lib/supabase/client";
import { csrfFetch } from "@/hooks/useCsrfFetch";
import type { GeneratedStory } from "@/components/story-generator/StoryCard";
import type { SaveGeneratedTasksRequest } from "@/types/api/saveGeneratedTasks";

export interface Space {
  space_id: string;
  name: string;
  projects: {
    project_id: string;
    name: string;
  }[];
  sprint_folders?: {
    sprint_folder_id: string;
    name: string;
  }[];
}

export type DestinationType = "existing" | "hybrid" | "new";

export interface AutoSaveDestination {
  type: DestinationType;
  spaceId: string | null;
  projectId: string | null;
  spaceName: string | null;
  projectName: string | null;
  newPortfolioName?: string;
  newProjectName?: string;
}

export interface ToastLike {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

export interface AutoSaveOptions {
  workspaceId: string;
  stories: GeneratedStory[];
  destination: AutoSaveDestination;
  /** Called when hybrid/new mode creates real IDs; caller updates its destination state */
  onDestinationResolved?: (d: AutoSaveDestination) => void;
  /** Called after new portfolio/project is created so caller can refresh its spaces list */
  onSpacesChanged?: () => void;
  /** Surfaces intermediate UX toasts ("Portfolio created", "Project created"). Final save toast is the caller's responsibility. */
  onToast?: (t: ToastLike) => void;
}

export interface AutoSaveResult {
  success: boolean;
  savedCount: number;
  savedTasks: Array<{ id?: string }>;
  targetProjectId: string | null;
  resolvedDestination: AutoSaveDestination;
  error?: string;
}

/**
 * Persists generated stories to the selected project's backlog. For hybrid mode
 * creates a new project inside an existing portfolio; for new mode creates both.
 * Returns a rich result instead of throwing so the caller can drive its own UI
 * state machine (saving / success / failure).
 */
export async function autoSaveStoriesToBacklog(
  opts: AutoSaveOptions
): Promise<AutoSaveResult> {
  const { workspaceId, stories, destination, onDestinationResolved, onSpacesChanged, onToast } = opts;

  if (stories.length === 0) {
    return {
      success: false,
      savedCount: 0,
      savedTasks: [],
      targetProjectId: null,
      resolvedDestination: destination,
      error: "No stories to save",
    };
  }

  const hasExistingDestination =
    destination.type === "existing" && destination.projectId && destination.spaceId;
  const hasHybridDestination =
    destination.type === "hybrid" && destination.spaceId && destination.newProjectName;
  const hasNewDestination =
    destination.type === "new" && destination.newPortfolioName && destination.newProjectName;

  if (!hasExistingDestination && !hasHybridDestination && !hasNewDestination) {
    return {
      success: false,
      savedCount: 0,
      savedTasks: [],
      targetProjectId: null,
      resolvedDestination: destination,
      error: "Invalid destination",
    };
  }

  let targetProjectId = destination.projectId;
  let resolvedDestination = destination;

  try {
    if (destination.type === "new" && destination.newPortfolioName && destination.newProjectName) {
      const supabase = createClientSupabaseClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("Authentication required to create portfolio/project");
      }

      const { data: workspaceData, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id")
        .eq("workspace_id", workspaceId)
        .single();

      if (workspaceError || !workspaceData) {
        throw new Error(`Failed to find workspace: ${workspaceError?.message || "not found"}`);
      }

      const { data: newSpace, error: spaceError } = await supabase
        .from("spaces")
        .insert({
          name: destination.newPortfolioName,
          workspace_id: workspaceData.id,
        })
        .select("id, space_id, name")
        .single();

      if (spaceError || !newSpace) {
        throw new Error(`Failed to create portfolio: ${spaceError?.message || "unknown error"}`);
      }

      const { data: newProject, error: projectError } = await supabase
        .from("projects")
        .insert({
          name: destination.newProjectName,
          space_id: newSpace.id,
          workspace_id: workspaceData.id,
        })
        .select("id, project_id, name")
        .single();

      if (projectError || !newProject) {
        throw new Error(`Failed to create project: ${projectError?.message || "unknown error"}`);
      }

      targetProjectId = newProject.project_id;
      resolvedDestination = {
        ...destination,
        spaceId: newSpace.space_id,
        projectId: newProject.project_id,
        spaceName: newSpace.name,
        projectName: newProject.name,
      };
      onDestinationResolved?.(resolvedDestination);
      onSpacesChanged?.();
      onToast?.({
        title: "Portfolio created",
        description: `Created "${newSpace.name}" → "${newProject.name}"`,
      });
    }

    if (destination.type === "hybrid" && destination.spaceId && destination.newProjectName) {
      const supabase = createClientSupabaseClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("Authentication required to create project");
      }

      const { data: workspaceData, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id")
        .eq("workspace_id", workspaceId)
        .single();

      if (workspaceError || !workspaceData) {
        throw new Error(`Failed to find workspace: ${workspaceError?.message || "not found"}`);
      }

      const { data: spaceData, error: spaceResolveError } = await supabase
        .from("spaces")
        .select("id, space_id, name")
        .eq("space_id", destination.spaceId)
        .is("deleted_at", null)
        .single();

      if (spaceResolveError || !spaceData) {
        throw new Error(
          `Failed to find portfolio: ${spaceResolveError?.message || "not found"}`
        );
      }

      const { data: newProject, error: projectError } = await supabase
        .from("projects")
        .insert({
          name: destination.newProjectName,
          space_id: spaceData.id,
          workspace_id: workspaceData.id,
        })
        .select("id, project_id, name")
        .single();

      if (projectError || !newProject) {
        throw new Error(`Failed to create project: ${projectError?.message || "unknown error"}`);
      }

      targetProjectId = newProject.project_id;
      resolvedDestination = {
        ...destination,
        spaceId: spaceData.space_id,
        projectId: newProject.project_id,
        spaceName: spaceData.name,
        projectName: newProject.name,
      };
      onDestinationResolved?.(resolvedDestination);
      onSpacesChanged?.();
      onToast?.({
        title: "Project created",
        description: `Created "${newProject.name}" in "${spaceData.name}"`,
      });
    }

    if (!targetProjectId) {
      throw new Error("No target project available for saving stories");
    }

    const tasksPayload: SaveGeneratedTasksRequest = {
      tasks: stories.map((story) => ({
        title: story.title,
        description: `As a ${story.role}, I want ${story.want}, so that ${story.benefit}.`,
        acceptanceCriteria: story.acceptanceCriteria,
        storyPoints: story.storyPoints,
        estimatedHours: story.estimatedHours,
        priority: (story.priority?.toLowerCase() || "medium") as
          | "low"
          | "medium"
          | "high"
          | "critical",
        assigneeId: story.assignedTeamMember?.id,
      })),
      projectId: targetProjectId,
    };

    const response = await csrfFetch("/api/tasks/save-generated", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tasksPayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to save stories");
    }

    const data = await response.json();
    const savedTasks: Array<{ id?: string }> = Array.isArray(data.tasks) ? data.tasks : [];

    return {
      success: true,
      savedCount: data.savedCount || stories.length,
      savedTasks,
      targetProjectId,
      resolvedDestination,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to save stories";
    console.error("[AutoSave] Failed to save stories:", error);
    return {
      success: false,
      savedCount: 0,
      savedTasks: [],
      targetProjectId,
      resolvedDestination,
      error: errorMessage,
    };
  }
}
