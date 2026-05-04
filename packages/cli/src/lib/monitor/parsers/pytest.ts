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

export const pytestParser: TestParser = {
  name: "pytest",

  detect(workingDir: string): boolean {
    if (existsSync(join(workingDir, "pytest.ini"))) return true;
    if (existsSync(join(workingDir, "conftest.py"))) return true;

    // Check pyproject.toml for [tool.pytest]
    const pyproject = join(workingDir, "pyproject.toml");
    if (existsSync(pyproject)) {
      try {
        const content = readFileSync(pyproject, "utf-8");
        if (content.includes("[tool.pytest")) return true;
      } catch {
        // skip
      }
    }
    return false;
  },

  parseResults(workingDir: string): TestRunResult | null {
    // Try JSON results first
    const jsonPath = join(workingDir, "reports", "pytest-results.json");
    if (existsSync(jsonPath) && isRecent(jsonPath)) {
      try {
        const data = JSON.parse(readFileSync(jsonPath, "utf-8"));
        return {
          framework: "pytest",
          passed: data.passed ?? 0,
          failed: data.failed ?? 0,
          skipped: data.skipped ?? data.deselected ?? 0,
          total: data.total ?? 0,
          duration: data.duration,
          timestamp: new Date().toISOString(),
        };
      } catch {
        // fall through to junit
      }
    }

    // Try JUnit XML
    const junitPath = join(workingDir, "junit.xml");
    if (existsSync(junitPath) && isRecent(junitPath)) {
      try {
        const xml = readFileSync(junitPath, "utf-8");
        const tests = parseInt(xml.match(/tests="(\d+)"/)?.[1] ?? "0", 10);
        const failures = parseInt(xml.match(/failures="(\d+)"/)?.[1] ?? "0", 10);
        const errors = parseInt(xml.match(/errors="(\d+)"/)?.[1] ?? "0", 10);
        const skipped = parseInt(xml.match(/skipped="(\d+)"/)?.[1] ?? "0", 10);
        const time = parseFloat(xml.match(/time="([\d.]+)"/)?.[1] ?? "0");

        return {
          framework: "pytest",
          passed: tests - failures - errors - skipped,
          failed: failures + errors,
          skipped,
          total: tests,
          duration: time * 1000,
          timestamp: new Date().toISOString(),
        };
      } catch {
        // skip
      }
    }

    return null;
  },
};
