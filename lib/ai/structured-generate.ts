/**
 * Structured AI generation helper.
 *
 * Wraps Anthropic Claude Haiku 4.5 with tool_use to guarantee well-formed JSON
 * output for typed object generation (roles, personas, etc.).
 * Logs every call to ai_usage_log via the shared tracker.
 *
 * Caller responsibilities: auth, CSRF, workspace membership, input validation.
 * This helper assumes the request is already authorized.
 */

import { Anthropic } from "@anthropic-ai/sdk";
import { extractAIUsage, trackAIUsage } from "@/lib/ai-usage-tracker";

const anthropic = new Anthropic({ maxRetries: 2 });

export const HAIKU_MODEL = "claude-haiku-4-5-20251001";
export const DEFAULT_MAX_TOKENS = 1500;
export const MAX_DESCRIPTION_CHARS = 2000;

export interface SystemPart {
  text: string;
  /** Cache this part of the prompt. Use for the static system instruction
   *  and any large read-only context (e.g. competency taxonomy). */
  cache?: boolean;
}

export interface StructuredGenerateOptions<TSchema> {
  /** Workspace UUID — written to ai_usage_log. May be null for unscoped calls. */
  workspaceId: string | null;
  /** Identifier written to ai_usage_log.route. e.g. "roles/ai-generate". */
  route: string;
  /** Static system prompt parts. Set cache=true on the large/static ones. */
  system: SystemPart[];
  /** Tool name used for the structured output schema. */
  toolName: string;
  /** JSON schema for the tool input — Claude will fill this. */
  toolSchema: TSchema;
  /** The user's natural-language input + any refinement hint. */
  userMessage: string;
  /** Override max output tokens. Defaults to 1500. */
  maxTokens?: number;
  /** Override sampling temperature. Defaults to 0.7. */
  temperature?: number;
}

export class StructuredGenerateError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "StructuredGenerateError";
  }
}

/**
 * Run a single tool_use generation against Haiku 4.5.
 * Returns the parsed tool input (typed by caller) along with token usage.
 *
 * Logging is fire-and-forget: a failure to write to ai_usage_log will not
 * fail the request.
 */
export async function structuredGenerate<TResult>(
  opts: StructuredGenerateOptions<unknown>
): Promise<{ result: TResult; rawUsage: { input_tokens: number; output_tokens: number } }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new StructuredGenerateError("ANTHROPIC_API_KEY is not configured");
  }

  const systemBlocks = opts.system.map((part) => ({
    type: "text" as const,
    text: part.text,
    ...(part.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));

  let response;
  try {
    response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: opts.temperature ?? 0.7,
      system: systemBlocks,
      tools: [
        {
          name: opts.toolName,
          description: `Emit the structured ${opts.toolName} payload.`,
          input_schema: opts.toolSchema as any,
        },
      ],
      tool_choice: { type: "tool", name: opts.toolName },
      messages: [
        {
          role: "user",
          content: opts.userMessage.slice(0, MAX_DESCRIPTION_CHARS * 2),
        },
      ],
    });
  } catch (err) {
    throw new StructuredGenerateError(
      `Anthropic call failed for ${opts.route}`,
      err
    );
  }

  // Fire-and-forget logging.
  const usage = extractAIUsage(response);
  trackAIUsage({
    workspaceId: opts.workspaceId ?? undefined,
    route: opts.route,
    usage,
  }).catch(() => {});

  const toolBlock = response.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> =>
      block.type === "tool_use" && block.name === opts.toolName
  );

  if (!toolBlock) {
    throw new StructuredGenerateError(
      `Model did not emit ${opts.toolName} tool_use block`
    );
  }

  return {
    result: toolBlock.input as TResult,
    rawUsage: response.usage,
  };
}
