/**
 * Semantic Similarity Test Utilities
 *
 * Test scripts for validating semantic similarity calculations
 * between sample relationship profiles and queries.
 *
 * Usage:
 *   npx tsx scripts/test-semantic-similarity.ts
 *
 * Environment Variables Required:
 *   - VOYAGE_API_KEY: Voyage AI API key for embedding generation
 */

import { generateEmbedding, generateBatchEmbeddings } from "../lib/embedding-service";

// ============================================================================
// Configuration
// ============================================================================

// Sample user story profiles for testing
const SAMPLE_PROFILES = [
  {
    id: "profile-1",
    title: "User Authentication Flow",
    description: "As a user, I want to securely login using email and password so that I can access my account",
    tags: ["authentication", "security", "login", "user management"],
    complexity: "moderate",
    domain: "security",
  },
  {
    id: "profile-2",
    title: "Dashboard Analytics View",
    description: "As a product manager, I want to view key metrics on a dashboard so that I can track performance",
    tags: ["analytics", "dashboard", "visualization", "metrics"],
    complexity: "moderate",
    domain: "analytics",
  },
  {
    id: "profile-3",
    title: "REST API Integration",
    description: "As a developer, I want to integrate with third-party APIs so that I can fetch external data",
    tags: ["api", "integration", "rest", "backend"],
    complexity: "complex",
    domain: "integration",
  },
  {
    id: "profile-4",
    title: "Database Query Optimization",
    description: "As a backend developer, I want to optimize slow database queries so that the app performs faster",
    tags: ["database", "performance", "optimization", "backend"],
    complexity: "complex",
    domain: "performance",
  },
  {
    id: "profile-5",
    title: "Simple UI Button Fix",
    description: "As a user, I want the submit button to be properly aligned so that the form looks professional",
    tags: ["ui", "bug fix", "styling", "frontend"],
    complexity: "simple",
    domain: "frontend",
  },
];

// Test queries to measure similarity against profiles
const TEST_QUERIES = [
  {
    query: "implement secure login with OAuth 2.0",
    expectedTopMatch: "profile-1",
    category: "authentication",
  },
  {
    query: "create analytics chart showing user growth",
    expectedTopMatch: "profile-2",
    category: "analytics",
  },
  {
    query: "integrate payment gateway API",
    expectedTopMatch: "profile-3",
    category: "api",
  },
  {
    query: "fix slow database performance issues",
    expectedTopMatch: "profile-4",
    category: "performance",
  },
  {
    query: "align form elements properly",
    expectedTopMatch: "profile-5",
    category: "ui",
  },
  // Cross-domain queries to test boundary conditions
  {
    query: "security audit for API endpoints",
    expectedTopMatch: "profile-1", // Could match authentication or API
    category: "security",
  },
  {
    query: "performance monitoring dashboard",
    expectedTopMatch: "profile-2", // Could match dashboard or performance
    category: "mixed",
  },
];

// ============================================================================
// Types
// ============================================================================

interface SimilarityResult {
  queryId: string;
  query: string;
  profileSimilarities: {
    profileId: string;
    title: string;
    similarity: number;
  }[];
  topMatch: string;
  expectedMatch: string;
  isCorrect: boolean;
  topSimilarity: number;
  avgSimilarity: number;
  similaritySpread: number;
}

interface TestReport {
  timestamp: string;
  totalQueries: number;
  correctMatches: number;
  accuracy: number;
  avgTopSimilarity: number;
  avgSimilaritySpread: number;
  results: SimilarityResult[];
  recommendations: string[];
}

// ============================================================================
// Similarity Calculation
// ============================================================================

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same length");
  }

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

function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same length");
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }

  return Math.sqrt(sum);
}

function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same length");
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }

  return sum;
}

// ============================================================================
// Test Functions
// ============================================================================

