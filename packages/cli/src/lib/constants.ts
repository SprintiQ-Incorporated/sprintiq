// Hardcoded at build time — update in package.json and here together
export const VERSION = "1.0.0";

export const DEFAULT_API_BASE_URL =
  process.env.SPRINTIQ_API_URL || "http://localhost:3000";

export const CALLBACK_TIMEOUT_MS = 120_000; // 2 minutes

export const CONFIG_DIR_NAME = ".sprintiq";
export const CREDENTIALS_FILE = "credentials.json";
export const PROMPTS_DIR_NAME = "prompts";
export const MAX_DESCRIPTION_LENGTH = 4000;
export const MAX_PROMPT_LENGTH = 8000;
export const WATCH_PORT = 19847;

export const SESSIONS_DIR_NAME = "sessions";
export const MONITOR_FILE_POLL_MS = 10_000;
export const MONITOR_GIT_POLL_MS = 30_000;
export const MONITOR_HEARTBEAT_MS = 60_000;
export const MONITOR_STATE_SAVE_MS = 30_000;
export const MONITOR_IDLE_THRESHOLD_MS = 15 * 60_000;
export const HEARTBEAT_RETRY_BASE_MS = 1_000;
export const HEARTBEAT_RETRY_MAX_MS = 5 * 60_000;
export const PENDING_REPORTS_DIR_NAME = "pending-reports";
export const COMPLETION_RETRY_BASE_MS = 1_000;
export const COMPLETION_RETRY_MAX_ATTEMPTS = 5;
export const PENDING_REPORT_MAX_AGE_DAYS = 7;
export const DEVELOPER_NOTES_TIMEOUT_MS = 30_000;

export const DEFAULT_EXCLUDE_PATTERNS = [
  "node_modules", "dist", "build", ".next", "*.lock",
  ".git", "coverage", ".cache", ".turbo", "__pycache__",
  ".pytest_cache", "vendor", "target",
];
