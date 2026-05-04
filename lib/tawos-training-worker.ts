/**
 * TAWOS training worker — processes training runs in the heavy queue.
 *
 * Branch A (source: "upload"): Embed new issues, then analyze patterns.
 * Branch B (source: "retraining_cron"): Re-analyze patterns only (no embedding).
 *
 * Follows the same pattern as story-generation-worker.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logAICall } from "@/lib/log-ai-call";
import { checkMultipleLimits } from "@/lib/rate-limit-v2";
import { generateBatchEmbeddings } from "@/lib/embedding-service";
import { convertIssueToStory } from "@/lib/tawos-training-helpers";
import type { TAWOSIssue } from "@/lib/tawos-training-helpers";
import type { VectorStory } from "@/lib/tawos-training-helpers";
import { qstashClient } from "@/lib/qstash-client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TawosTrainingPayload {
  trainingRunId: string;
  workspaceId: string;
  userId: string;
  task_type: "tawos_training";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function updateRunProgress(
  admin: SupabaseClient,
  trainingRunId: string,
  fields: Record<string, unknown>
): Promise<void> {
  await admin
    .from("tawos_training_runs" as any)
    .update(fields as any)
    .eq("id", trainingRunId);
}

async function insertFailure(
  admin: SupabaseClient,
  trainingRunId: string,
  issueKey: string,
  issueTitle: string | undefined,
  errorMessage: string,
  errorCode?: string
): Promise<void> {
  await (admin.from("tawos_training_failures" as any) as any).insert({
    training_run_id: trainingRunId,
    issue_key: issueKey,
    issue_title: issueTitle || null,
    error_message: errorMessage,
    error_code: errorCode || null,
  });
}

async function insertFailures(
  admin: SupabaseClient,
  trainingRunId: string,
  failures: Array<{ issueKey: string; issueTitle?: string; errorMessage: string; errorCode?: string }>
): Promise<void> {
  if (failures.length === 0) return;
  await (admin.from("tawos_training_failures" as any) as any).insert(
    failures.map((f) => ({
      training_run_id: trainingRunId,
      issue_key: f.issueKey,
      issue_title: f.issueTitle || null,
      error_message: f.errorMessage,
      error_code: f.errorCode || null,
    }))
  );
}

// ─── Main Worker ─────────────────────────────────────────────────────────────

export async function processTawosTraining(
  admin: SupabaseClient,
  payload: TawosTrainingPayload,
  taskId: string
): Promise<{ aiLogged: boolean }> {
  const { trainingRunId, workspaceId } = payload;
  const startTime = Date.now();

  try {
    // Fetch the training run
    const { data: run, error: fetchError } = await (admin
      .from("tawos_training_runs" as any) as any)
      .select("id, workspace_id, status, source, input_data, processed, failed, total_issues")
      .eq("id", trainingRunId)
      .single();

    if (fetchError || !run) {
      throw new Error(`Training run not found: ${trainingRunId}`);
    }

    // Mark as running
    await updateRunProgress(admin, trainingRunId, {
      status: "running",
      started_at: new Date().toISOString(),
      progress_message: "Starting training...",
    });

    const source = run.source as string;

    if (source === "retraining_cron") {
      await processBranchB(admin, trainingRunId, workspaceId);
    } else {
      await processBranchA(admin, trainingRunId, workspaceId, run, taskId, payload);
    }

    // Mark task complete
    await admin
      .from("ai_task_queue")
      .update({
        status: "complete",
        result: { trainingRunId },
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    const duration = Date.now() - startTime;
    logAICall({
      taskId,
      provider: "voyage",
      model: "voyage-3-large",
      queue: "heavy",
      taskType: "tawos_training",
      success: true,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      durationMs: duration,
    }).catch(() => {});

    return { aiLogged: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Training failed";

    // Mark training run as failed
    await updateRunProgress(admin, trainingRunId, {
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    });

    // Mark task as failed
    await admin
      .from("ai_task_queue")
      .update({
        status: "failed",
        error_message: errorMessage,
        failed_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    logAICall({
      taskId,
      provider: "voyage",
      model: "voyage-3-large",
      queue: "heavy",
      taskType: "tawos_training",
      success: false,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      durationMs: duration,
      errorCode: "processing_error",
      errorMessage,
    }).catch(() => {});

    return { aiLogged: true };
  }
}

// ─── Branch A: Upload (embedding ingestion + pattern analysis) ───────────────

async function processBranchA(
  admin: SupabaseClient,
  trainingRunId: string,
  workspaceId: string,
  run: any,
  taskId: string,
  payload: TawosTrainingPayload
): Promise<void> {
  const issues: TAWOSIssue[] = run.input_data || [];
  if (issues.length === 0) {
    await updateRunProgress(admin, trainingRunId, {
      status: "completed",
      progress_message: "No issues to process",
      completed_at: new Date().toISOString(),
    });
    return;
  }

  // Deduplicate within file
  const uniqueIssues = new Map<string, TAWOSIssue>();
  let duplicateInFile = 0;
  for (const issue of issues) {
    if (uniqueIssues.has(issue.Issue_Key)) {
      duplicateInFile++;
    } else {
      uniqueIssues.set(issue.Issue_Key, issue);
    }
  }
  const uniqueIssuesArray = Array.from(uniqueIssues.values());

  // Convert to stories
  const stories: VectorStory[] = [];
  const embeddingTexts: string[] = [];
  for (const issue of uniqueIssuesArray) {
    const { story, textForEmbedding } = convertIssueToStory(issue);
    stories.push(story);
    embeddingTexts.push(textForEmbedding);
  }

  // Check for existing stories in DB
  const issueKeys = stories.map((s) => s.metadata.originalIssueKey);
  const { data: existingStories } = await (admin
    .from("tawos_user_stories" as any) as any)
    .select("metadata")
    .in("metadata->originalIssueKey", issueKeys);

  const existingIssueKeys = new Set(
    (existingStories || [])
      .map((s: any) => s.metadata?.originalIssueKey)
      .filter(Boolean)
  );

  // Filter to new stories only
  const newStories: VectorStory[] = [];
  const newEmbeddingTexts: string[] = [];
  let duplicateInDB = 0;

  stories.forEach((story, index) => {
    if (existingIssueKeys.has(story.metadata.originalIssueKey)) {
      duplicateInDB++;
    } else {
      newStories.push(story);
      newEmbeddingTexts.push(embeddingTexts[index]);
    }
  });

  const newCount = newStories.length;

  // Update counts
  await updateRunProgress(admin, trainingRunId, {
    total_issues: issues.length,
    duplicate_in_file: duplicateInFile,
    duplicate_in_db: duplicateInDB,
    new_count: newCount,
    progress_message: newCount === 0
      ? "All issues already exist in database"
      : `Processing ${newCount} new issues...`,
  });

  if (newCount === 0) {
    await updateRunProgress(admin, trainingRunId, {
      status: "completed",
      processed: 0,
      failed: 0,
      progress_message: "No new issues to process",
      completed_at: new Date().toISOString(),
      result: { duplicateInFile, duplicateInDB, newCount: 0 },
    });
    return;
  }

  // Resume support: skip already-processed issues from a previous delivery
  const alreadyProcessed = run.processed as number || 0;
  const startIndex = alreadyProcessed;

  // Process in batches of 10
  const BATCH_SIZE = 10;
  let processed = alreadyProcessed;
  let failed = run.failed as number || 0;

  for (let i = startIndex; i < newStories.length; i += BATCH_SIZE) {
    // Rate limit check before each batch
    const rl = await checkMultipleLimits([
      { identifier: "global", preset: "voyage_batch" },
    ]);

    if (!rl.allowed) {
      // Save checkpoint and re-enqueue with delay
      await updateRunProgress(admin, trainingRunId, {
        processed,
        failed,
        progress_message: `Rate limited — resuming in ${Math.ceil(rl.retryAfter || 5)}s...`,
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      await qstashClient.publishJSON({
        url: `${appUrl}/api/workers/heavy`,
        body: { taskId, ...payload },
        delay: Math.ceil(rl.retryAfter || 5),
      });

      return; // Exit cleanly — will resume on next delivery
    }

    const batchStories = newStories.slice(i, i + BATCH_SIZE);
    const batchTexts = newEmbeddingTexts.slice(i, i + BATCH_SIZE);

    try {
      const batchResult = await generateBatchEmbeddings(batchTexts);
      const embeddings = batchResult?.embeddings ?? [];

      const storiesWithEmbeddings = batchStories.map((story, idx) => ({
        ...story,
        embedding: embeddings[idx] || [],
      }));

      const validStories = storiesWithEmbeddings.filter(
        (s) => s.embedding.length > 0
      );
      const invalidStories = storiesWithEmbeddings.filter(
        (s) => s.embedding.length === 0
      );

      // Insert valid stories
      if (validStories.length > 0) {
        const { error: insertError } = await (admin
          .from("tawos_user_stories" as any) as any)
          .insert(validStories);

        if (insertError) {
          console.error("[tawos-worker] Batch insert error:", insertError);
          // Record per-issue failures (batch)
          await insertFailures(
            admin,
            trainingRunId,
            validStories.map((story) => ({
              issueKey: story.metadata.originalIssueKey,
              issueTitle: story.metadata.title,
              errorMessage: `DB insert error: ${insertError.message}`,
              errorCode: "INSERT_ERROR",
            }))
          );
          failed += validStories.length;
        } else {
          processed += validStories.length;
        }
      }

      // Record failures for invalid stories (no embedding) — batch
      if (invalidStories.length > 0) {
        await insertFailures(
          admin,
          trainingRunId,
          invalidStories.map((story) => ({
            issueKey: story.metadata.originalIssueKey,
            issueTitle: story.metadata.title,
            errorMessage: "Embedding generation returned empty result",
            errorCode: "EMBEDDING_EMPTY",
          }))
        );
        failed += invalidStories.length;
      }
    } catch (batchError) {
      console.error("[tawos-worker] Batch processing error:", batchError);
      // Record failures for entire batch (batch insert)
      const batchErrorMsg = batchError instanceof Error ? batchError.message : "Batch processing failed";
      await insertFailures(
        admin,
        trainingRunId,
        batchStories.map((story) => ({
          issueKey: story.metadata.originalIssueKey,
          issueTitle: story.metadata.title,
          errorMessage: batchErrorMsg,
          errorCode: "BATCH_ERROR",
        }))
      );
      failed += batchStories.length;
    }

    // Update progress after each batch
    await updateRunProgress(admin, trainingRunId, {
      processed,
      failed,
      progress_message: `Processed ${processed + failed}/${newCount} issues...`,
    });

    // Delay between batches
    if (i + BATCH_SIZE < newStories.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Pattern analysis on newly ingested issues (sample of up to 50)
  await updateRunProgress(admin, trainingRunId, {
    progress_message: "Analyzing dataset patterns...",
  });

  try {
    const sampleIssues = issues.slice(0, 50);
    const { analyzeTAWOSDataset } = await import("@/lib/tawos-training-service");
    const analysis = await analyzeTAWOSDataset(sampleIssues);

    if (!analysis.error) {
      // Save patterns using admin client directly (worker has no user session)
      await (admin.from("tawos_training_data" as any) as any).insert({
        workspace_id: workspaceId,
        patterns: analysis.patterns,
        insights: analysis.insights,
        created_at: new Date().toISOString(),
      });
    }
  } catch (analysisError) {
    // Analysis failure is non-fatal — embedding ingestion already succeeded
    console.error("[tawos-worker] Pattern analysis failed:", analysisError);
  }

  // Mark completed
  await updateRunProgress(admin, trainingRunId, {
    status: "completed",
    processed,
    failed,
    progress_message: "Training completed",
    completed_at: new Date().toISOString(),
    result: {
      duplicateInFile,
      duplicateInDB,
      newCount,
      processed,
      failed,
    },
  });
}

// ─── Branch B: Retraining Cron (pattern refresh only) ────────────────────────

async function processBranchB(
  admin: SupabaseClient,
  trainingRunId: string,
  workspaceId: string
): Promise<void> {
  await updateRunProgress(admin, trainingRunId, {
    progress_message: "Loading existing stories for pattern refresh...",
  });

  // Read existing story metadata for the workspace
  const { data: existingStories, error: queryError } = await (admin
    .from("tawos_user_stories" as any) as any)
    .select("metadata")
    .limit(500);

  if (queryError || !existingStories || existingStories.length === 0) {
    await updateRunProgress(admin, trainingRunId, {
      status: "completed",
      progress_message: "No existing stories found for pattern refresh",
      completed_at: new Date().toISOString(),
      result: { message: "No stories to analyze" },
    });
    return;
  }

  // Convert stored metadata back to TAWOSIssue-like objects for analyzeTAWOSDataset
  const pseudoIssues: TAWOSIssue[] = existingStories.map((s: any) => {
    const m = s.metadata || {};
    return {
      ID: 0,
      Issue_Key: m.originalIssueKey || "UNKNOWN",
      URL: "",
      Title: m.title || "",
      Description: m.description || "",
      Description_Text: m.description || "",
      Description_Code: "",
      Type: m.originalType || "Task",
      Priority: m.priority || "Medium",
      Status: m.originalStatus || "Done",
      Resolution: null,
      Creation_Date: "",
      Estimation_Date: "",
      Resolution_Date: null,
      Last_Updated: "",
      Story_Point: m.storyPoints || 0,
      Timespent: null,
      In_Progress_Minutes: 0,
      Total_Effort_Minutes: m.totalEffort || 0,
      Resolution_Time_Minutes: m.resolutionTime || 0,
      Title_Changed_After_Estimation: 0,
      Description_Changed_After_Estimation: 0,
      Story_Point_Changed_After_Estimation: 0,
      Pull_Request_URL: "",
      Creator_ID: 0,
      Reporter_ID: 0,
      Assignee_ID: null,
      Project_ID: 0,
      Sprint_ID: null,
    };
  });

  await updateRunProgress(admin, trainingRunId, {
    progress_message: "Analyzing patterns with AI...",
  });

  try {
    const { analyzeTAWOSDataset } = await import("@/lib/tawos-training-service");
    const analysis = await analyzeTAWOSDataset(pseudoIssues.slice(0, 50));

    if (!analysis.error) {
      await (admin.from("tawos_training_data" as any) as any).insert({
        workspace_id: workspaceId,
        patterns: analysis.patterns,
        insights: analysis.insights,
        created_at: new Date().toISOString(),
      });
    }
  } catch (analysisError) {
    console.error("[tawos-worker] Retraining analysis failed:", analysisError);
  }

  await updateRunProgress(admin, trainingRunId, {
    status: "completed",
    processed: 0,
    failed: 0,
    progress_message: "Pattern refresh completed",
    completed_at: new Date().toISOString(),
    result: { message: "Patterns refreshed", storiesAnalyzed: pseudoIssues.length },
  });
}
