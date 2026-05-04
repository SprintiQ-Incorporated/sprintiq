/**
 * RAG Embeddings Audit Script
 *
 * Comprehensive audit of the TAWOS RAG system for SprintIQ.
 *
 * ANALYSIS TASKS:
 * 1. Vector Embeddings Inspection
 * 2. Similarity Threshold Testing
 * 3. Chunk Retrieval Analysis
 * 4. Framework Coverage Audit
 * 5. Quality Metrics Calculation
 *
 * Usage:
 *   npx tsx scripts/audit-rag-embeddings.ts
 *
 * Environment Variables Required:
 *   - VOYAGE_API_KEY: Voyage AI API key for embedding generation
 *   - SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "../lib/embedding-service";

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Current RAG parameters (as discovered in the codebase)
  currentThreshold: 0.7,
  currentMaxChunks: 5,

  // Voyage AI settings
  voyageModel: "voyage-large-2",
  embeddingDimensions: 1536,

  // Test thresholds to evaluate
  testThresholds: [0.5, 0.6, 0.7, 0.8],

  // Chunk counts to test
  testChunkCounts: [5, 10, 15, 20],

  // Test queries for comprehensive analysis
  testQueries: [
    // Success pattern queries
    "user authentication login security",
    "dashboard analytics visualization",
    "API integration REST endpoints",
    "database optimization performance",
    "user profile settings management",

    // Anti-pattern detection queries
    "vague requirements unclear specifications",
    "scope creep feature bloat",
    "technical debt legacy code",

    // Complexity-specific queries
    "simple bug fix minor issue",
    "moderate feature implementation",
    "complex system architecture design",

    // Priority-specific queries
    "critical security vulnerability",
    "high priority user impact",
    "low priority enhancement",
  ],

  // Expected frameworks (for coverage analysis)
  expectedFrameworks: [
    "Authentication",
    "Authorization",
    "API",
    "Database",
    "UI/UX",
    "Performance",
    "Security",
    "Testing",
    "DevOps",
    "Analytics",
  ],
};

// ============================================================================
// Types
// ============================================================================

interface VectorRecord {
  id: string;
  embedding: number[] | null;
  metadata: {
    title?: string;
    description?: string;
    role?: string;
    want?: string;
    benefit?: string;
    acceptanceCriteria?: string[];
    storyPoints?: number;
    businessValue?: number;
    priority?: string;
    tags?: string[];
    completionRate?: number;
    successPattern?: string;
    antiPatterns?: string[];
    complexity?: string;
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
}

interface SimilarityResult {
  id: string;
  similarity: number;
  metadata: VectorRecord["metadata"];
}

interface ThresholdTestResult {
  threshold: number;
  query: string;
  resultCount: number;
  averageSimilarity: number;
  minSimilarity: number;
  maxSimilarity: number;
  results: SimilarityResult[];
}

interface ChunkTestResult {
  maxChunks: number;
  query: string;
  resultCount: number;
  coveragePercent: number;
  uniqueFrameworks: string[];
  averageSimilarity: number;
}

interface FrameworkCoverage {
  framework: string;
  count: number;
  percentage: number;
  avgCompletionRate: number;
  avgSimilarity: number;
}

interface QualityMetrics {
  totalRecords: number;
  recordsWithEmbeddings: number;
  recordsWithoutEmbeddings: number;
  embeddingCoverage: number;
  avgCompletionRate: number;
  duplicateCount: number;
  nearDuplicateCount: number;
  outlierCount: number;
  avgEmbeddingMagnitude: number;
  dimensionStats: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
  };
}

interface AuditReport {
  timestamp: string;
  currentConfig: {
    threshold: number;
    maxChunks: number;
    model: string;
    dimensions: number;
  };
  embeddingQuality: QualityMetrics;
  thresholdAnalysis: {
    results: ThresholdTestResult[];
    recommendation: {
      optimalThreshold: number;
      reasoning: string;
    };
  };
  chunkAnalysis: {
    results: ChunkTestResult[];
    recommendation: {
      optimalChunkCount: number;
      reasoning: string;
    };
  };
  frameworkCoverage: {
    distribution: FrameworkCoverage[];
    tieredRetrievalRecommendation: boolean;
    reasoning: string;
  };
  qualityMetrics: {
    precision: number;
    recall: number;
    semanticCoherence: number;
    duplicateIssues: string[];
    edgeCases: string[];
  };
  recommendations: string[];
  costAnalysis: {
    currentCostPerQuery: number;
    recommendedCostPerQuery: number;
    monthlySavings: number;
  };
}

// ============================================================================
// Supabase Client
// ============================================================================

function createSupabaseClient(): SupabaseClient {
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
// Vector Embeddings Inspection
// ============================================================================

async function inspectVectorEmbeddings(
  supabase: SupabaseClient
): Promise<QualityMetrics> {
  console.log("\n" + "=".repeat(80));
  console.log("1. VECTOR EMBEDDINGS INSPECTION");
  console.log("=".repeat(80));

  // Fetch all records
  const { data: records, error } = await supabase
    .from("tawos_user_stories")
    .select("*")
    .limit(10000);

  if (error) {
    console.error("Error fetching records:", error);
    throw error;
  }

  const allRecords = records as VectorRecord[];
  console.log(`\nTotal records in database: ${allRecords.length}`);

  // Analyze embedding coverage
  const withEmbeddings = allRecords.filter((r) => r.embedding !== null);
  const withoutEmbeddings = allRecords.filter((r) => r.embedding === null);

  console.log(`Records with embeddings: ${withEmbeddings.length}`);
  console.log(`Records without embeddings: ${withoutEmbeddings.length}`);
  console.log(
    `Embedding coverage: ${((withEmbeddings.length / allRecords.length) * 100).toFixed(2)}%`
  );

  // Analyze embedding dimensions and quality
  let totalMagnitude = 0;
  let allDimensions: number[] = [];
  const outliers: VectorRecord[] = [];

  for (const record of withEmbeddings) {
    if (record.embedding) {
      // Check dimension count
      if (record.embedding.length !== CONFIG.embeddingDimensions) {
        console.warn(
          `⚠️ Dimension mismatch for record ${record.id}: expected ${CONFIG.embeddingDimensions}, got ${record.embedding.length}`
        );
      }

      // Calculate magnitude (L2 norm)
      const magnitude = Math.sqrt(
        record.embedding.reduce((sum, val) => sum + val * val, 0)
      );
      totalMagnitude += magnitude;

      // Collect dimension values for statistical analysis
      allDimensions.push(...record.embedding);

      // Detect outliers (embeddings with unusual magnitudes)
      if (magnitude < 0.5 || magnitude > 2.0) {
        outliers.push(record);
      }
    }
  }

  const avgMagnitude = totalMagnitude / withEmbeddings.length;
  console.log(`\nAverage embedding magnitude: ${avgMagnitude.toFixed(4)}`);
  console.log(`Outlier embeddings (unusual magnitude): ${outliers.length}`);

  // Calculate dimension statistics
  const mean = allDimensions.reduce((a, b) => a + b, 0) / allDimensions.length;
  const variance =
    allDimensions.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    allDimensions.length;
  const stdDev = Math.sqrt(variance);
  const minVal = Math.min(...allDimensions);
  const maxVal = Math.max(...allDimensions);

  console.log(`\nDimension Statistics:`);
  console.log(`  Mean: ${mean.toFixed(6)}`);
  console.log(`  Std Dev: ${stdDev.toFixed(6)}`);
  console.log(`  Min: ${minVal.toFixed(6)}`);
  console.log(`  Max: ${maxVal.toFixed(6)}`);

  // Detect duplicates and near-duplicates
  const { duplicates, nearDuplicates } = await detectDuplicates(withEmbeddings);
  console.log(`\nDuplicate embeddings: ${duplicates}`);
  console.log(`Near-duplicate embeddings (similarity > 0.99): ${nearDuplicates}`);

  // Calculate average completion rate
  const completionRates = allRecords
    .filter((r) => r.metadata.completionRate !== undefined)
    .map((r) => r.metadata.completionRate as number);
  const avgCompletionRate =
    completionRates.length > 0
      ? completionRates.reduce((a, b) => a + b, 0) / completionRates.length
      : 0;

  console.log(`\nAverage completion rate: ${(avgCompletionRate * 100).toFixed(2)}%`);

  return {
    totalRecords: allRecords.length,
    recordsWithEmbeddings: withEmbeddings.length,
    recordsWithoutEmbeddings: withoutEmbeddings.length,
    embeddingCoverage: withEmbeddings.length / allRecords.length,
    avgCompletionRate,
    duplicateCount: duplicates,
    nearDuplicateCount: nearDuplicates,
    outlierCount: outliers.length,
    avgEmbeddingMagnitude: avgMagnitude,
    dimensionStats: {
      mean,
      stdDev,
      min: minVal,
      max: maxVal,
    },
  };
}

async function detectDuplicates(
  records: VectorRecord[]
): Promise<{ duplicates: number; nearDuplicates: number }> {
  let duplicates = 0;
  let nearDuplicates = 0;
  const seen = new Set<string>();

  // Check for exact duplicates based on metadata title
  for (const record of records) {
    const key = `${record.metadata.title}-${record.metadata.description}`;
    if (seen.has(key)) {
      duplicates++;
    }
    seen.add(key);
  }

  // Sample check for near-duplicates using cosine similarity
  const sampleSize = Math.min(100, records.length);
  const sample = records.slice(0, sampleSize);

  for (let i = 0; i < sample.length; i++) {
    for (let j = i + 1; j < sample.length; j++) {
      if (sample[i].embedding && sample[j].embedding) {
        const similarity = cosineSimilarity(
          sample[i].embedding!,
          sample[j].embedding!
        );
        if (similarity > 0.99) {
          nearDuplicates++;
        }
      }
    }
  }

  // Extrapolate for full dataset
  const extrapolationFactor = Math.pow(records.length / sampleSize, 2);
  nearDuplicates = Math.round(nearDuplicates * extrapolationFactor);

  return { duplicates, nearDuplicates };
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================================
// Similarity Threshold Testing
// ============================================================================

async function testSimilarityThresholds(
  supabase: SupabaseClient
): Promise<ThresholdTestResult[]> {
  console.log("\n" + "=".repeat(80));
  console.log("2. SIMILARITY THRESHOLD TESTING");
  console.log("=".repeat(80));

  const results: ThresholdTestResult[] = [];

  for (const threshold of CONFIG.testThresholds) {
    console.log(`\n--- Testing threshold: ${threshold} ---`);

    for (const query of CONFIG.testQueries.slice(0, 5)) {
      // Use subset for speed
      const embedding = (await generateEmbedding(query))?.embedding ?? null;

      if (!embedding) {
        console.warn(`Failed to generate embedding for: ${query}`);
        continue;
      }

      // Wait a bit to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));

      const { data: matches, error } = await supabase.rpc("match_documents", {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: 20,
        filter: {},
      });

      if (error) {
        console.error(`Error searching with threshold ${threshold}:`, error);
        continue;
      }

      const similarityScores = matches?.map((m: SimilarityResult) => m.similarity) || [];
      const avgSimilarity =
        similarityScores.length > 0
          ? similarityScores.reduce((a: number, b: number) => a + b, 0) / similarityScores.length
          : 0;

      const result: ThresholdTestResult = {
        threshold,
        query,
        resultCount: matches?.length || 0,
        averageSimilarity: avgSimilarity,
        minSimilarity: Math.min(...similarityScores, 0),
        maxSimilarity: Math.max(...similarityScores, 0),
        results: matches || [],
      };

      results.push(result);

      console.log(
        `  Query: "${query.substring(0, 40)}..." → ${result.resultCount} results (avg: ${avgSimilarity.toFixed(3)})`
      );
    }
  }

  // Generate similarity score distribution
  console.log("\n--- Similarity Score Distribution ---");
  for (const threshold of CONFIG.testThresholds) {
    const thresholdResults = results.filter((r) => r.threshold === threshold);
    const avgCount =
      thresholdResults.reduce((sum, r) => sum + r.resultCount, 0) /
      thresholdResults.length;
    const avgSim =
      thresholdResults.reduce((sum, r) => sum + r.averageSimilarity, 0) /
      thresholdResults.length;

    console.log(
      `  Threshold ${threshold}: Avg ${avgCount.toFixed(1)} results, Avg similarity ${avgSim.toFixed(3)}`
    );
  }

  return results;
}

// ============================================================================
// Chunk Retrieval Analysis
// ============================================================================

async function analyzeChunkRetrieval(
  supabase: SupabaseClient
): Promise<ChunkTestResult[]> {
  console.log("\n" + "=".repeat(80));
  console.log("3. CHUNK RETRIEVAL ANALYSIS");
  console.log("=".repeat(80));

  const results: ChunkTestResult[] = [];

  for (const maxChunks of CONFIG.testChunkCounts) {
    console.log(`\n--- Testing max chunks: ${maxChunks} ---`);

    for (const query of CONFIG.testQueries.slice(0, 3)) {
      const embedding = (await generateEmbedding(query))?.embedding ?? null;

      if (!embedding) continue;

      await new Promise((resolve) => setTimeout(resolve, 200));

      const { data: matches, error } = await supabase.rpc("match_documents", {
        query_embedding: embedding,
        match_threshold: CONFIG.currentThreshold,
        match_count: maxChunks,
        filter: {},
      });

      if (error) {
        console.error(`Error with ${maxChunks} chunks:`, error);
        continue;
      }

      // Analyze framework coverage in results
      const frameworks = new Set<string>();
      for (const match of matches || []) {
        const tags = match.metadata?.tags || [];
        tags.forEach((tag: string) => {
          const normalizedTag = tag.toLowerCase();
          for (const framework of CONFIG.expectedFrameworks) {
            if (normalizedTag.includes(framework.toLowerCase())) {
              frameworks.add(framework);
            }
          }
        });
      }

      const similarityScores =
        matches?.map((m: SimilarityResult) => m.similarity) || [];
      const avgSimilarity =
        similarityScores.length > 0
          ? similarityScores.reduce((a: number, b: number) => a + b, 0) / similarityScores.length
          : 0;

      const result: ChunkTestResult = {
        maxChunks,
        query,
        resultCount: matches?.length || 0,
        coveragePercent:
          (frameworks.size / CONFIG.expectedFrameworks.length) * 100,
        uniqueFrameworks: Array.from(frameworks),
        averageSimilarity: avgSimilarity,
      };

      results.push(result);

      console.log(
        `  Query: "${query.substring(0, 30)}..." → ${result.resultCount} results, ${frameworks.size} frameworks`
      );
    }
  }

  // Summarize by chunk count
  console.log("\n--- Chunk Count Summary ---");
  for (const maxChunks of CONFIG.testChunkCounts) {
    const chunkResults = results.filter((r) => r.maxChunks === maxChunks);
    const avgResults =
      chunkResults.reduce((sum, r) => sum + r.resultCount, 0) /
      chunkResults.length;
    const avgCoverage =
      chunkResults.reduce((sum, r) => sum + r.coveragePercent, 0) /
      chunkResults.length;
    const avgSim =
      chunkResults.reduce((sum, r) => sum + r.averageSimilarity, 0) /
      chunkResults.length;

    console.log(
      `  ${maxChunks} chunks: Avg ${avgResults.toFixed(1)} results, ${avgCoverage.toFixed(1)}% coverage, ${avgSim.toFixed(3)} similarity`
    );
  }

  return results;
}

// ============================================================================
// Framework Coverage Audit
// ============================================================================

async function auditFrameworkCoverage(
  supabase: SupabaseClient
): Promise<FrameworkCoverage[]> {
  console.log("\n" + "=".repeat(80));
  console.log("4. FRAMEWORK COVERAGE AUDIT");
  console.log("=".repeat(80));

  const { data: records, error } = await supabase
    .from("tawos_user_stories")
    .select("metadata")
    .limit(10000);

  if (error) {
    console.error("Error fetching records for coverage:", error);
    throw error;
  }

  // Count framework occurrences
  const frameworkCounts = new Map<string, { count: number; completionRates: number[] }>();

  for (const record of records) {
    const metadata = record.metadata as VectorRecord["metadata"];
    const tags = metadata.tags || [];
    const completionRate = metadata.completionRate || 0;

    for (const tag of tags) {
      const normalizedTag = tag.toLowerCase();

      for (const framework of CONFIG.expectedFrameworks) {
        if (normalizedTag.includes(framework.toLowerCase())) {
          const current = frameworkCounts.get(framework) || {
            count: 0,
            completionRates: [],
          };
          current.count++;
          current.completionRates.push(completionRate);
          frameworkCounts.set(framework, current);
        }
      }
    }
  }

  const totalRecords = records.length;
  const coverage: FrameworkCoverage[] = [];

  console.log("\n--- Framework Distribution ---");
  for (const framework of CONFIG.expectedFrameworks) {
    const data = frameworkCounts.get(framework) || {
      count: 0,
      completionRates: [],
    };
    const percentage = (data.count / totalRecords) * 100;
    const avgCompletionRate =
      data.completionRates.length > 0
        ? data.completionRates.reduce((a, b) => a + b, 0) /
          data.completionRates.length
        : 0;

    coverage.push({
      framework,
      count: data.count,
      percentage,
      avgCompletionRate,
      avgSimilarity: 0, // Will be calculated during search
    });

    const bar = "█".repeat(Math.round(percentage / 5));
    console.log(
      `  ${framework.padEnd(15)} ${data.count.toString().padStart(5)} (${percentage.toFixed(1).padStart(5)}%) ${bar}`
    );
  }

  // Check for framework bias
  const percentages = coverage.map((c) => c.percentage);
  const avgPercentage =
    percentages.reduce((a, b) => a + b, 0) / percentages.length;
  const maxDeviation = Math.max(
    ...percentages.map((p) => Math.abs(p - avgPercentage))
  );

  console.log(`\nFramework Balance Analysis:`);
  console.log(`  Average representation: ${avgPercentage.toFixed(2)}%`);
  console.log(`  Max deviation from average: ${maxDeviation.toFixed(2)}%`);

  if (maxDeviation > 20) {
    console.log("  ⚠️ WARNING: Significant framework imbalance detected");
  } else {
    console.log("  ✓ Framework distribution is relatively balanced");
  }

  return coverage;
}

// ============================================================================
// Quality Metrics Calculation
// ============================================================================

async function calculateQualityMetrics(
  supabase: SupabaseClient,
  thresholdResults: ThresholdTestResult[],
  chunkResults: ChunkTestResult[]
): Promise<{
  precision: number;
  recall: number;
  semanticCoherence: number;
  duplicateIssues: string[];
  edgeCases: string[];
}> {
  console.log("\n" + "=".repeat(80));
  console.log("5. QUALITY METRICS CALCULATION");
  console.log("=".repeat(80));

  // Calculate precision (relevance of retrieved chunks)
  // Using completion rate as a proxy for relevance
  let relevantResults = 0;
  let totalResults = 0;

  for (const result of thresholdResults) {
    for (const match of result.results) {
      totalResults++;
      if (
        match.metadata.completionRate &&
        match.metadata.completionRate >= 0.6
      ) {
        relevantResults++;
      }
    }
  }

  const precision = totalResults > 0 ? relevantResults / totalResults : 0;
  console.log(`\nPrecision (based on completion rate): ${(precision * 100).toFixed(2)}%`);

  // Calculate recall estimate (coverage of relevant items)
  // Using framework coverage as a proxy
  const avgCoverage =
    chunkResults.reduce((sum, r) => sum + r.coveragePercent, 0) /
    chunkResults.length;
  const recall = avgCoverage / 100;
  console.log(`Recall estimate (based on framework coverage): ${(recall * 100).toFixed(2)}%`);

  // Calculate semantic coherence (consistency of retrieved chunks)
  const coherenceScores: number[] = [];

  for (const result of thresholdResults) {
    if (result.results.length >= 2) {
      // Calculate average pairwise similarity as coherence
      let pairCount = 0;
      let similaritySum = 0;

      for (let i = 0; i < result.results.length - 1; i++) {
        const sim1 = result.results[i].similarity;
        const sim2 = result.results[i + 1].similarity;
        similaritySum += Math.abs(sim1 - sim2);
        pairCount++;
      }

      if (pairCount > 0) {
        // Lower difference = higher coherence
        coherenceScores.push(1 - similaritySum / pairCount);
      }
    }
  }

  const semanticCoherence =
    coherenceScores.length > 0
      ? coherenceScores.reduce((a, b) => a + b, 0) / coherenceScores.length
      : 0;
  console.log(`Semantic coherence: ${(semanticCoherence * 100).toFixed(2)}%`);

  // Identify duplicate issues
  const duplicateIssues: string[] = [];
  const seenTitles = new Map<string, number>();

  for (const result of thresholdResults) {
    for (const match of result.results) {
      const title = match.metadata.title || "Unknown";
      const count = seenTitles.get(title) || 0;
      if (count > 3) {
        duplicateIssues.push(`"${title}" appears ${count + 1}+ times across queries`);
      }
      seenTitles.set(title, count + 1);
    }
  }

  console.log(`\nDuplicate issues found: ${duplicateIssues.length}`);
  duplicateIssues.slice(0, 5).forEach((issue) => console.log(`  - ${issue}`));

  // Identify edge cases
  const edgeCases: string[] = [];

  // Check for queries with zero results
  const zeroResultQueries = thresholdResults.filter((r) => r.resultCount === 0);
  if (zeroResultQueries.length > 0) {
    edgeCases.push(
      `${zeroResultQueries.length} queries returned zero results at threshold ${CONFIG.currentThreshold}`
    );
  }

  // Check for queries with very low similarity
  const lowSimQueries = thresholdResults.filter(
    (r) => r.averageSimilarity < 0.7 && r.resultCount > 0
  );
  if (lowSimQueries.length > 0) {
    edgeCases.push(
      `${lowSimQueries.length} queries had average similarity below 0.7`
    );
  }

  console.log(`\nEdge cases identified: ${edgeCases.length}`);
  edgeCases.forEach((issue) => console.log(`  - ${issue}`));

  return {
    precision,
    recall,
    semanticCoherence,
    duplicateIssues: [...new Set(duplicateIssues)],
    edgeCases,
  };
}

// ============================================================================
// Generate Recommendations
// ============================================================================

function generateRecommendations(
  embeddingQuality: QualityMetrics,
  thresholdResults: ThresholdTestResult[],
  chunkResults: ChunkTestResult[],
  frameworkCoverage: FrameworkCoverage[]
): {
  recommendations: string[];
  optimalThreshold: { value: number; reasoning: string };
  optimalChunkCount: { value: number; reasoning: string };
  tieredRetrieval: { recommended: boolean; reasoning: string };
  costAnalysis: { currentCost: number; recommendedCost: number; savings: number };
} {
  const recommendations: string[] = [];

  // 1. Threshold recommendation
  const thresholdStats = new Map<
    number,
    { avgCount: number; avgSimilarity: number }
  >();

  for (const threshold of CONFIG.testThresholds) {
    const results = thresholdResults.filter((r) => r.threshold === threshold);
    const avgCount =
      results.reduce((sum, r) => sum + r.resultCount, 0) / results.length;
    const avgSimilarity =
      results.reduce((sum, r) => sum + r.averageSimilarity, 0) / results.length;
    thresholdStats.set(threshold, { avgCount, avgSimilarity });
  }

  // Find optimal threshold (balance between count and quality)
  let optimalThreshold = 0.7;
  let bestScore = 0;

  for (const [threshold, stats] of thresholdStats) {
    // Score: normalize count (0-20) and similarity (0.5-1.0)
    const countScore = Math.min(stats.avgCount / 10, 1);
    const simScore = (stats.avgSimilarity - 0.5) / 0.5;
    const combinedScore = countScore * 0.4 + simScore * 0.6; // Weight similarity more

    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      optimalThreshold = threshold;
    }
  }

  const thresholdReasoning =
    optimalThreshold === CONFIG.currentThreshold
      ? `Current threshold of ${CONFIG.currentThreshold} is optimal for precision/recall balance`
      : `Recommend changing threshold from ${CONFIG.currentThreshold} to ${optimalThreshold} for better precision/recall balance`;

  if (optimalThreshold !== CONFIG.currentThreshold) {
    recommendations.push(
      `🎯 Adjust similarity threshold from ${CONFIG.currentThreshold} to ${optimalThreshold}`
    );
  }

  // 2. Chunk count recommendation
  const chunkStats = new Map<
    number,
    { avgCount: number; avgCoverage: number; avgSimilarity: number }
  >();

  for (const count of CONFIG.testChunkCounts) {
    const results = chunkResults.filter((r) => r.maxChunks === count);
    const avgCount =
      results.reduce((sum, r) => sum + r.resultCount, 0) / results.length;
    const avgCoverage =
      results.reduce((sum, r) => sum + r.coveragePercent, 0) / results.length;
    const avgSimilarity =
      results.reduce((sum, r) => sum + r.averageSimilarity, 0) / results.length;
    chunkStats.set(count, { avgCount, avgCoverage, avgSimilarity });
  }

  // Find optimal chunk count (diminishing returns analysis)
  let optimalChunkCount = 10;
  let prevCoverage = 0;

  for (const count of CONFIG.testChunkCounts.sort((a, b) => a - b)) {
    const stats = chunkStats.get(count);
    if (stats) {
      const coverageGain = stats.avgCoverage - prevCoverage;
      const costIncrease = count / CONFIG.testChunkCounts[0];

      // Stop when marginal coverage gain is less than 5% per doubling
      if (coverageGain / costIncrease < 2.5 && count > CONFIG.testChunkCounts[0]) {
        break;
      }
      optimalChunkCount = count;
      prevCoverage = stats.avgCoverage;
    }
  }

  const chunkReasoning =
    optimalChunkCount === CONFIG.currentMaxChunks
      ? `Current max chunks of ${CONFIG.currentMaxChunks} is optimal`
      : `Recommend changing max chunks from ${CONFIG.currentMaxChunks} to ${optimalChunkCount} for better coverage/cost ratio`;

  if (optimalChunkCount !== CONFIG.currentMaxChunks) {
    recommendations.push(
      `📦 Adjust max chunks from ${CONFIG.currentMaxChunks} to ${optimalChunkCount}`
    );
  }

  // 3. Tiered retrieval recommendation
  const coverageVariance = calculateVariance(
    frameworkCoverage.map((f) => f.percentage)
  );
  const shouldUseTieredRetrieval = coverageVariance > 100; // High variance suggests imbalance

  const tieredReasoning = shouldUseTieredRetrieval
    ? "Framework coverage is imbalanced. Tiered retrieval (minimum chunks per framework) recommended to ensure diverse results"
    : "Framework coverage is balanced. Tiered retrieval not necessary";

  if (shouldUseTieredRetrieval) {
    recommendations.push(
      "🔄 Implement tiered retrieval to ensure minimum representation from each framework"
    );
  }

  // 4. Embedding quality recommendations
  if (embeddingQuality.embeddingCoverage < 0.95) {
    recommendations.push(
      `⚠️ ${((1 - embeddingQuality.embeddingCoverage) * 100).toFixed(1)}% of records lack embeddings. Run migration to generate missing embeddings`
    );
  }

  if (embeddingQuality.duplicateCount > 0) {
    recommendations.push(
      `🔍 Remove ${embeddingQuality.duplicateCount} duplicate records to improve search quality`
    );
  }

  if (embeddingQuality.nearDuplicateCount > embeddingQuality.totalRecords * 0.05) {
    recommendations.push(
      `🔍 Consider deduplicating ${embeddingQuality.nearDuplicateCount} near-duplicate embeddings`
    );
  }

  if (embeddingQuality.outlierCount > 0) {
    recommendations.push(
      `📊 Investigate ${embeddingQuality.outlierCount} outlier embeddings with unusual magnitudes`
    );
  }

  // 5. Cost analysis
  // Voyage AI pricing: ~$0.00002 per 1K tokens (estimate)
  const avgTokensPerQuery = 50; // Approximate
  const voyageCostPerQuery = (avgTokensPerQuery / 1000) * 0.00002;
  const currentCost = voyageCostPerQuery + (CONFIG.currentMaxChunks * 0.0001); // Estimate DB cost
  const recommendedCost = voyageCostPerQuery + (optimalChunkCount * 0.0001);
  const queriesPerMonth = 10000; // Estimate
  const savings = (currentCost - recommendedCost) * queriesPerMonth;

  return {
    recommendations,
    optimalThreshold: { value: optimalThreshold, reasoning: thresholdReasoning },
    optimalChunkCount: { value: optimalChunkCount, reasoning: chunkReasoning },
    tieredRetrieval: { recommended: shouldUseTieredRetrieval, reasoning: tieredReasoning },
    costAnalysis: {
      currentCost: currentCost * queriesPerMonth,
      recommendedCost: recommendedCost * queriesPerMonth,
      savings: Math.max(0, savings),
    },
  };
}

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return (
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  );
}

// ============================================================================
// Generate ASCII Visualizations
// ============================================================================

function generateVisualizations(
  thresholdResults: ThresholdTestResult[],
  chunkResults: ChunkTestResult[],
  frameworkCoverage: FrameworkCoverage[]
): string {
  let output = "\n" + "=".repeat(80) + "\n";
  output += "VISUALIZATIONS\n";
  output += "=".repeat(80) + "\n";

  // 1. Similarity Score Distribution Histogram
  output += "\n📊 SIMILARITY SCORE DISTRIBUTION\n";
  output += "-".repeat(60) + "\n";

  const allSimilarities = thresholdResults.flatMap((r) =>
    r.results.map((m) => m.similarity)
  );

  const bins = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const histogram = new Map<string, number>();

  for (let i = 0; i < bins.length - 1; i++) {
    const key = `${bins[i].toFixed(1)}-${bins[i + 1].toFixed(1)}`;
    const count = allSimilarities.filter(
      (s) => s >= bins[i] && s < bins[i + 1]
    ).length;
    histogram.set(key, count);
  }

  const maxCount = Math.max(...histogram.values());
  for (const [range, count] of histogram) {
    const barLength = Math.round((count / maxCount) * 40);
    const bar = "█".repeat(barLength);
    output += `${range} | ${bar} ${count}\n`;
  }

  // 2. Threshold vs Results Chart
  output += "\n📈 THRESHOLD vs AVERAGE RESULTS\n";
  output += "-".repeat(60) + "\n";

  for (const threshold of CONFIG.testThresholds) {
    const results = thresholdResults.filter((r) => r.threshold === threshold);
    const avgCount =
      results.reduce((sum, r) => sum + r.resultCount, 0) / results.length;
    const bar = "█".repeat(Math.round(avgCount * 2));
    output += `${threshold.toFixed(1)} | ${bar} ${avgCount.toFixed(1)}\n`;
  }

  // 3. Chunk Count vs Coverage Chart
  output += "\n📦 CHUNK COUNT vs COVERAGE\n";
  output += "-".repeat(60) + "\n";

  for (const count of CONFIG.testChunkCounts) {
    const results = chunkResults.filter((r) => r.maxChunks === count);
    const avgCoverage =
      results.reduce((sum, r) => sum + r.coveragePercent, 0) / results.length;
    const bar = "█".repeat(Math.round(avgCoverage / 2.5));
    output += `${count.toString().padStart(2)} chunks | ${bar} ${avgCoverage.toFixed(1)}%\n`;
  }

  // 4. Framework Coverage Bar Chart
  output += "\n🏗️ FRAMEWORK COVERAGE\n";
  output += "-".repeat(60) + "\n";

  const maxPct = Math.max(...frameworkCoverage.map((f) => f.percentage));
  for (const framework of frameworkCoverage.sort(
    (a, b) => b.percentage - a.percentage
  )) {
    const barLength = Math.round((framework.percentage / maxPct) * 30);
    const bar = "█".repeat(barLength);
    output += `${framework.framework.padEnd(15)} | ${bar} ${framework.percentage.toFixed(1)}%\n`;
  }

  return output;
}

// ============================================================================
// Main Audit Function
// ============================================================================

async function runAudit(): Promise<AuditReport> {
  console.log("╔" + "═".repeat(78) + "╗");
  console.log("║" + " RAG EMBEDDINGS AUDIT - SprintIQ TAWOS ".padStart(50).padEnd(78) + "║");
  console.log("╚" + "═".repeat(78) + "╝");
  console.log(`\nAudit started at: ${new Date().toISOString()}`);
  console.log(`Voyage AI Model: ${CONFIG.voyageModel} (${CONFIG.embeddingDimensions} dimensions)`);
  console.log(`Current threshold: ${CONFIG.currentThreshold}`);
  console.log(`Current max chunks: ${CONFIG.currentMaxChunks}`);

  const supabase = createSupabaseClient();

  // 1. Vector Embeddings Inspection
  const embeddingQuality = await inspectVectorEmbeddings(supabase);

  // 2. Similarity Threshold Testing
  const thresholdResults = await testSimilarityThresholds(supabase);

  // 3. Chunk Retrieval Analysis
  const chunkResults = await analyzeChunkRetrieval(supabase);

  // 4. Framework Coverage Audit
  const frameworkCoverage = await auditFrameworkCoverage(supabase);

  // 5. Quality Metrics
  const qualityMetrics = await calculateQualityMetrics(
    supabase,
    thresholdResults,
    chunkResults
  );

  // Generate recommendations
  const {
    recommendations,
    optimalThreshold,
    optimalChunkCount,
    tieredRetrieval,
    costAnalysis,
  } = generateRecommendations(
    embeddingQuality,
    thresholdResults,
    chunkResults,
    frameworkCoverage
  );

  // Generate visualizations
  const visualizations = generateVisualizations(
    thresholdResults,
    chunkResults,
    frameworkCoverage
  );
  console.log(visualizations);

  // Compile report
  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    currentConfig: {
      threshold: CONFIG.currentThreshold,
      maxChunks: CONFIG.currentMaxChunks,
      model: CONFIG.voyageModel,
      dimensions: CONFIG.embeddingDimensions,
    },
    embeddingQuality,
    thresholdAnalysis: {
      results: thresholdResults,
      recommendation: {
        optimalThreshold: optimalThreshold.value,
        reasoning: optimalThreshold.reasoning,
      },
    },
    chunkAnalysis: {
      results: chunkResults,
      recommendation: {
        optimalChunkCount: optimalChunkCount.value,
        reasoning: optimalChunkCount.reasoning,
      },
    },
    frameworkCoverage: {
      distribution: frameworkCoverage,
      tieredRetrievalRecommendation: tieredRetrieval.recommended,
      reasoning: tieredRetrieval.reasoning,
    },
    qualityMetrics: {
      precision: qualityMetrics.precision,
      recall: qualityMetrics.recall,
      semanticCoherence: qualityMetrics.semanticCoherence,
      duplicateIssues: qualityMetrics.duplicateIssues,
      edgeCases: qualityMetrics.edgeCases,
    },
    recommendations,
    costAnalysis: {
      currentCostPerQuery: costAnalysis.currentCost / 10000,
      recommendedCostPerQuery: costAnalysis.recommendedCost / 10000,
      monthlySavings: costAnalysis.savings,
    },
  };

  // Print summary
  console.log("\n" + "=".repeat(80));
  console.log("AUDIT SUMMARY");
  console.log("=".repeat(80));

  console.log("\n📊 Current Configuration:");
  console.log(`  • Similarity Threshold: ${CONFIG.currentThreshold}`);
  console.log(`  • Max Chunks: ${CONFIG.currentMaxChunks}`);
  console.log(`  • Model: ${CONFIG.voyageModel}`);

  console.log("\n🎯 Recommended Configuration:");
  console.log(`  • Similarity Threshold: ${optimalThreshold.value}`);
  console.log(`  • Max Chunks: ${optimalChunkCount.value}`);
  console.log(`  • Tiered Retrieval: ${tieredRetrieval.recommended ? "Yes" : "No"}`);

  console.log("\n📈 Quality Metrics:");
  console.log(`  • Embedding Coverage: ${(embeddingQuality.embeddingCoverage * 100).toFixed(2)}%`);
  console.log(`  • Precision: ${(qualityMetrics.precision * 100).toFixed(2)}%`);
  console.log(`  • Recall: ${(qualityMetrics.recall * 100).toFixed(2)}%`);
  console.log(`  • Semantic Coherence: ${(qualityMetrics.semanticCoherence * 100).toFixed(2)}%`);

  console.log("\n💰 Cost Analysis:");
  console.log(`  • Current monthly cost: $${costAnalysis.currentCost.toFixed(2)}`);
  console.log(`  • Recommended monthly cost: $${costAnalysis.recommendedCost.toFixed(2)}`);
  console.log(`  • Potential savings: $${costAnalysis.savings.toFixed(2)}/month`);

  console.log("\n🔧 Recommendations:");
  recommendations.forEach((rec, i) => console.log(`  ${i + 1}. ${rec}`));

  console.log("\n" + "=".repeat(80));
  console.log(`Audit completed at: ${new Date().toISOString()}`);
  console.log("=".repeat(80));

  return report;
}

// ============================================================================
// Entry Point
// ============================================================================

runAudit()
  .then((report) => {
    // Save report to file
    const fs = require("fs");
    const reportPath = "./audit-report.json";
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Full report saved to: ${reportPath}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Audit failed:", error);
    process.exit(1);
  });
