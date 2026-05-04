/**
 * AI Provider Abstraction Layer with Complexity-Based Routing
 *
 * Routes complex reasoning tasks to Anthropic Claude and simpler tasks to DeepSeek
 * for cost optimization while maintaining quality for complex operations.
 */

import { Anthropic } from "@anthropic-ai/sdk";
import { calculateAICost, extractAIUsage, trackAIUsage } from "@/lib/ai-usage-tracker";
import { getCircuitState, recordFailure, recordSuccess } from "@/lib/circuit-breaker";

// Types for AI provider configuration
export type AIProvider = "claude" | "deepseek";
export type TaskComplexity = "simple" | "moderate" | "complex";

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AICompletionOptions {
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  /**
   * Identifier written to ai_usage_log.route — feature-specific so cost
   * reports can attribute usage by tool. Defaults to "ai-provider" if a
   * caller omits it (legacy bucket).
   */
  route?: string;
  /** Workspace UUID — written to ai_usage_log.workspace_id. */
  workspaceId?: string;
}

export interface AICompletionResult {
  text: string;
  provider: AIProvider;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// Task complexity indicators for automatic routing
export interface TaskComplexityIndicators {
  // Content indicators
  promptLength?: number;
  numberOfOutputItems?: number;

  // Reasoning complexity
  requiresMultiStepReasoning?: boolean;
  requiresContextualUnderstanding?: boolean;
  requiresDependencyAnalysis?: boolean;
  requiresPatternRecognition?: boolean;

  // Domain complexity
  hasPersonaContext?: boolean;
  hasTeamContext?: boolean;
  hasAntiPatternPrevention?: boolean;
  hasBusinessValueAnalysis?: boolean;

