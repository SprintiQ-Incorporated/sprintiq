/**
 * Sprint Folder Utilities
 *
 * Shared utilities for sprint folder creation and Monday day lookup.
 * Eliminates duplicate code across CreateSprintModal and CreateSpaceModal.
 */

import { createClientSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database-aliases";

type SprintFolderRow = Database["public"]["Tables"]["sprint_folders"]["Row"];
type SprintFolderInsert = Database["public"]["Tables"]["sprint_folders"]["Insert"];

// Cache Monday day ID at module level (immutable reference data)
let cachedMondayDayId: string | null = null;

/**
 * Get Monday day ID with caching.
 * The days table is reference data that never changes.
 */
export async function getMondayDayId(): Promise<string | null> {
  if (cachedMondayDayId) {
    return cachedMondayDayId;
  }

  const supabase = createClientSupabaseClient();
  const { data, error } = await supabase
    .from("days")
    .select("id")
    .eq("name", "monday")
    .single();

  if (error || !data) {
    console.error("Failed to fetch Monday day configuration:", error);
    return null;
  }

  cachedMondayDayId = data.id;
  return data.id;
}

export interface CreateSprintFolderOptions {
  spaceId: string;
  name: string;
  projectId?: string;
  durationWeeks?: number;
  sprintStartDayId?: string | null;
}

/**
 * Create a sprint folder with all required defaults.
 * Uses Monday as the default start day if not specified.
 */
export async function createSprintFolder(
  options: CreateSprintFolderOptions
): Promise<SprintFolderRow> {
  const supabase = createClientSupabaseClient();

  // Use provided start day ID or fetch Monday as default
  const startDayId = options.sprintStartDayId !== undefined
    ? options.sprintStartDayId
    : await getMondayDayId();

  const folderData: SprintFolderInsert = {
    name: options.name,
    space_id: options.spaceId,
    project_id: options.projectId ?? null,
    sprint_start_day_id: startDayId,
    duration_week: options.durationWeeks ?? 2,
  };

  const { data, error } = await supabase
    .from("sprint_folders")
    .insert(folderData)
    .select()
    .single();

  if (error || !data) {
    console.error("Failed to create sprint folder:", error);
    throw new Error(`Failed to create sprint folder: ${error?.message ?? "Unknown error"}`);
  }

  return data;
}

export interface EnsureDefaultSprintFolderOptions {
  spaceId: string;
  projectId: string;
  defaultName?: string;
}

/**
 * Ensure a default sprint folder exists for a space.
 * Returns existing folder if found, creates new one if not.
 * Returns null if creation fails (non-throwing for background operations).
 */
export async function ensureDefaultSprintFolder(
  options: EnsureDefaultSprintFolderOptions
): Promise<SprintFolderRow | null> {
  const supabase = createClientSupabaseClient();
  const { spaceId, projectId, defaultName = "Default" } = options;

  // Check for existing folder
  const { data: existing, error: existingError } = await supabase
    .from("sprint_folders")
    .select("*")
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .limit(1);

  if (existingError) {
    console.error("Error checking sprint folders:", existingError);
    return null;
  }

  if (existing && existing.length > 0) {
    return existing[0];
  }

  // Create new folder
  try {
    return await createSprintFolder({
      spaceId,
      projectId,
      name: defaultName,
    });
  } catch (error) {
    console.error("Error creating default sprint folder:", error);
    return null;
  }
}
