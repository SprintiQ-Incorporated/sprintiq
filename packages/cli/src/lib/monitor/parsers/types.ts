import type { TestRunResult } from "../types.js";

export interface TestParser {
  name: string;
  detect(workingDir: string): boolean;
  parseResults(workingDir: string): TestRunResult | null;
}
