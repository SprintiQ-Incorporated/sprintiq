import type { TestParser } from "./types.js";
import type { TestRunResult } from "../types.js";
import { jestParser } from "./jest.js";
import { vitestParser } from "./vitest.js";
import { pytestParser } from "./pytest.js";
import { goTestParser } from "./go-test.js";
import { rspecParser } from "./rspec.js";
import { mochaParser } from "./mocha.js";

export class ParserRegistry {
  private parsers: TestParser[] = [];

  register(parser: TestParser): void {
    this.parsers.push(parser);
  }

  detectParsers(workingDir: string): TestParser[] {
    return this.parsers.filter((p) => {
      try {
        return p.detect(workingDir);
      } catch {
        return false;
      }
    });
  }

  parseAll(workingDir: string, detectedParsers: TestParser[]): TestRunResult[] {
    const results: TestRunResult[] = [];
    for (const parser of detectedParsers) {
      try {
        const result = parser.parseResults(workingDir);
        if (result) results.push(result);
      } catch {
        // Parser failed — skip
      }
    }
    return results;
  }
}

export const parserRegistry = new ParserRegistry();
parserRegistry.register(jestParser);
parserRegistry.register(vitestParser);
parserRegistry.register(pytestParser);
parserRegistry.register(goTestParser);
parserRegistry.register(rspecParser);
parserRegistry.register(mochaParser);
