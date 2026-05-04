import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { verifyCsrfToken } from "@/lib/csrf-protection";
import type { ConflictData, ConflictFieldData, TaskSnapshot, Json } from "@/lib/database-aliases";

interface UpdateSessionRequest {
  status?: "active" | "completed" | "failed" | "stopped";
  error_message?: string;
  token?: string; // Session token for CLI auth
  proposed_changes?: {
    status_id?: string;
    assignee_id?: string | null;
    description?: string | null;
    story_points?: number | null;
    estimated_time?: number | null;
  };
  // Completion data from CLI
  metrics?: Record<string, unknown>;
  completion_report?: Record<string, unknown> | null;
  developer_notes?: string | null;
  proposed_status?: string | null;
  ac_met?: number | null;
  ac_total?: number | null;
  bugs_detected?: number | null;
  tech_debt_detected?: number | null;
  issues?: {
    type: string;
    title: string;
    description?: string;
    severity?: string;
    file_path?: string;
    line_number?: number;
    suggested_points?: number;
  }[];
  // Token accounting — written straight to claude_code_sessions columns.
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
}

const TERMINAL_STATUSES = ["completed", "failed", "stopped", "cancelled", "abandoned"];

/**
 * Validate session token (used by CLI).
 * Returns the session if the token matches and hasn't expired.
 */
async function validateSessionToken(
  sessionId: string,
  token: string
): Promise<{ valid: boolean; userId?: string }> {
  const supabase = createAdminClient();
  const { data: session, error } = await supabase
    .from("claude_code_sessions")
    .select("id, session_token, expires_at, user_id")
    .eq("id", sessionId)
    .single();

  if (error || !session) return { valid: false };
  if (session.session_token !== token) return { valid: false };
  if (new Date(session.expires_at) < new Date()) return { valid: false };

  return { valid: true, userId: session.user_id };
}

/**
 * Detect field-level conflicts between the task snapshot at session start,
 * the current task state, and the AI-proposed changes.
 */
