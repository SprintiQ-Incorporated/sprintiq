/**
 * ID Lookup Utilities
 *
 * SprintIQ uses two ID systems:
 * 1. Friendly IDs - Used in URLs (e.g., "w123456789", "s036717105687", "p269998695808")
 *    - workspaces.workspace_id
 *    - spaces.space_id
 *    - projects.project_id
 *    - statuses.status_id
 *    - tasks.task_id
 *
 * 2. Internal UUIDs - Used in database foreign keys
 *    - All tables have an `id` column (UUID) for FK relationships
 *    - FK columns (workspace_id, space_id, project_id, status_id) in child tables
 *      reference the parent's `id` column, NOT the friendly ID column
 *
 * This utility ensures proper conversion before database operations.
 */

import { SupabaseClient } from "@supabase/supabase-js";

// Type definitions for clarity
export type FriendlyId = string;
export type InternalUUID = string;

export interface ResolvedWorkspaceContext {
  workspaceUUID: InternalUUID;
  workspaceFriendlyId: FriendlyId;
  workspaceName: string;
}

export interface ResolvedSpaceContext {
  spaceUUID: InternalUUID;
  spaceFriendlyId: FriendlyId;
  spaceName: string;
  workspaceUUID: InternalUUID;
}

export interface ResolvedProjectContext {
  projectUUID: InternalUUID;
  projectFriendlyId: FriendlyId;
  projectName: string;
  spaceUUID: InternalUUID;
  workspaceUUID: InternalUUID;
}

export interface ResolvedStatusContext {
  statusUUID: InternalUUID;
  statusFriendlyId: FriendlyId;
  statusName: string;
  statusType: string;
  spaceUUID: InternalUUID;
}

/**
 * Validate that a string is a proper UUID format
 */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  );
}

/**
 * Resolves a workspace's internal UUID from a friendly workspace_id
 *
 * @param supabase - Supabase client
 * @param workspaceId - Friendly workspace_id (e.g., "w123456789")
 * @returns Resolved workspace context with internal UUID
 */
export async function resolveWorkspaceId(
  supabase: SupabaseClient,
  workspaceId: FriendlyId
): Promise<ResolvedWorkspaceContext> {
  // If already a UUID, verify it exists by id column
  if (isValidUUID(workspaceId)) {
    const { data, error } = await supabase
      .from("workspaces")
      .select("id, workspace_id, name")
      .eq("id", workspaceId)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      throw new Error(`Workspace not found by UUID: ${workspaceId}`);
    }

    return {
      workspaceUUID: data.id,
      workspaceFriendlyId: data.workspace_id,
      workspaceName: data.name,
    };
  }

  // Look up by friendly workspace_id
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, workspace_id, name")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    throw new Error(`Workspace not found for friendly ID: ${workspaceId}`);
  }

  return {
    workspaceUUID: data.id,
    workspaceFriendlyId: data.workspace_id,
    workspaceName: data.name,
  };
}

/**
 * Resolves a space's internal UUID from a friendly space_id or internal UUID
 *
 * @param supabase - Supabase client
 * @param spaceId - Friendly space_id (e.g., "s036717105687") or internal UUID
 * @returns Resolved space context with internal UUID
 */
export async function resolveSpaceId(
  supabase: SupabaseClient,
  spaceId: FriendlyId
): Promise<ResolvedSpaceContext> {
  // If it looks like a UUID, try both internal `id` column AND `space_id` column
  // because some spaces may have UUIDs in their space_id column
  if (isValidUUID(spaceId)) {
    // First, try by internal UUID (id column)
    const { data: byId } = await supabase
      .from("spaces")
      .select("id, space_id, name, workspace_id")
      .eq("id", spaceId)
      .is("deleted_at", null)
      .single();

    if (byId) {
      return {
        spaceUUID: byId.id,
        spaceFriendlyId: byId.space_id,
        spaceName: byId.name,
        workspaceUUID: byId.workspace_id,
      };
    }

    // If not found by id, try by space_id column (some spaces have UUIDs as friendly IDs)
    const { data: bySpaceId } = await supabase
      .from("spaces")
      .select("id, space_id, name, workspace_id")
      .eq("space_id", spaceId)
      .is("deleted_at", null)
      .single();

    if (bySpaceId) {
      return {
        spaceUUID: bySpaceId.id,
        spaceFriendlyId: bySpaceId.space_id,
        spaceName: bySpaceId.name,
        workspaceUUID: bySpaceId.workspace_id,
      };
    }

    // Neither found
    throw new Error(`Portfolio not found for guid: ${spaceId}. Please refresh your portfolio list.`);
  }

  // Look up by friendly space_id
  const { data, error } = await supabase
    .from("spaces")
    .select("id, space_id, name, workspace_id")
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    throw new Error(`Portfolio not found for ID: ${spaceId}. Please refresh your portfolio list.`);
  }

  return {
    spaceUUID: data.id,
    spaceFriendlyId: data.space_id,
    spaceName: data.name,
    workspaceUUID: data.workspace_id,
  };
}

