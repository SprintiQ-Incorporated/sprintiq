/**
 * Admin Client with Audit Logging
 * 
 * Wrapper around createAdminClient() that logs all service role usage
 * for security monitoring and compliance.
 * 
 * Usage:
 * import { createAdminClientWithAudit } from '@/lib/supabase/admin-with-audit';
 * 
 * const admin = await createAdminClientWithAudit({
 *   operation: 'workspace_create',
 *   userId: user.id,
 *   reason: 'Creating new workspace for authenticated user',
 *   riskLevel: 'medium',
 * });
 */

import { createAdminClient } from './server';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdminClientContext {
  operation: string;
  userId?: string;
  ipAddress?: string;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

interface AuditLogEntry {
  timestamp: string;
  operation: string;
  user_id: string | null;
  ip_address: string | null;
  reason: string;
  risk_level: string;
  metadata: Record<string, any>;
  environment: string;
}

/**
 * Log service role usage to console and optionally to database
 */
async function logServiceRoleUsage(context: AdminClientContext): Promise<void> {
  const logEntry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    operation: context.operation,
    user_id: context.userId || null,
    ip_address: context.ipAddress || null,
    reason: context.reason,
    risk_level: context.riskLevel,
    metadata: context.metadata || {},
    environment: process.env.NODE_ENV || 'development',
  };

  // Console logging with color coding by risk level
  const riskEmoji = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  };// Alert on high-risk operations
  if (context.riskLevel === 'high' || context.riskLevel === 'critical') {
    
    // TODO: Send alert to monitoring service (Sentry, DataDog, etc.)
    if (process.env.NODE_ENV === 'production') {
      // Sentry.captureMessage('High-risk service role usage', {
      //   level: 'warning',
      //   extra: logEntry,
      // });
    }
  }

  // TODO: Store in audit log table
  // try {
  //   const auditClient = createAdminClient(); // OK to use here for audit logging
  //   await auditClient.from('service_role_audit_logs').insert(logEntry);
  // } catch (error) {
  //   console.error('Failed to log to audit table:', error);
  //   // Don't fail the operation if logging fails
  // }
}

/**
 * Create admin client with mandatory audit logging
 * 
 * @param context - Context for audit logging
 * @returns Supabase admin client
 * 
 * @example
 * const admin = await createAdminClientWithAudit({
 *   operation: 'webhook_event_received',
 *   userId: externalCustomerId,
 *   reason: 'Processing inbound webhook',
 *   riskLevel: 'medium',
 *   ipAddress: req.headers.get('x-forwarded-for'),
 *   metadata: { eventType: 'event.received' },
 * });
 */
export async function createAdminClientWithAudit(
  context: AdminClientContext
): Promise<SupabaseClient> {
  // Validate required fields
  if (!context.operation || !context.reason || !context.riskLevel) {
    throw new Error(
      'Admin client audit context requires: operation, reason, and riskLevel'
    );
  }

  // Log the service role usage
  await logServiceRoleUsage(context);

  // Return the admin client
  return createAdminClient();
}

/**
 * Convenience functions for common operations
 */

export async function createAdminForWebhook(
  webhookSource: string,
  eventType: string,
  ipAddress?: string
) {
  return createAdminClientWithAudit({
    operation: `webhook_${webhookSource}_${eventType}`,
    reason: `Processing ${webhookSource} webhook: ${eventType}`,
    riskLevel: 'medium',
    ipAddress,
    metadata: { source: webhookSource, event: eventType },
  });
}

export async function createAdminForBatchOperation(
  operation: string,
  batchSize: number,
  userId?: string
) {
  return createAdminClientWithAudit({
    operation: `batch_${operation}`,
    reason: `Batch operation: ${operation} (${batchSize} items)`,
    riskLevel: batchSize > 100 ? 'high' : 'medium',
    userId,
    metadata: { batchSize, operation },
  });
}

export async function createAdminForMigration(
  migrationName: string,
  userId?: string
) {
  return createAdminClientWithAudit({
    operation: `migration_${migrationName}`,
    reason: `Database migration: ${migrationName}`,
    riskLevel: 'high',
    userId,
    metadata: { migration: migrationName },
  });
}

/**
 * Database schema for audit log table
 * 
 * CREATE TABLE public.service_role_audit_logs (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   timestamp timestamptz NOT NULL DEFAULT now(),
 *   operation text NOT NULL,
 *   user_id uuid REFERENCES auth.users(id),
 *   ip_address text,
 *   reason text NOT NULL,
 *   risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
 *   metadata jsonb DEFAULT '{}'::jsonb,
 *   environment text NOT NULL DEFAULT 'development',
 *   created_at timestamptz NOT NULL DEFAULT now()
 * );
 * 
 * CREATE INDEX idx_service_role_audit_timestamp ON service_role_audit_logs(timestamp DESC);
 * CREATE INDEX idx_service_role_audit_operation ON service_role_audit_logs(operation);
 * CREATE INDEX idx_service_role_audit_user_id ON service_role_audit_logs(user_id);
 * CREATE INDEX idx_service_role_audit_risk_level ON service_role_audit_logs(risk_level);
 * 
 * -- Enable RLS (service role can bypass to write)
 * ALTER TABLE public.service_role_audit_logs ENABLE ROW LEVEL SECURITY;
 * 
 * -- Only service role can write
 * CREATE POLICY "service_role_can_insert" ON service_role_audit_logs
 *   FOR INSERT TO service_role
 *   WITH CHECK (true);
 * 
 * -- Admins can read their own organization's logs
 * CREATE POLICY "admins_can_read_org_logs" ON service_role_audit_logs
 *   FOR SELECT
 *   USING (
 *     EXISTS (
 *       SELECT 1 FROM workspace_members
 *       WHERE user_id = auth.uid()
 *         AND role = 'owner'
 *         AND status = 'active'
 *     )
 *   );
 */
