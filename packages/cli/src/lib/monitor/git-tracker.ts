import { execSync } from "child_process";
import type { GitCommit } from "./types.js";

const EXEC_OPTS = { stdio: "pipe" as const, timeout: 10_000 };

export class GitTracker {
  private workingDir: string;
  private sessionStart: string;
  private knownShas: Set<string>;
  private commits: GitCommit[] = [];

  constructor(workingDir: string, sessionStart: string, knownShas?: string[]) {
    this.workingDir = workingDir;
    this.sessionStart = sessionStart;
    this.knownShas = new Set(knownShas ?? []);
  }

  static isGitRepo(dir: string): boolean {
    try {
      execSync("git rev-parse --is-inside-work-tree", {
        ...EXEC_OPTS,
        cwd: dir,
      });
      return true;
    } catch {
      return false;
    }
  }

  static getRepoRoot(dir: string): string | null {
    try {
      return execSync("git rev-parse --show-toplevel", {
        ...EXEC_OPTS,
        cwd: dir,
      })
        .toString()
        .trim();
    } catch {
      return null;
    }
  }

  pollNewCommits(): GitCommit[] {
    try {
      const raw = execSync(
        `git log --since="${this.sessionStart}" --format="%h|%s|%aI" --name-only`,
        { ...EXEC_OPTS, cwd: this.workingDir }
      )
        .toString()
        .trim();

      if (!raw) return [];

      const newCommits: GitCommit[] = [];
      const blocks = raw.split("\n\n");

      for (const block of blocks) {
        const lines = block.split("\n").filter((l) => l.length > 0);
        if (lines.length === 0) continue;

        const headerParts = lines[0].split("|");
        if (headerParts.length < 3) continue;

        const sha = headerParts[0];
        if (this.knownShas.has(sha)) continue;

        const message = headerParts[1];
        const timestamp = headerParts.slice(2).join("|"); // ISO timestamp may contain pipes in edge cases
        const filesChanged = lines.slice(1);

        const commit: GitCommit = { sha, message, timestamp, filesChanged };
        this.knownShas.add(sha);
        this.commits.push(commit);
        newCommits.push(commit);
      }

      return newCommits;
    } catch {
      return [];
    }
  }

  getCommits(): GitCommit[] {
    return this.commits;
  }

  getCommitCount(): number {
    return this.commits.length;
  }

  getKnownShas(): string[] {
    return Array.from(this.knownShas);
  }
}