  // Override
  forceProvider?: AIProvider;
}

// Model configurations - configurable via env vars
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

// Timeout configuration
const CLAUDE_TIMEOUT_MS = 60000; // 60 seconds
const DEEPSEEK_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Custom error class for DeepSeek API timeouts
 */
export class DeepSeekTimeoutError extends Error {
  constructor(message: string = "DeepSeek API request timed out after 30 seconds") {
    super(message);
    this.name = "DeepSeekTimeoutError";
  }
}

/**
 * Check if an error should trigger fallback to Deepseek
 */
function shouldFallbackToDeepseek(error: any): boolean {
  // Timeout errors
  if (error?.name === "AbortError" || error?.message?.includes("timeout")) {
    return true;
  }

  // Rate limiting (429)
  if (error?.status === 429 || error?.message?.includes("rate limit")) {
    return true;
  }

  // Service unavailable (5xx)
  if (error?.status >= 500 && error?.status < 600) {
    return true;
  }

  // API key issues (401/403)
  if (error?.status === 401 || error?.status === 403) {
    return true;
  }

  // Network errors
  if (error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND") {
    return true;
  }

  return false;
}

/**
 * Detect task complexity based on indicators
 */
export function detectTaskComplexity(
  indicators: TaskComplexityIndicators
): TaskComplexity {
  // Force provider override
  if (indicators.forceProvider) {
    return indicators.forceProvider === "claude" ? "complex" : "simple";
  }

  let complexityScore = 0;

  // Content-based scoring
  if (indicators.promptLength && indicators.promptLength > 2000)
    complexityScore += 2;
  else if (indicators.promptLength && indicators.promptLength > 500)
    complexityScore += 1;

  if (indicators.numberOfOutputItems && indicators.numberOfOutputItems > 5)
    complexityScore += 2;
  else if (indicators.numberOfOutputItems && indicators.numberOfOutputItems > 2)
    complexityScore += 1;

  // Reasoning complexity scoring
  if (indicators.requiresMultiStepReasoning) complexityScore += 3;
  if (indicators.requiresContextualUnderstanding) complexityScore += 2;
  if (indicators.requiresDependencyAnalysis) complexityScore += 3;
  if (indicators.requiresPatternRecognition) complexityScore += 2;

  // Domain complexity scoring
  if (indicators.hasPersonaContext) complexityScore += 2;
  if (indicators.hasTeamContext) complexityScore += 1;
  if (indicators.hasAntiPatternPrevention) complexityScore += 2;
  if (indicators.hasBusinessValueAnalysis) complexityScore += 2;

  // Map score to complexity level
  if (complexityScore >= 6) return "complex";
  if (complexityScore >= 3) return "moderate";
  return "simple";
}

/**
 * Select the appropriate AI provider based on task complexity
 */
export function selectProvider(complexity: TaskComplexity): AIProvider {
  // Complex tasks require Claude's superior reasoning
  if (complexity === "complex") return "claude";

  // Moderate tasks can use Claude Sonnet for balance
  if (complexity === "moderate") return "claude";

  // Simple tasks can use DeepSeek for cost efficiency
  return "deepseek";
}

/**
 * Get Claude completion with automatic fallback to Deepseek
 */
async function getClaudeCompletion(
  options: AICompletionOptions,
  complexity: TaskComplexity,
  allowFallback: boolean = true
): Promise<AICompletionResult> {
  // Circuit breaker check — skip Claude entirely if circuit is OPEN
  const claudeCircuit = await getCircuitState("claude");
  if (claudeCircuit === "OPEN") {
    console.warn("[CircuitBreaker] Claude circuit OPEN, skipping to DeepSeek");
    if (allowFallback && process.env.DEEPSEEK_API_KEY) {
      return getDeepSeekCompletionDirect(options);
    }
    throw new Error("Claude circuit breaker is OPEN and no fallback available");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // If no Anthropic key and Deepseek is available, use it as fallback
    if (allowFallback && process.env.DEEPSEEK_API_KEY) {
      return getDeepSeekCompletionDirect(options);
    }
    throw new Error("Anthropic API key is not configured. Please set ANTHROPIC_API_KEY in your environment variables.");
  }

  const anthropic = new Anthropic({ apiKey });

  const model = CLAUDE_MODEL;

  const messages = options.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // Ensure we have at least one message
  if (messages.length === 0) {
    throw new Error("At least one user or assistant message is required");
  }

  const systemMessage = options.messages.find((m) => m.role === "system");
  const systemContent = systemMessage?.content || options.systemPrompt;


  try {
    // Build request object - match original working format exactly
    const requestBody: {
      model: string;
      max_tokens: number;
      temperature: number;
      system?: string;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    } = {
      model,
      max_tokens: options.maxTokens || 2000,
      temperature: options.temperature ?? 0.7,
      messages,
    };

    // Only add system if it has content
    if (systemContent) {
      requestBody.system = systemContent;
    }


    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const error = new Error("Claude API request timed out");
        (error as any).name = "AbortError";
        reject(error);
      }, CLAUDE_TIMEOUT_MS);
    });

    // Race between API call and timeout
    const response = await Promise.race([
      anthropic.messages.create(requestBody),
      timeoutPromise,
    ]);

    const aiUsage = extractAIUsage(response);
    trackAIUsage({
      workspaceId: options.workspaceId,
      route: options.route ?? "ai-provider",
      usage: aiUsage,
    }).catch(() => {});

    const textContent = response.content.find(
      (c: { type: string }) => c.type === "text"
    ) as { type: "text"; text: string } | undefined;

    // Circuit breaker: record success
    recordSuccess("claude").catch(() => {});

    return {
      text: textContent?.text || "",
      provider: "claude",
      model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  } catch (error: any) {
    console.error(`[Claude] API error:`, error?.message || error);

    // Circuit breaker: record failure
    recordFailure("claude").catch(() => {});

    // Check if we should fallback to Deepseek
    if (allowFallback && shouldFallbackToDeepseek(error)) {
      return getDeepSeekCompletionDirect(options);
    }

    throw error;
  }
}

/**
 * Direct Deepseek completion (used for fallback, bypasses complexity routing)
 */
