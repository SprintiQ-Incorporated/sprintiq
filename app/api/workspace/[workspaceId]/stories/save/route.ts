import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { verifyCsrfToken } from "@/lib/csrf-protection";
import { v4 as uuidv4 } from "uuid";
import { getOrCreateBacklogStatus } from "@/lib/utils/id-lookup";
import { getOrCreateDefaultStatuses } from "@/lib/services/statusService";

/**
 * POST /api/workspace/[workspaceId]/stories/save
 *
 * @deprecated For saving to EXISTING projects, use POST /api/tasks/save-generated instead.
 *             This endpoint is maintained for backward compatibility and for creating
 *             NEW spaces/projects during the save flow.
 *
 * Saves generated stories as tasks to a space/project.
 * Supports both saving to existing spaces/projects and creating new ones.
 *
 * Migration guide:
 * - For existing projects: POST /api/tasks/save-generated { tasks: [...], projectId: "xxx" }
 * - For new space/project creation: Continue using this endpoint
 */

interface StoryToSave {
  title: string;
  description: string;
  role: string;
  want: string;
  benefit: string;
  acceptanceCriteria: string[];
  storyPoints?: number;
  estimatedHours?: number;
  tags?: string[];
  priority?: string;
  assignedTeamMember?: {
    id: string;
    name: string;
  };
}

