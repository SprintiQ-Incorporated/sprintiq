/**
 * Story generation worker logic.
 * Extracted from API route SSE stream for background processing via QStash heavy queue.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoleRecommendation, TeamRecommendation } from "@/types";
import type { Persona } from "@/lib/database-aliases";
import { DEFAULT_WEIGHTS, ROLE_SKILLS } from "@/types";
import { logAICall } from "@/lib/log-ai-call";
import { trackAIUsage } from "@/lib/ai-usage-tracker";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoryGenerationPayload {
  sessionId: string;
  workspaceId: string;
  userId: string;
  featureDescription: string;
  complexity: "simple" | "moderate" | "complex";
  priorityWeights: typeof DEFAULT_WEIGHTS;
  /**
   * User-selected personas. Optional so older queued payloads that predate this
   * field still deserialize — worker defaults to [] when absent.
   */
  selectedPersonas?: Persona[];
  antiPatternPrevention: boolean;
  useTAWOS: boolean;
  projectId: string | null;
  provider: string;
  model: string;
  task_type: "story_generation";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function updateProgress(
  admin: SupabaseClient,
  sessionId: string,
  progress: number,
  progressMessage: string
): Promise<void> {
  await admin
    .from("story_generation_sessions")
    .update({ progress, progress_message: progressMessage } as any)
    .eq("id", sessionId);
}

/** Infer role recommendations from story tags (moved from API route) */
function inferRoleRecommendations(tags: string[], estimatedHours: number): RoleRecommendation[] {
  const recommendations: RoleRecommendation[] = [];
  const tagLower = tags.map(t => t.toLowerCase());

  const frontendTags = ['react', 'vue', 'angular', 'javascript', 'typescript', 'css', 'html', 'frontend', 'ui'];
  const hasFrontend = tagLower.some(t => frontendTags.some(ft => t.includes(ft)));

  const backendTags = ['api', 'node', 'python', 'java', 'database', 'sql', 'backend', 'server', 'rest', 'graphql'];
  const hasBackend = tagLower.some(t => backendTags.some(bt => t.includes(bt)));

  const designTags = ['ui', 'ux', 'design', 'figma', 'prototype', 'user experience'];
  const hasDesign = tagLower.some(t => designTags.some(dt => t.includes(dt)));

  const devopsTags = ['docker', 'kubernetes', 'ci/cd', 'aws', 'deployment', 'infrastructure'];
  const hasDevops = tagLower.some(t => devopsTags.some(dt => t.includes(dt)));

  const qaTags = ['test', 'testing', 'qa', 'quality', 'automation'];
  const hasQA = tagLower.some(t => qaTags.some(qt => t.includes(qt)));

  const level = estimatedHours > 24 ? "Senior" : estimatedHours > 12 ? "Mid" : "Junior";

  if (hasFrontend) {
    recommendations.push({
      role: "Frontend Developer",
      level: level as "Junior" | "Mid" | "Senior" | "Lead",
      requiredSkills: tags.filter(t => frontendTags.some(ft => t.toLowerCase().includes(ft))),
      estimatedHours: Math.round(estimatedHours * (hasBackend ? 0.5 : 0.8)),
      rationale: "Story involves frontend/UI development work",
    });
  }

  if (hasBackend) {
    recommendations.push({
      role: "Backend Developer",
      level: level as "Junior" | "Mid" | "Senior" | "Lead",
      requiredSkills: tags.filter(t => backendTags.some(bt => t.toLowerCase().includes(bt))),
      estimatedHours: Math.round(estimatedHours * (hasFrontend ? 0.5 : 0.8)),
      rationale: "Story involves backend/API development work",
    });
  }

  if (hasDesign) {
    recommendations.push({
      role: "UI/UX Designer",
      level: "Mid",
      requiredSkills: tags.filter(t => designTags.some(dt => t.toLowerCase().includes(dt))),
      estimatedHours: Math.round(estimatedHours * 0.3),
      rationale: "Story requires design work",
    });
  }

  if (hasDevops) {
    recommendations.push({
      role: "DevOps Engineer",
      level: "Mid",
      requiredSkills: tags.filter(t => devopsTags.some(dt => t.toLowerCase().includes(dt))),
      estimatedHours: Math.round(estimatedHours * 0.4),
      rationale: "Story involves infrastructure/deployment work",
    });
  }

  if (hasQA) {
    recommendations.push({
      role: "QA Engineer",
      level: "Mid",
      requiredSkills: tags.filter(t => qaTags.some(qt => t.toLowerCase().includes(qt))),
      estimatedHours: Math.round(estimatedHours * 0.2),
      rationale: "Story requires testing and quality assurance",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      role: "Full Stack Developer",
      level: level as "Junior" | "Mid" | "Senior" | "Lead",
      requiredSkills: tags.length > 0 ? tags : ["General Development"],
      estimatedHours,
      rationale: "Story requires general development skills",
    });
  }

  return recommendations;
}

