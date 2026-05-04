import { Command } from "commander";
import { log } from "../../lib/logger.js";
import { WATCH_PORT } from "../../lib/constants.js";
import type { SessionMetrics } from "../../lib/monitor/types.js";

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60_000) % 60;
  const hours = Math.floor(ms / 3_600_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

const statusCommand = new Command("status")
  .description("Show status of active Claude Code sessions")
  .action(async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${WATCH_PORT}/sessions/status`);
      if (!res.ok) {
        log.error(`Watch server returned ${res.status}`);
        process.exit(1);
      }

      const { sessions } = (await res.json()) as {
        sessions: Record<string, SessionMetrics>;
      };

      const entries = Object.values(sessions);
      if (entries.length === 0) {
        log.info("No active sessions.");
        return;
      }

      for (const m of entries) {
        log.plain("");
        log.plain(`  Session: ${m.sessionId}`);
        log.plain(`  Task:    ${m.taskId}`);
        log.plain(
          `  Duration: ${formatDuration(m.activeMs)} active / ${formatDuration(m.durationMs)} total${
            m.isIdle ? " (IDLE)" : ""
          }`
        );

        if (m.files.changed > 0) {
          log.plain(
            `  Files:   ${m.files.changed} changed (+${m.files.totalLinesAdded} / -${m.files.totalLinesRemoved})`
          );
          if (m.files.topFiles.length > 0) {
            for (const f of m.files.topFiles.slice(0, 5)) {
              log.plain(`           ${f.path} (+${f.linesAdded}/-${f.linesRemoved})`);
            }
          }
        }

        if (m.git.commitCount > 0) {
          log.plain(`  Commits: ${m.git.commitCount}`);
          const latest = m.git.commits[m.git.commits.length - 1];
          if (latest) {
            log.plain(`           Latest: ${latest.sha} ${latest.message}`);
          }
        }

        if (m.tests.totalTests > 0) {
          const t = m.tests;
          log.plain(
            `  Tests:   ${t.totalPassed} passed, ${t.totalFailed} failed, ${t.totalSkipped} skipped (${t.totalTests} total)`
          );
        }

        if (m.tests.detectedFrameworks.length > 0) {
          log.plain(`  Frameworks: ${m.tests.detectedFrameworks.join(", ")}`);
        }

        if (m.idlePeriods > 0) {
          log.plain(`  Idle periods: ${m.idlePeriods}`);
        }
      }
      log.plain("");
    } catch {
      log.error("Could not reach watch server. Is `sprintiq watch` running?");
      process.exit(1);
    }
  });

export const sessionCommand = new Command("session")
  .description("Manage Claude Code sessions")
  .addCommand(statusCommand);
