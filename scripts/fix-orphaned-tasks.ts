/**
 * Fix Orphaned Tasks Script
 *
 * Finds tasks that have sprint_id set but no project_id (orphaned)
 * and restores them to the correct project.
 *
 * Usage:
 *   npx tsx scripts/fix-orphaned-tasks.ts
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Target IDs from user's URL
const SPACE_ID = "c712846b-5e85-4277-95ad-45a9c670fdc4";
const PROJECT_ID = "6afa7b8a-4b5d-4804-a50b-a08cdccfbe18";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing required environment variables:");
  if (!SUPABASE_URL) console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  if (!SERVICE_ROLE_KEY) console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================================================
// MAIN
// ============================================================================

async function findOrphanedTasks() {
  console.log("\n🔍 Finding orphaned tasks...\n");

  // Find tasks that have sprint_id but no project_id in this space
  const { data: orphanedTasks, error } = await supabase
    .from("tasks")
    .select(`
      id,
      name,
      task_id,
      sprint_id,
      project_id,
      space_id,
      status_id,
      created_at
    `)
    .eq("space_id", SPACE_ID)
    .is("project_id", null)
    .not("sprint_id", "is", null)
    .is("deleted_at", null);

  if (error) {
    console.error("Error finding orphaned tasks:", error);
    return [];
  }

  console.log(`Found ${orphanedTasks?.length || 0} orphaned tasks:\n`);

  if (orphanedTasks && orphanedTasks.length > 0) {
    orphanedTasks.forEach((task, index) => {
      console.log(`  ${index + 1}. ${task.name}`);
      console.log(`     ID: ${task.id}`);
      console.log(`     Task ID: ${task.task_id}`);
      console.log(`     Sprint ID: ${task.sprint_id}`);
      console.log(`     Space ID: ${task.space_id}`);
      console.log("");
    });
  }

  return orphanedTasks || [];
}

async function restoreOrphanedTasks(tasks: any[]) {
  if (tasks.length === 0) {
    console.log("No orphaned tasks to restore.");
    return;
  }

  console.log(`\n🔧 Restoring ${tasks.length} orphaned tasks to project ${PROJECT_ID}...\n`);

  const taskIds = tasks.map((t) => t.id);

  const { data, error } = await supabase
    .from("tasks")
    .update({
      project_id: PROJECT_ID,
      updated_at: new Date().toISOString(),
    })
    .in("id", taskIds)
    .select("id, name");

  if (error) {
    console.error("Error restoring tasks:", error);
    return;
  }

  console.log(`✅ Successfully restored ${data?.length || 0} tasks:\n`);
  data?.forEach((task) => {
    console.log(`  - ${task.name}`);
  });
}

async function main() {
  console.log("=".repeat(60));
  console.log("Fix Orphaned Tasks Script");
  console.log("=".repeat(60));
  console.log(`\nTarget Space: ${SPACE_ID}`);
  console.log(`Target Project: ${PROJECT_ID}`);

  // Step 1: Find orphaned tasks
  const orphanedTasks = await findOrphanedTasks();

  // Step 2: Ask for confirmation (auto-proceed in script)
  if (orphanedTasks.length > 0) {
    console.log("\n⚠️  About to restore these tasks to the project...");

    // Step 3: Restore tasks
    await restoreOrphanedTasks(orphanedTasks);
  }

  console.log("\n" + "=".repeat(60));
  console.log("Done!");
  console.log("=".repeat(60) + "\n");
}

main().catch(console.error);
