/**
 * Centralized AI Usage Tracking
 *
 * Extracts token usage from Anthropic API responses and logs to ai_usage_log table.
 * Used across all Claude call sites for cost monitoring.
 */

import { createAdminClient } from "@/lib/supabase/admin";

// Per-model pricing (USD per million tokens).
// Default = Sonnet 4.6 to preserve previous behavior for existing callers.
// DeepSeek pricing is approximate; accurate enough for cost monitoring.
const PRICING: Record<string, { input: number; output: number }> = {
  default: { input: 3.0, output: 15.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "deepseek-chat": { input: 0.27, output: 1.1 },
  "deepseek-coder": { input: 0.27, output: 1.1 },
};

function pricingFor(model: string): { input: number; output: number } {
  // Match by prefix so dated variants like claude-haiku-4-5-20251001 still resolve.
  for (const key of Object.keys(PRICING)) {
    if (key !== "default" && model.startsWith(key)) return PRICING[key];
  }
  return PRICING.default;
}

export interface AIUsageData {
  aiModel: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
}

/**
 * Calculate USD cost from token counts using model-specific Anthropic pricing.
 * Falls back to Sonnet pricing for unknown models.
 */
export function calculateAICost(
  inputTokens: number,
  outputTokens: number,
  model: string = "default"
): number {
  const { input, output } = pricingFor(model);
  return (
    (inputTokens / 1_000_000) * input +
    (outputTokens / 1_000_000) * output
  );
}

/**
 * Extract usage data from an Anthropic messages.create() response.
 */
export function extractAIUsage(response: {
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}): AIUsageData {
  const { model, usage } = response;
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const totalTokens = inputTokens + outputTokens;
  const costUsd = calculateAICost(inputTokens, outputTokens, model);

  return {
    aiModel: model,
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd,
  };
}

/**
 * Fire-and-forget insert into ai_usage_log via admin client.
 * Never throws — logs errors to console.
 */
export async function trackAIUsage({
  workspaceId,
  route,
  usage,
}: {
  workspaceId?: string;
  route: string;
  usage: AIUsageData;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    // Cast to any: ai_usage_log table is created via migration, not yet in generated types
    await (supabase.from("ai_usage_log" as any) as any).insert({
      workspace_id: workspaceId || null,
      route,
      ai_model: usage.aiModel,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      total_tokens: usage.totalTokens,
      cost_usd: usage.costUsd,
    });
  } catch (err) {
    console.error("[AI Usage Tracker] Failed to log usage:", err);
  }
}
