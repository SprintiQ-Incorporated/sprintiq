import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import type { TestParser } from "./types.js";
import type { TestRunResult } from "../types.js";

const MAX_AGE_MS = 10 * 60_000;

function isRecent(filePath: string): boolean {
  try {
    const stat = statSync(filePath);
    return Date.now() - stat.mtimeMs < MAX_AGE_MS;
  } catch {
    return false;
  }
}

export const jestParser: TestParser = {
  name: "jest",

  detect(workingDir: string): boolean {
    // Check for jest config files
    const configs = [
      "jest.config.js",
      "jest.config.ts",
      "jest.config.mjs",
      "jest.config.cjs",
    ];
    if (configs.some((c) => existsSync(join(workingDir, c)))) return true;

    // Check package.json for jest key
    try {
      const pkg = JSON.parse(
        readFileSync(join(workingDir, "package.json"), "utf-8")
      );
      if (pkg.jest) return true;
    } catch {
      // no package.json
    }
    return false;
  },

  parseResults(workingDir: string): TestRunResult | null {
    const resultPath = join(workingDir, "jest-results.json");
    if (!existsSync(resultPath) || !isRecent(resultPath)) return null;

    try {
      const data = JSON.parse(readFileSync(resultPath, "utf-8"));
      const passed = data.numPassedTests ?? 0;
      const failed = data.numFailedTests ?? 0;
      const skipped = data.numPendingTests ?? 0;

      let coveragePercent: number | undefined;
      const coveragePath = join(workingDir, "coverage", "coverage-summary.json");
      if (existsSync(coveragePath) && isRecent(coveragePath)) {
        try {
          const cov = JSON.parse(readFileSync(coveragePath, "utf-8"));
          coveragePercent = cov.total?.lines?.pct;
        } catch {
          // skip coverage
        }
      }

      return {
        framework: "jest",
        passed,
        failed,
        skipped,
        total: passed + failed + skipped,
        duration: data.testResults
          ? data.testResults.reduce(
              (sum: number, r: { endTime?: number; startTime?: number }) =>
                sum + ((r.endTime ?? 0) - (r.startTime ?? 0)),
              0
            )
          : undefined,
        timestamp: new Date().toISOString(),
        coveragePercent,
      };
    } catch {
      return null;
    }
  },
};
