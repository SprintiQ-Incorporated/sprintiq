import { Command } from "commander";
import http from "http";
import { URL } from "url";
import path from "path";
import { spawn } from "child_process";
import { SprintIQAPIClient } from "../lib/api-client.js";
import { getCredentials, writePromptFile, ensureGitignore, writeWorkspaceTaskFile, writeWorkspaceSessionFile } from "../lib/config.js";
import { generatePrompt } from "../lib/prompt-generator.js";
import { log } from "../lib/logger.js";
import { WATCH_PORT, DEFAULT_API_BASE_URL } from "../lib/constants.js";
import { SessionMonitor } from "../lib/monitor/session-monitor.js";
import { GitTracker } from "../lib/monitor/git-tracker.js";

const activeMonitors = new Map<string, SessionMonitor>();

const ALLOWED_ORIGINS = Array.from(new Set([
  DEFAULT_API_BASE_URL,
  "http://localhost:3000",
]));

function corsHeaders(origin: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  origin?: string
): void {
  const headers = {
    "Content-Type": "application/json",
    ...corsHeaders(origin),
  };
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

export const watchCommand = new Command("watch")
  .description("Start a local bridge server for browser-to-CLI communication")
  .option("-d, --dir <path>", "Working directory to monitor (defaults to current directory)")
  .action(async (options: { dir?: string }) => {
    const creds = getCredentials();
    if (!creds) {
      log.error("Not authenticated. Run `sprintiq auth login` first.");
      process.exit(1);
    }

    // Resolve working directory once at startup
    const startDir = options.dir
      ? path.resolve(options.dir)
      : process.cwd();
    const rawRoot = GitTracker.getRepoRoot(startDir) ?? startDir;
    const resolvedWorkingDir = path.normalize(rawRoot).replace(/\\/g, "/");
    const isGitRepo = GitTracker.isGitRepo(resolvedWorkingDir);

    log.info(`Working directory: ${resolvedWorkingDir}`);
    log.info(`Git repo: ${isGitRepo ? "yes" : "no (git operations disabled)"}`);

    const api = new SprintIQAPIClient({
      baseUrl: DEFAULT_API_BASE_URL,
      apiKey: creds.api_key,
    });

    // Flush any pending reports from previous failed completions
    try {
      await api.flushPendingReports();
    } catch (err) {
      log.warn(`Failed to flush pending reports: ${err instanceof Error ? err.message : "unknown"}`);
    }

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://localhost:${WATCH_PORT}`);
      const origin = req.headers.origin;

      // Handle CORS preflight
      if (req.method === "OPTIONS") {
        res.writeHead(204, corsHeaders(origin));
        res.end();
        return;
      }

      // GET /health
      if (req.method === "GET" && url.pathname === "/health") {
        jsonResponse(res, 200, {
          status: "ok",
          workingDir: resolvedWorkingDir,
          isGitRepo,
          activeSessions: activeMonitors.size,
        }, origin);
        return;
      }

      // POST /launch
      if (req.method === "POST" && url.pathname === "/launch") {
        let promptPath = "";
        let sessionId = "";

        try {
          const body = await readBody(req);
          const { session_id, token, task_id } = JSON.parse(body);
          sessionId = session_id;

          if (!session_id || !token || !task_id) {
            jsonResponse(res, 400, { error: "Missing session_id, token, or task_id" }, origin);
            return;
          }

          // Validate session token
          log.info(`Validating session ${session_id}...`);
          const validation = await api.validateSessionToken(session_id, token);
          if (!validation.valid) {
            log.error("Session token invalid or expired");
            jsonResponse(res, 401, { error: "Invalid or expired session token" }, origin);
            return;
          }

          // Fetch task
          log.info(`Fetching task ${task_id}...`);
          const { task, task_url } = await api.getTask(task_id, true);

          // Generate prompt
          const prompt = generatePrompt(task, {
            includeSubtasks: true,
            taskUrl: task_url,
          });

          // Save prompt file
          promptPath = writePromptFile(task.task_id, prompt);
          log.success(`Prompt saved to ${promptPath}`);

          // Start session monitor
          const monitor = new SessionMonitor(api, session_id, token, task_id, task.name, resolvedWorkingDir);
          monitor.start();
          activeMonitors.set(session_id, monitor);

          jsonResponse(res, 200, { status: "launched", prompt_path: promptPath }, origin);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";

          log.error(`Launch failed: ${message}`);
          if (!res.headersSent) {
            jsonResponse(res, 500, { error: message }, origin);
          }
          return;
        }

        // Launch Claude Code (outside try/catch so spawn errors don't crash the server)
        try {
          log.info("Launching Claude Code...");
          const normalizedPath = promptPath.replace(/\\/g, "/");

          // shell: true is required on Windows for npm .cmd shims
          // Pass the task file path as the initial user message (positional prompt arg)
          const cmd = `claude "Read ${normalizedPath} then summarize and begin."`;
          const child = spawn(cmd, [], {
            stdio: "inherit",
            shell: true,
            cwd: resolvedWorkingDir,
          });

          child.on("error", (err) => {
            log.error(`Failed to launch Claude Code: ${err.message}`);
          });

          child.on("exit", async (code) => {
            log.info(`Claude Code exited with code ${code}`);
            const mon = activeMonitors.get(sessionId);
            if (mon) {
              await mon.complete(code === 0 ? "completed" : "stopped");
              activeMonitors.delete(sessionId);
            }
          });
        } catch (err) {
          log.error(`Failed to launch Claude Code: ${err instanceof Error ? err.message : "unknown"}`);
        }
        return;
      }

      // POST /launch-cursor
      if (req.method === "POST" && url.pathname === "/launch-cursor") {
        let taskFilePath = "";
        let sessionId = "";

        try {
          const body = await readBody(req);
          const { session_id, token, task_id } = JSON.parse(body);
          sessionId = session_id;

          if (!session_id || !token || !task_id) {
            jsonResponse(res, 400, { error: "Missing session_id, token, or task_id" }, origin);
            return;
          }

          // Validate session token
          log.info(`[cursor] Validating session ${session_id}...`);
          const validation = await api.validateSessionToken(session_id, token);
          if (!validation.valid) {
            log.error("[cursor] Session token invalid or expired");
            jsonResponse(res, 401, { error: "Invalid or expired session token" }, origin);
            return;
          }

          // Fetch task
          log.info(`[cursor] Fetching task ${task_id}...`);
          const { task, task_url } = await api.getTask(task_id, true);

          // Generate prompt
          const prompt = generatePrompt(task, {
            includeSubtasks: true,
            taskUrl: task_url,
          });

          // Save prompt file (home dir — legacy location)
          const promptPath = writePromptFile(task.task_id, prompt);
          log.success(`[cursor] Prompt saved to ${promptPath}`);

          // Atomically write workspace context files for Cursor / extensions
          ensureGitignore(resolvedWorkingDir);
          taskFilePath = writeWorkspaceTaskFile(resolvedWorkingDir, prompt);
          log.success(`[cursor] Task context written to ${taskFilePath}`);
          const sessionFilePath = writeWorkspaceSessionFile(resolvedWorkingDir, {
            session_id,
            token,
            task_id,
            api_base_url: DEFAULT_API_BASE_URL,
            created_at: new Date().toISOString(),
          });
          log.success(`[cursor] Session file written to ${sessionFilePath}`);

          // Start session monitor (tracks git changes + heartbeats)
          const monitor = new SessionMonitor(api, session_id, token, task_id, task.name, resolvedWorkingDir);
          monitor.start();
          activeMonitors.set(session_id, monitor);

          const normalizedPath = promptPath.replace(/\\/g, "/");
          jsonResponse(res, 200, {
            status: "launched",
            prompt_path: normalizedPath,
            workspace_task_path: taskFilePath.replace(/\\/g, "/"),
            workspace_session_path: sessionFilePath.replace(/\\/g, "/"),
          }, origin);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";

          log.error(`[cursor] Launch failed: ${message}`);
          if (!res.headersSent) {
            jsonResponse(res, 500, { error: message }, origin);
          }
          return;
        }

        // Spawn cursor-agent (outside try/catch so spawn errors don't crash the server).
        // Mirrors the Claude Code launch pattern: response already sent, child runs
        // non-blocking, on('exit') closes the session record.
        try {
          log.info("[cursor-agent] Launching...");
          const normalizedTaskPath = taskFilePath.replace(/\\/g, "/");
          // cursor-agent prompt-ingestion interface per docs.cursor.com/cli/headless:
          // positional arg after -p/--print. No --prompt flag or stdin-piped prompt.
          const cmd = `cursor-agent -p "Read ${normalizedTaskPath} then summarize and begin."`;
          const child = spawn(cmd, [], {
            stdio: "inherit",
            shell: true,
            cwd: resolvedWorkingDir,
          });

          child.on("error", (err) => {
            log.error(`[cursor-agent] Failed to launch: ${err.message}`);
          });

          child.on("exit", async (code) => {
            log.info(`[cursor-agent] exited with code ${code}`);
            const mon = activeMonitors.get(sessionId);
            if (mon) {
              await mon.complete(code === 0 ? "completed" : "stopped");
              activeMonitors.delete(sessionId);
            }
          });
        } catch (err) {
          log.error(`[cursor-agent] Failed to launch: ${err instanceof Error ? err.message : "unknown"}`);
        }
        return;
      }

      // GET /sessions/status
      if (req.method === "GET" && url.pathname === "/sessions/status") {
        const statuses: Record<string, unknown> = {};
        for (const [id, monitor] of activeMonitors) {
          statuses[id] = monitor.getStatus();
        }
        jsonResponse(res, 200, { sessions: statuses }, origin);
        return;
      }

      // POST /sessions/:id/stop
      const stopMatch = url.pathname.match(/^\/sessions\/([^/]+)\/stop$/);
      if (req.method === "POST" && stopMatch) {
        const id = stopMatch[1];
        const monitor = activeMonitors.get(id);
        if (!monitor) {
          jsonResponse(res, 404, { error: "Session not found" }, origin);
          return;
        }
        await monitor.complete("stopped");
        activeMonitors.delete(id);
        jsonResponse(res, 200, { status: "stopped" }, origin);
        return;
      }

      // Not found
      jsonResponse(res, 404, { error: "Not found" }, origin);
    });

    server.listen(WATCH_PORT, "127.0.0.1", () => {
      log.success(`SprintIQ Watch running on http://127.0.0.1:${WATCH_PORT}`);
      log.info(`Monitoring: ${resolvedWorkingDir}`);
      log.info(`Git repo:   ${isGitRepo ? resolvedWorkingDir : "not a git repo — commit/PR disabled"}`);
      log.info("Waiting for browser requests... (Ctrl+C to stop)");
    });

    // Graceful shutdown
    const shutdown = async () => {
      log.info("Shutting down watch server...");
      for (const [id, monitor] of activeMonitors) {
        log.info(`Stopping session ${id}...`);
        await monitor.complete("stopped");
        activeMonitors.delete(id);
      }
      server.close(() => process.exit(0));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

