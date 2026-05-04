import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { DEFAULT_WEIGHTS, type PriorityWeights } from "@/types";
import type { Persona } from "@/lib/database-aliases";
import {
  processContext,
  formatContextForPrompt,
  type ContextFile,
} from "@/lib/context-processor";
import {
  ACCEPTED_TYPES_LABEL,
  CONTEXT_BUDGET_BYTES,
  getFileExtension,
  isAcceptedExtension,
} from "@/lib/context-accepted-types";
import { withRateLimit } from "@/lib/rate-limit-v2";
import { verifyCsrfToken } from "@/lib/csrf-protection";
import { qstashClient } from "@/lib/qstash-client";

// Route segment config
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

// Type for context data from frontend
interface ContextData {
  text: string;
  urls: string[];
  files: ContextFile[];
}

// Type for the request body
interface GenerateStoriesRequest {
  prompt: string;
  projectId?: string;
  sprintDuration?: 1 | 2 | 3 | 4;
  complexity?: "simple" | "moderate" | "complex";
  useTAWOS?: boolean;
  // User-tuned knobs from SettingsDrawer. These were silently hardcoded to
  // DEFAULT_WEIGHTS / [] at the route layer prior to 2026-04-23, making the
  // drawer cosmetic — see the 20260423 fix-commit body for the full audit.
  priorityWeights?: PriorityWeights;
  selectedPersonas?: Persona[];
  contextData?: ContextData;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  // Verify CSRF token
  const csrfValid = await verifyCsrfToken(request);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const { workspaceId } = await params;