/** Aggregate team recommendations from all stories (moved from API route) */
function aggregateTeamRecommendation(
  stories: Array<{ tags: string[]; estimatedHours: number; recommendedRoles?: RoleRecommendation[] }>
): TeamRecommendation {
  const roleMap = new Map<string, { count: number; skills: Set<string>; hours: number }>();
  let totalHours = 0;

  for (const story of stories) {
    const recommendations = story.recommendedRoles || inferRoleRecommendations(story.tags || [], story.estimatedHours || 8);

    for (const rec of recommendations) {
      totalHours += rec.estimatedHours;

      if (roleMap.has(rec.role)) {
        const existing = roleMap.get(rec.role)!;
        existing.hours += rec.estimatedHours;
        rec.requiredSkills.forEach(s => existing.skills.add(s));
      } else {
        roleMap.set(rec.role, {
          count: 1,
          skills: new Set(rec.requiredSkills),
          hours: rec.estimatedHours,
        });
      }
    }
  }

  const requiredRoles = Array.from(roleMap.entries()).map(([role, data]) => {
    const hoursPerPerson = 80;
    const count = Math.max(1, Math.ceil(data.hours / hoursPerPerson));
    return { role, count, skills: Array.from(data.skills) };
  });

  const totalPeople = requiredRoles.reduce((sum, r) => sum + r.count, 0);

  return {
    minimumTeamSize: Math.max(1, Math.ceil(totalPeople * 0.7)),
    optimalTeamSize: totalPeople,
    requiredRoles,
    totalEstimatedHours: totalHours,
    recommendation: `To complete this sprint optimally, you'll need ${totalPeople} team member${totalPeople > 1 ? "s" : ""} with ${requiredRoles.map(r => `${r.count}x ${r.role}`).join(", ")}. Total estimated effort: ${totalHours} hours.`,
  };
}

// ─── Main Worker Function ─────────────────────────────────────────────────────

/**
 * Process a story generation task in the heavy worker.
 * Updates session progress, calls generateTAWOSStories, enriches stories,
 * and writes results to both story_generation_sessions and ai_task_queue.
 *
 * NOTE: Stories are dual-written to `story_generation_sessions.generated_stories`
 * (source of truth for polling) and `ai_task_queue.result` (for queue system consistency).
 * Keep both in sync if modifying write logic.
 *
 * Sets `aiLogged = true` on the returned object so the heavy worker's finally
 * block can skip its zero-stub logAICall.
 */
