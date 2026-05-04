import { readFileSync, writeFileSync, mkdirSync, unlinkSync, chmodSync, existsSync, readdirSync, statSync, appendFileSync, renameSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { randomBytes } from "crypto";
import { CONFIG_DIR_NAME, CREDENTIALS_FILE, PROMPTS_DIR_NAME, SESSIONS_DIR_NAME, PENDING_REPORTS_DIR_NAME, PENDING_REPORT_MAX_AGE_DAYS } from "./constants.js";
import type { Credentials } from "../types.js";
import type { PersistedSessionState, PendingReport } from "./monitor/types.js";

export function getConfigDir(): string {
  return join(homedir(), CONFIG_DIR_NAME);
}

function getCredentialsPath(): string {
  return join(getConfigDir(), CREDENTIALS_FILE);
}

export function getCredentials(): Credentials | null {
  try {
    const raw = readFileSync(getCredentialsPath(), "utf-8");
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export function saveCredentials(creds: Credentials): void {
  const dir = getConfigDir();
  mkdirSync(dir, { recursive: true });

  const path = getCredentialsPath();
  writeFileSync(path, JSON.stringify(creds, null, 2), "utf-8");

  // Restrict permissions on POSIX (no-op on Windows in most cases)
  try {
    chmodSync(path, 0o600);
  } catch {
    // Ignore on Windows
  }
}

export function deleteCredentials(): boolean {
  const path = getCredentialsPath();
  if (!existsSync(path)) {
    return false;
  }
  unlinkSync(path);
  return true;
}

// --- Prompt file helpers ---

export function getPromptsDir(): string {
  return join(getConfigDir(), PROMPTS_DIR_NAME);
}

export function writePromptFile(taskId: string, content: string): string {
  const dir = getPromptsDir();
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${taskId}.md`);
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

export function readPromptFile(taskId: string): string | null {
  try {
    const filePath = join(getPromptsDir(), `${taskId}.md`);
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

// --- Session state helpers ---

export function getSessionsDir(): string {
  return join(getConfigDir(), SESSIONS_DIR_NAME);
}

export function saveSessionState(state: PersistedSessionState): void {
  const dir = getSessionsDir();
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${state.sessionId}.json`);
  writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
}

export function loadSessionState(sessionId: string): PersistedSessionState | null {
  try {
    const filePath = join(getSessionsDir(), `${sessionId}.json`);
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as PersistedSessionState;
  } catch {
    return null;
  }
}

export function deleteSessionState(sessionId: string): void {
  const filePath = join(getSessionsDir(), `${sessionId}.json`);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

export function listSessionStates(): string[] {
  const dir = getSessionsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}

// --- Pending report helpers ---

export function getPendingReportsDir(): string {
  return join(getConfigDir(), PENDING_REPORTS_DIR_NAME);
}

export function savePendingReport(report: PendingReport): void {
  const dir = getPendingReportsDir();
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${report.sessionId}.json`);
  writeFileSync(filePath, JSON.stringify(report, null, 2), "utf-8");
}

export function loadPendingReports(): PendingReport[] {
  const dir = getPendingReportsDir();
  if (!existsSync(dir)) return [];

  const reports: PendingReport[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    try {
      const raw = readFileSync(join(dir, file), "utf-8");
      reports.push(JSON.parse(raw) as PendingReport);
    } catch {
      // Skip corrupt files
    }
  }
  return reports;
}

export function deletePendingReport(sessionId: string): void {
  const filePath = join(getPendingReportsDir(), `${sessionId}.json`);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

export function cleanupOldPendingReports(): number {
  const dir = getPendingReportsDir();
  if (!existsSync(dir)) return 0;

  const maxAgeMs = PENDING_REPORT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let cleaned = 0;

  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const filePath = join(dir, file);
    try {
      const stats = statSync(filePath);
      if (now - stats.mtimeMs > maxAgeMs) {
        unlinkSync(filePath);
        cleaned++;
      }
    } catch {
      // Skip
    }
  }
  return cleaned;
}

// --- Atomic file write ---

/**
 * Writes a file atomically: content goes to a temp file in the same directory,
 * then is renamed into place. On the same filesystem, rename is atomic on both
 * POSIX and Windows (NTFS), so readers never see a partial write.
 */
export function atomicWriteFileSync(targetPath: string, content: string): void {
  const dir = dirname(targetPath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = `${targetPath}.${randomBytes(6).toString("hex")}.tmp`;
  writeFileSync(tmpPath, content, "utf-8");
  try {
    renameSync(tmpPath, targetPath);
  } catch (err) {
    // Clean up temp file on rename failure
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}

// --- Workspace .sprintiq/ file helpers ---

export interface WorkspaceSessionData {
  session_id: string;
  token: string;
  task_id: string;
  api_base_url: string;
  created_at: string;
}

/**
 * Returns the .sprintiq/ directory inside the workspace root.
 */
export function getWorkspaceSprintiqDir(workspaceRoot: string): string {
  return join(workspaceRoot, CONFIG_DIR_NAME);
}

/**
 * Atomically writes .sprintiq/current-task.md to the workspace root.
 * Contains the task prompt that Cursor / extensions can read.
 */
export function writeWorkspaceTaskFile(workspaceRoot: string, promptContent: string): string {
  const filePath = join(getWorkspaceSprintiqDir(workspaceRoot), "current-task.md");
  atomicWriteFileSync(filePath, promptContent);
  return filePath;
}

/**
 * Atomically writes .sprintiq/session.json to the workspace root.
 * Contains session credentials for Cursor / extensions.
 */
export function writeWorkspaceSessionFile(workspaceRoot: string, data: WorkspaceSessionData): string {
  const filePath = join(getWorkspaceSprintiqDir(workspaceRoot), "session.json");
  atomicWriteFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

// --- .gitignore protection ---

const GITIGNORE_ENTRY = ".sprintiq/";

/**
 * Ensures `.sprintiq/` is listed in the workspace's .gitignore.
 * Must be called before writing any files to the workspace .sprintiq/ directory.
 * Returns true if the entry was added, false if it was already present.
 */
export function ensureGitignore(repoRoot: string): boolean {
  const gitignorePath = join(repoRoot, ".gitignore");

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf-8");
    // Check if already covered — match `.sprintiq/` or `.sprintiq` as a standalone line
    const lines = content.split(/\r?\n/);
    const alreadyIgnored = lines.some(
      (line) => {
        const trimmed = line.trim();
        return trimmed === ".sprintiq/" || trimmed === ".sprintiq" || trimmed === "/.sprintiq/" || trimmed === "/.sprintiq";
      }
    );
    if (alreadyIgnored) return false;

    // Append with a preceding newline if the file doesn't end with one
    const prefix = content.endsWith("\n") ? "" : "\n";
    appendFileSync(gitignorePath, `${prefix}${GITIGNORE_ENTRY}\n`, "utf-8");
  } else {
    // No .gitignore exists — create one with just the entry
    writeFileSync(gitignorePath, `${GITIGNORE_ENTRY}\n`, "utf-8");
  }

  return true;
}