interface SaveStoriesRequest {
  stories: StoryToSave[];
  destination: {
    type: "existing" | "new";
    spaceId?: string;
    projectId?: string;
    spaceName?: string;
    projectName?: string;
  };
  workspaceId: string;
  /** Session ID from story generation - required to link tasks to the generation session */
  generationSessionId?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    // Verify CSRF token
    const csrfValid = await verifyCsrfToken(request);
    if (!csrfValid) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    const { workspaceId } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Look up workspace and verify ownership
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, owner_id")
      .eq("workspace_id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    if (workspace.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const internalWorkspaceId = workspace.id;

    const body: SaveStoriesRequest = await request.json();
    const { stories, destination, generationSessionId: providedSessionId } = body;

    // Log deprecation warning for "existing" destinations
    // These should migrate to /api/tasks/save-generated
    if (destination.type === "existing") {
    }

    if (!stories || stories.length === 0) {
      return NextResponse.json(
        { error: "No stories to save" },
        { status: 400 }
      );
    }

    let targetSpaceId: string;           // Internal UUID for space
    let targetSpaceFriendlyId: string;   // Friendly space_id for response
    let targetProjectId: string | null = null;  // Internal UUID for project
    let targetProjectFriendlyId: string | null = null;  // Friendly project_id for response

    // Handle destination
    if (destination.type === "new") {
      // Create new space (portfolio)
      const newSpaceInternalId = uuidv4();
      const newSpaceFriendlyId = uuidv4();
      const { data: newSpace, error: spaceError } = await supabase
        .from("spaces")
        .insert({
          id: newSpaceInternalId,
          space_id: newSpaceFriendlyId,
          name: destination.spaceName || "New Portfolio",
          workspace_id: internalWorkspaceId,
          icon: "folder",
          is_private: false,
        })
        .select()
        .single();

      if (spaceError) {
        console.error("Error creating space:", spaceError);
        return NextResponse.json(
          { error: "Failed to create portfolio" },
          { status: 500 }
        );
      }

      // Use internal ID for database relationships, friendly ID for response
      targetSpaceId = newSpaceInternalId;
      targetSpaceFriendlyId = newSpaceFriendlyId;

      // Create new project
      if (destination.projectName) {
        const newProjectInternalId = uuidv4();
        const newProjectFriendlyId = uuidv4();
        const { error: projectError } = await supabase
          .from("projects")
          .insert({
            id: newProjectInternalId,
            project_id: newProjectFriendlyId,
            name: destination.projectName,
            space_id: targetSpaceId,  // Use internal space ID
            workspace_id: internalWorkspaceId,
          });

        if (projectError) {
          console.error("Error creating project:", projectError);
          return NextResponse.json(
            { error: "Failed to create project" },
            { status: 500 }
          );
        }

        targetProjectId = newProjectInternalId;
        targetProjectFriendlyId = newProjectFriendlyId;
      }

      // Create default statuses for the space via centralized service
      try {
        await getOrCreateDefaultStatuses(supabase, targetSpaceId, internalWorkspaceId);
      } catch (statusError) {
        console.error("Error creating default statuses:", statusError);
      }
    } else {
      // Use existing space/project - need to look up internal IDs
      if (!destination.spaceId) {
        return NextResponse.json(
          { error: "Space ID is required" },
          { status: 400 }
        );
      }

      // Look up the internal space UUID from the friendly space_id
      const { data: existingSpace, error: spaceQueryError } = await supabase
        .from("spaces")
        .select("id, space_id")
        .eq("space_id", destination.spaceId)
        .is("deleted_at", null)
        .single();

      if (spaceQueryError || !existingSpace) {
        console.error("Error finding space:", spaceQueryError);
        return NextResponse.json(
          { error: "Portfolio not found" },
          { status: 404 }
        );
      }

      targetSpaceId = existingSpace.id;
      targetSpaceFriendlyId = existingSpace.space_id;

      // Look up the internal project UUID if project is specified
      if (destination.projectId) {
        const { data: existingProject, error: projectQueryError } = await supabase
          .from("projects")
          .select("id, project_id")
          .eq("project_id", destination.projectId)
          .is("deleted_at", null)
          .single();

        if (projectQueryError || !existingProject) {
          console.error("Error finding project:", projectQueryError);
          return NextResponse.json(
            { error: "Project not found" },
            { status: 404 }
          );
        }

        targetProjectId = existingProject.id;
        targetProjectFriendlyId = existingProject.project_id;
      }
    }

    // Get or create Backlog status for AI-generated stories
    // This ensures consistency with taskSaveService behavior
    const backlogContext = await getOrCreateBacklogStatus(supabase, targetSpaceId, internalWorkspaceId);

    if (!backlogContext) {
      console.error("Failed to get or create Backlog status for space:", targetSpaceId);
      return NextResponse.json(
        { error: "Failed to get or create Backlog status for tasks" },
        { status: 500 }
      );
    }

    const defaultStatusId = backlogContext.statusUUID;

    // Use provided session ID from generation, or create a fallback UUID
    // Note: providedSessionId should come from the generate-stories SSE completion event
    const generationSessionId = providedSessionId || uuidv4();
    const isLinkedSession = !!providedSessionId;

    // Save each story as a task
    const savedTasks = [];
    for (const story of stories) {
      const taskData = {
        name: story.title,
        description: story.description,
        status_id: defaultStatusId,
        priority: story.priority || "Medium",
        space_id: targetSpaceId,
        workspace_id: internalWorkspaceId,
        project_id: targetProjectId,
        created_by: user.id,
        story_points: story.storyPoints || null,
        estimated_time: story.estimatedHours || null,
        generated_by_ai: true,
        assignee_id: story.assignedTeamMember?.id || null,
      };

      const { data: savedTask, error: taskError } = await supabase
        .from("tasks")
        .insert(taskData)
        .select()
        .single();

      if (taskError) {
        console.error("Error saving task:", taskError);
      } else {
        savedTasks.push(savedTask);

        // Insert AI metadata into separate table
        const { error: metaError } = await supabase
          .from("task_ai_metadata")
          .insert({
            task_id: savedTask.id,
            generation_session_id: generationSessionId,
            ai_generation_metadata: {
              role: story.role,
              want: story.want,
              benefit: story.benefit,
              acceptanceCriteria: story.acceptanceCriteria,
              tags: story.tags,
              generatedAt: new Date().toISOString(),
            },
          });

        if (metaError) {
          console.error("Error saving task AI metadata:", metaError);
        }
      }
    }

    // Update the story_generation_session with the generated task IDs
    // This links the tasks to the session for analytics tracking
    if (isLinkedSession && savedTasks.length > 0) {
      const savedTaskIds = savedTasks.map((task) => task.id);
      const { error: sessionUpdateError } = await supabase
        .from("story_generation_sessions")
        .update({
          generated_story_ids: savedTaskIds,
        })
        .eq("id", generationSessionId);

      if (sessionUpdateError) {
        console.error("[stories/save] Failed to update session with task IDs:", sessionUpdateError);
        // Non-critical error - tasks are saved, just session link is missing
      } else {
      }
    }

    return NextResponse.json({
      success: true,
      savedCount: savedTasks.length,
      spaceId: targetSpaceFriendlyId,
      projectId: targetProjectFriendlyId,
      generationSessionId,
      message: `Successfully saved ${savedTasks.length} stories`,
    });
  } catch (error) {
    console.error("Unexpected error in save stories API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
