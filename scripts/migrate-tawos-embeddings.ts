/**
 * TAWOS Embeddings Migration Script
 *
 * Re-embeds all existing TAWOS user story records using Voyage AI (voyage-large-2).
 * Replaces old OpenAI embeddings with new Voyage AI embeddings.
 *
 * Features:
 * - Batch processing (50 records at a time)
 * - Rate limiting (2 second delay between batches)
 * - Progress tracking with ETA
 * - Resumable via --start-after-id flag or checkpoint file
 * - Graceful error handling
 * - Uses centralized embedding service
 *
 * Usage:
 *   npm run migrate:tawos
 *   npm run migrate:tawos -- --start-after-id <uuid>
 *
 * Environment variables required:
 *   - VOYAGE_API_KEY
 *   - SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { generateBatchEmbeddings } from "../lib/embedding-service";

// ============================================================================
// Configuration
// ============================================================================

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 2000; // 2 seconds between batches
const MAX_TEXT_LENGTH = 8000; // Max characters for embedding text
const CHECKPOINT_FILE = path.join(__dirname, ".tawos-migration-checkpoint.json");
const CHECKPOINT_SAVE_INTERVAL = 10; // Save checkpoint every N batches

// ============================================================================
// Types
// ============================================================================

interface TawosRecord {
  id: string;
  metadata: {
    title?: string;
    description?: string;
    role?: string;
    want?: string;
    benefit?: string;
    acceptanceCriteria?: string | string[];
    tags?: string[];
    successPattern?: string;
    antiPatterns?: string | string[];
    [key: string]: unknown;
  };
}

interface Checkpoint {
  lastProcessedId: string | null;
  processedCount: number;
  successCount: number;
  errorCount: number;
  startedAt: string;
  lastUpdatedAt: string;
}

interface MigrationStats {
  totalRecords: number;
  processedCount: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  startTime: number;
  batchesProcessed: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

function parseArgs(): { startAfterId: string | null } {
  const args = process.argv.slice(2);
  let startAfterId: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--start-after-id" && args[i + 1]) {
      startAfterId = args[i + 1];
      i++;
    }
  }

  return { startAfterId };
}

function loadCheckpoint(): Checkpoint | null {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = fs.readFileSync(CHECKPOINT_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn("[Checkpoint] Failed to load checkpoint file, starting fresh");
  }
  return null;
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  try {
    checkpoint.lastUpdatedAt = new Date().toISOString();
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
  } catch (error) {
    console.error("[Checkpoint] Failed to save checkpoint:", error);
  }
}

function deleteCheckpoint(): void {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE);
    }
  } catch (error) {
    console.warn("[Checkpoint] Failed to delete checkpoint file");
  }
}

/**
 * Build embedding text from metadata fields
 * Combines: title, description, role, want, benefit, acceptanceCriteria, tags, successPattern, antiPatterns
 * Limits output to MAX_TEXT_LENGTH characters
 */
