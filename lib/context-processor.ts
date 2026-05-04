/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

/**
 * Serverless-compatible Context Processor
 *
 * Processes uploaded context files (images, text files) and URL content
 * to extract text for AI story generation context.
 *
 * Uses Claude's native image support instead of canvas-based libraries,
 * making it compatible with Vercel's serverless environment.
 */

import { Anthropic } from "@anthropic-ai/sdk";
import { extractAIUsage, trackAIUsage } from "@/lib/ai-usage-tracker";

// ============================================================================
// Types
// ============================================================================

export interface ContextFile {
  name: string;
  type: string;
  size: number;
  content: string; // base64 data URL for binary files, text for text files
}

export interface ContextInput {
  text: string;
  urls: string[];
  files: ContextFile[];
}

export interface ProcessedContext {
  combinedText: string;
  sources: Array<{
    type: "file" | "url" | "text";
    name: string;
    extractedLength: number;
  }>;
  totalCharacters: number;
  tokenEstimate: number;
  errors: Array<{
    source: string;
    error: string;
  }>;
}

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate tokens from text (rough approximation: 1 token ~ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ============================================================================
// File Content Extraction (Serverless Compatible)
// ============================================================================

/**
 * Get Claude-compatible media type from file type/name
 */
function getMediaType(
  fileType: string,
  fileName: string
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | null {
  const type = fileType.toLowerCase();
  const ext = fileName.split(".").pop()?.toLowerCase();

  // Images
  if (type === "image/jpeg" || type === "image/jpg" || ext === "jpg" || ext === "jpeg") {
    return "image/jpeg";
  }
  if (type === "image/png" || ext === "png") {
    return "image/png";
  }
  if (type === "image/gif" || ext === "gif") {
    return "image/gif";
  }
  if (type === "image/webp" || ext === "webp") {
    return "image/webp";
  }

  return null;
}

/**
 * Check if file is a text-based format we can decode directly
 */
function isTextFile(fileType: string, fileName: string): boolean {
  const textTypes = [
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/json",
    "application/xml",
    "text/xml",
  ];
  const textExtensions = ["txt", "md", "csv", "json", "xml", "yaml", "yml"];

  const ext = fileName.split(".").pop()?.toLowerCase();

  return textTypes.includes(fileType.toLowerCase()) || textExtensions.includes(ext || "");
}

/**
 * Strip base64 data URL prefix if present
 */
function stripBase64Prefix(content: string): string {
  // Handle various data URL formats
  return content.replace(/^data:[^;]+;base64,/, "");
}

/**
 * Process a file using Claude's native document/image support
 * No canvas or native dependencies required
 */
async function processFileWithClaude(file: ContextFile): Promise<string> {
  const mediaType = getMediaType(file.type, file.name);

  if (!mediaType) {
    // For unsupported types, try to decode as text
    if (isTextFile(file.type, file.name)) {
      try {
        // Check if it's base64 encoded
        if (file.content.startsWith("data:") || /^[A-Za-z0-9+/]+=*$/.test(file.content.slice(0, 100))) {
          const base64Data = stripBase64Prefix(file.content);
          return Buffer.from(base64Data, "base64").toString("utf-8");
        }
        // Already plain text
        return file.content;
      } catch {
        return `[Could not decode file: ${file.name}]`;
      }
    }
    return `[Unsupported file type: ${file.type || file.name}]`;
  }

  // Use Claude API to process images
  const anthropic = new Anthropic({ maxRetries: 3 });
  const base64Data = stripBase64Prefix(file.content);

  // Build the message content for image processing
  const messageContent: any[] = [];

  // Image types
  messageContent.push({
    type: "image",
    source: {
      type: "base64",
      media_type: mediaType,
      data: base64Data,
    },
  });

  messageContent.push({
    type: "text",
    text: `Extract and summarize the key content from this document "${file.name}".

Focus on:
- Main topics, requirements, and objectives
- Technical specifications or constraints
- User stories, features, or functionality mentioned
- Acceptance criteria or success metrics
- Any dependencies or integrations noted

Provide a structured summary that can inform user story generation. Be thorough but concise.`,
  });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: messageContent }],
  });

  const aiUsage = extractAIUsage(response);
  trackAIUsage({ route: "context-processor", usage: aiUsage }).catch(() => {});

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text || "[No content extracted]";
}

