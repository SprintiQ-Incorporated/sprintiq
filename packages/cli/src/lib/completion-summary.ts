import chalk from "chalk";
import type { ClaudeCodeReport } from "./monitor/types.js";
import type { SessionMetrics } from "./monitor/types.js";

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `${hours}h ${rem}m`;
}

function formatTokens(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `<$0.01`;
  return `$${usd.toFixed(2)}`;
}

/**
 * Displays a styled completion summary in the terminal.
 * Non-blocking — no user input required.
 */
export function displayCompletionSummary(
  report: ClaudeCodeReport | null,
  metrics: SessionMetrics
): void {
  console.log();
  console.log(chalk.bold("━".repeat(50)));
  console.log(chalk.bold("  Session Complete"));
  console.log(chalk.bold("━".repeat(50)));

  // Baseline metrics
  console.log();
  console.log(chalk.dim("  Metrics"));
  console.log(`  Duration:      ${formatDuration(metrics.durationMs)} (${formatDuration(metrics.activeMs)} active)`);
  console.log(`  Files changed: ${metrics.files.changed}`);
  console.log(`  Lines:         ${chalk.green(`+${metrics.files.totalLinesAdded}`)} ${chalk.red(`-${metrics.files.totalLinesRemoved}`)}`);
  if (metrics.git.commitCount > 0) {
    console.log(`  Commits:       ${metrics.git.commitCount}`);
  }
  if (metrics.tests.totalTests > 0) {
    const testColor = metrics.tests.totalFailed > 0 ? chalk.red : chalk.green;
    console.log(`  Tests:         ${testColor(`${metrics.tests.totalPassed}/${metrics.tests.totalTests} passed`)}`);
  }
  if (metrics.tokens && metrics.tokens.totalTokens > 0) {
    const { inputTokens, outputTokens, totalTokens, costUsd } = metrics.tokens;
    console.log(`  Tokens:        ${formatTokens(totalTokens)} (in ${formatTokens(inputTokens)} / out ${formatTokens(outputTokens)})`);
    console.log(`  Cost:          ${formatCost(costUsd)}`);
  }

  // Report data (if Claude wrote one)
  if (report) {
    console.log();
    console.log(chalk.dim("  Self-Report"));

    if (report.status) {
      const statusColors: Record<string, (s: string) => string> = {
        completed: chalk.green,
        blocked: chalk.yellow,
        needs_review: chalk.cyan,
      };
      const colorFn = statusColors[report.status] ?? chalk.white;
      console.log(`  Status:        ${colorFn(report.status)}`);
    }

    if (report.ac_results && report.ac_results.length > 0) {
      const met = report.ac_results.filter((r) => r.met).length;
      const total = report.ac_results.length;
      console.log(`  AC Results:    ${met}/${total} met`);
      for (const ac of report.ac_results) {
        const icon = ac.met ? chalk.green("✓") : chalk.red("✗");
        console.log(`    ${icon} AC #${ac.index + 1}${ac.evidence ? chalk.dim(` — ${ac.evidence}`) : ""}`);
      }
    }

    if (report.issues && report.issues.length > 0) {
      const bugs = report.issues.filter((i) => i.type === "bug").length;
      const debt = report.issues.filter((i) => i.type === "tech_debt").length;
      const followups = report.issues.filter((i) => i.type === "followup").length;
      const parts: string[] = [];
      if (bugs > 0) parts.push(`${bugs} bug${bugs > 1 ? "s" : ""}`);
      if (debt > 0) parts.push(`${debt} tech debt`);
      if (followups > 0) parts.push(`${followups} followup${followups > 1 ? "s" : ""}`);
      console.log(`  Issues:        ${parts.join(", ")}`);
    }

    if (report.summary) {
      console.log(`  Summary:       ${report.summary}`);
    }
  } else {
    console.log();
    console.log(chalk.dim("  No self-report found — baseline metrics only"));
  }

  console.log(chalk.bold("━".repeat(50)));
  console.log();
}
