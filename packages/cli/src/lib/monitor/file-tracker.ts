import { execSync } from "child_process";
import { DEFAULT_EXCLUDE_PATTERNS } from "../constants.js";
import type { FileChange } from "./types.js";

const EXEC_OPTS = { stdio: "pipe" as const, timeout: 10_000 };

export class FileTracker {
  private workingDir: string;
  private excludePatterns: string[];
  private changes: Map<string, FileChange> = new Map();

  constructor(
    workingDir: string,
    excludePatterns?: string[],
    initialChanges?: Record<string, FileChange>
  ) {
    this.workingDir = workingDir;
    this.excludePatterns = excludePatterns ?? DEFAULT_EXCLUDE_PATTERNS;
    if (initialChanges) {
      for (const [path, change] of Object.entries(initialChanges)) {
        this.changes.set(path, change);
      }
    }
  }

  poll(): void {
    try {
      // Tracked file changes
      const numstat = execSync("git diff --numstat HEAD", {
        ...EXEC_OPTS,
        cwd: this.workingDir,
      })
        .toString()
        .trim();

      if (numstat) {
        for (const line of numstat.split("\n")) {
          const parts = line.split("\t");
          if (parts.length < 3) continue;

          const [added, removed, path] = parts;
          if (this.isExcluded(path)) continue;

          const isBinary = added === "-" || removed === "-";
          const linesAdded = isBinary ? 0 : parseInt(added, 10) || 0;
          const linesRemoved = isBinary ? 0 : parseInt(removed, 10) || 0;

          const existing = this.changes.get(path);
          if (existing) {
            existing.linesAdded = linesAdded;
            existing.linesRemoved = linesRemoved;
            existing.isBinary = isBinary;
          } else {
            this.changes.set(path, { path, linesAdded, linesRemoved, isBinary });
          }
        }
      }

      // Untracked files
      const untracked = execSync(
        "git ls-files --others --exclude-standard",
        { ...EXEC_OPTS, cwd: this.workingDir }
      )
        .toString()
        .trim();

      if (untracked) {
        for (const path of untracked.split("\n")) {
          if (!path || this.isExcluded(path)) continue;
          if (!this.changes.has(path)) {
            this.changes.set(path, {
              path,
              linesAdded: 0,
              linesRemoved: 0,
              isBinary: false,
            });
          }
        }
      }
    } catch {
      // Git command failed — skip this poll cycle
    }
  }

  private isExcluded(filePath: string): boolean {
    return this.excludePatterns.some((pattern) => {
      if (pattern.startsWith("*")) {
        return filePath.endsWith(pattern.slice(1));
      }
      return filePath.includes(pattern);
    });
  }

  getChanges(): FileChange[] {
    return Array.from(this.changes.values());
  }

  getChangesMap(): Record<string, FileChange> {
    return Object.fromEntries(this.changes);
  }

  getChangeCount(): number {
    return this.changes.size;
  }

  getTotalLines(): { added: number; removed: number } {
    let added = 0;
    let removed = 0;
    for (const change of this.changes.values()) {
      added += change.linesAdded;
      removed += change.linesRemoved;
    }
    return { added, removed };
  }

  getTopFiles(n: number): FileChange[] {
    return Array.from(this.changes.values())
      .sort((a, b) => (b.linesAdded + b.linesRemoved) - (a.linesAdded + a.linesRemoved))
      .slice(0, n);
  }
}
