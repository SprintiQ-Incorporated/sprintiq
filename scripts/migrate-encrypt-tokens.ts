/**
 * Token Encryption Migration Script
 *
 * Migrates existing unencrypted tokens in the database to encrypted format.
 * Safe to run multiple times - skips already encrypted tokens.
 *
 * Usage:
 *   npx tsx scripts/migrate-encrypt-tokens.ts
 *
 * Or with ts-node:
 *   npx ts-node --esm scripts/migrate-encrypt-tokens.ts
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - ENCRYPTION_KEY
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ENCRYPTION_KEY) {
  console.error("Missing required environment variables:");
  if (!SUPABASE_URL) console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  if (!SERVICE_ROLE_KEY) console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  if (!ENCRYPTION_KEY) console.error("  - ENCRYPTION_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================================================
// ENCRYPTION (inline to avoid module resolution issues)
// ============================================================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = ENCRYPTION_KEY!;
  if (key.length === 64) {
    return Buffer.from(key, "hex");
  }
  if (key.length === 44) {
    return Buffer.from(key, "base64");
  }
  return crypto.createHash("sha256").update(key).digest();
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, "hex")]);
  return combined.toString("base64");
}

function isEncrypted(value: string | null): boolean {
  if (!value) return false;

  // Known unencrypted token prefixes
  if (value.startsWith("xoxb-") || value.startsWith("xoxp-") || value.startsWith("xoxa-")) {
    return false;
  }
  if (value.startsWith("sk_") || value.startsWith("rk_")) {
    return false;
  }
  if (/^gh[pours]_/.test(value)) {
    return false;
  }

  // Check base64 format and minimum length
  if (value.length < 44) return false;
  if (!/^[A-Za-z0-9+/]+=*$/.test(value)) return false;

  try {
    const decoded = Buffer.from(value, "base64");
    return decoded.length >= IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

interface MigrationResult {
  table: string;
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("🔐 Token Encryption Migration");
  console.log("==============================");
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Encryption Key: ${ENCRYPTION_KEY?.substring(0, 8)}...`);
  console.log("");

  const results: MigrationResult[] = [];

  // No token-bearing tables remain in OSS — Slack migrations removed in Phase 3.

  // Summary
  console.log("\n==============================");
  console.log("📊 Migration Summary");
  console.log("==============================");

  let totalMigrated = 0;
  let totalErrors = 0;

  for (const result of results) {
    console.log(`\n${result.table}:`);
    console.log(`  Total: ${result.total}`);
    console.log(`  Migrated: ${result.migrated}`);
    console.log(`  Skipped (already encrypted): ${result.skipped}`);
    console.log(`  Errors: ${result.errors}`);

    totalMigrated += result.migrated;
    totalErrors += result.errors;
  }

  console.log("\n==============================");
  console.log(`Total migrated: ${totalMigrated}`);
  console.log(`Total errors: ${totalErrors}`);

  if (totalErrors > 0) {
    console.log("\n⚠️  Some records failed to migrate. Review errors above.");
    process.exit(1);
  } else {
    console.log("\n✅ Migration completed successfully!");
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