  // Verify authentication
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check rate limit (10 calls per hour per user)
  const rateLimitResponse = await withRateLimit(request, "ai_expensive", "user", user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Parse request body
  let body: GenerateStoriesRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body - failed to parse JSON" },
      { status: 400 }
    );
  }

  const {
    prompt,
    projectId,
    complexity = "moderate",
    useTAWOS = true,
    priorityWeights,
    selectedPersonas,
    contextData,
  } = body;

  if (!prompt || prompt.trim().length === 0) {
    return NextResponse.json(
      { error: "Prompt is required - please describe what you want to build" },
      { status: 400 }
    );
  }

  if (prompt.length > 10000) {
    return NextResponse.json(
      { error: "Prompt is too long. Please keep it under 10,000 characters." },
      { status: 400 }
    );
  }

  // Validate context files if provided. Allowlist + budget live in
  // lib/context-accepted-types.ts so client and server can't drift.
  // Budget is aggregate (sum of all uploaded files) — the client enforces the
  // same rule pre-upload; this is the authoritative check.
  if (contextData?.files?.length) {
    let totalBytes = 0;
    for (const file of contextData.files) {
      if (!isAcceptedExtension(file.name)) {
        const ext = getFileExtension(file.name);
        return NextResponse.json(
          {
            error: `File "${file.name}"${ext ? ` (.${ext})` : ""} is not a supported type. Accepted: ${ACCEPTED_TYPES_LABEL}.`,
          },
          { status: 400 }
        );
      }
      totalBytes += file.size;
    }
    if (totalBytes > CONTEXT_BUDGET_BYTES) {
      const limitKb = Math.round(CONTEXT_BUDGET_BYTES / 1024);
      const usedKb = (totalBytes / 1024).toFixed(1);
      return NextResponse.json(
        {
          error: `Uploaded files total ${usedKb} KB, which exceeds the ${limitKb} KB combined budget. Remove or shrink a file and try again.`,
        },
        { status: 400 }
      );
    }
  }

  // Process context data if provided
  let enrichedPrompt = prompt;

  if (contextData && (contextData.text || contextData.urls.length > 0 || contextData.files.length > 0)) {
    try {
      const processedContext = await processContext(contextData);
      if (processedContext.combinedText.length > 0) {
        const formattedContext = formatContextForPrompt(processedContext);
        enrichedPrompt = `${prompt}\n\n${formattedContext}`;
      }
    } catch (error) {
      console.error("[generate-stories] Context processing failed:", error);
      return NextResponse.json(
        { error: "Failed to process uploaded context files. Please check your files and try again." },
        { status: 400 }
      );
    }
  }

  // Cap prompt size before sending to Claude. 153KB+ prompts (seen in prod logs)
  // blow past the 90s Anthropic timeout because input-token processing + output
  // generation exceeds the budget. 45000 chars ≈ ~11000 input tokens, which
  // still leaves headroom for TAWOS persona, RAG context, anti-pattern
  // guidance, and output while absorbing a full 200 KB context upload.
  const MAX_PROMPT_CHARS = 45000;
  if (enrichedPrompt.length > MAX_PROMPT_CHARS) {
    console.warn("[generate-stories] Truncating oversized prompt", {
      originalLength: enrichedPrompt.length,
      truncatedTo: MAX_PROMPT_CHARS,
      userId: user.id,
      workspaceId,
    });
    enrichedPrompt =
      enrichedPrompt.slice(0, MAX_PROMPT_CHARS) +
      "\n\n[Content truncated to stay within AI timeout budget — original input was longer]";
  }

  // Look up the internal workspace UUID
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("workspace_id", workspaceId)
    .single();

  if (workspaceError || !workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const internalWorkspaceId = workspace.id;

  // Ensure user profile exists (required for FK constraint on story_generation_sessions)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    try {
      const admin = createAdminClient();
      await admin
        .from("profiles")
        .upsert(
          {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
            role: "user",
          },
          { onConflict: "id" }
        );
    } catch {
      return NextResponse.json(
        { error: "User profile not found. Please contact support." },
        { status: 500 }
      );
    }
  }

  // ── Create session ───────────────────────────────────────────────────────
  const adminClient = createAdminClient();
  const sessionInsertData = {
    workspace_id: internalWorkspaceId,
    user_id: user.id,
    feature_description: enrichedPrompt,
    // Placeholder: the worker overwrites this with stories.length on completion.
    // Column is NOT NULL so we insert 0 here rather than omit it.
    number_of_stories: 0,
    complexity,
    priority_weights: priorityWeights ?? DEFAULT_WEIGHTS,
    team_members: [],
    selected_personas: selectedPersonas ?? [],
    anti_pattern_prevention: true,
    status: "in_progress",
    started_at: new Date().toISOString(),
    progress: 0,
    progress_message: "Queued for processing...",
  };

  const { data: session, error: sessionError } = await adminClient
    .from("story_generation_sessions")
    .insert(sessionInsertData as any)
    .select("id")
    .single();

  if (sessionError || !session) {
    console.error("[generate-stories] Failed to create session:", sessionError);
    return NextResponse.json(
      { error: "Failed to create generation session" },
      { status: 500 }
    );
  }

  const sessionId = session.id;

  // ── Create ai_task_queue row ────────────────────────────────────────────
  const taskPayload = {
    sessionId,
    workspaceId: internalWorkspaceId,
    userId: user.id,
    featureDescription: enrichedPrompt,
    complexity,
    priorityWeights: priorityWeights ?? DEFAULT_WEIGHTS,
    selectedPersonas: selectedPersonas ?? [],
    antiPatternPrevention: true,
    useTAWOS,
    projectId: projectId || null,
    provider: "claude",
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    task_type: "story_generation" as const,
  };

  const { data: task, error: taskError } = await adminClient
    .from("ai_task_queue")
    .insert({
      workspace_id: internalWorkspaceId,
      created_by: user.id,
      queue: "heavy",
      task_type: "story_generation",
      source: "web",
      status: "queued",
      payload: taskPayload,
    } as any)
    .select("id")
    .single();

  if (taskError || !task) {
    console.error("[generate-stories] Failed to create task:", taskError);
    await adminClient
      .from("story_generation_sessions")
      .update({ status: "failed", error_message: "Failed to enqueue task" } as any)
      .eq("id", sessionId);
    return NextResponse.json(
      { error: "Failed to enqueue generation task" },
      { status: 500 }
    );
  }

  // ── Link session to task ────────────────────────────────────────────────
  await adminClient
    .from("story_generation_sessions")
    .update({ task_id: task.id } as any)
    .eq("id", sessionId);

  // ── Publish to QStash ───────────────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  try {
    await qstashClient.publishJSON({
      url: `${appUrl}/api/workers/heavy`,
      body: { taskId: task.id, ...taskPayload },
      retries: 3,
    });
  } catch (qstashError) {
    console.error("[generate-stories] QStash publish failed:", qstashError);
    await adminClient
      .from("ai_task_queue")
      .update({ status: "failed", error_message: "Failed to publish to queue" })
      .eq("id", task.id);
    await adminClient
      .from("story_generation_sessions")
      .update({ status: "failed", error_message: "Failed to publish to queue" } as any)
      .eq("id", sessionId);
    return NextResponse.json(
      { error: "Failed to enqueue generation task" },
      { status: 500 }
    );
  }

  // ── Return immediately ──────────────────────────────────────────────────
  return NextResponse.json({ taskId: task.id, sessionId }, { status: 202 });
}
