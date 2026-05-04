/**
 * Centralized Status Service
 *
 * Single source of truth for status creation and management.
 * Prevents duplicate status creation across different code paths.
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface StatusContext {
  id: string;
  status_id: string;
  name: string;
  type: string;
  color: string;
  position: number;
  status_type_id: string | null;
}

export interface DefaultStatusConfig {
  name: string;
  color: string;
  position: number;
  statusTypeName: "not-started" | "active" | "testing" | "done";
}

// Default statuses for new spaces - standard agile workflow
const DEFAULT_STATUSES: DefaultStatusConfig[] = [
  { name: "Backlog", color: "gray", position: 0, statusTypeName: "not-started" },
  { name: "To Do", color: "cyan", position: 1, statusTypeName: "not-started" },
  { name: "In Progress", color: "blue", position: 2, statusTypeName: "active" },
  { name: "Testing", color: "yellow", position: 3, statusTypeName: "testing" },
  { name: "Done", color: "green", position: 4, statusTypeName: "done" },
];

// Cache for status type IDs to avoid repeated lookups
const statusTypeCache: Map<string, string> = new Map();

/**
 * Get or create a status type by name
 */
async function getOrCreateStatusType(
  supabase: SupabaseClient,
  typeName: string
): Promise<string | null> {
  // Check cache first
  if (statusTypeCache.has(typeName)) {
    return statusTypeCache.get(typeName)!;
  }

  try {
    // Try to find existing status type
    const { data: existing } = await supabase
      .from("status_types")
      .select("id")
      .eq("name", typeName)
      .single();

    if (existing) {
      statusTypeCache.set(typeName, existing.id);
      return existing.id;
    }

    // Create if doesn't exist
    const { data: created, error } = await supabase
      .from("status_types")
      .insert({ name: typeName })
      .select("id")
      .single();

    if (error) {
      console.error(`[StatusService] Failed to create status type '${typeName}':`, error);
      return null;
    }

    statusTypeCache.set(typeName, created.id);
    return created.id;
  } catch (error) {
    console.error(`[StatusService] Error with status type '${typeName}':`, error);
    return null;
  }
}

/**
 * Get existing space-level statuses for a space
 * Returns null if no statuses exist
 */
export async function getSpaceStatuses(
  supabase: SupabaseClient,
  spaceUUID: string
): Promise<StatusContext[] | null> {
  const { data: statuses, error } = await supabase
    .from("statuses")
    .select("id, status_id, name, type, color, position, status_type_id")
    .eq("space_id", spaceUUID)
    .is("project_id", null)
    .is("sprint_id", null)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  if (error) {
    console.error("[StatusService] Error fetching space statuses:", error);
    return null;
  }

  if (!statuses || statuses.length === 0) {
    return null;
  }

  return statuses as StatusContext[];
}

/**
 * Get or create default statuses for a space
 *
 * This is the ONLY function that should be used to ensure statuses exist.
 * It prevents duplicates by checking for existing statuses first.
 *
 * @param supabase - Supabase client
 * @param spaceUUID - Internal space UUID
 * @param workspaceUUID - Internal workspace UUID
 * @param customStatuses - Optional custom status names (overrides defaults)
 * @returns Array of status contexts
 */