function buildEmbeddingText(metadata: TawosRecord["metadata"]): string {
  const parts: string[] = [];

  // Title
  if (metadata.title) {
    parts.push(`Title: ${metadata.title}`);
  }

  // User story format: As a [role], I want [want] so that [benefit]
  if (metadata.role && metadata.want && metadata.benefit) {
    parts.push(`As a ${metadata.role}, I want ${metadata.want} so that ${metadata.benefit}`);
  } else {
    if (metadata.role) parts.push(`Role: ${metadata.role}`);
    if (metadata.want) parts.push(`Want: ${metadata.want}`);
    if (metadata.benefit) parts.push(`Benefit: ${metadata.benefit}`);
  }

  // Description
  if (metadata.description) {
    parts.push(`Description: ${metadata.description}`);
  }

  // Acceptance Criteria (join with "; ")
  if (metadata.acceptanceCriteria) {
    const criteria = Array.isArray(metadata.acceptanceCriteria)
      ? metadata.acceptanceCriteria.join("; ")
      : metadata.acceptanceCriteria;
    parts.push(`Acceptance Criteria: ${criteria}`);
  }

  // Tags (join with ", ")
  if (metadata.tags && metadata.tags.length > 0) {
    parts.push(`Tags: ${metadata.tags.join(", ")}`);
  }

  // Success Pattern
  if (metadata.successPattern) {
    parts.push(`Success Pattern: ${metadata.successPattern}`);
  }

  // Anti-Patterns
  if (metadata.antiPatterns) {
    const antiPatterns = Array.isArray(metadata.antiPatterns)
      ? metadata.antiPatterns.join("; ")
      : metadata.antiPatterns;
    parts.push(`Anti-Patterns: ${antiPatterns}`);
  }

  // Join and limit to MAX_TEXT_LENGTH characters
  let text = parts.join("\n");
  if (text.length > MAX_TEXT_LENGTH) {
    text = text.substring(0, MAX_TEXT_LENGTH - 3) + "...";
  }

  return text;
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printProgress(stats: MigrationStats, checkpoint: Checkpoint): void {
  const elapsed = Date.now() - stats.startTime;
  const rate = stats.processedCount / (elapsed / 1000); // records per second
  let progressMsg = "";
  if (stats.totalRecords && stats.totalRecords > 0) {
    const remaining = stats.totalRecords - stats.processedCount;
    const eta = rate > 0 ? formatTime((remaining / rate) * 1000) : "calculating...";
    const percentComplete = ((stats.processedCount / stats.totalRecords) * 100).toFixed(2);
    const barWidth = 30;
    const filled = Math.floor((stats.processedCount / stats.totalRecords) * barWidth);
    const progressBar = `[${"█".repeat(filled)}${"░".repeat(barWidth - filled)}]`;
    progressMsg =
      `${progressBar} ${percentComplete}% | ` +
      `${formatNumber(stats.processedCount)}/${formatNumber(stats.totalRecords)} | ` +
      `✓${formatNumber(stats.successCount)} ✗${stats.errorCount} ⊘${stats.skippedCount} | ` +
      `${rate.toFixed(1)}/s | ETA: ${eta}`;
  } else {
    // Unknown total: show processed only
    progressMsg =
      `${formatNumber(stats.processedCount)} processed | ` +
      `✓${formatNumber(stats.successCount)} ✗${stats.errorCount} ⊘${stats.skippedCount} | ` +
      `${rate.toFixed(1)}/s`;
  }
  console.log(progressMsg);

  // Log last processed ID periodically
  if (stats.batchesProcessed % 10 === 0 && checkpoint.lastProcessedId) {
    console.log(`  └─ Last ID: ${checkpoint.lastProcessedId}`);
  }
}

// ============================================================================
// Database Functions
// ============================================================================

async function getTotalCount(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("tawos_user_stories")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(`Failed to get record count: ${error.message}`);
  }

  return count ?? 0;
}

