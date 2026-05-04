import { Command } from "commander";
import { getCredentials, deleteCredentials } from "../../lib/config.js";
import { SprintIQAPIClient } from "../../lib/api-client.js";
import { log } from "../../lib/logger.js";

export const logoutCommand = new Command("logout")
  .description("Log out and revoke your CLI API key")
  .action(async () => {
    const creds = getCredentials();

    if (!creds) {
      log.info("Not currently logged in.");
      return;
    }

    // Revoke key on the server (best-effort)
    try {
      const client = new SprintIQAPIClient({ apiKey: creds.api_key });
      await client.revokeKey();
    } catch {
      // Ignore — maybe already revoked or offline
    }

    deleteCredentials();
    log.success(`Logged out ${creds.email}`);
  });
