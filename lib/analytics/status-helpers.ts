/**
 * Status Helpers for Analytics
 *
 * Provides consistent methods for determining completed/done status across all analytics
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { STATUS_TYPE_CATEGORIES } from "@/lib/constants/statusTypes";

/**
 * Get all status IDs that represent "done/completed" state for a workspace
 * Uses status_types table for consistent lookup
 * Checks for both 'done' and 'closed' status types
 */
export async function getCompletedStatusIds(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string[]> {
  // Get all status_type IDs for completed types (done and closed)
  const { data: completedStatusTypes, error: typeError } = await supabase
    .from("status_types")
    .select("id")
    .in("name", STATUS_TYPE_CATEGORIES.COMPLETED);

  if (typeError || !completedStatusTypes || completedStatusTypes.length === 0) {
    console.error("Failed to get completed status types:", typeError);
    return [];
  }

  const completedStatusTypeIds = completedStatusTypes.map((st) => st.id);

  // Get all statuses with these status_type_ids for the workspace
  const { data: completedStatuses, error: statusError } = await supabase
    .from("statuses")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("status_type_id", completedStatusTypeIds);

  if (statusError) {
    console.error("Failed to get completed statuses:", statusError);
    return [];
  }

  return (completedStatuses || []).map((s) => s.id);
}