async function fetchBatch(
  supabase: SupabaseClient,
  afterId: string | null,
  limit: number
): Promise<TawosRecord[]> {
  let query = supabase
    .from("tawos_user_stories")
    .select("id, metadata")
    .order("id", { ascending: true })
    .limit(limit);

  if (afterId) {
    query = query.gt("id", afterId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch records: ${error.message}`);
  }

  return (data ?? []) as TawosRecord[];
}

// ============================================================================
// Main Migration Function
// ============================================================================

async function migrateEmbeddings(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║       TAWOS Embeddings Migration (Voyage AI voyage-large-2)    ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  // Parse command line arguments
  const { startAfterId } = parseArgs();

  // Validate environment variables
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!process.env.VOYAGE_API_KEY) {
    console.error("❌ VOYAGE_API_KEY is not set");
    process.exit(1);
  }
  if (!supabaseUrl) {
    console.error("❌ SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is not set");
    process.exit(1);
  }
  if (!supabaseServiceKey) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY is not set");
    process.exit(1);
  }

  console.log("✓ Environment variables validated");
  console.log(`  - Voyage Model: voyage-large-2`);
  console.log(`  - Batch Size: ${BATCH_SIZE}`);
  console.log(`  - Batch Delay: ${BATCH_DELAY_MS}ms`);
  console.log(`  - Max Text Length: ${MAX_TEXT_LENGTH} chars\n`);

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // Determine starting point
  let checkpoint: Checkpoint;

  if (startAfterId) {
    // Command line flag takes precedence
    console.log(`📋 Starting from --start-after-id: ${startAfterId}\n`);
    checkpoint = {
      lastProcessedId: startAfterId,
      processedCount: 0, // We don't know how many were processed before
      successCount: 0,
      errorCount: 0,
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };
  } else {
    // Try to load checkpoint file
    const savedCheckpoint = loadCheckpoint();
    if (savedCheckpoint) {
      console.log("📋 Resuming from checkpoint:");
      console.log(`   - Last processed ID: ${savedCheckpoint.lastProcessedId}`);
      console.log(`   - Records processed: ${formatNumber(savedCheckpoint.processedCount)}`);
      console.log(`   - Success: ${formatNumber(savedCheckpoint.successCount)}`);
      console.log(`   - Errors: ${savedCheckpoint.errorCount}`);
      console.log(`   - Started at: ${savedCheckpoint.startedAt}\n`);
      checkpoint = savedCheckpoint;
    } else {
      console.log("📋 Starting fresh migration\n");
      checkpoint = {
        lastProcessedId: null,
        processedCount: 0,
        successCount: 0,
        errorCount: 0,
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
      };
    }
  }

  // Determine if we should skip the count query
  let totalCount: number | null = null;
  if (startAfterId || (checkpoint && checkpoint.processedCount > 0)) {
    // Skipping count query due to Supabase USER-DEFINED column issue
    // Use hardcoded total or 0 if unknown
    totalCount = 201672; // Set to 0 if you want to hide total
    if (totalCount > 0) {
      console.log(`⚠️  Skipping total count query due to Supabase USER-DEFINED column issue.`);
      console.log(`📊 Using hardcoded total: ${formatNumber(totalCount)}\n`);
    } else {
      console.log(`⚠️  Skipping total count query due to Supabase USER-DEFINED column issue.`);
      console.log("📊 Total records unknown (progress will show processed only)\n");
    }
  } else {
    totalCount = await getTotalCount(supabase);
    console.log(`📊 Total records in tawos_user_stories: ${formatNumber(totalCount)}\n`);
    if (totalCount === 0) {
      console.log("✓ No records to migrate");
      return;
    }
  }

  // Initialize stats
  const stats: MigrationStats = {
    totalRecords: totalCount,
    processedCount: checkpoint.processedCount,
    successCount: checkpoint.successCount,
    errorCount: checkpoint.errorCount,
    skippedCount: 0,
    startTime: Date.now(),
    batchesProcessed: 0,
  };

  let hasMore = true;

  while (hasMore) {
    try {
      // Fetch batch of records
      const records = await fetchBatch(supabase, checkpoint.lastProcessedId, BATCH_SIZE);

      if (records.length === 0) {
        hasMore = false;
        break;
      }

      // Build embedding texts for batch
      const embeddingTexts: string[] = [];
      const validRecords: TawosRecord[] = [];

      for (const record of records) {
        const text = buildEmbeddingText(record.metadata);
        if (text.trim()) {
          embeddingTexts.push(text);
          validRecords.push(record);
        } else {
          // Skip records with no embeddable content
          stats.skippedCount++;
          stats.processedCount++;
          checkpoint.processedCount++;
          checkpoint.lastProcessedId = record.id;
        }
      }

      if (validRecords.length === 0) {
        // All records in batch were skipped
        saveCheckpoint(checkpoint);
        continue;
      }

      // Generate embeddings using centralized embedding service
      const result = await generateBatchEmbeddings(embeddingTexts);

      if (!result) {
        console.error(`\n❌ Failed to generate embeddings for batch`);
        stats.errorCount += validRecords.length;
        checkpoint.errorCount += validRecords.length;
        // Move past this batch to continue
        checkpoint.lastProcessedId = validRecords[validRecords.length - 1].id;
        checkpoint.processedCount += validRecords.length;
        stats.processedCount += validRecords.length;
        saveCheckpoint(checkpoint);
        await sleep(BATCH_DELAY_MS);
        continue;
      }

      // Batch upsert all records with new embeddings
      const batchUpdates = validRecords.map((record, i) => ({
        id: record.id,
        embedding: `[${result.embeddings[i].join(",")}]`,
      }));

      const { error: upsertError } = await supabase
        .from("tawos_user_stories")
        .upsert(batchUpdates, { onConflict: "id", ignoreDuplicates: false });

      if (upsertError) {
        console.error(`  ✗ Batch upsert failed: ${upsertError.message}`);
        stats.errorCount += validRecords.length;
        checkpoint.errorCount += validRecords.length;
      } else {
        stats.successCount += validRecords.length;
        checkpoint.successCount += validRecords.length;
      }

      stats.processedCount += validRecords.length;
      checkpoint.processedCount += validRecords.length;
      checkpoint.lastProcessedId = validRecords[validRecords.length - 1].id;

      stats.batchesProcessed++;

      // Print progress
      printProgress(stats, checkpoint);

      // Save checkpoint periodically
      if (stats.batchesProcessed % CHECKPOINT_SAVE_INTERVAL === 0) {
        saveCheckpoint(checkpoint);
      }

      // Check if we've processed all records
      if (totalCount && stats.processedCount >= totalCount) {
        hasMore = false;
        break;
      }

      // Wait between batches
      await sleep(BATCH_DELAY_MS);
    } catch (err) {
      console.error('❌ Error during migration batch:', err);
      // Optionally save checkpoint here
      saveCheckpoint(checkpoint);
      // Wait before retrying
      await sleep(BATCH_DELAY_MS);
    }
  }

  // Final checkpoint save
  saveCheckpoint(checkpoint);
  console.log('\n✓ Migration complete!');
}

migrateEmbeddings().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
