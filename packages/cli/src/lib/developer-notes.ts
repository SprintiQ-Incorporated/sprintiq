import { createInterface } from "readline";
import { DEVELOPER_NOTES_TIMEOUT_MS } from "./constants.js";

/**
 * Prompts the developer for optional session notes.
 * Auto-resolves with empty string after timeout to prevent
 * blocking the completion flow indefinitely (e.g., if developer is AFK
 * or process is about to be killed).
 */
export function promptForNotes(timeoutMs = DEVELOPER_NOTES_TIMEOUT_MS): Promise<string> {
  // Skip when stdin is not a TTY (watch server context on Windows, piped input)
  if (!process.stdin.isTTY) {
    return Promise.resolve("");
  }

  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const timer = setTimeout(() => {
      rl.close();
      console.log("\n(Notes prompt timed out — continuing without notes)");
      resolve("");
    }, timeoutMs);

    rl.question("Session notes (optional, press Enter to skip): ", (answer) => {
      clearTimeout(timer);
      rl.close();
      resolve(answer.trim());
    });
  });
}
