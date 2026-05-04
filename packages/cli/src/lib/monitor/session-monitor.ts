import { execSync } from "child_process";
import { existsSync, statSync, unlinkSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";
import { SprintIQAPIClient } from "../api-client.js";
import {
  MONITOR_FILE_POLL_MS,
  MONITOR_GIT_POLL_MS,
  MONITOR_HEARTBEAT_MS,
  MONITOR_STATE_SAVE_MS,
  MONITOR_IDLE_THRESHOLD_MS,
} from "../constants.js";
import { saveSessionState, loadSessionState, deleteSessionState, savePendingReport, loadPendingReports, ensureGitignore } from "../config.js";
import { log } from "../logger.js";
import { COMPLETION_RETRY_BASE_MS, COMPLETION_RETRY_MAX_ATTEMPTS } from "../constants.js";
import { GitTracker } from "./git-tracker.js";
import { FileTracker } from "./file-tracker.js";
import { TestTracker } from "./test-tracker.js";
import { HeartbeatSender } from "./heartbeat.js";
import { waitForReport } from "../report-reader.js";
import { displayCompletionSummary } from "../completion-summary.js";
import { promptForNotes } from "../developer-notes.js";
import { extractTokenUsage } from "./token-extractor.js";
import type { SessionMetrics, PersistedSessionState, CompletionPayload, TokenUsage } from "./types.js";

const PROTECTED_BRANCHES = ["main", "master", "develop", "dev"];

/**
 * Prompt the user and return the raw lowercased answer (trimmed).
 * Returns `defaultValue` if the prompt times out or stdin isn't a TTY.
 */
function promptWithTimeout(prompt: string, timeoutMs: number, defaultValue: string): Promise<string> {
  if (!process.stdin.isTTY) return Promise.resolve(defaultValue);
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const timer = setTimeout(() => {
      rl.close();
      log.info("\n(Prompt timed out — continuing with default)");
      resolve(defaultValue);
    }, timeoutMs);

    rl.question(prompt, (answer) => {
      clearTimeout(timer);
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

export class SessionMonitor {
  private api: SprintIQAPIClient;
  private sessionId: string;
  private token: string;
  private taskId: string;
  private taskName: string;
  private workingDir: string;
  private startedAt: string;
  private lastActiveAt: number;
  private activeMs: number;
  private idlePeriods: number;
  private isIdle = false;
  private isGitRepo: boolean;

  private gitTracker: GitTracker | null = null;
  private fileTracker: FileTracker | null = null;
  private testTracker: TestTracker;
  private heartbeat: HeartbeatSender;

  private timers: ReturnType<typeof setInterval>[] = [];
  private stopped = false;
  // Idempotency guard for complete() — set on entry, never reset.
  // Prevents double-execution if both report.json detection and user Ctrl-C
  // race to trigger completion in the same session.
  private completing = false;
  private signalHandler: (() => void) | null = null;
  // True once the end-of-session prompt has been shown for this run — prevents
  // re-prompting in a loop while report.json still exists on disk.
  private endPromptShown = false;
  private endPromptInFlight = false;

  constructor(
    api: SprintIQAPIClient,
    sessionId: string,
    token: string,
    taskId: string,
    taskName: string,
    workingDir: string
  ) {
    this.api = api;
    this.sessionId = sessionId;
    this.token = token;
    this.taskId = taskId;
    this.taskName = taskName;
    this.workingDir = workingDir;
    this.isGitRepo = GitTracker.isGitRepo(workingDir);

    // Try to resume from persisted state
    const persisted = loadSessionState(sessionId);

    if (persisted) {
      this.startedAt = persisted.startedAt;
      this.lastActiveAt = Date.now();
      this.activeMs = persisted.activeMs;
      this.idlePeriods = persisted.idlePeriods;
      log.info(`Resuming session ${sessionId} from persisted state`);
    } else {
      this.startedAt = new Date().toISOString();
      this.lastActiveAt = Date.now();
      this.activeMs = 0;
      this.idlePeriods = 0;
    }

    if (this.isGitRepo) {
      const repoRoot = GitTracker.getRepoRoot(workingDir) ?? workingDir;
      this.gitTracker = new GitTracker(
        repoRoot,
        this.startedAt,
        persisted?.knownCommitShas
      );
      this.fileTracker = new FileTracker(
        repoRoot,
        undefined,
        persisted?.fileChanges
      );
    }

    this.testTracker = new TestTracker(workingDir, persisted?.testRuns);

    this.heartbeat = new HeartbeatSender(
      api,
      sessionId,
      token,
      persisted?.heartbeatSequence
    );
  }

  start(): void {
    log.info(`Session monitor started for ${this.sessionId}`);
    log.info(`Working directory: ${this.workingDir}`);
    log.info(`Git repo: ${this.isGitRepo ? "yes" : "no"}, File tracker: ${this.fileTracker ? "active" : "none"}, Git tracker: ${this.gitTracker ? "active" : "none"}`);

    // Ensure .sprintiq/ is in the workspace .gitignore before writing any files
    if (this.isGitRepo) {
      try {
        const repoRoot = GitTracker.getRepoRoot(this.workingDir) ?? this.workingDir;
        const added = ensureGitignore(repoRoot);
        if (added) {
          log.info("Added .sprintiq/ to .gitignore");
        }
      } catch (err) {
        log.warn(`Could not update .gitignore: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    // Clear stale report.json from a previous session
    const reportPath = join(this.workingDir, ".sprintiq", "report.json");
    if (existsSync(reportPath)) {
      try {
        unlinkSync(reportPath);
        log.info("Cleared stale report.json from previous session");
      } catch {
        log.warn("Could not clear stale report.json — proceeding anyway");
      }
    }

    // File polling
    if (this.fileTracker) {
      this.fileTracker.poll(); // initial poll
      this.timers.push(
        setInterval(() => {
          this.fileTracker!.poll();
          this.recordActivity();
        }, MONITOR_FILE_POLL_MS)
      );
    }

    // Git polling
    if (this.gitTracker) {
      this.gitTracker.pollNewCommits(); // initial poll
      this.timers.push(
        setInterval(() => {
          const newCommits = this.gitTracker!.pollNewCommits();
          if (newCommits.length > 0) {
            this.recordActivity();
            log.info(
              `Detected ${newCommits.length} new commit(s): ${newCommits
                .map((c) => c.sha)
                .join(", ")}`
            );
          }
        }, MONITOR_GIT_POLL_MS)
      );
    }

    // Test polling
    this.timers.push(
      setInterval(() => {
        const newRuns = this.testTracker.poll();
        if (newRuns.length > 0) {
          this.recordActivity();
        }
      }, MONITOR_GIT_POLL_MS) // same interval as git
    );

    // Heartbeat
    this.timers.push(
      setInterval(async () => {
        if (this.stopped) return;
        this.recordActivity(); // accumulate active time every heartbeat cycle
        const metrics = this.buildMetrics();
        await this.heartbeat.send(metrics);

        const terminal = this.heartbeat.getTerminalStatus();
        if (terminal) {
          log.warn(`Server reports terminal status: ${terminal}`);
          await this.complete(terminal);
        }
      }, MONITOR_HEARTBEAT_MS)
    );

    // State persistence
    this.timers.push(
      setInterval(() => {
        this.saveState();
      }, MONITOR_STATE_SAVE_MS)
    );

    // Idle detection
    this.timers.push(
      setInterval(() => {
        const idleMs = Date.now() - this.lastActiveAt;
        if (idleMs > MONITOR_IDLE_THRESHOLD_MS && !this.isIdle) {
          this.isIdle = true;
          this.idlePeriods++;
          log.warn(`Session ${this.sessionId} is idle (${Math.round(idleMs / 60_000)}m)`);
        }
      }, 60_000) // check every minute
    );

    // End-of-session detection — proactively prompt when Claude writes report.json
    // so the user doesn't have to Ctrl-C to trigger completion.
    const endDetectPath = join(this.workingDir, ".sprintiq", "report.json");
    this.timers.push(
      setInterval(() => {
        if (this.stopped || this.endPromptShown || this.endPromptInFlight) return;
        if (!existsSync(endDetectPath)) return;
        // Size-stability check: skip this tick if Claude is still writing.
        // If size stays the same across two consecutive ticks, treat as settled.
        let size: number;
        try {
          size = statSync(endDetectPath).size;
        } catch {
          return;
        }
        if (size === 0) return;
        this.endPromptInFlight = true;
        // Defer the prompt one more second so a partial write has time to finish.
        setTimeout(() => {
          void this.promptEndSession(endDetectPath, size).catch((err) => {
            log.warn(`End-session prompt failed: ${err instanceof Error ? err.message : "unknown"}`);
            this.endPromptInFlight = false;
          });
        }, 1_000);
      }, 1_000)
    );

    // Signal handlers — save pending report on ungraceful exit.
    // watch.ts registers SIGINT/SIGTERM first and calls monitor.complete("stopped") (graceful).
    // complete() calls stop() which deregisters these handlers before watch.ts's handler fires
    // SessionMonitor's handler. If stop() hasn't run yet (hard kill), this handler saves
    // a pending report synchronously and exits.
    this.signalHandler = () => {
      if (this.stopped) return;
      this.stopped = true;
      try {
        savePendingReport({
          sessionId: this.sessionId,
          taskId: this.taskId,
          token: this.token,
          status: "stopped",
          metrics: this.buildMetrics(),
          completion_report: null,
          developer_notes: null,
          proposed_status: null,
          ac_met: null,
          ac_total: null,
          bugs_detected: null,
          tech_debt_detected: null,
          issues: null,
          failedAt: new Date().toISOString(),
        });
      } catch {
        // Best effort — process is dying
      }
      process.exit(1);
    };
    process.on("SIGINT", this.signalHandler);
    process.on("SIGTERM", this.signalHandler);
    process.on("uncaughtException", this.signalHandler);
  }

  stop(): void {
    this.stopped = true;
    if (this.signalHandler) {
      process.removeListener("SIGINT", this.signalHandler);
      process.removeListener("SIGTERM", this.signalHandler);
      process.removeListener("uncaughtException", this.signalHandler);
      this.signalHandler = null;
    }
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];
    this.saveState();
    log.info(`Session monitor stopped for ${this.sessionId}`);
  }

  async complete(status: string): Promise<void> {
    if (this.completing) {
      log.info("Completion already in progress — ignoring duplicate trigger.");
      return;
    }
    this.completing = true;
    this.stop();

    // 1. Build metrics (token usage is enriched below once we have the report)
    const baseMetrics = this.buildMetrics();

    // Token usage — best effort. Always enrich when we can, regardless of completion status,
    // so failed/stopped sessions still get accounted for on the server.
    let tokens: TokenUsage | undefined;
    try {
      const extracted = extractTokenUsage(this.startedAt);
      if (extracted.totalTokens > 0) tokens = extracted;
    } catch (err) {
      log.warn(`Token extraction failed (non-fatal): ${err instanceof Error ? err.message : "unknown"}`);
    }

    const metrics: SessionMetrics = { ...baseMetrics, tokens };
    log.info(
      `Final metrics — Files: ${metrics.files.changed}, Lines: +${metrics.files.totalLinesAdded} -${metrics.files.totalLinesRemoved}, ` +
      `Active: ${Math.round(metrics.activeMs / 60_000)}m, Commits: ${metrics.git.commitCount}` +
      (tokens ? `, Tokens: ${tokens.totalTokens} ($${tokens.costUsd.toFixed(2)})` : "")
    );

    // Send final heartbeat (best effort)
    try {
      await this.heartbeat.send(metrics);
    } catch {
      // Best effort
    }

    // 2. Poll for report.json (Claude Code may still be flushing it to disk)
    log.info("Waiting for report.json...");
    const report = await waitForReport(this.workingDir);
    if (!report) {
      log.warn("report.json not found after 5s — completing with baseline metrics only");
    }

    // 3. Display completion summary (non-blocking)
    displayCompletionSummary(report, metrics);

    // 4. Prompt for developer notes (BLOCKING — only blocking step)
    const notes = await promptForNotes();

    // 5. Build completion payload
    const finalStatus = report?.status ?? status;
    const payload: CompletionPayload = {
      status: finalStatus,
      token: this.token,
      metrics,
      completion_report: report,
      developer_notes: notes || null,
      proposed_status: report?.status ?? null,
      // Empty object (not undefined) so the server knows the CLI is participating in
      // auto-apply, even when we don't have a concrete status_id to propose.
      // The server resolves status_id from proposed_status when this is empty.
      proposed_changes: {},
      ac_met: report?.ac_results
        ? report.ac_results.filter((r) => r.met).length
        : null,
      ac_total: report?.ac_results?.length ?? null,
      bugs_detected: report?.issues
        ? report.issues.filter((i) => i.type === "bug").length
        : null,
      tech_debt_detected: report?.issues
        ? report.issues.filter((i) => i.type === "tech_debt").length
        : null,
      issues: report?.issues ?? null,
      input_tokens: tokens?.inputTokens,
      output_tokens: tokens?.outputTokens,
      total_tokens: tokens?.totalTokens,
      cost_usd: tokens?.costUsd,
    };

    // Diagnostic crumb — print the issue breakdown we're about to ship. Next time
    // the CLI display ("1 tech debt, 3 followups") disagrees with what SprintIQ
    // persisted, this line tells us whether the payload had it and something dropped
    // it server-side, or whether report.json had already been rewritten before send.
    try {
      const issues = payload.issues ?? [];
      const typeCounts = issues.reduce<Record<string, number>>((acc, i) => {
        const t = typeof i?.type === "string" ? i.type : "unknown";
        acc[t] = (acc[t] ?? 0) + 1;
        return acc;
      }, {});
      log.info(
        `Shipping payload — issues=${issues.length} ` +
        `types=${JSON.stringify(typeCounts)} ` +
        `tokens=${payload.total_tokens ?? 0} cost=$${(payload.cost_usd ?? 0).toFixed(4)}`
      );
    } catch {
      // Log-only diagnostic; never let it break the send.
    }

    // 6. Send to API with retry
    let succeeded = false;
    for (let attempt = 0; attempt < COMPLETION_RETRY_MAX_ATTEMPTS; attempt++) {
      try {
        await this.api.completeSession(this.sessionId, payload);
        succeeded = true;
        break;
      } catch (err) {
        const delay = COMPLETION_RETRY_BASE_MS * Math.pow(2, attempt);
        log.warn(
          `Completion attempt ${attempt + 1}/${COMPLETION_RETRY_MAX_ATTEMPTS} failed: ${
            err instanceof Error ? err.message : "unknown"
          }. Retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // 7. Save as pending report on failure
    if (!succeeded) {
      savePendingReport({
        sessionId: this.sessionId,
        taskId: this.taskId,
        token: this.token,
        status: finalStatus,
        metrics,
        completion_report: report,
        developer_notes: notes || null,
        proposed_status: report?.status ?? null,
        proposed_changes: {},
        ac_met: payload.ac_met,
        ac_total: payload.ac_total,
        bugs_detected: payload.bugs_detected,
        tech_debt_detected: payload.tech_debt_detected,
        issues: report?.issues ?? null,
        failedAt: new Date().toISOString(),
      });
      log.warn(
        `Failed to report to SprintIQ after ${COMPLETION_RETRY_MAX_ATTEMPTS} attempts. ` +
        `Will retry when connection restored.`
      );
    }

    // 8. Offer to commit pending changes. Never auto-pushes — push is always the user's call.
    await this.promptCommitIfChanges(finalStatus);

    deleteSessionState(this.sessionId);
    log.info(`Session ${this.sessionId} completed with status: ${finalStatus}`);
  }

  recordActivity(): void {
    const now = Date.now();
    if (this.isIdle) {
      // Was idle, now active again
      this.isIdle = false;
    } else {
      // Accumulate active time since last activity
      const elapsed = now - this.lastActiveAt;
      if (elapsed < MONITOR_IDLE_THRESHOLD_MS) {
        this.activeMs += elapsed;
      }
    }
    this.lastActiveAt = now;
  }

  getStatus(): SessionMetrics {
    return this.buildMetrics();
  }

  buildMetrics(): SessionMetrics {
    const totalLines = this.fileTracker?.getTotalLines() ?? { added: 0, removed: 0 };
    const testResults = this.testTracker.getResults();

    return {
      sessionId: this.sessionId,
      taskId: this.taskId,
      startedAt: this.startedAt,
      durationMs: Date.now() - new Date(this.startedAt).getTime(),
      activeMs: this.activeMs,
      idlePeriods: this.idlePeriods,
      isIdle: this.isIdle,
      files: {
        changed: this.fileTracker?.getChangeCount() ?? 0,
        totalLinesAdded: totalLines.added,
        totalLinesRemoved: totalLines.removed,
        topFiles: this.fileTracker?.getTopFiles(10) ?? [],
      },
      git: {
        commitCount: this.gitTracker?.getCommitCount() ?? 0,
        commits: this.gitTracker?.getCommits() ?? [],
      },
      tests: testResults,
      pendingReportsCount: loadPendingReports().length,
    };
  }

  /**
   * Fired when report.json is detected and appears stable. Shows an interactive
   * "End session now? [Y/n]" prompt with a short timeout (default Y). On confirm
   * or timeout, runs the graceful complete() flow. On decline, marks the prompt
   * as shown and leaves the session running — user can still Ctrl-C later.
   */
  private async promptEndSession(reportPath: string, previousSize: number): Promise<void> {
    try {
      // Second stability check after the 1s defer — if the file is still growing,
      // skip this round and let the next tick re-evaluate.
      let currentSize: number;
      try {
        currentSize = statSync(reportPath).size;
      } catch {
        this.endPromptInFlight = false;
        return;
      }
      if (currentSize !== previousSize) {
        this.endPromptInFlight = false;
        return;
      }

      // Non-TTY (watch server, CI): skip the prompt and complete directly.
      // User can't answer anyway, and hanging here would freeze the session.
      if (!process.stdin.isTTY) {
        this.endPromptShown = true;
        log.info("report.json detected — completing session (non-interactive).");
        await this.complete("completed");
        return;
      }

      console.log();
      console.log("Claude finished writing its session report.");
      const answer = await promptWithTimeout(
        "End session now? [Y/n, 10s default Y]: ",
        10_000,
        "y",
      );

      this.endPromptShown = true;

      if (answer === "n" || answer === "no") {
        console.log("Staying open. Press Ctrl-C when ready to end — or delete .sprintiq/report.json and keep working.");
        this.endPromptInFlight = false;
        return;
      }

      await this.complete("completed");
    } catch (err) {
      this.endPromptInFlight = false;
      throw err;
    }
  }

  /**
   * Offer to commit any pending changes after the session ends.
   *
   * - Never auto-commits. Never pushes. Push is always manual.
   * - Skips silently when there's nothing to commit (common when Claude already
   *   committed inside the session).
   * - Refuses on protected branches, on non-TTY stdin (scripts/CI), and on
   *   non-completed status.
   * - On user confirm, runs `git commit` with a suggested message; user can
   *   type `e` to edit the message in $EDITOR, or accept the default.
   */
  private async promptCommitIfChanges(completionStatus: string): Promise<void> {
    if (!this.isGitRepo) return;
    if (completionStatus !== "completed") {
      log.info(`Commit prompt skipped — session status: ${completionStatus}`);
      return;
    }
    if (!process.stdin.isTTY) {
      log.info("Commit prompt skipped — not an interactive terminal. Commit any pending changes manually.");
      return;
    }

    const execOpts = { cwd: this.workingDir, stdio: "pipe" as const, timeout: 30_000 };

    // Branch guard — refuse on protected branches
    let currentBranch: string;
    try {
      currentBranch = execSync("git rev-parse --abbrev-ref HEAD", execOpts).toString().trim();
    } catch {
      log.warn("Commit prompt skipped — could not determine current branch");
      return;
    }

    if (PROTECTED_BRANCHES.includes(currentBranch)) {
      log.warn(
        `Commit prompt skipped — on protected branch "${currentBranch}". ` +
        `Commit any pending changes manually.`
      );
      return;
    }

    // Is there anything to commit? Check BOTH staged and unstaged; `git status --porcelain`
    // is our single source of truth. Empty output = clean tree = nothing to prompt for.
    let statusOut: string;
    try {
      statusOut = execSync("git status --porcelain", execOpts).toString();
    } catch {
      log.warn("Commit prompt skipped — could not read git status");
      return;
    }
    if (!statusOut.trim()) {
      // Common case: Claude already committed everything during the session. Nothing for
      // the CLI to do — stay quiet.
      return;
    }

    // Preview what would be committed (numstat-style is too noisy; use --stat)
    let previewStat: string;
    try {
      // Stage everything before the preview so `diff --cached --stat` reflects what `git commit` would include.
      execSync("git add -A", execOpts);
      previewStat = execSync("git diff --cached --stat", execOpts).toString().trim();
    } catch (err) {
      log.warn(`Could not prepare commit preview: ${err instanceof Error ? err.message : "unknown"}`);
      return;
    }
    if (!previewStat) {
      // Only untracked files filtered by .gitignore, or a race with another commit.
      return;
    }

    console.log();
    console.log(`Pending changes on branch ${currentBranch}:`);
    console.log(previewStat);

    const commitMsg = `[SprintIQ] Complete: ${this.taskName} (task/${this.taskId})`;
    console.log();
    console.log(`Suggested message: ${commitMsg}`);
    console.log("Push is NOT automatic — run `git push` yourself when ready.");
    console.log();

    const answer = await promptWithTimeout(
      "Commit these changes now? [y/N/e to edit message]: ",
      60_000,
      "n",
    );

    if (answer === "n") {
      log.info("Commit skipped. Changes are staged — commit or reset manually.");
      return;
    }

    let finalMsg = commitMsg;
    if (answer === "e") {
      const edited = await promptWithTimeout("New commit message: ", 120_000, "");
      if (!edited.trim()) {
        log.info("Empty message — commit aborted. Changes remain staged.");
        return;
      }
      finalMsg = edited.trim();
    }

    // Run commit. Don't filter errors on substring — just report what git actually said.
    try {
      const out = execSync(`git commit -m ${JSON.stringify(finalMsg)}`, execOpts).toString().trim();
      if (out) log.info(out);
      log.success(`Committed: ${finalMsg}`);
      log.info("Run `git push` to push to remote.");
    } catch (err) {
      // Could be a pre-commit hook failure, could be "nothing to commit" (raced away), could be sign failure.
      // Either way: don't warn-spam. Report once, leave the working state as-is.
      const msg = err instanceof Error ? err.message : String(err);
      log.warn(`Commit did not complete: ${msg.split("\n")[0]}`);
      log.info("Changes remain staged. Run `git commit` manually once resolved.");
    }
  }

  private saveState(): void {
    const state: PersistedSessionState = {
      sessionId: this.sessionId,
      taskId: this.taskId,
      token: this.token,
      workingDir: this.workingDir,
      startedAt: this.startedAt,
      lastActiveAt: new Date(this.lastActiveAt).toISOString(),
      heartbeatSequence: this.heartbeat.getSequence(),
      knownCommitShas: this.gitTracker?.getKnownShas() ?? [],
      fileChanges: this.fileTracker?.getChangesMap() ?? {},
      testRuns: this.testTracker.getRuns(),
      idlePeriods: this.idlePeriods,
      activeMs: this.activeMs,
    };
    saveSessionState(state);
  }
}