async function runSemanticSimilarityTests(): Promise<TestReport> {
  console.log("╔" + "═".repeat(78) + "╗");
  console.log("║" + " SEMANTIC SIMILARITY TESTING ".padStart(50).padEnd(78) + "║");
  console.log("╚" + "═".repeat(78) + "╝");
  console.log(`\nTest started at: ${new Date().toISOString()}`);

  // Generate embeddings for all profiles
  console.log("\n📊 Generating embeddings for sample profiles...");
  const profileTexts = SAMPLE_PROFILES.map(
    (p) => `${p.title} ${p.description} ${p.tags.join(" ")}`
  );
  const batchResult = await generateBatchEmbeddings(profileTexts);
  const profileEmbeddings: (number[] | null)[] = batchResult?.embeddings ?? profileTexts.map(() => null);

  const validProfiles = SAMPLE_PROFILES.filter(
    (_, i) => profileEmbeddings[i] !== null
  );
  console.log(`Generated ${validProfiles.length} profile embeddings`);

  // Test each query
  console.log("\n🔍 Testing query similarities...");
  const results: SimilarityResult[] = [];

  for (const testCase of TEST_QUERIES) {
    console.log(`\n--- Testing: "${testCase.query.substring(0, 50)}..." ---`);

    const queryEmbedding = (await generateEmbedding(testCase.query))?.embedding ?? null;
    if (!queryEmbedding) {
      console.error(`Failed to generate embedding for query: ${testCase.query}`);
      continue;
    }

    // Calculate similarity with each profile
    const similarities: { profileId: string; title: string; similarity: number }[] = [];

    for (let i = 0; i < SAMPLE_PROFILES.length; i++) {
      const profileEmb = profileEmbeddings[i];
      if (profileEmb) {
        const similarity = cosineSimilarity(queryEmbedding, profileEmb);
        similarities.push({
          profileId: SAMPLE_PROFILES[i].id,
          title: SAMPLE_PROFILES[i].title,
          similarity,
        });
      }
    }

    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity);

    const topMatch = similarities[0];
    const isCorrect = topMatch.profileId === testCase.expectedTopMatch;
    const avgSimilarity =
      similarities.reduce((sum, s) => sum + s.similarity, 0) / similarities.length;
    const similaritySpread = topMatch.similarity - similarities[similarities.length - 1].similarity;

    results.push({
      queryId: testCase.category,
      query: testCase.query,
      profileSimilarities: similarities,
      topMatch: topMatch.profileId,
      expectedMatch: testCase.expectedTopMatch,
      isCorrect,
      topSimilarity: topMatch.similarity,
      avgSimilarity,
      similaritySpread,
    });

    // Print results
    console.log(`  Expected: ${testCase.expectedTopMatch}`);
    console.log(`  Actual:   ${topMatch.profileId} (${(topMatch.similarity * 100).toFixed(2)}%)`);
    console.log(`  ${isCorrect ? "✓ CORRECT" : "✗ INCORRECT"}`);

    // Print top 3 matches
    console.log("  Top 3 matches:");
    similarities.slice(0, 3).forEach((s, i) => {
      console.log(`    ${i + 1}. ${s.title}: ${(s.similarity * 100).toFixed(2)}%`);
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  // Calculate overall metrics
  const correctMatches = results.filter((r) => r.isCorrect).length;
  const accuracy = (correctMatches / results.length) * 100;
  const avgTopSimilarity =
    results.reduce((sum, r) => sum + r.topSimilarity, 0) / results.length;
  const avgSimilaritySpread =
    results.reduce((sum, r) => sum + r.similaritySpread, 0) / results.length;

  // Generate recommendations
  const recommendations: string[] = [];

  if (accuracy < 80) {
    recommendations.push(
      `⚠️ Accuracy is ${accuracy.toFixed(1)}% - consider fine-tuning the embedding model or adjusting similarity thresholds`
    );
  }

  if (avgTopSimilarity < 0.7) {
    recommendations.push(
      `📉 Average top similarity is ${(avgTopSimilarity * 100).toFixed(1)}% - may need lower threshold for retrieval`
    );
  }

  if (avgSimilaritySpread < 0.1) {
    recommendations.push(
      `📊 Low similarity spread (${(avgSimilaritySpread * 100).toFixed(1)}%) - embeddings may not differentiate well between categories`
    );
  }

  // Print summary
  console.log("\n" + "=".repeat(80));
  console.log("TEST SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total queries tested: ${results.length}`);
  console.log(`Correct matches: ${correctMatches}/${results.length}`);
  console.log(`Accuracy: ${accuracy.toFixed(2)}%`);
  console.log(`Average top similarity: ${(avgTopSimilarity * 100).toFixed(2)}%`);
  console.log(`Average similarity spread: ${(avgSimilaritySpread * 100).toFixed(2)}%`);

  if (recommendations.length > 0) {
    console.log("\n📋 Recommendations:");
    recommendations.forEach((rec) => console.log(`  ${rec}`));
  }

  return {
    timestamp: new Date().toISOString(),
    totalQueries: results.length,
    correctMatches,
    accuracy,
    avgTopSimilarity,
    avgSimilaritySpread,
    results,
    recommendations,
  };
}

// ============================================================================
// Embedding Quality Analysis
// ============================================================================

async function analyzeEmbeddingQuality(): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log("EMBEDDING QUALITY ANALYSIS");
  console.log("=".repeat(80));

  // Generate embeddings for profiles
  const profileTexts = SAMPLE_PROFILES.map(
    (p) => `${p.title} ${p.description} ${p.tags.join(" ")}`
  );
  const batchResult2 = await generateBatchEmbeddings(profileTexts);
  const embeddings: (number[] | null)[] = batchResult2?.embeddings ?? profileTexts.map(() => null);
  const validEmbeddings = embeddings.filter((e) => e !== null) as number[][];

  if (validEmbeddings.length === 0) {
    console.error("No valid embeddings generated");
    return;
  }

  // Analyze embedding properties
  console.log("\n📏 Embedding Dimensions:");
  console.log(`  Vector size: ${validEmbeddings[0].length} dimensions`);

  // Calculate magnitudes
  const magnitudes = validEmbeddings.map((emb) =>
    Math.sqrt(emb.reduce((sum, val) => sum + val * val, 0))
  );
  const avgMagnitude = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
  const minMagnitude = Math.min(...magnitudes);
  const maxMagnitude = Math.max(...magnitudes);

  console.log("\n📊 Magnitude Statistics:");
  console.log(`  Average: ${avgMagnitude.toFixed(4)}`);
  console.log(`  Min: ${minMagnitude.toFixed(4)}`);
  console.log(`  Max: ${maxMagnitude.toFixed(4)}`);
  console.log(`  Range: ${(maxMagnitude - minMagnitude).toFixed(4)}`);

  // Calculate pairwise similarities
  console.log("\n🔗 Pairwise Similarity Matrix:");
  console.log("     " + SAMPLE_PROFILES.map((_, i) => `P${i + 1}`.padStart(7)).join(""));

  for (let i = 0; i < validEmbeddings.length; i++) {
    let row = `P${i + 1}   `;
    for (let j = 0; j < validEmbeddings.length; j++) {
      const sim = cosineSimilarity(validEmbeddings[i], validEmbeddings[j]);
      row += `${(sim * 100).toFixed(1)}%`.padStart(7);
    }
    console.log(row);
  }

  // Identify potentially problematic pairs
  console.log("\n⚠️ High Similarity Pairs (> 80%, excluding self):");
  for (let i = 0; i < validEmbeddings.length; i++) {
    for (let j = i + 1; j < validEmbeddings.length; j++) {
      const sim = cosineSimilarity(validEmbeddings[i], validEmbeddings[j]);
      if (sim > 0.8) {
        console.log(
          `  ${SAMPLE_PROFILES[i].title} <-> ${SAMPLE_PROFILES[j].title}: ${(sim * 100).toFixed(1)}%`
        );
      }
    }
  }

  // Calculate inter-cluster and intra-cluster distances
  const domainGroups = new Map<string, number[][]>();
  SAMPLE_PROFILES.forEach((profile, i) => {
    if (validEmbeddings[i]) {
      const group = domainGroups.get(profile.domain) || [];
      group.push(validEmbeddings[i]);
      domainGroups.set(profile.domain, group);
    }
  });

  console.log("\n🏷️ Domain-based Clustering:");
  for (const [domain, embeddings] of domainGroups) {
    console.log(`  ${domain}: ${embeddings.length} profile(s)`);
  }
}

// ============================================================================
// Threshold Sensitivity Analysis
// ============================================================================

async function analyzeThresholdSensitivity(): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log("THRESHOLD SENSITIVITY ANALYSIS");
  console.log("=".repeat(80));

  // Generate embeddings
  const profileTexts = SAMPLE_PROFILES.map(
    (p) => `${p.title} ${p.description} ${p.tags.join(" ")}`
  );
  const batchResult3 = await generateBatchEmbeddings(profileTexts);
  const profileEmbeddings: (number[] | null)[] = batchResult3?.embeddings ?? profileTexts.map(() => null);

  const thresholds = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85];

  console.log("\n📈 Query Match Counts by Threshold:");
  console.log("Threshold | Matches | Avg Similarity | Quality Score");
  console.log("-".repeat(55));

  for (const threshold of thresholds) {
    let totalMatches = 0;
    let totalSimilarity = 0;
    let correctMatches = 0;

    for (const testCase of TEST_QUERIES) {
      const queryEmb = (await generateEmbedding(testCase.query))?.embedding ?? null;
      if (!queryEmb) continue;

      let bestMatch = "";
      let bestSimilarity = 0;

      for (let i = 0; i < SAMPLE_PROFILES.length; i++) {
        const profileEmb = profileEmbeddings[i];
        if (profileEmb) {
          const sim = cosineSimilarity(queryEmb, profileEmb);
          if (sim >= threshold && sim > bestSimilarity) {
            bestSimilarity = sim;
            bestMatch = SAMPLE_PROFILES[i].id;
            totalMatches++;
            totalSimilarity += sim;
          }
        }
      }

      if (bestMatch === testCase.expectedTopMatch) {
        correctMatches++;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const avgSim =
      totalMatches > 0 ? totalSimilarity / totalMatches : 0;
    const qualityScore = (correctMatches / TEST_QUERIES.length) * 100;

    console.log(
      `${threshold.toFixed(2).padStart(9)} | ${totalMatches.toString().padStart(7)} | ${(avgSim * 100).toFixed(1).padStart(14)}% | ${qualityScore.toFixed(1).padStart(13)}%`
    );
  }

  // Recommendation
  console.log("\n📋 Threshold Recommendations:");
  console.log("  • For high precision (anti-patterns, risks): Use 0.75+");
  console.log("  • For balanced retrieval (story generation): Use 0.65-0.70");
  console.log("  • For high recall (broad search): Use 0.55-0.60");
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  try {
    // Run all tests
    const testReport = await runSemanticSimilarityTests();

    // Analyze embedding quality
    await analyzeEmbeddingQuality();

    // Analyze threshold sensitivity
    await analyzeThresholdSensitivity();

    // Save report
    const fs = require("fs");
    const reportPath = "./semantic-similarity-report.json";
    fs.writeFileSync(reportPath, JSON.stringify(testReport, null, 2));
    console.log(`\n📄 Full report saved to: ${reportPath}`);

    console.log("\n" + "=".repeat(80));
    console.log("TEST COMPLETE");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

main();

// Export to make this a module (prevents global scope conflicts)
export {};