/**
 * Resolves a project's internal UUID from a friendly project_id or internal UUID
 *
 * @param supabase - Supabase client
 * @param projectId - Friendly project_id (e.g., "p269998695808") or internal UUID
 * @returns Resolved project context with internal UUID and related IDs
 */
export async function resolveProjectId(
  supabase: SupabaseClient,
  projectId: FriendlyId
): Promise<ResolvedProjectContext> {
  // If it looks like a UUID, try both internal `id` column AND `project_id` column
  // because some projects may have UUIDs in their project_id column
  if (isValidUUID(projectId)) {
    // First, try by internal UUID (id column)
    const { data: byId } = await supabase
      .from("projects")
      .select("id, project_id, name, space_id, workspace_id")
      .eq("id", projectId)
      .is("deleted_at", null)
      .single();

    if (byId) {
      return {
        projectUUID: byId.id,
        projectFriendlyId: byId.project_id,
        projectName: byId.name,
        spaceUUID: byId.space_id,
        workspaceUUID: byId.workspace_id,
      };
    }

    // If not found by id, try by project_id column (some projects have UUIDs as friendly IDs)
    const { data: byProjectId } = await supabase
      .from("projects")
      .select("id, project_id, name, space_id, workspace_id")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .single();

    if (byProjectId) {
      return {
        projectUUID: byProjectId.id,
        projectFriendlyId: byProjectId.project_id,
        projectName: byProjectId.name,
        spaceUUID: byProjectId.space_id,
        workspaceUUID: byProjectId.workspace_id,
      };
    }

    // Neither found
    throw new Error(`Project not found for guid: ${projectId}. Please refresh your project list or select a different project.`);
  }

  // Look up by friendly project_id
  const { data, error } = await supabase
    .from("projects")
    .select("id, project_id, name, space_id, workspace_id")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    throw new Error(`Project not found for ID: ${projectId}. Please refresh your project list or select a different project.`);
  }

  return {
    projectUUID: data.id,
    projectFriendlyId: data.project_id,
    projectName: data.name,
    spaceUUID: data.space_id,
    workspaceUUID: data.workspace_id,
  };
}

/**
 * Get the default/first status for a space
 * Used when creating tasks that need an initial status
 *
 * @param supabase - Supabase client
 * @param spaceUUID - Internal space UUID (NOT friendly ID)
 * @returns Resolved status context or null if no status exists
 */