export async function processStoryGeneration(
  admin: SupabaseClient,
  payload: StoryGenerationPayload,
  taskId: string
): Promise<{ aiLogged: boolean }> {
  const { sessionId } = payload;
  const startTime = Date.now();

  try {
    // 5% — Starting
    await updateProgress(admin, sessionId, 5, "Starting story generation...");

    // Dynamic import to avoid bundling "use server" file
    const { generateTAWOSStories } = await import("@/app/[workspaceId]/actions");

    // Call generateTAWOSStories with onProgress callback
    const result = await generateTAWOSStories({
      featureDescription: payload.featureDescription,
      complexity: payload.complexity,
      priorityWeights: payload.priorityWeights,
      teamMembers: [],
      selectedPersonas: payload.selectedPersonas ?? [],
      antiPatternPrevention: payload.antiPatternPrevention,
      workspaceId: payload.workspaceId,
      useTAWOS: payload.useTAWOS,
      onProgress: async (percent: number, message: string) => {
        await updateProgress(admin, sessionId, percent, message);
      },
    });

    if (result.error) {
      throw new Error(result.error);
    }

    // 85% already set by onProgress in generateTAWOSStories

    // Enrich stories with role recommendations
    const stories = (result.stories || []).map(story => {
      const estimatedHours = (story.storyPoints || 3) * 4;
      const tags = story.tags || [];
      const recommendedRoles = inferRoleRecommendations(tags, estimatedHours);

      return {
        id: story.id,
        title: story.title,
        role: story.role,
        want: story.want,
        benefit: story.benefit,
        acceptanceCriteria: story.acceptanceCriteria || [],
        requirements: story.description ? [story.description] : [],
        storyPoints: story.storyPoints || 3,
        estimatedHours,
        tags,
        antiPatternWarnings: [],
        skillMatch: undefined,
        missingSkills: [],
        type: "feature" as const,
        recommendedRoles,
      };
    });

    // 95% — Team recommendation
    await updateProgress(admin, sessionId, 95, "Finalizing stories...");

    const storiesForRecommendation = stories.map(s => ({
      tags: s.tags,
      estimatedHours: s.estimatedHours,
      recommendedRoles: s.recommendedRoles,
    }));
    const teamRecommendation = storiesForRecommendation.length > 0
      ? aggregateTeamRecommendation(storiesForRecommendation)
      : null;

    const duration = Date.now() - startTime;

    // Write to story_generation_sessions (source of truth for polling).
    // number_of_stories is written post-hoc as stories.length because count is
    // AI-determined at generation time; the route insert seeded 0 as a placeholder.
    await admin
      .from("story_generation_sessions")
      .update({
        status: "completed",
        generated_stories: stories,
        number_of_stories: stories.length,
        progress: 100,
        progress_message: "Complete",
        generation_time_ms: duration,
        completed_at: new Date().toISOString(),
        team_recommendation: teamRecommendation,
        ...(result.aiUsage && {
          ai_model: result.aiUsage.aiModel,
          ai_tokens_used: result.aiUsage.totalTokens,
          ai_cost_usd: result.aiUsage.costUsd,
        }),
      } as any)
      .eq("id", sessionId);

    // Write to ai_task_queue (secondary, for queue system consistency)
    await admin
      .from("ai_task_queue")
      .update({
        status: "complete",
        result: { stories, teamRecommendation },
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    // Log AI call with real token/cost data
    logAICall({
      taskId,
      provider: "claude",
      model: result.aiUsage?.aiModel || payload.model,
      queue: "heavy",
      taskType: "story_generation",
      success: true,
      inputTokens: result.aiUsage?.inputTokens || 0,
      outputTokens: result.aiUsage?.outputTokens || 0,
      costUsd: result.aiUsage?.costUsd || 0,
      durationMs: duration,
    }).catch(() => {});

    // Log to centralized AI usage table
    if (result.aiUsage) {
      trackAIUsage({
        workspaceId: payload.workspaceId,
        route: "generate-stories-worker",
        usage: result.aiUsage,
      }).catch(() => {});
    }

    return { aiLogged: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Story generation failed";

    // Mark session as failed
    await admin
      .from("story_generation_sessions")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
        generation_time_ms: duration,
        progress: 0,
        progress_message: "Failed",
      } as any)
      .eq("id", sessionId);

    // Mark task as failed
    await admin
      .from("ai_task_queue")
      .update({
        status: "failed",
        error_message: errorMessage,
        failed_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    // Log failed AI call
    logAICall({
      taskId,
      provider: "claude",
      model: payload.model,
      queue: "heavy",
      taskType: "story_generation",
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
