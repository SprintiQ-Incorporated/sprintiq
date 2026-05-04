import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import {
  parseSessionMetrics,
  type SprintClaudeCodeAnalytics,
  type IssueBreakdown,
} from "@/lib/types/claude-code-metrics";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sprintId = searchParams.get("sprint_id");
    const workspaceId = searchParams.get("workspace_id");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!sprintId || !workspaceId) {
      return NextResponse.json(
        { error: "sprint_id and workspace_id are required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("owner_id")
      .eq("id", workspaceId)
      .maybeSingle();

    if (!workspace || workspace.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Get tasks in sprint
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, name, story_points")
      .eq("sprint_id", sprintId);

    if (!tasks || tasks.length === 0) {
      const emptyAnalytics: SprintClaudeCodeAnalytics = {
        sprintId,
        sessionCount: 0,
        totalDurationMs: 0,
        avgDurationMs: 0,
        totalFilesChanged: 0,
        totalCommits: 0,
        totalTestsPassed: 0,
        totalTestsFailed: 0,
        issuesByType: {},
        completionRate: 0,
        sessions: [],
        issues: [],
        aggregates: {
          totalBugsDetected: 0,
          totalTechDebtDetected: 0,
          totalPointsCompleted: 0,
          avgQualityScore: 0,
        },
        aiAcceptanceRate: 0,
        conflictRate: 0,
        lateArrivalRate: 0,
        conflictCount: 0,
        lateArrivalCount: 0,
      };
      return NextResponse.json(emptyAnalytics);
    }

    const taskIds = tasks.map((t) => t.id);
    const taskNameMap = new Map(tasks.map((t) => [t.id, t.name]));
    const taskPointsMap = new Map(tasks.map((t) => [t.id, t.story_points ?? 0]));

    // Fetch sessions (profiles joined separately — no FK from claude_code_sessions.user_id to profiles)
    let query = supabase
      .from("claude_code_sessions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("task_id", taskIds)
      .order("created_at", { ascending: false });

    if (from) {
      query = query.gte("created_at", from);
    }
    if (to) {
      query = query.lte("created_at", to);
    }

    const { data: sessions, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch sessions" },
        { status: 500 }
      );
    }

    const userIds = Array.from(
      new Set((sessions ?? []).map((s: any) => s.user_id).filter(Boolean))
    );
    const profileMap = new Map<string, string | null>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        profileMap.set(p.id, p.full_name ?? null);
      }
    }

    // Fetch claude_code_issues for these tasks
    const { data: issues } = await supabase
      .from("claude_code_issues")
      .select("id, issue_type, severity, title, file_path, status, suggested_points, created_at")
      .in("task_id", taskIds)
      .order("created_at", { ascending: false });

    const issuesBreakdown: IssueBreakdown[] = (issues ?? []).map((issue) => ({
      id: issue.id,
      type: issue.issue_type,
      severity: issue.severity,
      title: issue.title,
      filePath: issue.file_path,
      status: issue.status,
      suggestedPoints: issue.suggested_points,
      createdAt: issue.created_at,
    }));

    // Aggregate metrics — uses real top-level columns from live schema
    let totalDurationMs = 0;
    let totalFilesChanged = 0;
    let totalCommits = 0;
    let totalTestsPassed = 0;
    let totalTestsFailed = 0;
    let totalBugsDetected = 0;
    let totalTechDebtDetected = 0;
    const issuesByType: Record<string, number> = {};
    let completedCount = 0;
    let totalPointsCompleted = 0;
    let conflictCount = 0;
    let lateArrivalCount = 0;
    let statusAcceptedCount = 0;
    let totalAcMet = 0;
    let totalAcTotal = 0;

    const sessionResults = (sessions ?? []).map((session: any) => {
      const metrics = parseSessionMetrics(session.session_metrics);
      const userName = profileMap.get(session.user_id) ?? null;

      // Use real top-level columns (ac_met, ac_total, bugs_detected, tech_debt_detected)
      // with session_metrics jsonb as fallback for granular file/commit data
      const sessionBugs = session.bugs_detected ?? 0;
      const sessionTechDebt = session.tech_debt_detected ?? 0;

      if (metrics) {
        totalDurationMs += metrics.durationMs;
        totalFilesChanged += metrics.files.changed;
        totalCommits += metrics.git.commitCount;
        totalTestsPassed += metrics.tests.totalPassed;
        totalTestsFailed += metrics.tests.totalFailed;

        if (metrics.issues) {
          for (const issue of metrics.issues) {
            issuesByType[issue.type] = (issuesByType[issue.type] ?? 0) + 1;
          }
        }
      }

      totalBugsDetected += sessionBugs;
      totalTechDebtDetected += sessionTechDebt;

      if (session.status === "completed") {
        completedCount++;
        totalPointsCompleted += taskPointsMap.get(session.task_id) ?? 0;
      }
      if (session.conflict_detected) {
        conflictCount++;
      }
      if (session.is_late_arrival) {
        lateArrivalCount++;
      }
      if (session.status_accepted === true) {
        statusAcceptedCount++;
      }

      // Accumulate acceptance criteria from real columns
      totalAcMet += session.ac_met ?? 0;
      totalAcTotal += session.ac_total ?? 0;

      return {
        id: session.id,
        taskId: session.task_id,
        taskName: taskNameMap.get(session.task_id) ?? "Unknown",
        userId: session.user_id,
        userName,
        status: session.status,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        durationMs: metrics?.durationMs ?? 0,
        filesChanged: metrics?.files.changed ?? 0,
        commits: metrics?.git.commitCount ?? 0,
        bugsDetected: sessionBugs,
        techDebtDetected: sessionTechDebt,
        metrics,
      };
    });

    const sessionCount = sessionResults.length;

    // Quality score: 75% AC hit rate + 25% inverse bug density
    const acRate = totalAcTotal > 0 ? totalAcMet / totalAcTotal : 0;
    const bugDensity = sessionCount > 0
      ? Math.min(totalBugsDetected / sessionCount, 1)
      : 0;
    const avgQualityScore = totalAcTotal > 0 && sessionCount > 0
      ? Math.round((acRate * 0.75 + (1 - bugDensity) * 0.25) * 100) / 100
      : 0;

    const analytics: SprintClaudeCodeAnalytics = {
      sprintId,
      sessionCount,
      totalDurationMs,
      avgDurationMs: sessionCount > 0 ? Math.round(totalDurationMs / sessionCount) : 0,
      totalFilesChanged,
      totalCommits,
      totalTestsPassed,
      totalTestsFailed,
      issuesByType,
      completionRate: sessionCount > 0 ? completedCount / sessionCount : 0,
      sessions: sessionResults,
      issues: issuesBreakdown,
      aggregates: {
        totalBugsDetected,
        totalTechDebtDetected,
        totalPointsCompleted,
        avgQualityScore,
      },
      // Phase 1A: AI behavior metrics from real live columns
      // ac_met/ac_total: acceptance criteria hit rate across all sessions
      aiAcceptanceRate: totalAcTotal > 0
        ? Math.round((totalAcMet / totalAcTotal) * 100) / 100
        : 0,
      // conflict_detected: AI-human conflict frequency
      conflictRate: sessionCount > 0
        ? Math.round((conflictCount / sessionCount) * 100) / 100
        : 0,
      // is_late_arrival: late session rate
      lateArrivalRate: sessionCount > 0
        ? Math.round((lateArrivalCount / sessionCount) * 100) / 100
        : 0,
      conflictCount,
      lateArrivalCount,
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
