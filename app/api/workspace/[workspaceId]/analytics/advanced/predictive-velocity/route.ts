import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { resolveWorkspaceId } from "@/lib/api/workspace-resolver";
import {
  calculateVelocityWithConfidence,
} from "@/lib/analytics/predictive-analytics";
import { getCompletedStatusIds } from "@/lib/analytics/status-helpers";

interface SprintWithStatus {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
}

interface TaskWithStatus {
  id: string;
  status_id: string;
  story_points: number | null;
  sprint_id: string | null;
}


/**
 * GET /api/workspace/[workspaceId]/analytics/advanced/predictive-velocity
 *
 * Returns 3-sprint forward velocity projections with
 * confidence intervals and risk factors.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
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

    // Parallelize independent queries: sprints and completedStatusIds
    const [sprintsResult, completedStatusIds] = await Promise.all([
      supabase
        .from("sprints")
        .select(`
          id,
          name,
          start_date,
          end_date,
          status
        `)
        .eq("workspace_id", workspace.uuid)
        .is("deleted_at", null)
        .order("start_date", { ascending: true })
        .returns<SprintWithStatus[]>(),
      getCompletedStatusIds(supabase, workspace.uuid),
    ]);

    const { data: sprints, error: sprintsError } = sprintsResult;

    if (sprintsError) {
      throw new Error(`Failed to fetch sprints: ${sprintsError.message}`);
    }

    const sprintIds = sprints?.map((s) => s.id) || [];

    // Fetch tasks (depends on sprintIds, must be sequential)
    let tasks: TaskWithStatus[] = [];
    if (sprintIds.length > 0) {
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select(`
          id,
          status_id,
          story_points,
          sprint_id
        `)
        .in("sprint_id", sprintIds)
        .is("deleted_at", null)
        .returns<TaskWithStatus[]>();

      if (tasksError) {
        throw new Error(`Failed to fetch tasks: ${tasksError.message}`);
      }
      tasks = tasksData || [];
    }

    // Calculate historical velocity from completed live sprints. archived_sprints was
    // dropped in the OSS reduction, so live data is the only source of truth.
    const historicalData = (sprints || [])
      .filter((s) => s.status === "completed" || s.status === "done")
      .map((sprint) => {
        const sprintTasks = (tasks || []).filter(
          (t) => t.sprint_id === sprint.id
        );
        const completedTasks = sprintTasks.filter(
          (t) => completedStatusIds.includes(t.status_id)
        );
        const plannedPoints = sprintTasks.reduce(
          (sum, t) => sum + (t.story_points || 0),
          0
        );
        const completedPoints = completedTasks.reduce(
          (sum, t) => sum + (t.story_points || 0),
          0
        );

        return {
          sprint: sprint.name,
          actual: completedPoints,
          planned: plannedPoints,
          velocity: completedPoints,
          isPrediction: false,
          startDate: sprint.start_date,
        };
      })
      .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""))
      .map(({ startDate, ...rest }) => rest);

    // Calculate velocity metrics
    const velocities = historicalData.map((d) => d.velocity);
    const velocityAnalysis = calculateVelocityWithConfidence(velocities);

    // Generate predictions for next 3 sprints
    const lastSprint = sprints?.[sprints.length - 1];
    const predictions = [];

    for (let i = 1; i <= 3; i++) {
      const predictedVelocity = velocityAnalysis.predictedVelocity;
      const variance = velocityAnalysis.standardDeviation * (1 + i * 0.1);

      predictions.push({
        sprint: `Sprint ${(sprints?.length || 0) + i}`,
        predicted: Math.round(predictedVelocity),
        confidenceLow: Math.round(predictedVelocity - variance * 1.96),
        confidenceHigh: Math.round(predictedVelocity + variance * 1.96),
        isPrediction: true,
      });
    }

    // Combine historical and predictions
    const dataPoints = [...historicalData.slice(-6), ...predictions];

    // Calculate trend
    const recentVelocities = velocities.slice(-4);
    let trendPercentage = 0;
    let predictedTrend: "up" | "down" | "stable" = "stable";

    if (recentVelocities.length >= 2) {
      const first = recentVelocities.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
      const last =
        recentVelocities.slice(-2).reduce((a, b) => a + b, 0) / 2;
      trendPercentage = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
      predictedTrend = trendPercentage > 5 ? "up" : trendPercentage < -5 ? "down" : "stable";
    }

    // Identify risk factors
    const riskFactors = [];

    if (velocityAnalysis.coefficientOfVariation > 0.3) {
      riskFactors.push({
        id: "velocity-variance",
        name: "High Velocity Variance",
        impact: velocityAnalysis.coefficientOfVariation > 0.5 ? "high" : "medium",
        description: `Velocity varies by ${Math.round(velocityAnalysis.coefficientOfVariation * 100)}% - predictions less reliable`,
      });
    }

    if (trendPercentage < -10) {
      riskFactors.push({
        id: "declining-trend",
        name: "Declining Velocity Trend",
        impact: trendPercentage < -20 ? "high" : "medium",
        description: `Velocity has declined ${Math.abs(trendPercentage)}% recently`,
      });
    }

    if (velocities.length < 4) {
      riskFactors.push({
        id: "limited-data",
        name: "Limited Historical Data",
        impact: "medium",
        description: `Only ${velocities.length} completed sprints available for prediction`,
      });
    }

    // Generate recommendations
    const recommendations = [];

    if (riskFactors.some((r) => r.id === "velocity-variance")) {
      recommendations.push(
        "Reduce velocity variance by improving sprint planning accuracy"
      );
    }

    if (riskFactors.some((r) => r.id === "declining-trend")) {
      recommendations.push(
        "Investigate causes of velocity decline - check for blockers or capacity issues"
      );
    }

    if (predictedTrend === "stable") {
      recommendations.push(
        "Velocity is stable - good opportunity to experiment with process improvements"
      );
    }

    const response = {
      dataPoints,
      averageVelocity: Math.round(velocityAnalysis.averageVelocity),
      predictedTrend,
      trendPercentage,
      predictionAccuracy: Math.round(
        100 - velocityAnalysis.coefficientOfVariation * 50
      ),
      confidenceLevel: Math.round(velocityAnalysis.confidence * 100),
      riskFactors,
      recommendations,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Predictive velocity error:", error);
    return NextResponse.json(
      { error: "Failed to generate velocity predictions" },
      { status: 500 }
    );
  }
}
