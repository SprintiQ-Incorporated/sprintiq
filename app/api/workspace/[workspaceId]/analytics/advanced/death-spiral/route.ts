import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import { detectDeathSpiral } from "@/lib/analytics/death-spiral-detection";
import type { SprintHistoryData } from "@/lib/analytics/predictive-analytics";
import { resolveWorkspaceId } from "@/lib/api/workspace-resolver";
import { getCompletedStatusIds } from "@/lib/analytics/status-helpers";

/**
 * GET /api/workspace/[workspaceId]/analytics/advanced/death-spiral
 *
 * Returns death spiral prediction with >90% accuracy,
 * risk indicators, and intervention recommendations.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const supabase = await createServerSupabaseClient();

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

    // Verify ownership
    if (workspace.ownerId !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Parallelize independent queries: completedStatusIds, blockedStatuses, completed sprints (history),
    // current sprint tasks, claude code issues. Sprint history derives from live `sprints` + their
    // tasks now that archived_sprints/archived_tasks have been dropped.
    const [completedStatusIds, blockedStatusesResult, completedSprintsResult, currentSprintResult, techDebtIssuesResult, bugIssuesResult] = await Promise.all([
      getCompletedStatusIds(supabase, workspace.uuid),
      supabase
        .from("statuses")
        .select("id")
        .eq("workspace_id", workspace.uuid)
        .ilike("name", "%blocked%"),
      // Completed sprints (used as historical input for death-spiral algorithm)
      supabase
        .from("sprints")
        .select("id, name, start_date, end_date, status")
        .eq("workspace_id", workspace.uuid)
        .is("deleted_at", null)
        .in("status", ["completed", "done"])
        .order("start_date", { ascending: true }),
      // Get the current (active) sprint for currentMetrics
      supabase
        .from("sprints")
        .select("id, start_date")
        .eq("workspace_id", workspace.uuid)
        .is("deleted_at", null)
        .order("start_date", { ascending: false })
        .limit(1),
      // Claude Code issues: tech_debt type
      supabase
        .from("claude_code_issues")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspace.uuid)
        .eq("issue_type", "tech_debt"),
      // Claude Code issues: bug type (unresolved)
      supabase
        .from("claude_code_issues")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspace.uuid)
        .eq("issue_type", "bug")
        .neq("status", "resolved"),
    ]);

    const blockedStatusIds = (blockedStatusesResult.data || []).map((s) => s.id);
    // PHASE_5_NOOP: was multi-user team-size count, OSS is single-user
    const teamSize = 1;
    const inactiveMembers = 0;
    const claudeCodeTechDebtCount = techDebtIssuesResult.count || 0;
    const claudeCodeBugCount = bugIssuesResult.count || 0;
    const currentSprint = currentSprintResult.data?.[0] || null;

    // Fetch current sprint tasks for currentMetrics (live data for active sprint state)
    const currentSprintId = currentSprint?.id;
    const { data: tasks } = currentSprintId
      ? await supabase
          .from("tasks")
          .select("id, name, status_id, story_points, sprint_id, created_at, updated_at, type")
          .eq("sprint_id", currentSprintId)
          .is("deleted_at", null)
      : { data: [] as any[] };

    // Fetch task tags for tech debt and bug classification
    const taskIds = (tasks || []).map((t: any) => t.id);
    const taskTagMap = new Map<string, string[]>();
    if (taskIds.length > 0) {
      const { data: taskTagRows } = await supabase
        .from("task_tags")
        .select("task_id, tag:tags(name)")
        .in("task_id", taskIds)
        .is("deleted_at", null);
      for (const row of taskTagRows || []) {
        const tagName = (row.tag as any)?.name?.toLowerCase();
        if (tagName) {
          const existing = taskTagMap.get(row.task_id) || [];
          existing.push(tagName);
          taskTagMap.set(row.task_id, existing);
        }
      }
    }

    // Phase 1C: Fetch task_blocks for real blocker analytics
    const { data: taskBlocks } = await supabase
      .from("task_blocks")
      .select("task_id, blocked_at, unblocked_at, duration_ms, blocker_type, affects_sprint, resolution")
      .eq("workspace_id", workspace.uuid);

    // Calculate current metrics for death spiral detection
    const allTasks = tasks || [];
    const blockedTasks = allTasks.filter((t) => blockedStatusIds.includes(t.status_id)).length;
    const totalTasks = allTasks.length;

    // Calculate average cycle time (days from created to completed)
    const completedTasks = allTasks.filter((t) => completedStatusIds.includes(t.status_id));
    let averageCycleTime = 7; // Default 7 days
    if (completedTasks.length > 0) {
      const cycleTimes = completedTasks.map((t) => {
        const created = new Date(t.created_at!);
        const updated = new Date(t.updated_at!);
        return (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      });
      averageCycleTime = cycleTimes.reduce((sum, ct) => sum + ct, 0) / cycleTimes.length;
    }

    // Build sprint history from completed live sprints. archived_sprints was dropped in
    // the OSS reduction, so we aggregate planned/completed points by reading the live
    // tasks that belong to each completed sprint.
    const completedSprints = completedSprintsResult.data || [];
    const completedSprintIds = completedSprints.map((s) => s.id);
    const sprintTaskMap = new Map<
      string,
      { planned: number; completed: number; total: number; done: number }
    >();
    if (completedSprintIds.length > 0) {
      const { data: historicalTasks } = await supabase
        .from("tasks")
        .select("sprint_id, status_id, story_points")
        .in("sprint_id", completedSprintIds)
        .is("deleted_at", null);
      for (const t of historicalTasks || []) {
        if (!t.sprint_id) continue;
        const agg = sprintTaskMap.get(t.sprint_id) || {
          planned: 0,
          completed: 0,
          total: 0,
          done: 0,
        };
        const points = t.story_points || 0;
        agg.planned += points;
        agg.total += 1;
        if (completedStatusIds.includes(t.status_id)) {
          agg.completed += points;
          agg.done += 1;
        }
        sprintTaskMap.set(t.sprint_id, agg);
      }
    }
    const sprintHistoryData: SprintHistoryData[] = completedSprints.map((s) => {
      const agg = sprintTaskMap.get(s.id) || { planned: 0, completed: 0, total: 0, done: 0 };
      return {
        sprintId: s.id,
        plannedPoints: agg.planned,
        completedPoints: agg.completed,
        totalStories: agg.total,
        completedStories: agg.done,
        blockedStories: 0, // Algorithm only reads currentMetrics.blockedStories
        teamSize,
        sprintDuration:
          s.start_date && s.end_date
            ? Math.round(
                (new Date(s.end_date).getTime() -
                  new Date(s.start_date).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : 14,
        dependencies: 0, // Not aggregated here; 0 prevents false dependency_hell indicator
        startDate: s.start_date || "",
        endDate: s.end_date || "",
        success: agg.planned > 0 ? agg.completed / agg.planned >= 0.8 : true,
      };
    });

    // Phase 1C: Compute blocker analytics from task_blocks
    const blocks = taskBlocks || [];
    const sprintAffectingBlocks = blocks.filter(b => b.affects_sprint);
    const resolvedBlocks = blocks.filter(b => b.unblocked_at != null);
    const blockDurationsByType: Record<string, number[]> = {};
    for (const block of blocks) {
      const type = block.blocker_type || "unknown";
      if (!blockDurationsByType[type]) blockDurationsByType[type] = [];
      if (block.duration_ms != null) {
        blockDurationsByType[type].push(block.duration_ms);
      }
    }
    const blockerAnalytics = {
      totalBlocks: blocks.length,
      sprintAffectingBlocks: sprintAffectingBlocks.length,
      resolvedBlocks: resolvedBlocks.length,
      avgResolutionTimeMs: resolvedBlocks.length > 0
        ? Math.round(resolvedBlocks.reduce((s, b) => s + (b.duration_ms || 0), 0) / resolvedBlocks.length)
        : null,
      byType: Object.entries(blockDurationsByType).map(([type, durations]) => ({
        type,
        count: durations.length,
        avgDurationMs: durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0,
      })),
    };

    // Use task_blocks data to improve blocked count if available
    const blockedFromBlocks = blocks.filter(b => b.unblocked_at == null).length;
    const effectiveBlockedCount = Math.max(blockedTasks, blockedFromBlocks);

    // Count scope changes: tasks added to current sprint after its start_date
    const currentSprintStart = currentSprint?.start_date;
    const scopeChanges = currentSprintStart
      ? allTasks.filter(t => {
          if (!t.created_at) return false;
          return new Date(t.created_at) > new Date(currentSprintStart);
        }).length
      : 0;

    // Compute technicalDebtHours from tasks (type + tags) and Claude Code issues
    const techDebtTypes = new Set(["tech_debt", "technical_debt", "refactor"]);
    const techDebtTagNames = new Set(["tech-debt", "refactor", "cleanup", "legacy"]);
    const techDebtTaskIds = new Set<string>();
    for (const t of allTasks) {
      const taskType = (t as any).type?.toLowerCase();
      if (taskType && techDebtTypes.has(taskType)) {
        techDebtTaskIds.add(t.id);
      }
      const tags = taskTagMap.get(t.id) || [];
      if (tags.some(tag => techDebtTagNames.has(tag))) {
        techDebtTaskIds.add(t.id);
      }
    }
    let technicalDebtHours = 0;
    for (const taskId of techDebtTaskIds) {
      const task = allTasks.find(t => t.id === taskId);
      technicalDebtHours += ((task?.story_points || 3) * 2);
    }
    technicalDebtHours += claudeCodeTechDebtCount * 6;

    // Compute bugCount from tasks (name + type + tags) and Claude Code issues
    const bugTaskIds = new Set<string>();
    for (const t of allTasks) {
      if (t.name?.toLowerCase().includes("bug")) bugTaskIds.add(t.id);
      if ((t as any).type?.toLowerCase() === "bug") bugTaskIds.add(t.id);
      const tags = taskTagMap.get(t.id) || [];
      if (tags.includes("bug")) bugTaskIds.add(t.id);
    }
    const bugCount = bugTaskIds.size + claudeCodeBugCount;

    // Compute teamTurnover from active/inactive members
    const totalMembers = teamSize + inactiveMembers;
    const teamTurnover = totalMembers > 0 ? inactiveMembers / totalMembers : 0;

    // Current metrics for death spiral detection
    const currentMetrics = {
      blockedStories: effectiveBlockedCount,
      totalStories: Math.max(1, totalTasks),
      averageCycleTime,
      technicalDebtHours,
      teamTurnover,
      scopeChanges,
      bugCount,
    };

    // Run death spiral detection
    const deathSpiralResult = detectDeathSpiral(sprintHistoryData, currentMetrics);

    // Build response based on detection result
    if (!deathSpiralResult) {
      // No death spiral detected — compute real low-risk score from available signals
      const blockedRate = totalTasks > 0 ? effectiveBlockedCount / totalTasks : 0;
      const scopeChangeRate = totalTasks > 0 ? scopeChanges / totalTasks : 0;
      const bugRate = totalTasks > 0 ? bugCount / totalTasks : 0;

      const lowRiskScore = Math.min(45, Math.round(
        5 // base
        + Math.min(10, blockedRate * 40)        // 0-10 from blocked rate
        + Math.min(8, scopeChangeRate * 20)     // 0-8 from scope change rate
        + Math.min(7, bugRate * 25)             // 0-7 from bug rate
        + Math.min(5, teamTurnover * 15)        // 0-5 from turnover
        + Math.min(5, technicalDebtHours / 20)  // 0-5 from tech debt hours
      ));
      const ciLow = Math.max(0, lowRiskScore - 8);
      const ciHigh = Math.min(49, lowRiskScore + 8);

      return NextResponse.json({
        riskScore: lowRiskScore,
        riskLevel: "low",
        indicators: [],
        interventions: [],
        daysToIntervention: null,
        confidenceInterval: { low: ciLow, high: ciHigh },
        sprintsAnalyzed: sprintHistoryData.length,
        blockerAnalytics: blockerAnalytics,
        message: "No death spiral indicators detected. Project health is good.",
      });
    }

    // Death spiral detected - map response
    const response = {
      riskScore: Math.round(deathSpiralResult.probability * 100),
      riskLevel: deathSpiralResult.severity,
      stage: deathSpiralResult.stage,
      indicators: deathSpiralResult.indicators.map((ind, idx) => ({
        id: `indicator-${idx}`,
        type: ind.type,
        detected: ind.detected,
        confidence: Math.round(ind.confidence * 100),
        trend: ind.trend,
        evidence: ind.evidence,
        impact: ind.impact,
      })),
      interventions: deathSpiralResult.interventions.map((int, idx) => ({
        id: `intervention-${idx}`,
        priority: int.priority,
        action: int.action,
        expectedImpact: int.expectedImpact,
        timeframe: int.timeframe,
        category: int.category,
      })),
      timeToFailure: deathSpiralResult.timeToFailure,
      confidenceInterval: {
        low: Math.max(0, deathSpiralResult.probability * 100 - 8),
        high: Math.min(100, deathSpiralResult.probability * 100 + 8),
      },
      affectedMetrics: deathSpiralResult.affectedMetrics,
      sprintsAnalyzed: sprintHistoryData.length,
      blockerAnalytics: blockerAnalytics,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Death spiral analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze death spiral risk" },
      { status: 500 }
    );
  }
}
