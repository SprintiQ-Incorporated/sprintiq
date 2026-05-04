import { Command } from "commander";
import { execSync } from "child_process";
import { getCredentials } from "../lib/config.js";
import { SprintIQAPIClient } from "../lib/api-client.js";
import { log } from "../lib/logger.js";
import { VERSION, WATCH_PORT } from "../lib/constants.js";

export const doctorCommand = new Command("doctor")
  .description("Check your environment and connectivity")
  .action(async () => {
    log.plain(`\n  SprintIQ CLI v${VERSION}\n`);

    let allPassed = true;

    // 1. Node.js version
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1), 10);
    if (major >= 18) {
      log.check(`Node.js ${nodeVersion}`, "pass");
    } else {
      log.check(`Node.js ${nodeVersion} (requires >= 18)`, "fail");
      allPassed = false;
    }

    // 2. Credentials
    const creds = getCredentials();
    if (creds) {
      const expiry = new Date(creds.expires_at);
      if (expiry > new Date()) {
        log.check(`Authenticated as ${creds.email}`, "pass");
      } else {
        log.check(`Credentials expired (${creds.email})`, "warn");
        allPassed = false;
      }
    } else {
      log.check("Not authenticated", "warn");
    }

    // 3. API connectivity
    try {
      const client = new SprintIQAPIClient();
      const start = Date.now();
      const health = await client.healthCheck();
      const latency = Date.now() - start;

      if (health.ok) {
        log.check(`API reachable (${latency}ms, server v${health.version})`, "pass");
      } else {
        log.check("API returned unexpected response", "warn");
      }
    } catch (err) {
      log.check(
        `API unreachable: ${err instanceof Error ? err.message : "unknown"}`,
        "fail"
      );
      allPassed = false;
    }

    // 4. Watch server
    try {
      const watchRes = await fetch(`http://127.0.0.1:${WATCH_PORT}/health`);
      if (watchRes.ok) {
        log.check(`Watch server running on :${WATCH_PORT}`, "pass");
      } else {
        log.check("Watch server responded but unhealthy", "warn");
      }
    } catch {
      log.check("Watch server not running (start with `sprintiq watch`)", "skip");
    }

    // 5. Claude Code in PATH
    try {
      const isWindows = process.platform === "win32";
      const cmd = isWindows ? "where claude" : "which claude";
      execSync(cmd, { stdio: "ignore" });
      log.check("Claude Code found in PATH", "pass");
    } catch {
      log.check("Claude Code not found in PATH", "warn");
    }

    log.plain("");

    if (!allPassed) {
      process.exit(1);
    }
  });
