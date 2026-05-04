/**
 * TAWOS Tiered Retrieval Verification Script
 *
 * This script verifies that all tiered retrieval changes are working correctly.
 *
 * Usage:
 *   npx tsx scripts/verify-tiered-retrieval.ts
 *
 * Environment Variables Required:
 *   - VOYAGE_API_KEY: Voyage AI API key for embedding generation
 *   - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 */

import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "../lib/embedding-service";

// ============================================================================
// Configuration
// ============================================================================

const TEST_QUERIES = [
  "user authentication login security",
  "dashboard analytics visualization",
  "API integration REST endpoints",
  "database query optimization",
  "UI component button form",
];

const EXPECTED_THRESHOLDS = {
  successPatterns: 0.75,
  balanced: 0.65,
  antiPatterns: 0.60,
};

const EXPECTED_MAX_CHUNKS = {
  successPatterns: 5,
  balanced: 10,
  antiPatterns: 10,
};

// ============================================================================
// Supabase Client
// ============================================================================

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, supabaseKey);
}

// ============================================================================
// Verification Tests
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

async function verifyTableExists(supabase: ReturnType<typeof createSupabaseClient>): Promise<TestResult> {
  try {
    const { count, error } = await supabase
      .from("tawos_user_stories")
      .select("*", { count: "exact", head: true });

    if (error) {
      return {
        name: "Table Exists",
        passed: false,
        message: `Error accessing table: ${error.message}`,
      };
    }

    return {
      name: "Table Exists",
      passed: true,
      message: `tawos_user_stories table exists with ${count} records`,
      details: { recordCount: count },
    };
  } catch (error) {
    return {
      name: "Table Exists",
      passed: false,
      message: `Exception: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function verifyEmbeddingCoverage(supabase: ReturnType<typeof createSupabaseClient>): Promise<TestResult> {
  try {
    const { data, error } = await supabase
      .from("tawos_user_stories")
      .select("id, embedding")
      .limit(1000);

    if (error) {
      return {
        name: "Embedding Coverage",
        passed: false,
        message: `Error: ${error.message}`,
      };
    }

    const total = data?.length || 0;
    const withEmbeddings = data?.filter((r) => r.embedding !== null).length || 0;
    const coverage = total > 0 ? (withEmbeddings / total) * 100 : 0;

    const passed = coverage >= 90;

    return {
      name: "Embedding Coverage",
      passed,
      message: `${coverage.toFixed(2)}% coverage (${withEmbeddings}/${total})`,
      details: { total, withEmbeddings, coverage },
    };
  } catch (error) {
    return {
      name: "Embedding Coverage",
      passed: false,
      message: `Exception: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function verifyMatchDocumentsFunction(
  supabase: ReturnType<typeof createSupabaseClient>,
  embedding: number[]
): Promise<TestResult> {
  try {
    // Test with default parameters (should be 0.65 threshold, 10 count)
    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: embedding,
      // Don't pass threshold/count to test defaults
    });

    if (error) {
      return {
        name: "match_documents Function",
        passed: false,
        message: `Error calling function: ${error.message}`,
      };
    }

    const resultCount = data?.length || 0;

    return {
      name: "match_documents Function",
      passed: true,
      message: `Function works, returned ${resultCount} results with default params`,
      details: { resultCount },
    };
  } catch (error) {
    return {
      name: "match_documents Function",
      passed: false,
      message: `Exception: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function verifyThresholdBehavior(
  supabase: ReturnType<typeof createSupabaseClient>,
  embedding: number[]
): Promise<TestResult> {
  try {
    const results: Record<string, number> = {};

    // Test different thresholds
    for (const [name, threshold] of Object.entries(EXPECTED_THRESHOLDS)) {
      const { data, error } = await supabase.rpc("match_documents", {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: 20,
      });

      if (error) {
        return {
          name: "Threshold Behavior",
          passed: false,
          message: `Error at threshold ${threshold}: ${error.message}`,
        };
      }

      results[name] = data?.length || 0;
    }

    // Verify: lower threshold should return more results
    const successCount = results.successPatterns || 0;
    const balancedCount = results.balanced || 0;
    const antiPatternCount = results.antiPatterns || 0;

    const behaviorCorrect =
      antiPatternCount >= balancedCount && balancedCount >= successCount;

    return {
      name: "Threshold Behavior",
      passed: behaviorCorrect,
      message: behaviorCorrect
        ? `Correct: 0.60→${antiPatternCount}, 0.65→${balancedCount}, 0.75→${successCount}`
        : `Unexpected: 0.60→${antiPatternCount}, 0.65→${balancedCount}, 0.75→${successCount}`,
      details: results,
    };
  } catch (error) {
    return {
      name: "Threshold Behavior",
      passed: false,
      message: `Exception: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function verifySuccessPatternsExist(supabase: ReturnType<typeof createSupabaseClient>): Promise<TestResult> {
  try {
    const { data, error } = await supabase
      .from("tawos_user_stories")
      .select("id, metadata")
      .gte("metadata->completionRate", 0.8)
      .limit(100);

    if (error) {
      return {
        name: "Success Patterns Exist",
        passed: false,
        message: `Error: ${error.message}`,
      };
    }

    const count = data?.length || 0;
    const passed = count > 0;

    return {
      name: "Success Patterns Exist",
      passed,
      message: passed
        ? `Found ${count} records with completionRate >= 0.8`
        : "No success patterns found (completionRate >= 0.8)",
      details: { count },
    };
  } catch (error) {
    return {
      name: "Success Patterns Exist",
      passed: false,
      message: `Exception: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function verifyAntiPatternsExist(supabase: ReturnType<typeof createSupabaseClient>): Promise<TestResult> {
  try {
    const { data, error } = await supabase
      .from("tawos_user_stories")
      .select("id, metadata")
      .lt("metadata->completionRate", 0.6)
      .limit(100);

    if (error) {
      return {
        name: "Anti-Patterns Exist",
        passed: false,
        message: `Error: ${error.message}`,
      };
    }

    const count = data?.length || 0;
    const passed = count > 0;

    return {
      name: "Anti-Patterns Exist",
      passed,
      message: passed
        ? `Found ${count} records with completionRate < 0.6`
        : "No anti-patterns found (completionRate < 0.6)",
      details: { count },
    };
  } catch (error) {
    return {
      name: "Anti-Patterns Exist",
      passed: false,
      message: `Exception: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function verifyFrameworkDiversity(supabase: ReturnType<typeof createSupabaseClient>): Promise<TestResult> {
  try {
    const { data, error } = await supabase
      .from("tawos_user_stories")
      .select("metadata")
      .not("metadata->tags", "is", null)
      .limit(500);

    if (error) {
      return {
        name: "Framework Diversity",
        passed: false,
        message: `Error: ${error.message}`,
      };
    }

    // Count tags
    const tagCounts = new Map<string, number>();
    for (const record of data || []) {
      const tags = record.metadata?.tags || [];
      for (const tag of tags) {
        const normalizedTag = String(tag).toLowerCase();
        tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
      }
    }

    const uniqueTags = tagCounts.size;
    const passed = uniqueTags >= 5;

    return {
      name: "Framework Diversity",
      passed,
      message: `Found ${uniqueTags} unique tags/frameworks`,
      details: {
        uniqueTags,
        topTags: Array.from(tagCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([tag, count]) => `${tag}: ${count}`),
      },
    };
  } catch (error) {
    return {
      name: "Framework Diversity",
      passed: false,
      message: `Exception: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// ============================================================================
// Main Verification Runner
// ============================================================================

async function runVerification() {
  console.log("╔" + "═".repeat(78) + "╗");
  console.log("║" + " TAWOS TIERED RETRIEVAL VERIFICATION ".padStart(50).padEnd(78) + "║");
  console.log("╚" + "═".repeat(78) + "╝");
  console.log(`\nStarted at: ${new Date().toISOString()}\n`);

  const results: TestResult[] = [];

  // Initialize clients
  let supabase: ReturnType<typeof createSupabaseClient>;
  try {
    supabase = createSupabaseClient();
    console.log("✓ Supabase client initialized\n");
  } catch (error) {
    console.error("✗ Failed to initialize Supabase client:", error);
    process.exit(1);
  }

  // Run tests
  console.log("Running verification tests...\n");

  // 1. Table exists
  console.log("1. Checking table exists...");
  results.push(await verifyTableExists(supabase));

  // 2. Embedding coverage
  console.log("2. Checking embedding coverage...");
  results.push(await verifyEmbeddingCoverage(supabase));

  // 3. Generate test embedding
  console.log("3. Generating test embedding...");
  const testEmbeddingResult = await generateEmbedding(TEST_QUERIES[0]);
  const testEmbedding = testEmbeddingResult?.embedding ?? null;

  if (testEmbedding) {
    console.log("   ✓ Test embedding generated\n");

    // 4. match_documents function
    console.log("4. Testing match_documents function...");
    results.push(await verifyMatchDocumentsFunction(supabase, testEmbedding));

    // 5. Threshold behavior
    console.log("5. Testing threshold behavior...");
    results.push(await verifyThresholdBehavior(supabase, testEmbedding));
  } else {
    console.log("   ⚠ Skipping embedding-dependent tests (no VOYAGE_API_KEY)\n");
    results.push({
      name: "match_documents Function",
      passed: false,
      message: "Skipped - no embedding available",
    });
    results.push({
      name: "Threshold Behavior",
      passed: false,
      message: "Skipped - no embedding available",
    });
  }

  // 6. Success patterns exist
  console.log("6. Checking success patterns...");
  results.push(await verifySuccessPatternsExist(supabase));

  // 7. Anti-patterns exist
  console.log("7. Checking anti-patterns...");
  results.push(await verifyAntiPatternsExist(supabase));

  // 8. Framework diversity
  console.log("8. Checking framework diversity...");
  results.push(await verifyFrameworkDiversity(supabase));

  // Print results
  console.log("\n" + "=".repeat(80));
  console.log("VERIFICATION RESULTS");
  console.log("=".repeat(80) + "\n");

  let passedCount = 0;
  let failedCount = 0;

  for (const result of results) {
    const icon = result.passed ? "✓" : "✗";
    const status = result.passed ? "PASS" : "FAIL";
    console.log(`${icon} [${status}] ${result.name}`);
    console.log(`  ${result.message}`);
    if (result.details) {
      console.log(`  Details: ${JSON.stringify(result.details, null, 2).split("\n").join("\n  ")}`);
    }
    console.log();

    if (result.passed) {
      passedCount++;
    } else {
      failedCount++;
    }
  }

  // Summary
  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total: ${results.length} tests`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Status: ${failedCount === 0 ? "ALL TESTS PASSED ✓" : "SOME TESTS FAILED ✗"}`);
  console.log("=".repeat(80));

  // Expected configuration reminder
  console.log("\n📋 EXPECTED CONFIGURATION:");
  console.log("┌────────────────────────┬───────────┬────────────┐");
  console.log("│ Retrieval Type         │ Threshold │ Max Chunks │");
  console.log("├────────────────────────┼───────────┼────────────┤");
  console.log("│ Success Patterns       │ 0.75      │ 5          │");
  console.log("│ Balanced (Story Gen)   │ 0.65      │ 10         │");
  console.log("│ Anti-Patterns (Risks)  │ 0.60      │ 10         │");
  console.log("│ General Search         │ 0.65      │ 10         │");
  console.log("└────────────────────────┴───────────┴────────────┘");

  console.log(`\nCompleted at: ${new Date().toISOString()}`);

  process.exit(failedCount > 0 ? 1 : 0);
}

// Run verification
runVerification().catch((error) => {
  console.error("Verification failed:", error);
  process.exit(1);
});