export async function getOrCreateDefaultStatuses(
  supabase: SupabaseClient,
  spaceUUID: string,
  workspaceUUID: string,
  customStatuses?: { name: string; color?: string }[]
): Promise<StatusContext[]> {

  // 1. Check for existing space-level statuses
  const existing = await getSpaceStatuses(supabase, spaceUUID);

  if (existing && existing.length > 0) {
    return existing;
  }

  // 2. No statuses exist - create defaults

  // Determine which statuses to create
  const statusesToCreate = customStatuses && customStatuses.length > 0
    ? customStatuses.map((s, i) => ({
        name: s.name,
        color: s.color || getDefaultColor(i),
        position: i,
        statusTypeName: inferStatusType(s.name) as "not-started" | "active" | "testing" | "done",
      }))
    : DEFAULT_STATUSES;

  // Fetch all status types in one query (avoids N+1)
  const { data: statusTypes } = await supabase
    .from("status_types")
    .select("id, name");

  if (!statusTypes || statusTypes.length === 0) {
    throw new Error("Failed to fetch status types");
  }

  // Create lookup map for O(1) access
  const statusTypeMap = Object.fromEntries(
    statusTypes.map(st => [st.name.toLowerCase(), st.id])
  );

  // Build status inserts (synchronously - no loop queries)
  const statusInserts = statusesToCreate.map((status) => {
    // Map status type names to database status_types.name values
    // DB has: "not-started", "active", "done" (created by setup-form)
    const statusTypeNameMap: Record<string, string> = {
      "not-started": "not-started",
      "active": "active",
      "testing": "testing",
      "done": "done",
    };

    const dbStatusTypeName = statusTypeNameMap[status.statusTypeName] || status.statusTypeName;
    const statusTypeId = statusTypeMap[dbStatusTypeName.toLowerCase()];

    if (!statusTypeId) {
      // Fallback to first available status type
      return {
        name: status.name,
        color: status.color,
        position: status.position,
        type: "space",
        space_id: spaceUUID,
        workspace_id: workspaceUUID,
        project_id: null,
        sprint_id: null,
        status_type_id: statusTypes[0]?.id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return {
      name: status.name,
      color: status.color,
      position: status.position,
      type: "space",
      space_id: spaceUUID,
      workspace_id: workspaceUUID,
      project_id: null,
      sprint_id: null,
      status_type_id: statusTypeId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  // Insert statuses
  const { data: created, error } = await supabase
    .from("statuses")
    .insert(statusInserts)
    .select("id, status_id, name, type, color, position, status_type_id");

  if (error) {
    // Race condition: another request may have created statuses between
    // our check and insert. Re-check and return existing if found.
    const raceCheck = await getSpaceStatuses(supabase, spaceUUID);
    if (raceCheck && raceCheck.length > 0) {
      console.warn("[StatusService] Race condition detected — returning existing statuses");
      return raceCheck;
    }
    console.error("[StatusService] Failed to create default statuses:", error);
    throw new Error(`Failed to create default statuses: ${error.message}`);
  }

  // Post-insert dedup: if a race condition slipped through (no insert error
  // but another request also inserted), clean up by soft-deleting extras.
  const postCheck = await getSpaceStatuses(supabase, spaceUUID);
  if (postCheck && postCheck.length > statusesToCreate.length) {
    console.warn(`[StatusService] Duplicate statuses detected after insert (${postCheck.length} found, expected ${statusesToCreate.length}). Cleaning up...`);
    // Group by lowercase name, keep the first (lowest position) of each
    const seen = new Map<string, string>();
    const dupeIds: string[] = [];
    for (const s of postCheck) {
      const key = s.name.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, s.id);
      } else {
        dupeIds.push(s.id);
      }
    }
    if (dupeIds.length > 0) {
      await supabase
        .from("statuses")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", dupeIds);
    }
    // Return clean list
    return (await getSpaceStatuses(supabase, spaceUUID)) || (created as StatusContext[]);
  }

  return created as StatusContext[];
}

/**
 * Get the first/default status for a space (usually Backlog)
 * Creates default statuses if none exist
 */
export async function getDefaultStatus(
  supabase: SupabaseClient,
  spaceUUID: string,
  workspaceUUID: string
): Promise<StatusContext> {
  const statuses = await getOrCreateDefaultStatuses(supabase, spaceUUID, workspaceUUID);
  return statuses[0];
}

/**
 * Get a specific status by type (e.g., "not-started", "active", "done")
 * Creates default statuses if none exist
 */
export async function getStatusByType(
  supabase: SupabaseClient,
  spaceUUID: string,
  workspaceUUID: string,
  statusTypeName: "not-started" | "active" | "testing" | "done"
): Promise<StatusContext | null> {
  const statuses = await getOrCreateDefaultStatuses(supabase, spaceUUID, workspaceUUID);

  // First try to find by status_type_id
  const statusTypeId = await getOrCreateStatusType(supabase, statusTypeName);
  if (statusTypeId) {
    const byType = statuses.find(s => s.status_type_id === statusTypeId);
    if (byType) return byType;
  }

  // Fallback: find by name pattern
  const namePatterns: Record<string, string[]> = {
    "not-started": ["backlog", "to do", "todo", "open", "new"],
    "active": ["in progress", "in-progress", "doing", "working"],
    "testing": ["testing", "test", "review", "qa"],
    "done": ["done", "complete", "completed", "resolved"],
  };

  const patterns = namePatterns[statusTypeName] || [];
  const byName = statuses.find(s =>
    patterns.some(p => s.name.toLowerCase().includes(p))
  );

  return byName || null;
}

/**
 * Get the "In Progress" status for a space
 * Creates default statuses if none exist
 */
export async function getInProgressStatus(
  supabase: SupabaseClient,
  spaceUUID: string,
  workspaceUUID: string
): Promise<StatusContext | null> {
  return getStatusByType(supabase, spaceUUID, workspaceUUID, "active");
}

/**
 * Get the "Backlog" status for a space
 * Creates default statuses if none exist
 */
export async function getBacklogStatus(
  supabase: SupabaseClient,
  spaceUUID: string,
  workspaceUUID: string
): Promise<StatusContext | null> {
  return getStatusByType(supabase, spaceUUID, workspaceUUID, "not-started");
}

// Helper: Get default color by index
function getDefaultColor(index: number): string {
  const colors = ["gray", "blue", "green", "purple", "yellow", "red", "orange"];
  return colors[index % colors.length];
}

// Helper: Infer status type from name
function inferStatusType(name: string): string {
  const lowerName = name.toLowerCase();

  if (lowerName.includes("done") || lowerName.includes("complete")) {
    return "done";
  }
  if (lowerName.includes("testing") || lowerName.includes("test")
    || lowerName.includes("review") || lowerName.includes("qa")) {
    return "testing";
  }
  if (lowerName.includes("progress") || lowerName.includes("doing") || lowerName.includes("active")
    || lowerName.includes("implementation")) {
    return "active";
  }
  // Default to not-started for backlog, to do, open, etc.
  return "not-started";
}
