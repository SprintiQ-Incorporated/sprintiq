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

export const mochaParser: TestParser = {
  name: "mocha",

  detect(workingDir: string): boolean {
    const configs = [".mocharc.yml", ".mocharc.yaml", ".mocharc.js", ".mocharc.cjs", ".mocharc.json"];
    if (configs.some((c) => existsSync(join(workingDir, c)))) return true;

    try {
      const pkg = JSON.parse(
        readFileSync(join(workingDir, "package.json"), "utf-8")
      );
      if (pkg.mocha || pkg.devDependencies?.mocha || pkg.dependencies?.mocha)
        return true;
    } catch {
      // no package.json
    }
    return false;
  },

  parseResults(workingDir: string): TestRunResult | null {
    const resultPath = join(
      workingDir,
      "mochawesome-report",
      "mochawesome.json"
    );
    if (!existsSync(resultPath) || !isRecent(resultPath)) return null;

    try {
      const data = JSON.parse(readFileSync(resultPath, "utf-8"));
      const stats = data.stats ?? {};

      return {
        framework: "mocha",
        passed: stats.passes ?? 0,
        failed: stats.failures ?? 0,
        skipped: stats.pending ?? stats.skipped ?? 0,
        total: stats.tests ?? 0,
        duration: stats.duration,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },
};
