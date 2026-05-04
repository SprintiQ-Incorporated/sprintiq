import { exec } from "child_process";

/**
 * Open a URL in the default browser.
 * Uses platform-specific commands to avoid ESM-only dependency issues.
 */
export function openBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd: string;

    switch (process.platform) {
      case "darwin":
        cmd = `open "${url}"`;
        break;
      case "win32":
        cmd = `start "" "${url}"`;
        break;
      default:
        // Linux / others
        cmd = `xdg-open "${url}"`;
        break;
    }

    exec(cmd, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
