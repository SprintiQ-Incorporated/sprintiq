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

export const rspecParser: TestParser = {
  name: "rspec",

  detect(workingDir: string): boolean {
    if (existsSync(join(workingDir, ".rspec"))) return true;

    const gemfilePath = join(workingDir, "Gemfile");
    if (existsSync(gemfilePath)) {
      try {
        const content = readFileSync(gemfilePath, "utf-8");
        if (content.includes("rspec")) return true;
      } catch {
        // skip
      }
    }
    return false;
  },

  parseResults(workingDir: string): TestRunResult | null {
    const resultPath = join(workingDir, ".rspec_results.json");
    if (!existsSync(resultPath) || !isRecent(resultPath)) return null;

    try {
      const data = JSON.parse(readFileSync(resultPath, "utf-8"));
      const summary = data.summary ?? data;
      const passed = summary.example_count - (summary.failure_count ?? 0) - (summary.pending_count ?? 0);

      return {
        framework: "rspec",
        passed: Math.max(0, passed),
        failed: summary.failure_count ?? 0,
        skipped: summary.pending_count ?? 0,
        total: summary.example_count ?? 0,
        duration: summary.duration != null ? summary.duration * 1000 : undefined,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },
};
