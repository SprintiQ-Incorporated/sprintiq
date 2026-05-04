import http from "http";
import { URL } from "url";
import { CALLBACK_TIMEOUT_MS } from "./constants.js";
import type { CallbackResult } from "../types.js";

const SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head><title>SprintIQ CLI</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc}
.card{text-align:center;padding:2rem;border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1)}
h1{color:#16a34a;margin:0 0 .5rem}p{color:#475569}</style></head>
<body><div class="card"><h1>Authenticated!</h1><p>You can close this tab and return to your terminal.</p></div></body>
</html>`;

const ERROR_HTML = (msg: string) => `<!DOCTYPE html>
<html>
<head><title>SprintIQ CLI</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc}
.card{text-align:center;padding:2rem;border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1)}
h1{color:#dc2626;margin:0 0 .5rem}p{color:#475569}</style></head>
<body><div class="card"><h1>Authentication Failed</h1><p>${msg}</p></div></body>
</html>`;

/**
 * Starts an ephemeral HTTP server on a random port.
 * Waits for a single GET /callback?mcp_token=X&email=Y request.
 * Returns a Promise that resolves with { token, email } or rejects on timeout.
 */
export function startCallbackServer(): {
  port: Promise<number>;
  result: Promise<CallbackResult>;
  close: () => void;
} {
  let resolvePort: (port: number) => void;
  let resolveResult: (result: CallbackResult) => void;
  let rejectResult: (err: Error) => void;

  const portPromise = new Promise<number>((res) => {
    resolvePort = res;
  });

  const resultPromise = new Promise<CallbackResult>((res, rej) => {
    resolveResult = res;
    rejectResult = rej;
  });

  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || "/", `http://localhost`);

      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const token = url.searchParams.get("mcp_token");
      const email = url.searchParams.get("email");
      const error = url.searchParams.get("error");

      if (error) {
        const desc =
          url.searchParams.get("error_description") || "Unknown error";
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(ERROR_HTML(desc));
        rejectResult(new Error(desc));
        server.close();
        return;
      }

      if (!token || !email) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(ERROR_HTML("Missing token or email in callback"));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(SUCCESS_HTML);

      resolveResult({ token, email });
      server.close();
    } catch (err) {
      res.writeHead(500);
      res.end("Internal error");
    }
  });

  // Listen on port 0 → OS picks a free port
  server.listen(0, "127.0.0.1", () => {
    const addr = server.address();
    if (addr && typeof addr === "object") {
      resolvePort(addr.port);
    }
  });

  // Timeout
  const timer = setTimeout(() => {
    rejectResult(new Error("Authentication timed out (120s). Please try again."));
    server.close();
  }, CALLBACK_TIMEOUT_MS);

  // Clean up timer when result resolves
  resultPromise.finally(() => clearTimeout(timer));

  return {
    port: portPromise,
    result: resultPromise,
    close: () => {
      clearTimeout(timer);
      server.close();
    },
  };
}
