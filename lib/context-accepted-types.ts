/**
 * Single source of truth for context-file upload acceptance in the story
 * generator. Imported by both the client upload UI (StoryPromptInput) and the
 * server route that validates submissions (generate-stories). Keeping these in
 * sync prevented a bug where the client advertised JSON/YAML/CSV support but
 * the server silently rejected everything except .md and .txt.
 */

export const ACCEPTED_FILE_EXTENSIONS: readonly string[] = [
  "md",
  "mdx",
  "txt",
  "json",
  "yaml",
  "yml",
  "csv",
];

export const ACCEPTED_MIME_TYPES: readonly string[] = [
  "text/markdown",
  "text/x-markdown",
  "text/plain",
  "application/json",
  "application/x-yaml",
  "text/yaml",
  "text/x-yaml",
  "text/csv",
];

export const ACCEPTED_FILE_TYPES_DOTTED: readonly string[] =
  ACCEPTED_FILE_EXTENSIONS.map((ext) => `.${ext}`);

export const ACCEPTED_TYPES_LABEL = ACCEPTED_FILE_TYPES_DOTTED.join(", ");

/**
 * Aggregate upload budget across all context files in a single generation
 * request. Applied as SUM(file.size) <= CONTEXT_BUDGET_BYTES on both client
 * and server. A single 200 KB file is allowed; two 150 KB files are not.
 */
export const CONTEXT_BUDGET_BYTES = 200 * 1024;

/**
 * Aggregate character budget across all context files. Client-side only for
 * now (the server can't cheaply recount chars without re-decoding uploads).
 */
export const CONTEXT_BUDGET_CHARS = 100_000;

export function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function isAcceptedExtension(fileName: string): boolean {
  return ACCEPTED_FILE_EXTENSIONS.includes(getFileExtension(fileName));
}
