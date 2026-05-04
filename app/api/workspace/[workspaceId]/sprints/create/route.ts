import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";
import { verifyCsrfToken } from "@/lib/csrf-protection";
import { getInProgressStatus } from "@/lib/services/statusService";

/**
 * POST /api/workspace/[workspaceId]/sprints/create
 *
 * Creates a new sprint with the provided stories.
 * Supports AI-optimized task assignment based on team member skills.
 */

interface StoryForSprint {
  id: string;
  title: string;
  description: string;
  storyPoints?: number;
  estimatedHours?: number;
  assignedTeamMember?: {
    id: string;
    name: string;
  };
  acceptanceCriteria?: string[];
  tags?: string[];
}

interface TeamMemberForSprint {
  id: string;
  name: string;
  skills?: string[];
  availability?: number;
}

interface CreateSprintRequest {
  name: string;
  duration: number; // in weeks
  startDate: string;
  autoAssign: boolean;
  spaceId: string;
  sprintFolderId?: string;
  projectId?: string; // Optional project to associate tasks with
  goal?: string; // Optional sprint goal (AI-generated or user-provided)
  stories: StoryForSprint[];
  teamMembers: TeamMemberForSprint[];
  workspaceId: string;
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

    const body: CreateSprintRequest = await request.json();
    const {
      name,
      duration,
      startDate,
      autoAssign,
      spaceId,
      sprintFolderId,
      projectId,
      goal,
      stories,
      teamMembers,
    } = body;

    if (!name || !spaceId) {
      return NextResponse.json(
        { error: "Sprint name and space ID are required" },
        { status: 400 }
      );
    }

    if (!stories || stories.length === 0) {
      return NextResponse.json(
        { error: "At least one story is required" },
        { status: 400 }
      );
    }

    // Look up the internal space UUID from the friendly space_id
    const { data: space, error: spaceError } = await supabase
      .from("spaces")
      .select("id")
      .eq("space_id", spaceId)
      .single();

    if (spaceError || !space) {
      console.error("Error finding space:", spaceError);
      return NextResponse.json(
        { error: "Space not found" },
        { status: 404 }
      );
    }

    const internalSpaceId = space.id;

    // Look up the internal project UUID if provided
    let internalProjectId: string | null = null;
    if (projectId) {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("project_id", projectId)
        .single();

      if (projectError || !project) {
        // Don't fail - just proceed without project association
      } else {
        internalProjectId = project.id;
      }
    }