/**
 * Extract text content from a file based on its type
 * Uses Claude API for images, direct decoding for text files
 */
export async function extractFileContent(file: ContextFile): Promise<string> {
  const { name, type, content } = file;

  try {
    // Check if it's a text file we can decode directly
    if (isTextFile(type, name)) {
      // Check if content is base64 encoded
      if (content.startsWith("data:") || /^[A-Za-z0-9+/]+=*$/.test(content.slice(0, 100))) {
        const base64Data = stripBase64Prefix(content);
        const decoded = Buffer.from(base64Data, "base64").toString("utf-8");

        // For JSON, format nicely
        if (type === "application/json" || name.endsWith(".json")) {
          try {
            const data = JSON.parse(decoded);
            return JSON.stringify(data, null, 2);
          } catch {
            return decoded;
          }
        }
        return decoded;
      }

      // Already plain text, format JSON if needed
      if (type === "application/json" || name.endsWith(".json")) {
        try {
          const data = JSON.parse(content);
          return JSON.stringify(data, null, 2);
        } catch {
          return content;
        }
      }
      return content;
    }

    // Image - use Claude API
    const mediaType = getMediaType(type, name);
    if (mediaType) {
      return await processFileWithClaude(file);
    }

    // Unsupported type
    return `[Unsupported file type: ${type || name}]`;
  } catch (error) {
    throw new Error(
      `Failed to extract content from ${name}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// ============================================================================
// URL Content Extraction (Serverless Compatible - No JSDOM)
// ============================================================================

/**
 * Strip HTML tags without jsdom
 * Simple regex-based approach for serverless compatibility
 */
function stripHtml(html: string): string {
  return (
    html
      // Remove script and style tags with content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, "")
      // Remove all HTML tags
      .replace(/<[^>]+>/g, " ")
      // Decode common HTML entities
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Extract title from HTML
 */
function extractTitle(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : null;
}

/**
 * Fetch and extract readable content from a URL
 * Uses simple fetch + regex (no jsdom dependency)
 */
export async function fetchUrlContent(url: string): Promise<string> {
  try {
    // Validate URL
    new URL(url);

    // Fetch the page content with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SprintIQ/1.0; Story Generator)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";

    // Handle JSON responses directly
    if (contentType.includes("application/json")) {
      const json = await response.json();
      return JSON.stringify(json, null, 2);
    }

    // Handle HTML pages with simple regex stripping
    const html = await response.text();
    const title = extractTitle(html);
    const textContent = stripHtml(html);

    if (title && textContent) {
      return `Title: ${title}\n\n${textContent}`;
    }

    return textContent || "[No content extracted from URL]";
  } catch (error) {
    throw new Error(
      `Failed to fetch URL ${url}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// ============================================================================
// Main Context Processor
// ============================================================================

/**
 * Process all context inputs (text, files, URLs) and combine into structured context
 */
export async function processContext(input: ContextInput): Promise<ProcessedContext> {
  const sources: ProcessedContext["sources"] = [];
  const errors: ProcessedContext["errors"] = [];
  const contextParts: string[] = [];

  // Process text context
  if (input.text && input.text.trim().length > 0) {
    const trimmedText = input.text.trim();
    contextParts.push(`=== User Provided Context ===\n${trimmedText}`);
    sources.push({
      type: "text",
      name: "User provided context",
      extractedLength: trimmedText.length,
    });
  }

  // Process files in parallel
  const filePromises = input.files.map(async (file) => {
    try {
      const extractedText = await extractFileContent(file);
      return {
        success: true as const,
        file,
        text: extractedText,
      };
    } catch (error) {
      return {
        success: false as const,
        file,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  const fileResults = await Promise.all(filePromises);

  for (const result of fileResults) {
    if (result.success) {
      contextParts.push(`=== File: ${result.file.name} ===\n${result.text}`);
      sources.push({
        type: "file",
        name: result.file.name,
        extractedLength: result.text.length,
      });
    } else {
      errors.push({
        source: result.file.name,
        error: result.error,
      });
    }
  }

  // Process URLs in parallel
  const urlPromises = input.urls.map(async (url) => {
    try {
      const extractedText = await fetchUrlContent(url);
      return {
        success: true as const,
        url,
        text: extractedText,
      };
    } catch (error) {
      return {
        success: false as const,
        url,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  const urlResults = await Promise.all(urlPromises);

  for (const result of urlResults) {
    if (result.success) {
      contextParts.push(`=== URL: ${result.url} ===\n${result.text}`);
      sources.push({
        type: "url",
        name: result.url,
        extractedLength: result.text.length,
      });
    } else {
      errors.push({
        source: result.url,
        error: result.error,
      });
    }
  }

  const combinedText = contextParts.join("\n\n");

  return {
    combinedText,
    sources,
    totalCharacters: combinedText.length,
    tokenEstimate: estimateTokens(combinedText),
    errors,
  };
}

// ============================================================================
// Context Formatting
// ============================================================================

/**
 * Smart truncation that keeps beginning and end of content
 * (often the most important parts of documents)
 */
function truncateContext(text: string, maxTokens: number = 40000): string {
  const estimatedTokens = estimateTokens(text);

  if (estimatedTokens <= maxTokens) {
    return text;
  }

  // Calculate max characters (4 chars per token estimate)
  const maxChars = maxTokens * 4;
  const keepFromStart = Math.floor(maxChars * 0.7);
  const keepFromEnd = Math.floor(maxChars * 0.25);

  return (
    text.slice(0, keepFromStart) +
    "\n\n[... content truncated for length ...]\n\n" +
    text.slice(-keepFromEnd)
  );
}

/**
 * Format processed context for injection into AI prompt using XML-like structure
 */
export function formatContextForPrompt(
  processedContext: ProcessedContext,
  maxTokens: number = 40000
): string {
  // Truncate if necessary using smart truncation
  const truncatedText = truncateContext(processedContext.combinedText, maxTokens);

  // Build source summary
  const sourceSummary = processedContext.sources
    .map(
      (s) => `  - ${s.name} (${s.extractedLength} chars, ~${Math.ceil(s.extractedLength / 4)} tokens)`
    )
    .join("\n");

  const errorSummary =
    processedContext.errors.length > 0
      ? `\n<context_errors>
Some sources could not be processed:
${processedContext.errors.map((e) => `  - ${e.source}: ${e.error}`).join("\n")}
</context_errors>`
      : "";

  // Check if truncation occurred
  const wasTruncated = truncatedText.includes("[... content truncated");
  const truncationNote = wasTruncated
    ? `\nNote: Content was truncated from ${processedContext.tokenEstimate} to ~${maxTokens} tokens.`
    : "";

  return `<context>
The following is background information, requirements, and documentation
that should inform the user stories you generate:

<context_sources>
${sourceSummary}${truncationNote}
</context_sources>
${errorSummary}

<context_content>
${truncatedText}
</context_content>
</context>`;
}

/**
 * Get context-aware prompt instructions for Claude
 */
export function getContextAwareInstructions(): string {
  return `
When context documents are provided in <context> tags:
- Extract concrete requirements from the documentation, not just summaries
- Identify technical constraints, APIs, or systems mentioned in docs
- Reference specific features named in the source documents
- Maintain consistency with terminology used in the source materials
- Flag any ambiguities or conflicts found in the documentation
- Ensure stories align with stated business goals from the context
- Use acceptance criteria that reference specific requirements from the docs`;
}

// ============================================================================
// Keyword Extraction (for team recommendation service)
// ============================================================================

/**
 * Extract keywords from text for matching purposes
 * Simple extraction without NLP dependencies
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];

  // Common stop words to filter out
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
    "be", "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "this", "that",
    "these", "those", "it", "its", "i", "you", "he", "she", "we", "they",
    "what", "which", "who", "whom", "when", "where", "why", "how", "all",
    "each", "every", "both", "few", "more", "most", "other", "some", "such",
    "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  ]);

  // Extract words, filter and deduplicate
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  // Return unique keywords
  return [...new Set(words)];
}

export default processContext;
