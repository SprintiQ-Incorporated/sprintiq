/**
 * Shared AI client utilities for server actions
 * Extracted from ai-actions.ts for better modularity
 *
 * NOTE: This file does NOT use "use server" because it exports
 * non-async items (the anthropic client). The importing server action
 * files already have "use server" directive.
 */

import { Anthropic } from "@anthropic-ai/sdk";

// Initialize Anthropic client once (shared across all action files)
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
