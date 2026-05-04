import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";
import type { DependencyRecommendation } from "@/types";

/**
 * POST /api/workspace/[workspaceId]/dependencies/save
 *
 * Saves task dependencies to the database.
 * Supports both single dependency and batch saves from AI recommendations.
 */

interface SaveDependencyRequest {
  dependencies: {
    sourceTaskId: string;
    targetTaskId: string;
    dependencyType: "blocks" | "is_blocked_by" | "relates_to";
    reason?: string;
    confidence?: number;
  }[];
  overwrite?: boolean; // If true, replace existing dependencies for source tasks
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
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

    // Look up the workspace and verify ownership
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

    const body: SaveDependencyRequest = await request.json();
    const { dependencies, overwrite = false } = body;

    if (!dependencies || dependencies.length === 0) {
      return NextResponse.json(
        { error: "No dependencies to save" },
        { status: 400 }
      );
    }

    // Validate all task IDs exist and belong to this workspace
    // Handle both task_id (friendly ID like "TASK-123") and internal UUID id
    const allTaskIds = [
      ...new Set([
        ...dependencies.map(d => d.sourceTaskId),
        ...dependencies.map(d => d.targetTaskId),
      ])
    ];

    // First try to find by task_id (friendly ID)
    let { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, task_id, workspace_id")
      .in("task_id", allTaskIds);

    // If no results by task_id, try by internal id (UUID)
    if ((!tasks || tasks.length === 0) && !tasksError) {
      const { data: tasksByUuid, error: uuidTasksError } = await supabase
        .from("tasks")
        .select("id, task_id, workspace_id")
        .in("id", allTaskIds);

      tasks = tasksByUuid;
      tasksError = uuidTasksError;
    }

    // If still partial results, try to find remaining by the other ID type
    if (tasks && tasks.length > 0 && tasks.length < allTaskIds.length && !tasksError) {
      const foundTaskIds = new Set(tasks.map(t => t.task_id));
      const foundIds = new Set(tasks.map(t => t.id));
      const remainingIds = allTaskIds.filter(id => !foundTaskIds.has(id) && !foundIds.has(id));

      if (remainingIds.length > 0) {
        // Try to find remaining by internal id
        const { data: additionalTasks } = await supabase
          .from("tasks")
          .select("id, task_id, workspace_id")
          .in("id", remainingIds);

        if (additionalTasks && additionalTasks.length > 0) {
          tasks = [...tasks, ...additionalTasks];
        }
      }
    }

    if (tasksError) {
      return NextResponse.json(
        { error: "Failed to validate tasks" },
        { status: 500 }
      );
    }

    // Create maps from both task_id and id to internal id
    const taskIdMap = new Map<string, string>();
    tasks?.forEach(task => {
      taskIdMap.set(task.task_id, task.id);  // Map friendly task_id to internal id
      taskIdMap.set(task.id, task.id);        // Map internal id to itself
    });

    // Check all tasks exist (check against both possible ID types)
    const missingTasks = allTaskIds.filter(id => !taskIdMap.has(id));
    if (missingTasks.length > 0) {
      return NextResponse.json(
        { error: `Tasks not found: ${missingTasks.join(", ")}` },
        { status: 404 }
      );
    }

    // If overwrite is true, delete existing dependencies for source tasks
    if (overwrite) {
      const sourceTaskInternalIds = dependencies
        .map(d => taskIdMap.get(d.sourceTaskId))
        .filter(Boolean) as string[];

      if (sourceTaskInternalIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("task_dependencies")
          .delete()
          .in("source_task_id", sourceTaskInternalIds);

      }
    }

    // Prepare dependencies for insertion
    const dependenciesToInsert = dependencies.map(dep => ({
      id: uuidv4(),
      source_task_id: taskIdMap.get(dep.sourceTaskId)!,
      target_task_id: taskIdMap.get(dep.targetTaskId)!,
      dependency_type: dep.dependencyType,
      reason: dep.reason || null,
      confidence: dep.confidence || null,
      created_by: user.id,
      created_at: new Date().toISOString(),
    }));

    // Check for duplicates if not overwriting
    if (!overwrite) {
      const sourceIds = dependenciesToInsert.map(d => d.source_task_id);
      const targetIds = dependenciesToInsert.map(d => d.target_task_id);

      const { data: existing } = await supabase
        .from("task_dependencies")
        .select("source_task_id, target_task_id")
        .in("source_task_id", sourceIds)
        .in("target_task_id", targetIds);

      if (existing && existing.length > 0) {
        // Filter out duplicates
        const existingSet = new Set(
          existing.map(e => `${e.source_task_id}-${e.target_task_id}`)
        );

        const filteredDeps = dependenciesToInsert.filter(
          d => !existingSet.has(`${d.source_task_id}-${d.target_task_id}`)
        );

        if (filteredDeps.length === 0) {
          return NextResponse.json({
            success: true,
            savedCount: 0,
            skippedCount: dependencies.length,
            message: "All dependencies already exist",
          });
        }

        // Insert only non-duplicate dependencies
        const { error: insertError } = await supabase
          .from("task_dependencies")
          .insert(filteredDeps);

        if (insertError) {
          return NextResponse.json(
            { error: "Failed to save dependencies" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          savedCount: filteredDeps.length,
          skippedCount: dependencies.length - filteredDeps.length,
          message: `Saved ${filteredDeps.length} dependencies, skipped ${dependencies.length - filteredDeps.length} duplicates`,
        });
      }
    }

    // Insert all dependencies
    const { error: insertError } = await supabase
      .from("task_dependencies")
      .insert(dependenciesToInsert);

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to save dependencies" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      savedCount: dependenciesToInsert.length,
      skippedCount: 0,
      message: `Successfully saved ${dependenciesToInsert.length} dependencies`,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspace/[workspaceId]/dependencies/save
 *
 * Deletes task dependencies.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
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

    // Look up the workspace and verify ownership
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

    const body = await request.json();
    const { dependencyIds, sourceTaskId, targetTaskId } = body;

    // Delete by dependency IDs
    if (dependencyIds && dependencyIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("task_dependencies")
        .delete()
        .in("id", dependencyIds);

      if (deleteError) {
        return NextResponse.json(
          { error: "Failed to delete dependencies" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        deletedCount: dependencyIds.length,
      });
    }

    // Delete by source and target task IDs
    if (sourceTaskId && targetTaskId) {
      // Look up internal task IDs
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, task_id")
        .in("task_id", [sourceTaskId, targetTaskId]);

      const taskIdMap = new Map<string, string>();
      tasks?.forEach(task => {
        taskIdMap.set(task.task_id, task.id);
      });

      const sourceInternalId = taskIdMap.get(sourceTaskId);
      const targetInternalId = taskIdMap.get(targetTaskId);

      if (!sourceInternalId || !targetInternalId) {
        return NextResponse.json(
          { error: "Tasks not found" },
          { status: 404 }
        );
      }

      const { error: deleteError } = await supabase
        .from("task_dependencies")
        .delete()
        .eq("source_task_id", sourceInternalId)
        .eq("target_task_id", targetInternalId);

      if (deleteError) {
        return NextResponse.json(
          { error: "Failed to delete dependency" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        deletedCount: 1,
      });
    }

    return NextResponse.json(
      { error: "Must provide dependencyIds or sourceTaskId and targetTaskId" },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
