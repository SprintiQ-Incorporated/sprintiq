import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { hashForLogging } from "@/lib/encryption";

type EventCategory = "auth" | "integration" | "data_access" | "admin";
type Severity = "info" | "warning" | "error" | "critical";

interface AuditEvent {
  eventType: string;
  category: EventCategory;
  severity?: Severity;
  userId?: string;
  workspaceId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

class AuditService {
  private _supabase: SupabaseClient | null = null;

  private get supabase(): SupabaseClient {
    if (!this._supabase) {
      this._supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
    }
    return this._supabase;
  }

  async log(event: AuditEvent): Promise<void> {
    try {
      // Extract request context
      const headersList = await headers();
      const ipAddress =
        headersList.get("x-forwarded-for")?.split(",")[0] ||
        headersList.get("x-real-ip") ||
        null;
      const userAgent = headersList.get("user-agent") || null;

      // Sanitize metadata - never log tokens or secrets
      const sanitizedMetadata = this.sanitizeMetadata(event.metadata || {});

      await this.supabase.from("security_audit_log").insert({
        event_type: event.eventType,
        event_category: event.category,
        severity: event.severity || "info",
        user_id: event.userId,
        workspace_id: event.workspaceId,
        ip_address: ipAddress,
        user_agent: userAgent?.substring(0, 500),
        resource_type: event.resourceType,
        resource_id: event.resourceId,
        action: event.action,
        metadata: sanitizedMetadata,
      });
    } catch {
      // Don't throw - audit logging should never break the app
    }
  }

  private sanitizeMetadata(
    metadata: Record<string, unknown>
  ): Record<string, unknown> {
    const sensitiveKeys = [
      "token",
      "secret",
      "password",
      "key",
      "credential",
      "access_token",
      "refresh_token",
      "api_key",
      "signing_secret",
    ];

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();

      if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
        // Hash sensitive values for correlation without exposure
        sanitized[key] =
          typeof value === "string"
            ? `[REDACTED:${hashForLogging(value)}]`
            : "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  // Convenience methods for common events
  async logIntegrationConnect(params: {
    userId: string;
    workspaceId: string;
    integration: string;
    externalId?: string;
  }) {
    await this.log({
      eventType: `${params.integration}_connected`,
      category: "integration",
      severity: "info",
      userId: params.userId,
      workspaceId: params.workspaceId,
      resourceType: `${params.integration}_connection`,
      action: "connect",
      metadata: { external_id: params.externalId },
    });
  }

  async logIntegrationDisconnect(params: {
    userId: string;
    workspaceId: string;
    integration: string;
  }) {
    await this.log({
      eventType: `${params.integration}_disconnected`,
      category: "integration",
      severity: "info",
      userId: params.userId,
      workspaceId: params.workspaceId,
      resourceType: `${params.integration}_connection`,
      action: "disconnect",
    });
  }

  async logAuthEvent(params: {
    eventType: "login" | "logout" | "signup" | "password_reset" | "mfa_enabled";
    userId: string;
    success: boolean;
    method?: string;
  }) {
    await this.log({
      eventType: `auth_${params.eventType}`,
      category: "auth",
      severity: params.success ? "info" : "warning",
      userId: params.userId,
      action: params.eventType,
      metadata: { success: params.success, method: params.method },
    });
  }

  async logSecurityWarning(params: {
    eventType: string;
    userId?: string;
    workspaceId?: string;
    details: string;
  }) {
    await this.log({
      eventType: params.eventType,
      category: "auth",
      severity: "warning",
      userId: params.userId,
      workspaceId: params.workspaceId,
      metadata: { details: params.details },
    });
  }

  async logWebhookReceived(params: {
    integration: string;
    eventType: string;
    workspaceId?: string;
    success: boolean;
    error?: string;
  }) {
    await this.log({
      eventType: `webhook_${params.integration}`,
      category: "integration",
      severity: params.success ? "info" : "error",
      workspaceId: params.workspaceId,
      resourceType: "webhook",
      action: "receive",
      metadata: {
        webhook_event: params.eventType,
        success: params.success,
        error: params.error,
      },
    });
  }
}

export const auditService = new AuditService();
