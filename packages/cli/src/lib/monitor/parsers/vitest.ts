import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import type { TestParser } from "./types.js";
import type { TestRunResult } from "../types.js";

const MAX_AGE_MS = 10 * 60_000;

function isRecent(filePath: string): boolean {
  try {
    return Date.now() - statSync(filePath).mtimeMs < MAX_AGE_MS;
  } catch {
    return false;
  }
}

export const vitestParser: TestParser = {
  name: "vitest",

  detect(workingDir: string): boolean {
    const configs = [
      "vitest.config.ts",
      "vitest.config.js",
      "vitest.config.mts",
      "vitest.config.mjs",
    ];
    if (configs.some((c) => existsSync(join(workingDir, c)))) return true;

    try {
      const pkg = JSON.parse(
        readFileSync(join(workingDir, "package.json"), "utf-8")
      );
      if (pkg.vitest || pkg.devDependencies?.vitest || pkg.dependencies?.vitest)
        return true;
    } catch {
      // no package.json
    }
    return false;
  },

  parseResults(workingDir: string): TestRunResult | null {
    const resultPath = join(workingDir, "test-results", "vitest-results.json");
    if (!existsSync(resultPath) || !isRecent(resultPath)) return null;

    try {
      const data = JSON.parse(readFileSync(resultPath, "utf-8"));
      const passed = data.numPassedTests ?? 0;
      const failed = data.numFailedTests ?? 0;
      const skipped = data.numPendingTests ?? data.numSkippedTests ?? 0;

      return {
        framework: "vitest",
        passed,
        failed,
        skipped,
        total: passed + failed + skipped,
        duration: data.duration,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },
};
