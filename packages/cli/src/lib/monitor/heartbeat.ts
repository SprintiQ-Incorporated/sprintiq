import { SprintIQAPIClient } from "../api-client.js";
import { HEARTBEAT_RETRY_BASE_MS, HEARTBEAT_RETRY_MAX_MS } from "../constants.js";
import { log } from "../logger.js";
import type { SessionMetrics, HeartbeatPayload, HeartbeatResponse } from "./types.js";

export class HeartbeatSender {
  private api: SprintIQAPIClient;
  private sessionId: string;
  private token: string;
  private sequence: number;
  private retryCount = 0;
  private buffer: HeartbeatPayload[] = [];
  private terminalStatus: string | null = null;

  constructor(
    api: SprintIQAPIClient,
    sessionId: string,
    token: string,
    initialSequence = 0
  ) {
    this.api = api;
    this.sessionId = sessionId;
    this.token = token;
    this.sequence = initialSequence;
  }

  async send(metrics: SessionMetrics): Promise<boolean> {
    this.sequence++;

    const payload: HeartbeatPayload = {
      token: this.token,
      sequence: this.sequence,
      metrics,
    };

    try {
      // Flush buffered heartbeats first
      while (this.buffer.length > 0) {
        const buffered = this.buffer[0];
        const bufferedRes = await this.api.sendHeartbeat(this.sessionId, buffered);
        if (bufferedRes.accepted || bufferedRes.lastSequence >= buffered.sequence) {
          this.buffer.shift();
        } else {
          break;
        }
      }

      const response = await this.api.sendHeartbeat(this.sessionId, payload);
      this.retryCount = 0;

      if (response.lastSequence && response.lastSequence > this.sequence) {
        this.sequence = response.lastSequence;
      }

      if (
        response.sessionStatus &&
        ["completed", "failed", "stopped", "cancelled"].includes(response.sessionStatus)
      ) {
        if (response.reason === "workspace_tier_downgraded") {
          log.warn("Workspace was downgraded — Claude Code requires Velocity tier or above");
        }
        this.terminalStatus = response.sessionStatus;
      }

      return response.accepted;
    } catch (err) {
      this.retryCount++;
      this.buffer.push(payload);
      log.warn(
        `Heartbeat failed (retry ${this.retryCount}, buffered ${this.buffer.length}): ${
          err instanceof Error ? err.message : "unknown"
        }`
      );
      return false;
    }
  }

  getBackoffMs(): number {
    return Math.min(
      HEARTBEAT_RETRY_BASE_MS * Math.pow(2, this.retryCount),
      HEARTBEAT_RETRY_MAX_MS
    );
  }

  getSequence(): number {
    return this.sequence;
  }

  getTerminalStatus(): string | null {
    return this.terminalStatus;
  }

  getBufferedCount(): number {
    return this.buffer.length;
  }
}