    // Calculate end date based on duration
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + duration * 7);

    // Check or create sprint folder - we need the internal ID
    let internalSprintFolderId: string;

    if (sprintFolderId) {
      // Look up the internal sprint folder UUID from the friendly sprint_folder_id
      const { data: existingFolder, error: folderLookupError } = await supabase
        .from("sprint_folders")
        .select("id")
        .eq("sprint_folder_id", sprintFolderId)
        .single();

      if (folderLookupError || !existingFolder) {
        console.error("Error finding sprint folder:", folderLookupError);
        return NextResponse.json(
          { error: "Sprint folder not found" },
          { status: 404 }
        );
      }

      internalSprintFolderId = existingFolder.id;
    } else {
      // Create a default sprint folder if none specified
      // Sprint folders belong to projects (via project_id) in addition to spaces
      const folderUuid = uuidv4();
      const { data: newFolder, error: folderError } = await supabase
        .from("sprint_folders")
        .insert({
          id: uuidv4(),
          sprint_folder_id: folderUuid,
          name: "AI Generated Sprints",
          space_id: internalSpaceId,
          project_id: internalProjectId, // Associate folder with project
          duration_week: duration,
        })
        .select()
        .single();

      if (folderError) {
        console.error("Error creating sprint folder:", folderError);
        return NextResponse.json(
          { error: "Failed to create sprint folder" },
          { status: 500 }
        );
      }

      internalSprintFolderId = newFolder.id;
    }

    // Create the sprint
    const sprintUuid = uuidv4();
    const totalPoints = stories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);

    // Use provided goal or generate a default one
    const sprintGoal = goal || `Complete ${stories.length} stories (${totalPoints} story points)`;

    const { data: newSprint, error: sprintError } = await supabase
      .from("sprints")
      .insert({
        id: uuidv4(),
        sprint_id: sprintUuid,
        name,
        goal: sprintGoal,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        sprint_folder_id: internalSprintFolderId,
        space_id: internalSpaceId,
        workspace_id: internalWorkspaceId,
        project_id: internalProjectId, // Associate sprint with project
        status: "planned",
      })
      .select()
      .single();

    if (sprintError) {
      console.error("Error creating sprint:", sprintError);
      return NextResponse.json(
        { error: "Failed to create sprint" },
        { status: 500 }
      );
    }

    // Use statusService to get "In Progress" status (fixes inline duplication - Issue #6)
    const activeStatus = await getInProgressStatus(supabase, internalSpaceId, internalWorkspaceId);

    if (!activeStatus) {
      return NextResponse.json(
        { error: "No status found for the space" },
        { status: 400 }
      );
    }

    const inProgressStatusId = activeStatus.id;

    // Create generation session ID
    const generationSessionId = uuidv4();

    // Separate stories into existing tasks (have DB IDs) vs new stories to create
    // This prevents task duplication (Issue #3)
    const storyIds = stories.map(s => s.id).filter(Boolean);

    // Check which story IDs correspond to existing tasks
    let existingTaskIds: Set<string> = new Set();
    if (storyIds.length > 0) {
      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("id")
        .in("id", storyIds);
      existingTaskIds = new Set((existingTasks || []).map(t => t.id));
    }

    const existingStories = stories.filter(s => existingTaskIds.has(s.id));
    const newStories = stories.filter(s => !existingTaskIds.has(s.id));

    // Resolve assignees for all stories upfront
    const resolveAssignee = (story: StoryForSprint): string | null => {
      let assignedMemberId = story.assignedTeamMember?.id || null;
      if (autoAssign && !assignedMemberId && teamMembers.length > 0 && story.tags) {
        const bestMatch = findBestTeamMemberMatch(story.tags, teamMembers);
        if (bestMatch) {
          assignedMemberId = bestMatch.id;
        }
      }
      return assignedMemberId;
    };

    // Move existing tasks to the sprint instead of creating duplicates (Issue #3)
    let movedTasks: any[] = [];
    if (existingStories.length > 0) {
      const existingIds = existingStories.map(s => s.id);
      const { data: moved, error: moveError } = await supabase
        .from("tasks")
        .update({
          sprint_id: newSprint.id,
          status_id: inProgressStatusId,
          updated_at: new Date().toISOString(),
        })
        .in("id", existingIds)
        .select();

      if (moveError) {
        console.error("Error moving existing tasks to sprint:", moveError);
      } else {
        movedTasks = moved || [];
      }
    }

    // Batch insert new tasks (fixes N+1 pattern - Issue #2)
    let createdTasks: any[] = [];
    if (newStories.length > 0) {
      const tasksToInsert = newStories.map(story => ({
        id: uuidv4(),
        task_id: uuidv4(),
        name: story.title,
        description: story.description,
        status_id: inProgressStatusId,
        priority: mapPriorityToInt("medium"), // Store as integer (fixes Issue #4)
        project_id: internalProjectId,
        space_id: internalSpaceId,
        workspace_id: internalWorkspaceId,
        sprint_id: newSprint.id,
        created_by: user.id,
        story_points: story.storyPoints || null,
        estimated_time: story.estimatedHours || null,
        assignee_id: resolveAssignee(story),
        generated_by_ai: true,
        acceptance_criteria: story.acceptanceCriteria?.length ? story.acceptanceCriteria : null,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("tasks")
        .insert(tasksToInsert)
        .select();

      if (insertError) {
        console.error("Error batch inserting tasks:", insertError);
      } else {
        createdTasks = inserted || [];
      }
    }

    // Batch insert AI metadata for new tasks (fixes N+1 pattern - Issue #2)
    if (createdTasks.length > 0) {
      const metadataRows = createdTasks.map((task, index) => ({
        task_id: task.id,
        generation_session_id: generationSessionId,
        ai_generation_metadata: {
          originalStoryId: newStories[index].id,
          acceptanceCriteria: newStories[index].acceptanceCriteria,
          tags: newStories[index].tags,
          generatedAt: new Date().toISOString(),
          sprintCreation: true,
        },
      }));

      const { error: metaError } = await supabase
        .from("task_ai_metadata")
        .insert(metadataRows);

      if (metaError) {
        console.error("Error batch inserting task AI metadata:", metaError);
      }
    }

    const allTasks = [...movedTasks, ...createdTasks];

    return NextResponse.json({
      success: true,
      sprintId: sprintUuid,
      name: newSprint.name,
      startDate: newSprint.start_date,
      endDate: newSprint.end_date,
      storiesAssigned: allTasks.length,
      totalPoints,
      generationSessionId,
      message: `Successfully created sprint "${name}" with ${allTasks.length} stories`,
    });
  } catch (error) {
    console.error("Unexpected error in create sprint API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Map priority string to integer string (consistent with taskSaveService)
 * DB column is typed as string but stores numeric priority values
 */
function mapPriorityToInt(priority?: string): string {
  const map: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return String(map[(priority || "medium").toLowerCase()] || 2);
}

/**
 * Find the best team member match based on story tags and member skills
 */
function findBestTeamMemberMatch(
  tags: string[],
  teamMembers: TeamMemberForSprint[]
): TeamMemberForSprint | null {
  if (teamMembers.length === 0) return null;

  const tagsLower = tags.map((t) => t.toLowerCase());

  let bestMatch: TeamMemberForSprint | null = null;
  let bestScore = 0;

  for (const member of teamMembers) {
    if (!member.skills || member.skills.length === 0) continue;

    const memberSkillsLower = member.skills.map((s) => s.toLowerCase());

    // Calculate match score
    let matchCount = 0;
    for (const tag of tagsLower) {
      for (const skill of memberSkillsLower) {
        if (skill.includes(tag) || tag.includes(skill)) {
          matchCount++;
          break;
        }
      }
    }

    const score = matchCount / tagsLower.length;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = member;
    }
  }

  return bestMatch;
}
