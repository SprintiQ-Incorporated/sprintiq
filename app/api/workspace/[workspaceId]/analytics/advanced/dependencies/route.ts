import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { buildDependencyGraph } from "@/lib/ai/dependency-analyzer";
import { resolveWorkspaceId } from "@/lib/api/workspace-resolver";

// Migrated from obsolete 'stories' table to 'tasks' table
// Now uses task_dependencies table for AI-generated dependencies
interface TaskRow {
  id: string;
  name: string;
  status_id: string;
  story_points: number | null;
  sprint_id: string | null;
  parent_task_id: string | null;
  priority: string | null;
}

interface TaskDependency {
  id: string;
  source_task_id: string;
  target_task_id: string;
  dependency_type: string;
  reason: string | null;
  confidence: number | null;
}

interface StatusData {
  id: string;
  name: string;
}

/**
 * GET /api/workspace/[workspaceId]/analytics/advanced/dependencies
 *
 * Returns dependency graph with critical path analysis,
 * bottleneck detection, and cluster identification.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const sprintId = searchParams.get("sprintId");

    const supabase = await createClient();

    // Check authentication (uses getSession to avoid 429 flood from parallel API calls)
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve workspace ID (supports both UUID and friendly ID)
    const workspace = await resolveWorkspaceId(supabase, workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Only show tasks in active sprints (prevents orphaned/unsprinted tasks
    // like "Local Bridge" from appearing as phantom nodes in the graph).
    // First fetch active sprint IDs, then scope tasks to those sprints.
    const { data: activeSprints } = await supabase
      .from("sprints")
      .select("id")
      .eq("workspace_id", workspace.uuid)
      .is("deleted_at", null)
      .not("status", "eq", "archived");

    const activeSprintIds = (activeSprints || []).map(s => s.id);

    let tasks: TaskRow[] = [];
    if (activeSprintIds.length > 0) {
      const query = supabase
        .from("tasks")
        .select(`
          id,
          name,
          status_id,
          story_points,
          sprint_id,
          parent_task_id,
          priority
        `)
        .eq("workspace_id", workspace.uuid)
        .is("deleted_at", null)
        .in("sprint_id", sprintId ? [sprintId] : activeSprintIds);

      const { data, error: tasksError } = await query
        .limit(200)
        .returns<TaskRow[]>();

      if (tasksError) {
        throw new Error(`Failed to fetch tasks: ${tasksError.message}`);
      }
      tasks = data || [];
    }

    // Fetch task dependencies — only keep edges where BOTH endpoints are in
    // the task set so orphaned references can't create phantom nodes.
    const taskIdSet = new Set(tasks.map(t => t.id));
    let taskDependencies: TaskDependency[] = [];

    if (taskIdSet.size > 0) {
      const taskIds = [...taskIdSet];
      const { data: deps, error: depsError } = await supabase
        .from("task_dependencies")
        .select("id, source_task_id, target_task_id, dependency_type, reason, confidence")
        .or(`source_task_id.in.(${taskIds.join(",")}),target_task_id.in.(${taskIds.join(",")})`)
        .returns<TaskDependency[]>();

      if (!depsError && deps) {
        // Drop edges that reference tasks outside the active set
        taskDependencies = deps.filter(
          d => taskIdSet.has(d.source_task_id) && taskIdSet.has(d.target_task_id)
        );
      }
    }

    // Build a map of task dependencies: taskId -> array of tasks it depends on (blockers)
    const dependencyMap = new Map<string, string[]>();
    const blockedByMap = new Map<string, string[]>();
    const relatedToMap = new Map<string, string[]>();

    for (const dep of taskDependencies) {
      if (dep.dependency_type === "blocks") {
        // source_task blocks target_task, so target depends on source
        if (!dependencyMap.has(dep.target_task_id)) {
          dependencyMap.set(dep.target_task_id, []);
        }
        dependencyMap.get(dep.target_task_id)!.push(dep.source_task_id);
      } else if (dep.dependency_type === "is_blocked_by") {
        // source_task is blocked by target_task
        if (!blockedByMap.has(dep.source_task_id)) {
          blockedByMap.set(dep.source_task_id, []);
        }
        blockedByMap.get(dep.source_task_id)!.push(dep.target_task_id);
      } else if (dep.dependency_type === "relates_to") {
        // bidirectional relationship
        if (!relatedToMap.has(dep.source_task_id)) {
          relatedToMap.set(dep.source_task_id, []);
        }
        relatedToMap.get(dep.source_task_id)!.push(dep.target_task_id);
      }
    }

    // Get status mapping for this workspace
    const { data: statuses } = await supabase
      .from("statuses")
      .select("id, name")
      .eq("workspace_id", workspace.uuid)
      .returns<StatusData[]>();

    const statusMap = new Map((statuses || []).map((s) => [s.id, s.name.toLowerCase()]));

    // Helper to convert status_id to status string
    const getStatusString = (statusId: string): "todo" | "in_progress" | "done" | "blocked" => {
      const statusName = statusMap.get(statusId) || "";
      if (statusName.includes("done") || statusName.includes("completed")) return "done";
      if (statusName.includes("progress") || statusName.includes("active")) return "in_progress";
      if (statusName.includes("blocked")) return "blocked";
      return "todo";
    };

    // Transform tasks for dependency analyzer
    // Uses task_dependencies table for AI-generated dependencies + parent_task_id as fallback
    const taskData = tasks.map((task) => {
      // Combine all dependency sources:
      // 1. Dependencies from task_dependencies table (blocks relationships)
      // 2. Dependencies from is_blocked_by relationships
      // 3. Legacy parent_task_id fallback
      const depsFromBlocks = dependencyMap.get(task.id) || [];
      const depsFromBlockedBy = blockedByMap.get(task.id) || [];
      const relatedTasks = relatedToMap.get(task.id) || [];

      // Combine and deduplicate
      const allDependencies = [...new Set([
        ...depsFromBlocks,
        ...depsFromBlockedBy,
        ...(task.parent_task_id && taskIdSet.has(task.parent_task_id) ? [task.parent_task_id] : []),
      ])];

      return {
        id: task.id,
        title: task.name,
        type: "story" as const,
        status: getStatusString(task.status_id),
        storyPoints: task.story_points || 0,
        priority: task.priority || "medium",
        dependencies: allDependencies,
        relatedTo: relatedTasks,
      };
    });

    // Fetch sprint names for tasks that have sprint_id
    const sprintIds = [...new Set(tasks.map(t => t.sprint_id).filter(Boolean))] as string[];
    const sprintNameMap = new Map<string, string>();

    if (sprintIds.length > 0) {
      const { data: sprints } = await supabase
        .from("sprints")
        .select("id, name")
        .in("id", sprintIds)
        .eq("workspace_id", workspace.uuid)
        .returns<{ id: string; name: string }[]>();

      (sprints || []).forEach(s => sprintNameMap.set(s.id, s.name));
    }

    // Create a map to store sprint info for each task
    const taskSprintMap = new Map(
      tasks.map((task) => [
        task.id,
        {
          sprintId: task.sprint_id,
          sprintName: task.sprint_id ? sprintNameMap.get(task.sprint_id) || null : null,
        },
      ])
    );

    // Build dependency graph
    const graph = buildDependencyGraph(taskData);

    // Build maps for dependencies and dependents
    const dependenciesMap = new Map<string, string[]>();
    const dependentsMap = new Map<string, string[]>();

    graph.edges.forEach((edge) => {
      if (edge.type === "blocks") {
        // edge.from blocks edge.to
        if (!dependenciesMap.has(edge.to)) {
          dependenciesMap.set(edge.to, []);
        }
        dependenciesMap.get(edge.to)!.push(edge.from);

        if (!dependentsMap.has(edge.from)) {
          dependentsMap.set(edge.from, []);
        }
        dependentsMap.get(edge.from)!.push(edge.to);
      }
    });

    // Check which nodes are on critical path
    const criticalPathSet = new Set(graph.criticalPath);
    const bottleneckNodeIds = new Set(graph.bottlenecks.map((b) => b.nodeId));

    // Map cluster membership
    const nodeClusterMap = new Map<string, string>();
    graph.clusters.forEach((cluster) => {
      cluster.nodeIds.forEach((nodeId) => {
        nodeClusterMap.set(nodeId, cluster.id);
      });
    });

    // Transform response
    const response = {
      nodes: graph.nodes.map((node) => {
        const sprintInfo = taskSprintMap.get(node.id);
        return {
          id: node.id,
          title: node.title,
          status: node.status,
          storyPoints: node.storyPoints,
          sprintId: sprintInfo?.sprintId || null,
          sprintName: sprintInfo?.sprintName || null,
          dependencies: dependenciesMap.get(node.id) || [],
          dependents: dependentsMap.get(node.id) || [],
          isOnCriticalPath: criticalPathSet.has(node.id),
          isBottleneck: bottleneckNodeIds.has(node.id),
          clusterId: nodeClusterMap.get(node.id) || null,
        };
      }),
      edges: graph.edges.map((edge) => ({
        from: edge.from,
        to: edge.to,
        type: edge.type,
        isOnCriticalPath: criticalPathSet.has(edge.from) && criticalPathSet.has(edge.to),
      })),
      criticalPath: graph.criticalPath,
      bottlenecks: graph.bottlenecks.map((b) => ({
        nodeId: b.nodeId,
        title: graph.nodes.find((n) => n.id === b.nodeId)?.title || "",
        blockedCount: b.blockedCount,
        totalImpactedPoints: b.totalImpactedPoints,
        severity: b.severity,
      })),
      clusters: graph.clusters.map((c) => ({
        id: c.id,
        name: c.name,
        nodeIds: c.nodeIds,
        health: c.health,
      })),
      metrics: {
        totalNodes: graph.metrics.totalNodes,
        totalEdges: graph.metrics.totalEdges,
        criticalPathLength: graph.metrics.criticalPathLength,
        maxDepth: graph.metrics.maxDependencyChain,
        averageDependencies: Math.round(graph.metrics.avgDependencyDepth * 10) / 10,
        blockedStories: graph.nodes.filter((n) => n.status === "blocked").length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Dependency graph error:", error);
    return NextResponse.json(
      { error: "Failed to build dependency graph" },
      { status: 500 }
    );
  }
}
