import { DEFAULT_API_BASE_URL } from "./constants.js";
import { loadPendingReports, deletePendingReport, cleanupOldPendingReports } from "./config.js";
import { log } from "./logger.js";
import type {
  InitiateAuthResponse,
  ExchangeTokenResponse,
  AuthStatusResponse,
  HealthResponse,
  TaskPayloadResponse,
} from "../types.js";
import type { HeartbeatPayload, HeartbeatResponse, CompletionPayload } from "./monitor/types.js";

export class SprintIQAPIClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(opts?: { baseUrl?: string; apiKey?: string }) {
    this.baseUrl = (opts?.baseUrl ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
    this.apiKey = opts?.apiKey;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      h["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
      if (contentType.includes("application/json")) {
        const json = (await res.json().catch(() => ({}))) as Record<string, string>;
        throw new Error(json.error || json.message || `HTTP ${res.status}`);
      }
      throw new Error(`HTTP ${res.status}`);
    }

    if (!contentType.includes("application/json")) {
      throw new Error(`Expected JSON response, got ${contentType || "unknown"}`);
    }

    return res.json() as Promise<T>;
  }

  // --- Auth endpoints ---

  async initiateAuth(redirectPort: number): Promise<InitiateAuthResponse> {
    return this.request("POST", "/api/cli/auth/initiate", {
      redirect_port: redirectPort,
    });
  }

  async exchangeToken(
    token: string,
    email: string
  ): Promise<ExchangeTokenResponse> {
    return this.request("POST", "/api/cli/auth/exchange", { token, email });
  }

  async getAuthStatus(): Promise<AuthStatusResponse> {
    return this.request("GET", "/api/cli/auth/status");
  }

  async revokeKey(): Promise<{ revoked: boolean }> {
    return this.request("POST", "/api/cli/auth/revoke", {});
  }

  async refreshKey(): Promise<ExchangeTokenResponse> {
    return this.request("POST", "/api/cli/auth/refresh", {});
  }

  // --- Tasks ---

  async getTask(
    taskId: string,
    includeSubtasks?: boolean
  ): Promise<TaskPayloadResponse> {
    const params = includeSubtasks ? "?include_subtasks=true" : "";
    return this.request(
      "GET",
      `/api/cli/tasks/${encodeURIComponent(taskId)}${params}`
    );
  }

  // --- Session validation ---

  async validateSessionToken(
    sessionId: string,
    token: string
  ): Promise<{ valid: boolean; task_id?: string; workspace_id?: string }> {
    return this.request(
      "POST",
      `/api/claude-code/sessions/${encodeURIComponent(sessionId)}/validate`,
      { token }
    );
  }

  // --- Session monitoring ---

  async sendHeartbeat(
    sessionId: string,
    payload: HeartbeatPayload
  ): Promise<HeartbeatResponse> {
    return this.request(
      "POST",
      `/api/claude-code/sessions/${encodeURIComponent(sessionId)}/heartbeat`,
      payload
    );
  }

  async completeSession(
    sessionId: string,
    data: CompletionPayload | { status: string; error_message?: string; token?: string }
  ): Promise<{ updated: boolean }> {
    return this.request(
      "PATCH",
      `/api/claude-code/sessions/${encodeURIComponent(sessionId)}`,
      data
    );
  }

  // --- Health ---

  async healthCheck(): Promise<HealthResponse> {
    return this.request("GET", "/api/cli/health");
  }

  // --- Pending reports ---

  async flushPendingReports(): Promise<void> {
    // Clean up reports older than 7 days
    const cleaned = cleanupOldPendingReports();
    if (cleaned > 0) {
      log.warn(`Deleted ${cleaned} pending report(s) older than 7 days`);
    }

    const reports = loadPendingReports();
    if (reports.length === 0) return;

    log.info(`Found ${reports.length} pending report(s) to sync`);

    for (const report of reports) {
      try {
        const payload: CompletionPayload = {
          status: report.status,
          token: report.token,
          metrics: report.metrics,
          completion_report: report.completion_report,
          developer_notes: report.developer_notes,
          proposed_status: report.proposed_status,
          ac_met: report.ac_met,
          ac_total: report.ac_total,
          bugs_detected: report.bugs_detected,
          tech_debt_detected: report.tech_debt_detected,
          issues: report.issues,
        };
        await this.completeSession(report.sessionId, payload);
        deletePendingReport(report.sessionId);
        log.info(`Synced previous session: ${report.sessionId}`);
      } catch (err) {
        log.warn(
          `Failed to flush pending report ${report.sessionId}: ${
            err instanceof Error ? err.message : "unknown"
          }`
        );
        // Stop flushing on first failure — will retry next time
        break;
      }
    }
  }
}