export async function getDefaultStatusForSpace(
  supabase: SupabaseClient,
  spaceUUID: InternalUUID
): Promise<ResolvedStatusContext | null> {
  // Query the first status for the space, ordered by position
  // All statuses created by statusService have type: "space"
  let { data, error } = await supabase
    .from("statuses")
    .select("id, status_id, name, type, space_id")
    .eq("space_id", spaceUUID)
    .eq("type", "space")
    .is("deleted_at", null)
    .order("position", { ascending: true })
    .limit(1);

  // Fallback: If no "space" typed statuses found, get any status for the space
  // This handles legacy statuses that were created without a type field
  if ((!data || data.length === 0) && !error) {
    const fallbackResult = await supabase
      .from("statuses")
      .select("id, status_id, name, type, space_id")
      .eq("space_id", spaceUUID)
      .is("deleted_at", null)
      .order("position", { ascending: true })
      .limit(1);

    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    console.error("Error fetching default status:", error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const status = data[0];
  return {
    statusUUID: status.id, // CRITICAL: Use internal UUID, not status_id
    statusFriendlyId: status.status_id,
    statusName: status.name,
    statusType: status.type || "space", // Default to "space" if type is null
    spaceUUID: status.space_id,
  };
}

/**
 * Resolves a status by name or friendly ID within a space
 *
 * @param supabase - Supabase client
 * @param statusIdOrName - Friendly status_id or status name
 * @param spaceUUID - Internal space UUID to scope the search
 * @returns Resolved status context
 */
export async function resolveStatusId(
  supabase: SupabaseClient,
  statusIdOrName: string,
  spaceUUID: InternalUUID
): Promise<ResolvedStatusContext> {
  // If it's a UUID, look up directly
  if (isValidUUID(statusIdOrName)) {
    const { data, error } = await supabase
      .from("statuses")
      .select("id, status_id, name, type, space_id")
      .eq("id", statusIdOrName)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      throw new Error(`Status not found by UUID: ${statusIdOrName}`);
    }

    return {
      statusUUID: data.id,
      statusFriendlyId: data.status_id,
      statusName: data.name,
      statusType: data.type,
      spaceUUID: data.space_id,
    };
  }

  // Try to find by friendly status_id first, then by name
  const query = supabase
    .from("statuses")
    .select("id, status_id, name, type, space_id")
    .eq("space_id", spaceUUID)
    .is("deleted_at", null);

  // First try by friendly status_id
  const { data: byFriendlyId } = await query
    .eq("status_id", statusIdOrName)
    .single();

  if (byFriendlyId) {
    return {
      statusUUID: byFriendlyId.id,
      statusFriendlyId: byFriendlyId.status_id,
      statusName: byFriendlyId.name,
      statusType: byFriendlyId.type,
      spaceUUID: byFriendlyId.space_id,
    };
  }

  // Fall back to searching by name (case-insensitive)
  const { data: byName, error } = await supabase
    .from("statuses")
    .select("id, status_id, name, type, space_id")
    .eq("space_id", spaceUUID)
    .ilike("name", statusIdOrName)
    .is("deleted_at", null)
    .single();

  if (error || !byName) {
    throw new Error(
      `Status not found: "${statusIdOrName}" in space ${spaceUUID}`
    );
  }

  return {
    statusUUID: byName.id,
    statusFriendlyId: byName.status_id,
    statusName: byName.name,
    statusType: byName.type,
    spaceUUID: byName.space_id,
  };
}

/**
 * Get or create a "Backlog" status for a space
 * This ensures AI-generated stories are always saved to a proper Backlog status
 *
 * Uses the centralized statusService to prevent duplicate status creation.
 *
 * @param supabase - Supabase client
 * @param spaceUUID - Internal space UUID
 * @param workspaceUUID - Internal workspace UUID (needed for creating new status)
 * @returns Resolved status context for Backlog status
 */
export async function getOrCreateBacklogStatus(
  supabase: SupabaseClient,
  spaceUUID: InternalUUID,
  workspaceUUID: InternalUUID
): Promise<ResolvedStatusContext | null> {
  // Import the centralized service to prevent circular dependency issues
  const { getBacklogStatus, getOrCreateDefaultStatuses } = await import("@/lib/services/statusService");

  try {
    // Use centralized service - this checks for existing statuses first
    const backlogStatus = await getBacklogStatus(supabase, spaceUUID, workspaceUUID);

    if (backlogStatus) {
      return {
        statusUUID: backlogStatus.id,
        statusFriendlyId: backlogStatus.status_id,
        statusName: backlogStatus.name,
        statusType: backlogStatus.type || "not-started",
        spaceUUID: spaceUUID,
      };
    }

    // If no backlog-specific status found, get the first available status
    const allStatuses = await getOrCreateDefaultStatuses(supabase, spaceUUID, workspaceUUID);
    if (allStatuses.length > 0) {
      const firstStatus = allStatuses[0];
      return {
        statusUUID: firstStatus.id,
        statusFriendlyId: firstStatus.status_id,
        statusName: firstStatus.name,
        statusType: firstStatus.type || "not-started",
        spaceUUID: spaceUUID,
      };
    }

    console.error("[getOrCreateBacklogStatus] No statuses found or created");
    return null;
  } catch (error) {
    console.error("[getOrCreateBacklogStatus] Error:", error);
    // Fall back to legacy behavior
    return getDefaultStatusForSpace(supabase, spaceUUID);
  }
}

/**
 * Batch resolve multiple IDs in a single operation
 * Useful for API endpoints that receive multiple friendly IDs
 */
export interface BatchResolveParams {
  workspaceId?: FriendlyId;
  spaceId?: FriendlyId;
  projectId?: FriendlyId;
}

export interface BatchResolveResult {
  workspace?: ResolvedWorkspaceContext;
  space?: ResolvedSpaceContext;
  project?: ResolvedProjectContext;
}

export async function batchResolveIds(
  supabase: SupabaseClient,
  params: BatchResolveParams
): Promise<BatchResolveResult> {
  const result: BatchResolveResult = {};

  // Resolve in dependency order
  if (params.workspaceId) {
    result.workspace = await resolveWorkspaceId(supabase, params.workspaceId);
  }

  if (params.spaceId) {
    result.space = await resolveSpaceId(supabase, params.spaceId);
  }

  if (params.projectId) {
    result.project = await resolveProjectId(supabase, params.projectId);
  }

  return result;
}

/**
 * Assert that all required UUIDs are present and valid
 * Throws an error if any are missing or invalid
 */
export function assertValidUUIDs(
  ids: Record<string, string | null | undefined>,
  context: string
): void {
  const invalid: string[] = [];

  for (const [name, value] of Object.entries(ids)) {
    if (!value) {
      invalid.push(`${name} is missing`);
    } else if (!isValidUUID(value)) {
      invalid.push(`${name} is not a valid UUID: ${value}`);
    }
  }

  if (invalid.length > 0) {
    throw new Error(`Invalid UUIDs in ${context}: ${invalid.join(", ")}`);
  }
}