async function getDeepSeekCompletionDirect(
  options: AICompletionOptions
): Promise<AICompletionResult> {
  // Circuit breaker check — fail fast if DeepSeek is OPEN
  const dsCircuit = await getCircuitState("deepseek");
  if (dsCircuit === "OPEN") {
    throw new Error("DeepSeek circuit breaker is OPEN — service temporarily unavailable");
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Deepseek API key is not configured and Claude is unavailable");
  }

  const messages = options.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Add system prompt if provided and not already in messages
  if (
    options.systemPrompt &&
    !options.messages.some((m) => m.role === "system")
  ) {
    messages.unshift({ role: "system", content: options.systemPrompt });
  }


  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature ?? 0.7,
      }),
      signal: controller.signal,
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    // Circuit breaker: record failure
    recordFailure("deepseek").catch(() => {});
    if (error.name === "AbortError") {
      console.error("[Deepseek Fallback] Request timed out after 30 seconds");
      throw new DeepSeekTimeoutError("DeepSeek API request timed out after 30 seconds");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    // Only log status code — response body may contain sensitive info
    console.error(`[Deepseek Fallback] API error: ${response.status} ${response.statusText}`);
    // Circuit breaker: record failure
    recordFailure("deepseek").catch(() => {});
    throw new Error(`Deepseek API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  // Circuit breaker: record success
  recordSuccess("deepseek").catch(() => {});

  if (data.usage) {
    const inputTokens = data.usage.prompt_tokens ?? 0;
    const outputTokens = data.usage.completion_tokens ?? 0;
    trackAIUsage({
      workspaceId: options.workspaceId,
      route: options.route ?? "ai-provider",
      usage: {
        aiModel: DEEPSEEK_MODEL,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUsd: calculateAICost(inputTokens, outputTokens, DEEPSEEK_MODEL),
      },
    }).catch(() => {});
  }

  return {
    text: content,
    provider: "deepseek",
    model: DEEPSEEK_MODEL,
    usage: data.usage
      ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
        }
      : undefined,
  };
}

/**
 * Get DeepSeek completion
 */
async function getDeepSeekCompletion(
  options: AICompletionOptions
): Promise<AICompletionResult> {
  // Circuit breaker check — fail fast if DeepSeek is OPEN
  const dsCircuit = await getCircuitState("deepseek");
  if (dsCircuit === "OPEN") {
    console.warn("[CircuitBreaker] DeepSeek circuit OPEN, falling back to Claude");
    return getClaudeCompletion(options, "simple");
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    // Fallback to Claude if DeepSeek is not configured
    return getClaudeCompletion(options, "simple");
  }

  const messages = options.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Add system prompt if provided and not already in messages
  if (
    options.systemPrompt &&
    !options.messages.some((m) => m.role === "system")
  ) {
    messages.unshift({ role: "system", content: options.systemPrompt });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature ?? 0.7,
      }),
      signal: controller.signal,
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    // Circuit breaker: record failure
    recordFailure("deepseek").catch(() => {});
    if (error.name === "AbortError") {
      console.error("[DeepSeek] Request timed out after 30 seconds, falling back to Claude");
      return getClaudeCompletion(options, "simple");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    // Only log status code — response body may contain sensitive info
    console.error(`[DeepSeek] API error: ${response.status} ${response.statusText}`);
    // Circuit breaker: record failure
    recordFailure("deepseek").catch(() => {});
    // Fallback to Claude on error
    return getClaudeCompletion(options, "simple");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  // Circuit breaker: record success
  recordSuccess("deepseek").catch(() => {});

  if (data.usage) {
    const inputTokens = data.usage.prompt_tokens ?? 0;
    const outputTokens = data.usage.completion_tokens ?? 0;
    trackAIUsage({
      workspaceId: options.workspaceId,
      route: options.route ?? "ai-provider",
      usage: {
        aiModel: DEEPSEEK_MODEL,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUsd: calculateAICost(inputTokens, outputTokens, DEEPSEEK_MODEL),
      },
    }).catch(() => {});
  }

  return {
    text: content,
    provider: "deepseek",
    model: DEEPSEEK_MODEL,
    usage: data.usage
      ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
        }
      : undefined,
  };
}

/**
 * Main AI completion function with automatic routing
 */
export async function getAICompletion(
  options: AICompletionOptions,
  complexityIndicators?: TaskComplexityIndicators
): Promise<AICompletionResult> {
  // Detect complexity
  const complexity = complexityIndicators
    ? detectTaskComplexity(complexityIndicators)
    : "moderate";

  // Select provider
  const provider = selectProvider(complexity);// Route to appropriate provider
  if (provider === "deepseek") {
    return getDeepSeekCompletion(options);
  }

  return getClaudeCompletion(options, complexity);
}

/**
 * Convenience function for simple text completions
 */
export async function getSimpleCompletion(
  prompt: string,
  options?: {
    maxTokens?: number;
    temperature?: number;
    forceProvider?: AIProvider;
  }
): Promise<string> {
  const result = await getAICompletion(
    {
      messages: [{ role: "user", content: prompt }],
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
    },
    {
      promptLength: prompt.length,
      forceProvider: options?.forceProvider,
    }
  );

  return result.text;
}

/**
 * Task-specific completion functions with predefined complexity routing
 */

// COMPLEX TASKS - Always use Claude

/**
 * Generate user stories with TAWOS patterns (COMPLEX - Claude)
 */
export async function generateStoriesCompletion(
  prompt: string,
  options: {
    numberOfStories: number;
    hasPersonaContext: boolean;
    hasTeamContext: boolean;
    hasAntiPatternPrevention: boolean;
    maxTokens?: number;
  }
): Promise<AICompletionResult> {
  return getAICompletion(
    {
      messages: [{ role: "user", content: prompt }],
      maxTokens: options.maxTokens || Math.max(3000, options.numberOfStories * 500),
      temperature: 0.7,
      route: "story/generate",
    },
    {
      promptLength: prompt.length,
      numberOfOutputItems: options.numberOfStories,
      requiresMultiStepReasoning: true,
      requiresPatternRecognition: true,
      hasPersonaContext: options.hasPersonaContext,
      hasTeamContext: options.hasTeamContext,
      hasAntiPatternPrevention: options.hasAntiPatternPrevention,
      forceProvider: "claude", // Always use Claude for story generation
    }
  );
}

/**
 * Analyze story dependencies (COMPLEX - Claude)
 */
export async function analyzeDependenciesCompletion(
  prompt: string,
  storyCount: number
): Promise<AICompletionResult> {
  return getAICompletion(
    {
      messages: [{ role: "user", content: prompt }],
      maxTokens: 2000,
      temperature: 0.7,
      route: "dependencies/analyze",
    },
    {
      promptLength: prompt.length,
      numberOfOutputItems: storyCount,
      requiresDependencyAnalysis: true,
      requiresMultiStepReasoning: true,
      forceProvider: "claude", // Always use Claude for dependency analysis
    }
  );
}

/**
 * Generate sprint goals (COMPLEX - Claude)
 */
export async function generateSprintGoalCompletion(
  prompt: string
): Promise<AICompletionResult> {
  return getAICompletion(
    {
      messages: [{ role: "user", content: prompt }],
      maxTokens: 2000,
      temperature: 0.7,
      route: "sprints/generate-goal",
    },
    {
      promptLength: prompt.length,
      requiresContextualUnderstanding: true,
      hasBusinessValueAnalysis: true,
      requiresPatternRecognition: true,
      forceProvider: "claude", // Always use Claude for sprint goals
    }
  );
}

/**
 * Reformat sprint description (COMPLEX - Claude)
 */
export async function reformatDescriptionCompletion(
  systemPrompt: string,
  description: string
): Promise<AICompletionResult> {
  return getAICompletion(
    {
      systemPrompt,
      messages: [
        {
          role: "user",
          content: `Please reformat the following sprint description into the structured format:\n\n${description}`,
        },
      ],
      maxTokens: 4000,
      temperature: 0.3,
      route: "sprints/reformat-description",
    },
    {
      promptLength: description.length,
      requiresContextualUnderstanding: true,
      forceProvider: "claude",
    }
  );
}

// SIMPLE TASKS - Use DeepSeek for cost efficiency

/**
 * Generate task description (SIMPLE - DeepSeek)
 */
export async function generateTaskDescriptionCompletion(
  prompt: string
): Promise<AICompletionResult> {
  return getAICompletion(
    {
      messages: [{ role: "user", content: prompt }],
      maxTokens: 200,
      temperature: 0.7,
      route: "tasks/generate-description",
    },
    {
      promptLength: prompt.length,
      // Simple task - will route to DeepSeek
    }
  );
}

/**
 * Team optimization analysis (COMPLEX - Claude)
 */
export async function teamOptimizationCompletion(
  prompt: string
): Promise<AICompletionResult> {
  return getAICompletion(
    {
      messages: [{ role: "user", content: prompt }],
      maxTokens: 2048,
      temperature: 0.7,
      route: "teams/optimize",
    },
    {
      promptLength: prompt.length,
      requiresMultiStepReasoning: true,
      requiresContextualUnderstanding: true,
      hasTeamContext: true,
      forceProvider: "claude",
    }
  );
}

/**
 * Priority recommendations analysis (COMPLEX - Claude)
 */
export async function priorityRecommendationsCompletion(
  prompt: string
): Promise<AICompletionResult> {
  return getAICompletion(
    {
      messages: [{ role: "user", content: prompt }],
      maxTokens: 4096,
      temperature: 0.7,
      route: "priority/recommendations",
    },
    {
      promptLength: prompt.length,
      requiresMultiStepReasoning: true,
      hasBusinessValueAnalysis: true,
      forceProvider: "claude",
    }
  );
}

/**
 * Generate project name suggestions (SIMPLE - DeepSeek)
 */
export async function generateProjectSuggestionsCompletion(
  prompt: string
): Promise<AICompletionResult> {
  return getAICompletion(
    {
      messages: [{ role: "user", content: prompt }],
      maxTokens: 300,
      temperature: 0.7,
    },
    {
      promptLength: prompt.length,
      numberOfOutputItems: 4,
      // Moderate task but can use DeepSeek since it's just naming
    }
  );
}

