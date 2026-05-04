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

export const goTestParser: TestParser = {
  name: "go-test",

  detect(workingDir: string): boolean {
    return existsSync(join(workingDir, "go.mod"));
  },

  parseResults(workingDir: string): TestRunResult | null {
    const resultPath = join(workingDir, "go-test-report.json");
    if (!existsSync(resultPath) || !isRecent(resultPath)) return null;

    try {
      const raw = readFileSync(resultPath, "utf-8");
      // go test -json outputs newline-delimited JSON
      const lines = raw.trim().split("\n");
      let passed = 0;
      let failed = 0;
      let skipped = 0;
      let elapsed = 0;

      for (const line of lines) {
        try {
          const event = JSON.parse(line) as {
            Action?: string;
            Elapsed?: number;
            Test?: string;
          };
          if (!event.Test) continue; // package-level event
          if (event.Action === "pass") passed++;
          else if (event.Action === "fail") failed++;
          else if (event.Action === "skip") skipped++;
          if (event.Elapsed) elapsed = Math.max(elapsed, event.Elapsed);
        } catch {
          // skip malformed line
        }
      }

      if (passed + failed + skipped === 0) return null;

      return {
        framework: "go-test",
        passed,
        failed,
        skipped,
        total: passed + failed + skipped,
        duration: elapsed * 1000,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },
};
