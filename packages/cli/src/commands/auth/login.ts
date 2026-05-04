import { Command } from "commander";
import { getCredentials, saveCredentials } from "../../lib/config.js";
import { SprintIQAPIClient } from "../../lib/api-client.js";
import { startCallbackServer } from "../../lib/callback-server.js";
import { openBrowser } from "../../lib/browser.js";
import { log } from "../../lib/logger.js";

export const loginCommand = new Command("login")
  .description("Authenticate with SprintIQ via your browser")
  .option("--force", "Re-authenticate even if already logged in")
  .action(async (opts) => {
    // Check existing credentials
    if (!opts.force) {
      const existing = getCredentials();
      if (existing) {
        const expiry = new Date(existing.expires_at);
        if (expiry > new Date()) {
          log.info(`Already logged in as ${existing.email}`);
          log.info(`Use --force to re-authenticate.`);
          return;
        }
        log.warn("Existing credentials have expired. Re-authenticating...");
      }
    }

    const client = new SprintIQAPIClient();
    const callback = startCallbackServer();

    try {
      const port = await callback.port;

      log.info("Starting authentication...");

      // Ask server for a pending auth token
      const { token, browser_url } = await client.initiateAuth(port);

      // Open the browser
      log.info("Opening browser for authentication...");
      try {
        await openBrowser(browser_url);
      } catch {
        log.warn("Could not open browser automatically.");
        log.plain(`\n  Open this URL in your browser:\n  ${browser_url}\n`);
      }

      log.info("Waiting for authentication (timeout: 120s)...");

      // Wait for the callback
      const { token: mcpToken, email } = await callback.result;

      // Exchange the MCP token for a long-lived CLI API key
      log.info("Exchanging token...");
      const exchangeResult = await client.exchangeToken(mcpToken, email);

      // Save credentials
      saveCredentials({
        api_key: exchangeResult.api_key,
        email: exchangeResult.email,
        expires_at: exchangeResult.expires_at,
      });

      log.success(`Authenticated as ${exchangeResult.email}`);
    } catch (err) {
      callback.close();
      log.error(err instanceof Error ? err.message : "Authentication failed");
      process.exit(1);
    }
  });
