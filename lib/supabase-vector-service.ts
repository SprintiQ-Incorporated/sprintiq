import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HOURS_PER_STORY_POINT } from "@/lib/constants/statusTypes";
import {
  getHighPrecisionSuccessPatterns as tieredSuccessPatterns,
  getAntiPatternsAndRisks as tieredAntiPatterns,
  getBalancedRetrieval,
  TieredSearchResult,
} from "@/lib/tiered-retrieval-service";
import { generateEmbedding as generateEmbeddingService } from "@/lib/embedding-service";

// Type definitions
interface VectorSearchResult {
  id: string;
  similarity: number;
  metadata: any;
}

interface TeamMember {
  id: string;
  name: string;
  avatar_url: string;
  email: string;
  role: string;
  level: "Junior" | "Mid" | "Senior" | "Lead";
  skills: string[];
  availability: number;
}

/**
 * Search for similar stories in Supabase Vector Database with dimension handling
 */
export async function searchSimilarStories(
  query: string,
  topK: number = 10,  // Increased from 5 to 10 for better coverage
  threshold: number = 0.65  // Lowered from 0.7 for better recall
): Promise<{ results: VectorSearchResult[]; error?: string }> {
  try {
    const embeddingResult = await generateEmbeddingService(query);
    const embedding = embeddingResult?.embedding ?? null;
    if (!embedding) {
      return {
        results: [],
        error: "Failed to generate embedding for query",
      };
    }

    // tawos_user_stories is global reference data with RLS gated to
    // 'authenticated' / 'service_role'. Worker callbacks have no user
    // session and fall back to anon — which matches no policy and gets
    // denied. Use the admin client for corpus reads regardless of caller
    // context. (Mirrors the fix in tieredSearch.)
    const supabase = createAdminClient();

    // First try with the current embedding dimensions
    const { data: matches, error } = await (supabase.rpc as any)("match_documents", {
      query_embedding: embedding,
      match_threshold: threshold,  // Use configurable threshold
      match_count: topK,
      filter: { table_name: "tawos_user_stories" },
    });

    // If dimension mismatch error, try alternative approach
    if (error && error.message?.includes("different vector dimensions")) {
      // Try searching without vector similarity (fallback to text search)
      const { data: textMatches, error: textError } = await (supabase as any)
        .from("tawos_user_stories")
        .select("*")
        .or(`metadata->>'title'.ilike.%${query}%,metadata->>'description'.ilike.%${query}%`)
        .limit(topK);

      if (textError) {
        console.error("Text search also failed:", textError);
        return {
          results: [],
          error: `Failed to search Supabase: ${error.message}`,
        };
      }

      // Convert text search results to VectorSearchResult format
      const results: VectorSearchResult[] = (textMatches || []).map(
        (match: any) => ({
          id: match.id,
          similarity: 0.5, // Default similarity for text search
          metadata: {
            title: match.metadata?.title as string,
            description: match.metadata?.description as string,
            successPattern: match.metadata?.successPattern as string,
            completionRate: match.metadata?.completionRate as number,
            antiPatterns: match.metadata?.antiPatterns as string[],
            tags: match.metadata?.tags as string[],
            storyPoints: match.metadata?.storyPoints as number,
            priority: match.metadata?.priority as string,
            role: match.metadata?.role as string,
            want: match.metadata?.want as string,
            benefit: match.metadata?.benefit as string,
            acceptanceCriteria: match.metadata?.acceptanceCriteria as string[],
            assignedTeamMember: match.metadata?.assignedTeamMember as string,
            estimatedTime: match.metadata?.estimatedTime as number,
            businessValue: match.metadata?.businessValue as number,
          },
        })
      );

      return { results };
    }

    if (error) {
      console.error("Supabase vector search error:", error);
      return {
        results: [],
        error: `Failed to search Supabase: ${error.message}`,
      };
    }

    const results: VectorSearchResult[] =
      matches?.map((match: any) => ({
        id: match.id,
        similarity: match.similarity || 0,
        metadata: {
          title: match.metadata?.title as string,
          description: match.metadata?.description as string,
          successPattern: match.metadata?.successPattern as string,
          completionRate: match.metadata?.completionRate as number,
          antiPatterns: match.metadata?.antiPatterns as string[],
          tags: match.metadata?.tags as string[],
          storyPoints: match.metadata?.storyPoints as number,
          priority: match.metadata?.priority as string,
          role: match.metadata?.role as string,
          want: match.metadata?.want as string,
          benefit: match.metadata?.benefit as string,
          acceptanceCriteria: match.metadata?.acceptanceCriteria as string[],
          assignedTeamMember: match.metadata?.assignedTeamMember as string,
          estimatedTime: match.metadata?.estimatedTime as number,
          businessValue: match.metadata?.businessValue as number,
        },
      })) || [];

    return { results };
  } catch (error) {
    console.error("Error searching Supabase:", error);
    return {
      results: [],
      error: `Failed to search Supabase: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

/**
 * Get TAWOS success patterns for story generation
 * Uses tiered retrieval with high precision threshold (0.75) for quality patterns
 *
 * Performance optimized: Success patterns and anti-patterns are fetched in parallel
 * to reduce total latency from ~16s to ~8s.
 */
export async function getTAWOSSuccessPatterns(
  featureDescription: string,
  complexity: "simple" | "moderate" | "complex"
): Promise<{
  patterns: VectorSearchResult[];
  antiPatterns: string[];
  error?: string;
}> {
  try {
    const searchQuery = `${featureDescription} ${complexity} complexity`;

    // Run both retrievals in parallel to reduce total latency
    // Previously sequential (~16s) → Now parallel (~8s)
    const [tieredResult, antiPatternResult] = await Promise.all([
      tieredSuccessPatterns(searchQuery, 5),
      tieredAntiPatterns(searchQuery, 5), // Reduced from 10 to 5 for faster retrieval
    ]);

    // Convert tiered results to VectorSearchResult format
    const patterns: VectorSearchResult[] = tieredResult.results
      .filter((r) => r.isSuccessPattern)
      .map((r) => ({
        id: r.id,
        similarity: r.similarity,
        metadata: r.metadata as VectorSearchResult["metadata"],
      }));

    // Collect anti-patterns from results
    const antiPatterns = new Set<string>();
    antiPatternResult.results.forEach((result) => {
      if (result.metadata.antiPatterns) {
        (result.metadata.antiPatterns as string[]).forEach((pattern: string) =>
          antiPatterns.add(pattern)
        );
      }
    });return {
      patterns,
      antiPatterns: Array.from(antiPatterns),
    };
  } catch (error) {
    console.error("Error getting TAWOS patterns:", error);
    return {
      patterns: [],
      antiPatterns: [],
      error: `Failed to get TAWOS patterns: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

/**
 * Get story templates based on similar successful stories
 * Uses balanced tiered retrieval (threshold: 0.65) for diverse framework coverage
 */
export async function getStoryTemplates(
  featureDescription: string,
  complexity: "simple" | "moderate" | "complex",
  numberOfStories: number
): Promise<{
  templates: VectorSearchResult[];
  frameworkCoverage?: Map<string, number>;
  error?: string;
}> {
  try {
    // Use balanced tiered retrieval for diverse templates
    const searchQuery = `${featureDescription} ${complexity} story template`;
    const tieredResult = await getBalancedRetrieval(searchQuery, numberOfStories * 2);

    // Convert and filter for high-quality templates (completion rate > 70% and good structure)
    const qualityTemplates = tieredResult.results
      .filter((result) => {
        const metadata = result.metadata;
        return (
          (metadata.completionRate as number || 0) >= 0.7 &&
          metadata.title &&
          metadata.role &&
          metadata.want &&
          metadata.benefit &&
          ((metadata.acceptanceCriteria as string[])?.length || 0) >= 3
        );
      })
      .map((r) => ({
        id: r.id,
        similarity: r.boostedScore, // Use boosted score which includes success pattern bonus
        metadata: r.metadata as VectorSearchResult["metadata"],
      }));

    // Sort by boosted relevance and quality
    const sortedTemplates = qualityTemplates
      .sort(
        (a: VectorSearchResult, b: VectorSearchResult) =>
          b.similarity - a.similarity
      )
      .slice(0, numberOfStories);return {
      templates: sortedTemplates,
      frameworkCoverage: tieredResult.frameworkCoverage,
    };
  } catch (error) {
    console.error("Error getting story templates:", error);
    return { templates: [], error: "Failed to get story templates" };
  }
}

/**
 * Get team performance data from Supabase with fallback
 */
export async function getTeamPerformanceData(
  teamMembers: Array<TeamMember>
): Promise<{
  performanceData: Array<{
    memberId: string;
    successRate: number;
    averageVelocity: number;
    completedStories: number;
  }>;
  error?: string;
}> {
  try {
    // Try to get performance data from Supabase
    const supabase = await createServerSupabaseClient();

    // Search for stories completed by team members
    const performanceData: Array<{
      memberId: string;
      successRate: number;
      averageVelocity: number;
      completedStories: number;
    }> = [];

    for (const member of teamMembers) {
      try {
        // Search for stories assigned to this member
        const searchQuery = `stories assigned to ${member.name} ${member.role}`;
        const { results, error } = await searchSimilarStories(searchQuery, 20);

        if (error) {
          // Use default performance data
          performanceData.push({
            memberId: member.id,
            successRate: 0.7, // Default 70% success rate
            averageVelocity: 8, // Default 8 story points per sprint
            completedStories: 0,
          });
          continue;
        }

        // Calculate performance metrics
        const completedStories = results.filter(
          (result) => result.metadata.completionRate >= 0.8
        ).length;

        const successRate =
          results.length > 0 ? completedStories / results.length : 0.7;
        const averageVelocity =
          results.length > 0
            ? results.reduce(
                (sum, result) => sum + (result.metadata.storyPoints || 5),
                0
              ) / results.length
            : 8;

        performanceData.push({
          memberId: member.id,
          successRate,
          averageVelocity,
          completedStories,
        });
      } catch (memberError) {
        // Use default performance data
        performanceData.push({
          memberId: member.id,
          successRate: 0.7,
          averageVelocity: 8,
          completedStories: 0,
        });
      }
    }

    return { performanceData };
  } catch (error) {
    console.error("Error getting team performance data:", error);
    // Return default performance data for all members
    const defaultPerformanceData = teamMembers.map((member) => ({
      memberId: member.id,
      successRate: 0.7,
      averageVelocity: 8,
      completedStories: 0,
    }));

    return {
      performanceData: defaultPerformanceData,
      error: "Using default performance data due to API limitations",
    };
  }
}

/**
 * Analyze story for anti-patterns using Supabase data
 * Uses tiered retrieval with low threshold (0.60) to catch more potential risks
 */
export async function analyzeStoryForAntiPatterns(story: {
  title: string;
  description: string;
  acceptanceCriteria: string[];
}): Promise<{
  warnings: string[];
  riskScore: number;
  antiPatternCount?: number;
  error?: string;
}> {
  try {
    const storyText = `${story.title} ${
      story.description
    } ${story.acceptanceCriteria.join(" ")}`;

    // Use tiered retrieval with low threshold (0.60) for broad risk detection
    const tieredResult = await tieredAntiPatterns(storyText, 10);

    const warnings: string[] = [];
    let riskScore = 0;

    // FBI Sentinel Anti-pattern Detection (rule-based)
    const text = storyText.toLowerCase();

    // Requirements confusion detection
    const vagueWords = [
      "maybe",
      "possibly",
      "might",
      "could",
      "should",
      "nice to have",
      "if possible",
    ];
    const hasVagueRequirements = vagueWords.some((word) => text.includes(word));
    if (hasVagueRequirements) {
      warnings.push(
        "FBI Sentinel: Vague requirements detected - use specific, measurable criteria"
      );
      riskScore += 0.3;
    }

    // Scope overload detection
    const scopeIndicators = [
      "and",
      "also",
      "additionally",
      "furthermore",
      "moreover",
    ];
    const scopeCount = scopeIndicators.filter((word) =>
      text.includes(word)
    ).length;
    if (scopeCount > 2) {
      warnings.push(
        "FBI Sentinel: Scope overload detected - story may contain too many features"
      );
      riskScore += 0.4;
    }

    // Analyze similar stories using tiered retrieval results
    const failedStories = tieredResult.results.filter(
      (r) => r.isAntiPattern || (r.metadata.completionRate as number || 1) < 0.6
    );

    if (failedStories.length > 0) {
      const lowestRate = Math.min(
        ...failedStories.map((s) => (s.metadata.completionRate as number) || 0)
      );
      warnings.push(
        `TAWOS Analysis: ${failedStories.length} similar stories had low completion rates ` +
        `(lowest: ${(lowestRate * 100).toFixed(0)}%)`
      );
      riskScore += 0.3;
    }

    // Check for common anti-patterns from tiered retrieval results
    const commonAntiPatterns = new Set<string>();
    tieredResult.results.forEach((result) => {
      if (result.metadata.antiPatterns) {
        (result.metadata.antiPatterns as string[]).forEach((pattern: string) =>
          commonAntiPatterns.add(pattern)
        );
      }
    });

    commonAntiPatterns.forEach((pattern: string) => {
      warnings.push(`TAWOS Anti-pattern: ${pattern}`);
      riskScore += 0.2;
    });return {
      warnings,
      riskScore: Math.min(riskScore, 1.0),
      antiPatternCount: tieredResult.antiPatternCount,
    };
  } catch (error) {
    console.error("Error analyzing story for anti-patterns:", error);
    return {
      warnings: ["Failed to analyze anti-patterns"],
      riskScore: 0.5,
      antiPatternCount: 0,
      error: `Failed to analyze anti-patterns: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

/**
 * Get optimal team assignment based on Supabase performance data with improved distribution
 */
export async function getOptimalTeamAssignment(
  story: {
    title: string;
    description: string;
    tags: string[];
    complexity: "simple" | "moderate" | "complex";
    priority: "Low" | "Medium" | "High" | "Critical";
  },
  teamMembers: Array<TeamMember>,
  options?: {
    forceDistribution?: boolean;
    maxStoriesPerMember?: number;
    currentAssignments?: Map<string, number>; // Track current assignments per member
  }
): Promise<{
  assignedMember: (typeof teamMembers)[0] | null;
  reason: string;
  confidence: number;
  skillMatch: number;
}> {
  try {
    // Get team performance data from Supabase
    const { performanceData, error } = await getTeamPerformanceData(
      teamMembers
    );

    if (error || performanceData.length === 0) {
      return await getLocalTeamAssignment(story, teamMembers, options);
    }

    // Enhanced team assignment with improved distribution
    return await getEnhancedTeamAssignment(
      story,
      teamMembers,
      performanceData,
      options
    );
  } catch (error) {
    console.error("❌ Error in optimal team assignment:", error);
    // Fallback to local algorithm
    return await getLocalTeamAssignment(story, teamMembers, options);
  }
}

/**
 * Get current workload from database for team members
 */
async function getCurrentWorkloadsFromDatabase(
  teamMembers: TeamMember[]
): Promise<Map<string, number>> {
  const workloads = new Map<string, number>();

  try {
    const supabase = await import("@/lib/supabase/server").then((m) =>
      m.createServerSupabaseClient()
    );

    // Get current user to access workspace
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Get all active tasks assigned to team members
    const { data: activeTasks, error } = await supabase
      .from("tasks")
      .select(
        `
        id,
        assignee_id,
        estimated_time,
        story_points,
        status:statuses(name)
      `
      )
      .not("assignee_id", "is", null)
      .not("status.name", "in", "(Done,Completed,Closed)")
      .not("status.name", "ilike", "%done%")
      .not("status.name", "ilike", "%complete%");

    if (error) {
      throw error;
    }

    // Calculate workload for each team member
    teamMembers.forEach((member) => {
      let totalWorkload = 0;

      // Find tasks assigned to this member
      const memberTasks =
        activeTasks?.filter((task) => task.assignee_id === member.id) || [];

      memberTasks.forEach((task) => {
        // Use estimated_time if available, otherwise estimate from story points
        if (task.estimated_time) {
          totalWorkload += task.estimated_time;
        } else if (task.story_points) {
          totalWorkload += task.story_points * HOURS_PER_STORY_POINT;
        }
      });

      workloads.set(member.id, totalWorkload);});
  } catch (error) {
    // Fall back to estimation
    teamMembers.forEach((member) => {
      const estimatedWorkload = Math.random() * member.availability * 0.6;
      workloads.set(member.id, estimatedWorkload);
    });
  }

  return workloads;
}

/**
 * Calculate current workload for each team member
 */
async function calculateMemberWorkloads(
  teamMembers: TeamMember[]
): Promise<Map<string, number>> {
  // Try to get real workload data from database first
  try {
    return await getCurrentWorkloadsFromDatabase(teamMembers);
  } catch (error) {

    const workloads = new Map<string, number>();

    // Fallback: sophisticated estimation system
    teamMembers.forEach((member) => {
      // Calculate workload based on member characteristics
      let estimatedWorkload = 0;

      // Base workload based on level (higher levels tend to have more responsibilities)
      const levelWorkloadMultiplier = {
        Junior: 0.4, // 40% of availability typically assigned
        Mid: 0.5, // 50% of availability typically assigned
        Senior: 0.6, // 60% of availability typically assigned
        Lead: 0.7, // 70% of availability typically assigned (more meetings, mentoring)
      };

      const baseWorkload =
        member.availability * (levelWorkloadMultiplier[member.level] || 0.5);

      // Add some randomization to simulate real-world variation
      const variation = (Math.random() - 0.5) * 0.3; // ±15% variation
      estimatedWorkload = Math.max(0, baseWorkload * (1 + variation));

      workloads.set(member.id, estimatedWorkload);
    });return workloads;
  }
}

/**
 * Calculate workload balancing score (Case 3)
 */
function calculateWorkloadScore(
  member: TeamMember,
  memberWorkloads: Map<string, number>
): number {
  const currentWorkload = memberWorkloads.get(member.id) || 0;
  const maxWorkload = member.availability * 0.8; // 80% of availability as max workload

  // Prefer members with lower workload
  if (currentWorkload >= maxWorkload) {
    return 0.1; // Very low score for overloaded members
  }

  // Calculate workload ratio (lower is better)
  const workloadRatio = currentWorkload / maxWorkload;

  // Invert the ratio so lower workload gets higher score
  // Add a bonus for very low workloads to encourage distribution
  const baseScore = Math.max(0.1, 1.0 - workloadRatio);
  const lowWorkloadBonus = workloadRatio < 0.3 ? 0.1 : 0; // Bonus for members with <30% workload

  return Math.min(1.0, baseScore + lowWorkloadBonus);
}

/**
 * Enhanced team assignment algorithm with improved distribution
 */
async function getEnhancedTeamAssignment(
  story: {
    title: string;
    description: string;
    tags: string[];
    complexity: "simple" | "moderate" | "complex";
    priority: "Low" | "Medium" | "High" | "Critical";
  },
  teamMembers: Array<TeamMember>,
  performanceData: any[],
  options?: {
    forceDistribution?: boolean;
    maxStoriesPerMember?: number;
    currentAssignments?: Map<string, number>;
  }
): Promise<{
  assignedMember: (typeof teamMembers)[0] | null;
  reason: string;
  confidence: number;
  skillMatch: number;
}> {if (teamMembers.length === 0) {
    return {
      assignedMember: null,
      reason: "No team members available",
      confidence: 0,
      skillMatch: 0,
    };
  }

  // Calculate current workload for each team member
  const memberWorkloads = await calculateMemberWorkloads(teamMembers);

  // Get current assignment counts
  const currentAssignments =
    options?.currentAssignments || new Map<string, number>();
  const maxStoriesPerMember = options?.maxStoriesPerMember || 3; // Default max 3 stories per member

  // Calculate scores for each team member
  const memberScores = teamMembers.map((member) => {
    const performance = performanceData.find(
      (p: any) => p.memberId === member.id
    );

    // 1. Skill Matching (40% weight)
    const skillMatch = calculateSkillMatch(member, story);

    // 2. Level-based Priority Assignment (30% weight)
    const levelPriorityMatch = calculateLevelPriorityMatch(member, story);

    // 3. Workload Balancing (20% weight) - Reduced from 30% to make room for distribution
    const workloadScore = calculateWorkloadScore(member, memberWorkloads);

    // 4. Distribution Bonus (10% weight) - NEW: Encourage distribution
    const distributionScore = calculateDistributionScore(
      member,
      currentAssignments,
      maxStoriesPerMember,
      teamMembers.length
    );

    // Performance bonus (if available)
    const performanceBonus = performance ? performance.successRate * 0.05 : 0; // Reduced from 0.1

    const totalScore =
      skillMatch * 0.4 +
      levelPriorityMatch * 0.3 +
      workloadScore * 0.2 +
      distributionScore * 0.1 +
      performanceBonus;

    const currentWorkload = memberWorkloads.get(member.id) || 0;
    const maxWorkload = member.availability * 0.8;
    const currentAssignmentCount = currentAssignments.get(member.id) || 0;return {
      member,
      score: totalScore,
      skillMatch,
      levelPriorityMatch,
      workloadScore,
      distributionScore,
      performanceBonus,
      currentWorkload,
      maxWorkload,
      currentAssignmentCount,
      reason: generateAssignmentReason(
        member,
        story,
        skillMatch,
        levelPriorityMatch,
        workloadScore,
        distributionScore,
        performance
      ),
      confidence: calculateConfidence(
        skillMatch,
        levelPriorityMatch,
        workloadScore,
        distributionScore
      ),
    };
  });

  // Filter out members who have reached their assignment limit
  const availableMembers = memberScores.filter(
    (score) => score.currentAssignmentCount < maxStoriesPerMember
  );

  if (availableMembers.length === 0) {
    // If all members are at limit, reset and start over
    return {
      assignedMember: memberScores[0].member, // Return the best match anyway
      reason: "All members at assignment limit, using best available match",
      confidence: memberScores[0].confidence,
      skillMatch: memberScores[0].skillMatch,
    };
  }

  // Sort by score and return the best available match
  availableMembers.sort((a, b) => b.score - a.score);
  const bestMatch = availableMembers[0];

  // Log detailed assignment information// Check for potential issues
  if (bestMatch.currentWorkload >= bestMatch.maxWorkload) {}

  if (bestMatch.skillMatch < 0.3) {}

  return {
    assignedMember: bestMatch.member,
    reason: bestMatch.reason,
    confidence: bestMatch.confidence,
    skillMatch: bestMatch.skillMatch,
  };
}

/**
 * Calculate skill matching score (Case 1)
 */
function calculateSkillMatch(
  member: TeamMember,
  story: {
    title: string;
    description: string;
    tags: string[];
    complexity: "simple" | "moderate" | "complex";
    priority: "Low" | "Medium" | "High" | "Critical";
  }
): number {
  if (story.tags.length === 0) {
    return 0.5; // Neutral score if no tags
  }

  // Direct skill matches
  const directMatches = story.tags.filter((tag) =>
    member.skills.some((skill) => skill.toLowerCase() === tag.toLowerCase())
  ).length;

  // Partial skill matches (e.g., "React" matches "React Native")
  const partialMatches =
    story.tags.filter((tag) =>
      member.skills.some(
        (skill) =>
          skill.toLowerCase().includes(tag.toLowerCase()) ||
          tag.toLowerCase().includes(skill.toLowerCase())
      )
    ).length - directMatches; // Subtract direct matches to avoid double counting

  // Role-based skill matching
  const roleSkillMatch = calculateRoleSkillMatch(member.role, story.tags);

  const totalMatches =
    directMatches + partialMatches * 0.7 + roleSkillMatch * 0.5;
  const maxPossibleMatches = story.tags.length;

  const finalScore = Math.min(totalMatches / maxPossibleMatches, 1.0);return finalScore;
}

/**
 * Calculate role-based skill matching
 */
function calculateRoleSkillMatch(role: string, tags: string[]): number {
  const roleSkillMap: Record<string, string[]> = {
    "Frontend Developer": [
      "react",
      "vue",
      "angular",
      "javascript",
      "typescript",
      "css",
      "html",
      "ui",
      "frontend",
    ],
    "Backend Developer": [
      "java",
      "spring",
      "node.js",
      "python",
      "c#",
      "database",
      "api",
      "backend",
      "server",
    ],
    "Full Stack Developer": [
      "react",
      "node.js",
      "java",
      "spring",
      "database",
      "api",
      "fullstack",
    ],
    "DevOps Engineer": [
      "docker",
      "kubernetes",
      "aws",
      "ci/cd",
      "infrastructure",
      "monitoring",
      "devops",
    ],
    "QA Engineer": [
      "testing",
      "automation",
      "selenium",
      "jest",
      "quality",
      "qa",
    ],
    "UI/UX Designer": [
      "figma",
      "design",
      "ui",
      "ux",
      "prototyping",
      "user research",
    ],
    "Product Manager": [
      "product",
      "strategy",
      "agile",
      "stakeholder",
      "user research",
    ],
    "Data Scientist": [
      "python",
      "machine learning",
      "statistics",
      "data analysis",
      "sql",
    ],
    "AI Engineer": [
      "python",
      "machine learning",
      "ai",
      "artificial intelligence",
      "ml",
      "deep learning",
      "neural networks",
      "tensorflow",
      "pytorch",
      "ai/ml",
    ],
    Designer: [
      "figma",
      "design",
      "ui",
      "ux",
      "prototyping",
      "user research",
      "visual design",
      "graphic design",
      "design system",
    ],
    Frontend: [
      "react",
      "vue",
      "angular",
      "javascript",
      "typescript",
      "css",
      "html",
      "ui",
      "frontend",
      "web",
    ],
    Backend: [
      "java",
      "spring",
      "node.js",
      "python",
      "c#",
      "database",
      "api",
      "backend",
      "server",
      "microservices",
    ],
    Deploy: [
      "docker",
      "kubernetes",
      "aws",
      "ci/cd",
      "infrastructure",
      "monitoring",
      "devops",
      "deployment",
      "cloud",
      "azure",
      "gcp",
    ],
  };

  const roleSkills = roleSkillMap[role] || [];
  const matches = tags.filter((tag) =>
    roleSkills.some(
      (skill) =>
        skill.toLowerCase().includes(tag.toLowerCase()) ||
        tag.toLowerCase().includes(skill.toLowerCase())
    )
  ).length;

  return matches / Math.max(tags.length, 1);
}

/**
 * Calculate level-based priority assignment (Case 2)
 */
function calculateLevelPriorityMatch(
  member: TeamMember,
  story: {
    title: string;
    description: string;
    tags: string[];
    complexity: "simple" | "moderate" | "complex";
    priority: "Low" | "Medium" | "High" | "Critical";
  }
): number {
  const levelScores = {
    Junior: {
      complexity: { simple: 0.9, moderate: 0.6, complex: 0.3 },
      priority: { Low: 0.9, Medium: 0.7, High: 0.4, Critical: 0.2 }, // More aggressive for Junior
    },
    Mid: {
      complexity: { simple: 0.8, moderate: 0.9, complex: 0.7 },
      priority: { Low: 0.7, Medium: 0.9, High: 0.8, Critical: 0.5 }, // More aggressive for Mid
    },
    Senior: {
      complexity: { simple: 0.7, moderate: 0.8, complex: 0.9 },
      priority: { Low: 0.5, Medium: 0.7, High: 0.9, Critical: 0.8 }, // More aggressive for Senior
    },
    Lead: {
      complexity: { simple: 0.6, moderate: 0.7, complex: 0.8 },
      priority: { Low: 0.3, Medium: 0.5, High: 0.8, Critical: 0.95 }, // More aggressive for Lead
    },
  };

  const levelScore = levelScores[member.level as keyof typeof levelScores];
  if (!levelScore) return 0.5;

  const complexityScore = levelScore.complexity[story.complexity] || 0.5;
  const priorityScore = levelScore.priority[story.priority] || 0.5;

  // Weight complexity and priority equally
  return (complexityScore + priorityScore) / 2;
}

/**
 * Calculate distribution bonus score
 */
function calculateDistributionScore(
  member: TeamMember,
  currentAssignments: Map<string, number>,
  maxStoriesPerMember: number,
  totalMembers: number
): number {
  const currentAssignmentCount = currentAssignments.get(member.id) || 0;
  const maxPossibleAssignments = maxStoriesPerMember;

  // If member is already at max assignments, they get a low score
  if (currentAssignmentCount >= maxPossibleAssignments) {
    return 0.1; // Very low score for overloaded members
  }

  // Calculate the number of stories they could potentially take
  const storiesAvailable = maxPossibleAssignments - currentAssignmentCount;

  // If no stories are available, they get a low score
  if (storiesAvailable <= 0) {
    return 0.1;
  }

  // Calculate the ratio of available stories to total stories
  const availableRatio = storiesAvailable / totalMembers;

  // Invert the ratio to encourage distribution (higher score for more available stories)
  const distributionScore = 1.0 - availableRatio;

  return Math.min(1.0, distributionScore);
}

/**
 * Generate assignment reason
 */
function generateAssignmentReason(
  member: TeamMember,
  story: {
    title: string;
    description: string;
    tags: string[];
    complexity: "simple" | "moderate" | "complex";
    priority: "Low" | "Medium" | "High" | "Critical";
  },
  skillMatch: number,
  levelPriorityMatch: number,
  workloadScore: number,
  distributionScore: number,
  performance?: any
): string {
  const reasons: string[] = [];

  if (skillMatch > 0.7) {
    reasons.push("excellent skill match");
  } else if (skillMatch > 0.5) {
    reasons.push("good skill match");
  }

  if (levelPriorityMatch > 0.8) {
    reasons.push("optimal level for priority");
  } else if (levelPriorityMatch > 0.6) {
    reasons.push("appropriate level");
  }

  if (workloadScore > 0.8) {
    reasons.push("available capacity");
  } else if (workloadScore > 0.6) {
    reasons.push("reasonable workload");
  }

  if (distributionScore > 0.8) {
    reasons.push("available for more stories");
  } else if (distributionScore > 0.6) {
    reasons.push("reasonable distribution");
  }

  if (performance?.successRate > 0.8) {
    reasons.push("high success rate");
  }

  if (reasons.length === 0) {
    reasons.push("best available match");
  }

  return reasons.join(", ");
}

/**
 * Calculate confidence score
 */
function calculateConfidence(
  skillMatch: number,
  levelPriorityMatch: number,
  workloadScore: number,
  distributionScore: number
): number {
  // Weight the factors for confidence calculation
  const confidence =
    skillMatch * 0.4 +
    levelPriorityMatch * 0.3 +
    workloadScore * 0.2 +
    distributionScore * 0.1;

  return Math.min(Math.max(confidence, 0.1), 0.95);
}

/**
 * Local team assignment algorithm (fallback)
 */
function getLocalTeamAssignment(
  story: {
    title: string;
    description: string;
    tags: string[];
    complexity: "simple" | "moderate" | "complex";
    priority: "Low" | "Medium" | "High" | "Critical";
  },
  teamMembers: Array<TeamMember>,
  options?: {
    forceDistribution?: boolean;
    maxStoriesPerMember?: number;
    currentAssignments?: Map<string, number>;
  }
): Promise<{
  assignedMember: (typeof teamMembers)[0] | null;
  reason: string;
  confidence: number;
  skillMatch: number;
}> {

  if (teamMembers.length === 0) {
    return Promise.resolve({
      assignedMember: null,
      reason: "No team members available",
      confidence: 0,
      skillMatch: 0,
    });
  }

  // Get current assignment counts for distribution
  const currentAssignments =
    options?.currentAssignments || new Map<string, number>();
  const maxStoriesPerMember = options?.maxStoriesPerMember || 3;

  // Use the enhanced algorithm without performance data
  const memberScores = teamMembers.map((member) => {
    const skillMatch = calculateSkillMatch(member, story);
    const levelPriorityMatch = calculateLevelPriorityMatch(member, story);
    const workloadScore = 0.7; // Default workload score for local assignment
    const distributionScore = calculateDistributionScore(
      member,
      currentAssignments,
      maxStoriesPerMember,
      teamMembers.length
    );

    const totalScore =
      skillMatch * 0.4 +
      levelPriorityMatch * 0.3 +
      workloadScore * 0.2 +
      distributionScore * 0.1;

    return {
      member,
      score: totalScore,
      skillMatch,
      reason: generateAssignmentReason(
        member,
        story,
        skillMatch,
        levelPriorityMatch,
        workloadScore,
        distributionScore
      ),
      confidence: calculateConfidence(
        skillMatch,
        levelPriorityMatch,
        workloadScore,
        distributionScore
      ),
    };
  });

  // Filter out members who have reached their assignment limit
  const availableMembers = memberScores.filter((score) => {
    const currentAssignmentCount = currentAssignments.get(score.member.id) || 0;
    return currentAssignmentCount < maxStoriesPerMember;
  });

  if (availableMembers.length === 0) {// If all members are at limit, return the best match anyway
    memberScores.sort((a, b) => b.score - a.score);
    const bestMatch = memberScores[0];
    return Promise.resolve({
      assignedMember: bestMatch.member,
      reason: "All members at assignment limit, using best available match",
      confidence: bestMatch.confidence,
      skillMatch: bestMatch.skillMatch,
    });
  }

  // Sort by score and return the best available match
  availableMembers.sort((a, b) => b.score - a.score);
  const bestMatch = availableMembers[0];return Promise.resolve({
    assignedMember: bestMatch.member,
    reason: bestMatch.reason,
    confidence: bestMatch.confidence,
    skillMatch: bestMatch.skillMatch,
  });
}

/**
 * Store successful story in Supabase Vector Database for future reference
 */
export async function storeSuccessfulStory(story: {
  id: string;
  title: string;
  description: string;
  role: string;
  want: string;
  benefit: string;
  acceptanceCriteria: string[];
  storyPoints: number;
  businessValue: number;
  priority: string;
  tags: string[];
  assignedTeamMember?: string;
  estimatedTime: number;
  completionRate: number;
  successPattern: string;
  antiPatterns?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const embeddingResult = await generateEmbeddingService(
      `${story.title} ${story.description} ${story.role} ${story.want} ${
        story.benefit
      } ${story.tags.join(" ")}`
    );
    const embedding = embeddingResult?.embedding ?? null;

    if (!embedding) {
      return { success: false, error: "Failed to generate embedding" };
    }

    // Corpus write — service_role required (modify policy is TO service_role).
    const supabase = createAdminClient();

    // Insert the story with embedding into the tawos_user_stories table
    const { error } = await (supabase as any).from("tawos_user_stories").insert({
      id: story.id,
      embedding: embedding,
      metadata: {
        title: story.title,
        description: story.description,
        role: story.role,
        want: story.want,
        benefit: story.benefit,
        acceptanceCriteria: story.acceptanceCriteria,
        storyPoints: story.storyPoints,
        businessValue: story.businessValue,
        priority: story.priority,
        tags: story.tags,
        assignedTeamMember: story.assignedTeamMember || "",
        estimatedTime: story.estimatedTime,
        completionRate: story.completionRate,
        successPattern: story.successPattern,
        antiPatterns: story.antiPatterns || [],
      },
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error storing story in Supabase:", error);
      return {
        success: false,
        error: `Failed to store story: ${error.message}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error storing story in Supabase:", error);
    return {
      success: false,
      error: `Failed to store story: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

/**
 * Test function to demonstrate the enhanced team assignment logic
 */
export async function testEnhancedTeamAssignment(): Promise<void> {

  // Sample team members
  const sampleTeamMembers: TeamMember[] = [
    {
      id: "member-1",
      name: "Alice Johnson",
      avatar_url: "",
      email: "alice@example.com",
      role: "Frontend Developer",
      level: "Senior",
      skills: ["React", "TypeScript", "CSS", "UI/UX"],
      availability: 40,
    },
    {
      id: "member-2",
      name: "Bob Smith",
      avatar_url: "",
      email: "bob@example.com",
      role: "Backend Developer",
      level: "Mid",
      skills: ["Java", "Spring", "Database", "API"],
      availability: 40,
    },
    {
      id: "member-3",
      name: "Carol Davis",
      avatar_url: "",
      email: "carol@example.com",
      role: "Full Stack Developer",
      level: "Junior",
      skills: ["JavaScript", "React", "Node.js"],
      availability: 35,
    },
    {
      id: "member-4",
      name: "David Wilson",
      avatar_url: "",
      email: "david@example.com",
      role: "DevOps Engineer",
      level: "Lead",
      skills: ["Docker", "Kubernetes", "AWS", "CI/CD"],
      availability: 40,
    },
  ];

  // Sample stories to test different scenarios
  const testStories = [
    {
      title: "Implement React Dashboard",
      description: "Create a new dashboard using React and TypeScript",
      tags: ["React", "TypeScript", "UI"],
      complexity: "moderate" as const,
      priority: "High" as const,
    },
    {
      title: "Database Optimization",
      description: "Optimize database queries and add indexes",
      tags: ["Database", "Performance"],
      complexity: "complex" as const,
      priority: "Critical" as const,
    },
    {
      title: "Simple Bug Fix",
      description: "Fix a minor UI bug in the login form",
      tags: ["UI", "Bug"],
      complexity: "simple" as const,
      priority: "Low" as const,
    },
    {
      title: "Deploy to Production",
      description: "Set up production deployment pipeline",
      tags: ["DevOps", "CI/CD", "AWS"],
      complexity: "complex" as const,
      priority: "High" as const,
    },
  ];

  testStories.forEach(() => {});

  sampleTeamMembers.forEach((member) => {});


  for (const story of testStories) {

    try {
      const result = await getOptimalTeamAssignment(story, sampleTeamMembers);

      if (result.assignedMember) {} else {
      }
    } catch (error) {
      console.error(`❌ Error testing assignment:`, error);
    }
  }

}

/**
 * Test the improved team assignment distribution
 */
export async function testImprovedTeamAssignment(): Promise<void> {

  // Sample team members with different levels
  const sampleTeamMembers: TeamMember[] = [
    {
      id: "lead-1",
      name: "Sarah Lead",
      avatar_url: "",
      email: "sarah@example.com",
      role: "Tech Lead",
      level: "Lead",
      skills: [
        "Architecture",
        "System Design",
        "Leadership",
        "React",
        "Node.js",
      ],
      availability: 40,
    },
    {
      id: "senior-1",
      name: "John Senior",
      avatar_url: "",
      email: "john@example.com",
      role: "Senior Developer",
      level: "Senior",
      skills: ["React", "TypeScript", "API Design", "Testing"],
      availability: 40,
    },
    {
      id: "mid-1",
      name: "Alice Mid",
      avatar_url: "",
      email: "alice@example.com",
      role: "Mid-Level Developer",
      level: "Mid",
      skills: ["React", "JavaScript", "CSS", "Basic Testing"],
      availability: 40,
    },
    {
      id: "junior-1",
      name: "Bob Junior",
      avatar_url: "",
      email: "bob@example.com",
      role: "Junior Developer",
      level: "Junior",
      skills: ["JavaScript", "HTML", "CSS", "Basic React"],
      availability: 40,
    },
  ];

  // Sample stories with different priorities and complexities
  const testStories = [
    {
      title: "Critical System Architecture Design",
      description:
        "Design the overall system architecture for the new platform",
      tags: ["Architecture", "System Design", "Leadership"],
      complexity: "complex" as const,
      priority: "Critical" as const,
    },
    {
      title: "High Priority API Implementation",
      description: "Implement the core API endpoints for user management",
      tags: ["API", "Backend", "Node.js"],
      complexity: "moderate" as const,
      priority: "High" as const,
    },
    {
      title: "Medium Priority UI Component",
      description: "Create reusable UI components for the dashboard",
      tags: ["React", "UI", "Components"],
      complexity: "moderate" as const,
      priority: "Medium" as const,
    },
    {
      title: "Low Priority Bug Fix",
      description: "Fix minor styling issues in the footer",
      tags: ["CSS", "Bug Fix"],
      complexity: "simple" as const,
      priority: "Low" as const,
    },
    {
      title: "High Priority Security Feature",
      description: "Implement authentication and authorization system",
      tags: ["Security", "Authentication", "Backend"],
      complexity: "complex" as const,
      priority: "High" as const,
    },
    {
      title: "Medium Priority Testing",
      description: "Add unit tests for existing components",
      tags: ["Testing", "Jest", "React"],
      complexity: "simple" as const,
      priority: "Medium" as const,
    },
  ];sampleTeamMembers.forEach((member) => {});

  // Track assignments to demonstrate distribution
  const assignmentCounts = new Map<string, number>();
  const assignments: Array<{
    story: string;
    member: string;
    level: string;
    priority: string;
  }> = [];

  for (const story of testStories) {try {
      const result = await getOptimalTeamAssignment(story, sampleTeamMembers, {
        forceDistribution: true,
        maxStoriesPerMember: 3,
        currentAssignments: assignmentCounts,
      });

      if (result.assignedMember) {
        // Update assignment count
        const currentCount =
          assignmentCounts.get(result.assignedMember.id) || 0;
        assignmentCounts.set(result.assignedMember.id, currentCount + 1);

        assignments.push({
          story: story.title,
          member: result.assignedMember.name,
          level: result.assignedMember.level,
          priority: story.priority,
        });} else {
      }
    } catch (error) {
      console.error(`❌ Error testing assignment:`, error);
    }
  }

  // Show final distribution

  sampleTeamMembers.forEach((member) => {
    const count = assignmentCounts.get(member.id) || 0;
    const memberAssignments = assignments.filter(
      (a) => a.member === member.name
    );
    memberAssignments.forEach((assignment) => {
    });
  });

  // Show priority distribution analysis

  const priorityDistribution = {
    Critical: assignments.filter((a) => a.priority === "Critical"),
    High: assignments.filter((a) => a.priority === "High"),
    Medium: assignments.filter((a) => a.priority === "Medium"),
    Low: assignments.filter((a) => a.priority === "Low"),
  };

  Object.entries(priorityDistribution).forEach(([priority, assignments]) => {
    assignments.forEach((assignment) => {});
  });

}

/**
 * Get assignment statistics for team members
 */
export async function getTeamAssignmentStats(
  teamMembers: TeamMember[]
): Promise<{
  totalMembers: number;
  averageWorkload: number;
  overloadedMembers: number;
  availableMembers: number;
  skillDistribution: Record<string, number>;
}> {
  const workloads = await calculateMemberWorkloads(teamMembers);

  const totalWorkload = Array.from(workloads.values()).reduce(
    (sum, workload) => sum + workload,
    0
  );
  const averageWorkload = totalWorkload / teamMembers.length;

  const overloadedMembers = teamMembers.filter((member) => {
    const workload = workloads.get(member.id) || 0;
    const maxWorkload = member.availability * 0.8;
    return workload >= maxWorkload;
  }).length;

  const availableMembers = teamMembers.filter((member) => {
    const workload = workloads.get(member.id) || 0;
    const maxWorkload = member.availability * 0.8;
    return workload < maxWorkload * 0.5; // Less than 50% of max workload
  }).length;

  // Calculate skill distribution
  const skillDistribution: Record<string, number> = {};
  teamMembers.forEach((member) => {
    member.skills.forEach((skill) => {
      skillDistribution[skill] = (skillDistribution[skill] || 0) + 1;
    });
  });

  return {
    totalMembers: teamMembers.length,
    averageWorkload,
    overloadedMembers,
    availableMembers,
    skillDistribution,
  };
}
