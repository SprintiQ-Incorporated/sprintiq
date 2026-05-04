import { parserRegistry } from "./parsers/index.js";
import type { TestParser } from "./parsers/types.js";
import type { TestRunResult, AggregatedTestResults } from "./types.js";

export class TestTracker {
  private workingDir: string;
  private detectedParsers: TestParser[];
  private runs: TestRunResult[] = [];
  private seenKeys: Set<string> = new Set();

  constructor(workingDir: string, initialRuns?: TestRunResult[]) {
    this.workingDir = workingDir;
    this.detectedParsers = parserRegistry.detectParsers(workingDir);
    if (initialRuns) {
      for (const run of initialRuns) {
        const key = `${run.framework}:${run.timestamp}`;
        this.seenKeys.add(key);
        this.runs.push(run);
      }
    }
  }

  poll(): TestRunResult[] {
    const newResults = parserRegistry.parseAll(
      this.workingDir,
      this.detectedParsers
    );

    const added: TestRunResult[] = [];
    for (const result of newResults) {
      const key = `${result.framework}:${result.timestamp}`;
      if (this.seenKeys.has(key)) continue;
      this.seenKeys.add(key);
      this.runs.push(result);
      added.push(result);
    }
    return added;
  }

  getResults(): AggregatedTestResults {
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const run of this.runs) {
      totalPassed += run.passed;
      totalFailed += run.failed;
      totalSkipped += run.skipped;
    }

    return {
      runs: this.runs,
      totalPassed,
      totalFailed,
      totalSkipped,
      totalTests: totalPassed + totalFailed + totalSkipped,
      detectedFrameworks: this.getDetectedFrameworks(),
    };
  }

  getRuns(): TestRunResult[] {
    return this.runs;
  }

  getDetectedFrameworks(): string[] {
    return this.detectedParsers.map((p) => p.name);
  }
}
