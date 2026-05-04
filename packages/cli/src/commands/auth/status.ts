import { Command } from "commander";
import { getCredentials } from "../../lib/config.js";
import { SprintIQAPIClient } from "../../lib/api-client.js";
import { log } from "../../lib/logger.js";
import { VERSION } from "../../lib/constants.js";

export const statusCommand = new Command("status")
  .description("Show current authentication status")
  .action(async () => {
    const creds = getCredentials();

    if (!creds) {
      log.error("Not logged in. Run `sprintiq auth login` to authenticate.");
      process.exit(1);
    }

    // Try to fetch live status from server
    try {
      const client = new SprintIQAPIClient({ apiKey: creds.api_key });
      const status = await client.getAuthStatus();

      log.plain("");
      log.plain(`  Email:       ${status.email}`);
      log.plain(`  User ID:     ${status.user_id || "N/A"}`);
      log.plain(`  Expires:     ${new Date(status.expires_at).toLocaleDateString()}`);
      log.plain(`  Workspaces:  ${status.workspaces.length}`);

      for (const ws of status.workspaces) {
        log.plain(`    - ${ws.name} (${ws.role})`);
      }

      log.plain(`  CLI Version: ${VERSION}`);
      log.plain("");
    } catch {
      // Offline fallback — show local data
      log.warn("Could not reach SprintIQ (offline?). Showing local data.\n");
      log.plain(`  Email:       ${creds.email}`);
      log.plain(`  Expires:     ${new Date(creds.expires_at).toLocaleDateString()}`);
      log.plain(`  CLI Version: ${VERSION}`);
      log.plain("");

      const expiry = new Date(creds.expires_at);
      if (expiry < new Date()) {
        log.warn("Your credentials have expired. Run `sprintiq auth login` to re-authenticate.");
      }
    }
  });