function detectConflicts(
  snapshot: TaskSnapshot,
  currentTask: Record<string, unknown>,
  proposedChanges: Record<string, unknown>,
  sessionStartedAt: string
): ConflictData | null {
  const trackFields = ["status_id", "assignee_id", "description", "story_points", "estimated_time"];
  const fields: Record<string, ConflictFieldData> = {};
  let hasConflict = false;

  for (const field of trackFields) {
    const snapshotVal = (snapshot as unknown as Record<string, unknown>)[field] ?? null;
    const currentVal = currentTask[field] ?? null;
    const proposedVal = proposedChanges[field];

    // Skip fields the AI didn't propose changes for
    if (proposedVal === undefined) continue;

    const manuallyChanged = JSON.stringify(snapshotVal) !== JSON.stringify(currentVal);
    const aiWantsChange = JSON.stringify(currentVal) !== JSON.stringify(proposedVal);

    if (manuallyChanged && aiWantsChange) {
      // Both manual and AI changed this field — conflict
      fields[field] = {
        sessionStartValue: snapshotVal as Json,
        currentValue: currentVal as Json,
        aiProposedValue: proposedVal as Json,
        autoResolved: false,
      };
      hasConflict = true;
    } else if (!manuallyChanged && aiWantsChange) {
      // Only AI changed — auto-apply
      fields[field] = {
        sessionStartValue: snapshotVal as Json,
        currentValue: currentVal as Json,
        aiProposedValue: proposedVal as Json,
        autoResolved: true,
      };
    }
  }

  if (!hasConflict && Object.keys(fields).length === 0) return null;

  return {
    fields,
    taskUpdatedAt: currentTask.updated_at as string,
    sessionStartedAt,
    detectedAt: new Date().toISOString(),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    let body: UpdateSessionRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    let userId: string;

    // Auth path 1: Session token (CLI)
    if (body.token) {
      const validation = await validateSessionToken(sessionId, body.token);
      if (!validation.valid || !validation.userId) {
        return NextResponse.json(
          { error: "Invalid or expired session token" },
          { status: 401 }
        );
      }
      userId = validation.userId;
    } else {
      // Auth path 2: CSRF + browser cookie (UI)
      const csrfValid = await verifyCsrfToken(request);
      if (!csrfValid) {
        return NextResponse.json(
          { error: "Invalid CSRF token" },
          { status: 403 }
        );
      }

      const supabase = await createClient();
      const { user } = await getAuthUser(supabase);

      if (!user) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }
      userId = user.id;
    }

    const supabaseAdmin = createAdminClient();

    // Fetch current session to check for late arrival and get snapshot
    const { data: existingSession } = await supabaseAdmin
      .from("claude_code_sessions")
      .select("status, task_id, workspace_id, started_at, task_snapshot_at_start")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single();

    if (!existingSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.status) {
      updateData.status = body.status;
    }

    if (body.error_message !== undefined) {
      updateData.error_message = body.error_message;
    }

    if (
      body.status === "completed" ||
      body.status === "failed" ||
      body.status === "stopped"
    ) {
      updateData.completed_at = new Date().toISOString();
    }

    // Late arrival detection: session was already in a terminal state
    const isLateArrival = TERMINAL_STATUSES.includes(existingSession.status);
    if (isLateArrival) {
      updateData.is_late_arrival = true;
      // Store what the CLI actually reported for audit trail
      if (body.status) {
        updateData.late_arrival_reported_status = body.status;
      }
      // For late arrivals, allow status changes in specific cases:
      // 1. Abandoned/cancelled sessions accept any completion status
      // 2. "failed" overrides "completed" (failure is more critical info)
      // 3. Otherwise, keep existing terminal status
      if (existingSession.status === "abandoned" || existingSession.status === "cancelled") {
        updateData.status = body.status;
      } else if (body.status === "failed" && existingSession.status === "completed") {
        // Failure is more important than completion — allow the override
        updateData.status = body.status;
      } else {
        // Already in a terminal state that shouldn't be overridden
        delete updateData.status;
      }
    }

    // Store completion data from CLI
    if (body.completion_report !== undefined) {
      updateData.completion_report = body.completion_report;
    }
    if (body.developer_notes !== undefined) {
      updateData.developer_notes = body.developer_notes;
    }
    if (body.proposed_status !== undefined) {
      updateData.proposed_status = body.proposed_status;
    }
    if (body.ac_met != null) {
      updateData.ac_met = body.ac_met;
    }
    if (body.ac_total != null) {
      updateData.ac_total = body.ac_total;
    }
    if (body.bugs_detected != null) {
      updateData.bugs_detected = body.bugs_detected;
    }
    if (body.tech_debt_detected != null) {
      updateData.tech_debt_detected = body.tech_debt_detected;
    }
    if (body.metrics) {
      updateData.session_metrics = body.metrics;
    }

    // Telemetry goes in a separate, non-fatal update — a missing/renamed token
    // column must not take down core session completion. (Regression driver:
    // migration 20260422 landed in the repo but not in prod, combined UPDATE
    // failed with 42703, and an entire session's worth of status/metrics was
    // lost alongside the cost data.)
    const telemetryUpdate: Record<string, number> = {};
    if (typeof body.input_tokens === "number" && body.input_tokens >= 0) {
      telemetryUpdate.input_tokens = body.input_tokens;
    }
    if (typeof body.output_tokens === "number" && body.output_tokens >= 0) {
      telemetryUpdate.output_tokens = body.output_tokens;
    }
    if (typeof body.total_tokens === "number" && body.total_tokens >= 0) {
      telemetryUpdate.total_tokens = body.total_tokens;
    }
    if (typeof body.cost_usd === "number" && body.cost_usd >= 0) {
      telemetryUpdate.cost_usd = body.cost_usd;
    }

    // Conflict detection on completion with proposed changes
    // Compute task updates but defer execution until after session update succeeds
    let pendingTaskUpdate: Record<string, unknown> | null = null;

    // Bridge proposed_status → proposed_changes.status_id so the CLI can express intent
    // without knowing workspace-specific status UUIDs. Only fires when the CLI supplied
    // proposed_changes (even if empty) AND didn't already include a status_id.
    if (
      body.status === "completed" &&
      body.proposed_status === "completed" &&
      body.proposed_changes &&
      !body.proposed_changes.status_id
    ) {
      const { data: taskForStatus } = await supabaseAdmin
        .from("tasks")
        .select("project_id, workspace_id")
        .eq("id", existingSession.task_id!)
        .single();

      if (taskForStatus) {
        // A CLI task that completes is moved to "Testing" — not "Done" — because the
        // work still needs human verification before it's actually shipped.
        // Prefer a project-scoped testing status; fall back to any workspace testing status.
        const { data: testingStatus } = await supabaseAdmin
          .from("statuses")
          .select("id, is_default, project_id")
          .eq("workspace_id", taskForStatus.workspace_id!)
          .eq("type", "testing")
          .is("deleted_at", null)
          .order("project_id", { ascending: false, nullsFirst: false })
          .order("is_default", { ascending: false, nullsFirst: false })
          .limit(5);

        const resolved =
          testingStatus?.find((s) => s.project_id === taskForStatus.project_id && s.is_default) ??
          testingStatus?.find((s) => s.project_id === taskForStatus.project_id) ??
          testingStatus?.[0];

        if (resolved) {
          body.proposed_changes = { ...body.proposed_changes, status_id: resolved.id };
        }
        // If the project has no "testing" status, we deliberately do nothing — the CLI
        // will not move the card silently to a wrong column. The session still logs
        // completion; operator resolves manually.
      }
    }

    if (
      body.status === "completed" &&
      body.proposed_changes &&
      Object.keys(body.proposed_changes).length > 0 &&
      existingSession.task_snapshot_at_start
    ) {
      const snapshot = existingSession.task_snapshot_at_start as unknown as TaskSnapshot;

      // Fetch current task state
      const { data: currentTask } = await supabaseAdmin
        .from("tasks")
        .select("status_id, assignee_id, description, story_points, estimated_time, updated_at")
        .eq("id", existingSession.task_id)
        .single();

      if (currentTask) {
        const taskUpdatedAfterSessionStart =
          new Date(currentTask.updated_at!) > new Date(existingSession.started_at!);

        if (taskUpdatedAfterSessionStart) {
          const conflictData = detectConflicts(
            snapshot,
            currentTask as unknown as Record<string, unknown>,
            body.proposed_changes as unknown as Record<string, unknown>,
            existingSession.started_at!
          );

          if (conflictData) {
            const hasUnresolvedConflicts = Object.values(conflictData.fields).some(
              (f) => !f.autoResolved
            );

            if (hasUnresolvedConflicts) {
              updateData.conflict_detected = true;
              updateData.conflict_data = conflictData as unknown as Json;
            }

            // Prepare auto-apply for non-conflicting fields (deferred)
            const autoApplyUpdates: Record<string, unknown> = {};
            for (const [field, data] of Object.entries(conflictData.fields)) {
              if (data.autoResolved) {
                autoApplyUpdates[field] = data.aiProposedValue;
              }
            }

            if (Object.keys(autoApplyUpdates).length > 0) {
              autoApplyUpdates.updated_at = new Date().toISOString();
              pendingTaskUpdate = autoApplyUpdates;
            }
          }
        } else if (!isLateArrival) {
          // No manual changes during session — prepare to auto-apply all proposed changes
          pendingTaskUpdate = {
            ...body.proposed_changes,
            updated_at: new Date().toISOString(),
          };
        }
      }
    }

    const { data: session, error } = await supabaseAdmin
      .from("claude_code_sessions")
      .update(updateData)
      .eq("id", sessionId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("[claude-code/sessions] PATCH core update error:", error);
      return NextResponse.json(
        {
          error: "Failed to update session",
          supabase: {
            code: error.code,
            message: error.message,
            hint: error.hint,
            details: error.details,
          },
        },
        { status: 500 }
      );
    }

    const warnings: string[] = [];

    // Optional telemetry write — non-fatal. See the telemetryUpdate comment above.
    if (Object.keys(telemetryUpdate).length > 0) {
      const { error: telemetryError } = await supabaseAdmin
        .from("claude_code_sessions")
        .update(telemetryUpdate)
        .eq("id", sessionId)
        .eq("user_id", userId);

      if (telemetryError) {
        console.error("[claude-code/sessions] Token telemetry write skipped:", telemetryError);
        warnings.push(
          `Token usage not recorded (${telemetryError.code}: ${telemetryError.message}).`
        );
      }
    }

    // Apply deferred task updates now that the session update succeeded
    if (pendingTaskUpdate) {
      const { error: taskUpdateError } = await supabaseAdmin
        .from("tasks")
        .update(pendingTaskUpdate)
        .eq("id", existingSession.task_id);

      if (taskUpdateError) {
        console.error("[claude-code/sessions] Deferred task update error:", taskUpdateError);
        warnings.push(
          `Task changes not applied (${taskUpdateError.code}: ${taskUpdateError.message}). Try resolving manually.`
        );
      }
    }

    // Post-update: insert issues, create event, trigger sprint metrics
    if (
      body.status === "completed" ||
      body.status === "failed" ||
      body.status === "stopped"
    ) {
      // Insert detected issues
      if (body.issues && body.issues.length > 0) {
        const issueRows = body.issues.map((issue) => ({
          session_id: sessionId,
          task_id: existingSession.task_id!,
          workspace_id: existingSession.workspace_id!,
          issue_type: issue.type,
          title: issue.title,
          description: issue.description ?? null,
          severity: issue.severity ?? "medium",
          file_path: issue.file_path ?? null,
          line_number: issue.line_number ?? null,
          suggested_points: issue.suggested_points ?? null,
          status: "detected",
        }));

        const { error: issuesError } = await supabaseAdmin
          .from("claude_code_issues")
          .insert(issueRows);

        if (issuesError) {
          console.error("[claude-code/sessions] Issues insert error:", issuesError);
          warnings.push(
            `Failed to record ${issueRows.length} detected issue(s) (${issuesError.code}: ${issuesError.message}).`
          );
        }
      }

      // Trigger sprint metrics aggregation
      // Find the sprint for this task
      const { data: task } = await supabaseAdmin
        .from("tasks")
        .select("sprint_id")
        .eq("id", existingSession.task_id)
        .single();

      if (task?.sprint_id) {
        const { error: rpcError } = await supabaseAdmin.rpc(
          "calculate_sprint_metrics",
          { p_sprint_id: task.sprint_id }
        );

        if (rpcError) {
          console.error("[claude-code/sessions] Sprint metrics RPC error:", rpcError);
          warnings.push("Sprint metrics failed to recalculate. They will update on next sync.");
        }
      }
    }

    return NextResponse.json({
      session,
      ...(warnings.length > 0 ? { warnings } : {}),
      ...(pendingTaskUpdate ? { taskUpdated: true, updatedFields: Object.keys(pendingTaskUpdate).filter(k => k !== "updated_at") } : {}),
    });
  } catch (error) {
    console.error("[claude-code/sessions] PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
