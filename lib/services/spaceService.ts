/**
 * Space Service
 *
 * Centralized service for space-related operations.
 * Ensures consistent cascade behavior when deleting spaces.
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface CascadeDeleteResult {
  success: boolean;
  error?: string;
  deletedCounts: {
    tasks: number;
    statuses: number;
    projects: number;
    sprints: number;
    sprintFolders: number;
  };
}

/**
 * Cascade delete a space and all related data.
 *
 * This soft-deletes (sets deleted_at) in the following order:
 * 1. Tasks in the space
 * 2. Statuses (space, project, and sprint statuses)
 * 3. Projects in the space
 * 4. Sprints in the space
 * 5. Sprint folders in the space
 * 6. The space itself
 *
 * @param supabase - Supabase client instance
 * @param spaceId - The UUID of the space to delete
 * @returns CascadeDeleteResult with success status and counts
 */
export async function cascadeDeleteSpace(
  supabase: SupabaseClient,
  spaceId: string
): Promise<CascadeDeleteResult> {
  const timestamp = new Date().toISOString();
  const deletedCounts = {
    tasks: 0,
    statuses: 0,
    projects: 0,
    sprints: 0,
    sprintFolders: 0,
  };

  try {
    // 1. Get projects and sprints in this space for status deletion
    const { data: projectsInSpace } = await supabase
      .from("projects")
      .select("id")
      .eq("space_id", spaceId)
      .is("deleted_at", null);

    const { data: sprintsInSpace } = await supabase
      .from("sprints")
      .select("id")
      .eq("space_id", spaceId)
      .is("deleted_at", null);

    const projectIds = (projectsInSpace || []).map((p) => p.id);
    const sprintIds = (sprintsInSpace || []).map((s) => s.id);

    // 2. Collect all status IDs that will be affected
    const statusIdsToDelete: string[] = [];

    // Space statuses
    const { data: spaceStatuses } = await supabase
      .from("statuses")
      .select("id")
      .eq("space_id", spaceId)
      .is("deleted_at", null);

    if (spaceStatuses) {
      statusIdsToDelete.push(...spaceStatuses.map((s) => s.id));
    }

    // Project statuses
    if (projectIds.length > 0) {
      const { data: projectStatuses } = await supabase
        .from("statuses")
        .select("id")
        .in("project_id", projectIds)
        .is("deleted_at", null);

      if (projectStatuses) {
        statusIdsToDelete.push(...projectStatuses.map((s) => s.id));
      }
    }

    // Sprint statuses
    if (sprintIds.length > 0) {
      const { data: sprintStatuses } = await supabase
        .from("statuses")
        .select("id")
        .in("sprint_id", sprintIds)
        .is("deleted_at", null);

      if (sprintStatuses) {
        statusIdsToDelete.push(...sprintStatuses.map((s) => s.id));
      }
    }

    const uniqueStatusIds = [...new Set(statusIdsToDelete)];

    // 3. Delete tasks in this space
    const { count: tasksCount, error: tasksError } = await supabase
      .from("tasks")
      .update({ deleted_at: timestamp }, { count: "exact" })
      .eq("space_id", spaceId)
      .is("deleted_at", null)
      .select("id");

    if (tasksError) {
      console.error("Error deleting tasks:", tasksError);
      throw new Error(`Failed to delete tasks: ${tasksError.message}`);
    }
    deletedCounts.tasks = tasksCount || 0;

    // 4. Delete tasks that reference statuses being deleted (from other spaces)
    if (uniqueStatusIds.length > 0) {
      const { error: statusTasksError } = await supabase
        .from("tasks")
        .update({ deleted_at: timestamp })
        .in("status_id", uniqueStatusIds)
        .is("deleted_at", null);

      if (statusTasksError) {
        console.error("Error deleting tasks with status references:", statusTasksError);
        // Continue - this is a cleanup operation
      }
    }

    // 5. Delete statuses
    // Space statuses
    const { count: spaceStatusCount, error: spaceStatusesError } = await supabase
      .from("statuses")
      .update({ deleted_at: timestamp }, { count: "exact" })
      .eq("space_id", spaceId)
      .is("deleted_at", null)
      .select("id");

    if (spaceStatusesError) {
      console.error("Error deleting space statuses:", spaceStatusesError);
    }
    deletedCounts.statuses += spaceStatusCount || 0;

    // Project statuses
    if (projectIds.length > 0) {
      const { count: projectStatusCount, error: projectStatusesError } = await supabase
        .from("statuses")
        .update({ deleted_at: timestamp }, { count: "exact" })
        .in("project_id", projectIds)
        .is("deleted_at", null)
        .select("id");

      if (projectStatusesError) {
        console.error("Error deleting project statuses:", projectStatusesError);
      }
      deletedCounts.statuses += projectStatusCount || 0;
    }

    // Sprint statuses
    if (sprintIds.length > 0) {
      const { count: sprintStatusCount, error: sprintStatusesError } = await supabase
        .from("statuses")
        .update({ deleted_at: timestamp }, { count: "exact" })
        .in("sprint_id", sprintIds)
        .is("deleted_at", null)
        .select("id");

      if (sprintStatusesError) {
        console.error("Error deleting sprint statuses:", sprintStatusesError);
      }
      deletedCounts.statuses += sprintStatusCount || 0;
    }

    // 6. Delete projects
    const { count: projectsCount, error: projectsError } = await supabase
      .from("projects")
      .update({ deleted_at: timestamp }, { count: "exact" })
      .eq("space_id", spaceId)
      .is("deleted_at", null)
      .select("id");

    if (projectsError) {
      console.error("Error deleting projects:", projectsError);
      throw new Error(`Failed to delete projects: ${projectsError.message}`);
    }
    deletedCounts.projects = projectsCount || 0;

    // 8. Delete sprints
    const { count: sprintsCount, error: sprintsError } = await supabase
      .from("sprints")
      .update({ deleted_at: timestamp }, { count: "exact" })
      .eq("space_id", spaceId)
      .is("deleted_at", null)
      .select("id");

    if (sprintsError) {
      console.error("Error deleting sprints:", sprintsError);
      throw new Error(`Failed to delete sprints: ${sprintsError.message}`);
    }
    deletedCounts.sprints = sprintsCount || 0;

    // 9. Delete sprint folders
    const { count: sprintFoldersCount, error: sprintFoldersError } = await supabase
      .from("sprint_folders")
      .update({ deleted_at: timestamp }, { count: "exact" })
      .eq("space_id", spaceId)
      .is("deleted_at", null)
      .select("id");

    if (sprintFoldersError) {
      console.error("Error deleting sprint folders:", sprintFoldersError);
      throw new Error(`Failed to delete sprint folders: ${sprintFoldersError.message}`);
    }
    deletedCounts.sprintFolders = sprintFoldersCount || 0;

    // 10. Finally, delete the space itself
    const { error: spaceError } = await supabase
      .from("spaces")
      .update({ deleted_at: timestamp })
      .eq("id", spaceId);

    if (spaceError) {
      console.error("Error deleting space:", spaceError);
      throw new Error(`Failed to delete space: ${spaceError.message}`);
    }

    return {
      success: true,
      deletedCounts,
    };
  } catch (error: any) {
    console.error("Cascade delete space failed:", error);
    return {
      success: false,
      error: error.message || "Unknown error during cascade delete",
      deletedCounts,
    };
  }
}

/**
 * Clean up orphaned data from deleted spaces.
 *
 * This finds and soft-deletes any data that references deleted spaces.
 *
 * @param supabase - Supabase client instance
 * @param workspaceId - The workspace UUID to clean up
 */
export async function cleanupOrphanedSpaceData(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<{ cleaned: number; errors: string[] }> {
  const timestamp = new Date().toISOString();
  let cleaned = 0;
  const errors: string[] = [];

  try {
    // Get all deleted space IDs in this workspace
    const { data: deletedSpaces } = await supabase
      .from("spaces")
      .select("id")
      .eq("workspace_id", workspaceId)
      .not("deleted_at", "is", null);

    if (!deletedSpaces || deletedSpaces.length === 0) {
      return { cleaned: 0, errors: [] };
    }

    const deletedSpaceIds = deletedSpaces.map((s) => s.id);

    // Clean up sprint_folders pointing to deleted spaces
    const { count: foldersCount, error: foldersError } = await supabase
      .from("sprint_folders")
      .update({ deleted_at: timestamp }, { count: "exact" })
      .in("space_id", deletedSpaceIds)
      .is("deleted_at", null)
      .select("id");

    if (foldersError) {
      errors.push(`Sprint folders: ${foldersError.message}`);
    } else {
      cleaned += foldersCount || 0;
    }

    // Clean up sprints pointing to deleted spaces
    const { count: sprintsCount, error: sprintsError } = await supabase
      .from("sprints")
      .update({ deleted_at: timestamp }, { count: "exact" })
      .in("space_id", deletedSpaceIds)
      .is("deleted_at", null)
      .select("id");

    if (sprintsError) {
      errors.push(`Sprints: ${sprintsError.message}`);
    } else {
      cleaned += sprintsCount || 0;
    }

    // Clean up projects pointing to deleted spaces
    const { count: projectsCount, error: projectsError } = await supabase
      .from("projects")
      .update({ deleted_at: timestamp }, { count: "exact" })
      .in("space_id", deletedSpaceIds)
      .is("deleted_at", null)
      .select("id");

    if (projectsError) {
      errors.push(`Projects: ${projectsError.message}`);
    } else {
      cleaned += projectsCount || 0;
    }

    // Clean up tasks pointing to deleted spaces
    const { count: tasksCount, error: tasksError } = await supabase
      .from("tasks")
      .update({ deleted_at: timestamp }, { count: "exact" })
      .in("space_id", deletedSpaceIds)
      .is("deleted_at", null)
      .select("id");

    if (tasksError) {
      errors.push(`Tasks: ${tasksError.message}`);
    } else {
      cleaned += tasksCount || 0;
    }

    return { cleaned, errors };
  } catch (error: any) {
    return { cleaned, errors: [error.message] };
  }
}
