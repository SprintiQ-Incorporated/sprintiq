"use server";

/**
 * Story-related server actions
 * Extracted from ai-actions.ts
 *
 * Includes:
 * - generateTAWOSStories - Main story generation with TAWOS
 * - saveUserStory - Save story to database
 * - saveUserStoryToDestination - Save story with destination options
 * - analyzeStoryDependencies - Analyze dependencies between stories
 */

import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import type { PriorityWeights } from "@/components/workspace/ai/priority-scoring-config";
import { buildTieredRAGContext, CONFIDENCE_THRESHOLDS } from "@/lib/tawos-rag-context-builder";
import { TIER_THRESHOLDS } from "@/lib/tiered-retrieval-service";

import type { TeamMember, EnhancedStoryGenerationParams, StoryGenerationParams } from "@/types";
import {
  getContextAwareInstructions,
} from "@/lib/context-processor";
import { DEFAULT_WEIGHTS, type UserStory } from "@/types";
import { getOrCreateBacklogStatus } from "@/lib/utils/id-lookup";
import { anthropic } from "./shared/ai-client";
import { generateEmbedding } from "@/lib/embedding-service";
import { extractAIUsage, trackAIUsage, type AIUsageData } from "@/lib/ai-usage-tracker";
import { analyzeDependenciesCompletion } from "@/lib/ai-provider";

// Re-export type for consumers (type-only exports are allowed in "use server" files)
export type { StoryGenerationParams } from "@/types";

/**
 * TAWOS Story Generator Persona
 * Optimized for tiered RAG retrieval integration with 144,000+ real-world user stories
 */
const TAWOS_STORY_GENERATOR_PERSONA = `You are an elite Agile Product Owner and User Story Architect trained on the TAWOS (Team-Aware Work Optimization System) corpus of 144,000+ real-world user stories.

## Core Competencies
- Digital product planning with data-driven estimation
- Writing testable user stories with measurable acceptance criteria
- INVEST principles mastery (Independent, Negotiable, Valuable, Estimable, Small, Testable)
- Pattern recognition from successful sprint completions

## TAWOS Context Integration
You will receive three categories of retrieved context. Use them as follows:

### 1. SUCCESS PATTERNS (High-precision tier - similarity ≥ ${TIER_THRESHOLDS.SUCCESS_PATTERNS})
These are battle-tested patterns from stories with 85%+ completion rates.
- STRONGLY PREFER structures, acceptance criteria formats, and estimation approaches from these patterns
- Mirror the specificity level and scope boundaries
- Adopt similar story point allocations for comparable complexity

### 2. STORY TEMPLATES (Balanced tier - similarity ≥ ${TIER_THRESHOLDS.STORY_TEMPLATES})
These provide framework-diverse examples across domains.
- Use for structural inspiration and acceptance criteria coverage
- Cross-reference multiple templates to ensure comprehensive criteria
- Adapt rather than copy directly

### 3. ANTI-PATTERNS (Broad-catch tier - similarity ≥ ${TIER_THRESHOLDS.ANTI_PATTERNS})
These are failure modes to actively avoid.
- NEVER replicate patterns flagged as anti-patterns
- Check your output against each anti-pattern before finalizing
- Common failures: scope overload, vague criteria, missing edge cases, unrealistic estimates

## Confidence Calibration
Chunks arrive pre-labeled HIGH/MEDIUM/LOW by the retrieval layer based on their
similarity score. Use those labels as follows:
- HIGH (similarity ≥ ${CONFIDENCE_THRESHOLDS.high}): Follow retrieved pattern closely
- MEDIUM (similarity ≥ ${CONFIDENCE_THRESHOLDS.medium} and < ${CONFIDENCE_THRESHOLDS.high}): Use as inspiration, adapt to context
- LOW (similarity < ${CONFIDENCE_THRESHOLDS.medium}): Reference cautiously, prioritize first principles
- No relevant matches: Fall back to INVEST principles

## Output Standards
- Stories must pass the FBI Sentinel check (no requirements confusion, scope overload, missing dependencies, unrealistic estimates)
- Acceptance criteria: 3-5 criteria per story, each testable and specific
- Include Given-When-Then format OR explicit checklist format
- Always specify: happy path, error states, edge cases
- Story points must follow Fibonacci (1, 2, 3, 5, 8, 13)

## Domain-Aware Generation
When generating stories, ensure coverage appropriate to the domain:
- **Auth/Security**: Include session handling, permission boundaries, token management
- **API**: Specify request/response formats, error codes, rate limiting
- **Database**: Address data validation, migration concerns, indexing
- **UI**: Include accessibility (WCAG), responsive breakpoints, loading states
- **Integration**: Define contract boundaries, retry logic, failure modes`;

/**
 * Extract framework/domain hints from a feature description
 * Used to provide domain-specific guidance in story generation
 */
function extractFrameworkHints(description: string): string[] {
  const hints: string[] = [];
  const lowerDesc = description.toLowerCase();

  const patterns: Record<string, string[]> = {
    Auth: [
      "auth",
      "login",
      "logout",
      "signup",
      "sign up",
      "password",
      "session",
      "token",
      "oauth",
      "sso",
      "permission",
      "role",
      "access control",
      "jwt",
    ],
    API: [
      "api",
      "endpoint",
      "rest",
      "graphql",
      "webhook",
      "request",
      "response",
      "payload",
      "http",
      "fetch",
      "axios",
    ],
    DB: [
      "database",
      "query",
      "table",
      "migration",
      "index",
      "schema",
      "record",
      "crud",
      "sql",
      "postgres",
      "supabase",
      "insert",
      "update",
      "delete",
    ],
    UI: [
      "button",
      "form",
      "modal",
      "page",
      "component",
      "layout",
      "responsive",
      "mobile",
      "dashboard",
      "dropdown",
      "input",
      "navigation",
      "sidebar",
      "header",
    ],
    Security: [
      "encrypt",
      "secure",
      "audit",
      "compliance",
      "vulnerability",
      "sanitize",
      "xss",
      "csrf",
      "injection",
      "validation",
    ],
    Integration: [
      "integrate",
      "sync",
      "import",
      "export",
      "third-party",
      "external",
      "webhook",
    ],
  };

  for (const [domain, keywords] of Object.entries(patterns)) {
    if (keywords.some((kw) => lowerDesc.includes(kw))) {
      hints.push(domain);
    }
  }

  return hints;
}

/**
 * Build persona-specific context for story generation
 * Combines selected personas with framework-specific guidance
 */
function buildPersonaContext(
  selectedPersonas: Array<{
    name: string;
    role?: string | null;
    tech_savviness?: number | null;
    usage_frequency?: string | null;
    priority_level?: string | null;
    domain?: string | null;
    description?: string | null;
  }>,
  frameworkHints?: string[]
): string {
  let context = "";

  // Build persona section
  if (selectedPersonas.length > 0) {
    context += `\n## TARGET PERSONAS (${selectedPersonas.length} selected)\n`;
    context += selectedPersonas
      .map(
        (persona) => `
- **${persona.name}** (${persona.role || "User"})
  - Tech Savviness: ${persona.tech_savviness || 3}/5
  - Usage Frequency: ${persona.usage_frequency || "Regular"}
  - Priority Level: ${persona.priority_level || "Medium"}
  - Domain: ${persona.domain || "General"}
  ${persona.description ? `- **Context**: ${persona.description}` : ""}
`
      )
      .join("\n");

    context += `
### Persona-Driven Requirements
- Write acceptance criteria that match the technical level of these personas
- Consider the usage patterns when defining user flows
- Prioritize features based on the persona priority levels
`;
  }

  // Add framework-specific guidance if hints provided
  if (frameworkHints && frameworkHints.length > 0) {
    context += `\n## DOMAIN-SPECIFIC REQUIREMENTS\n`;

    const domainGuidance: Record<string, string> = {
      Auth: `**Authentication Domain:**
- Include session management edge cases
- Specify token refresh and expiration handling
- Define permission boundary testing
- Consider SSO/OAuth flow variations`,
      API: `**API Domain:**
- Specify request/response schema validation
- Include rate limiting and throttling behavior
- Define versioning and backward compatibility
- Include timeout and retry specifications`,
      DB: `**Database Domain:**
- Include data validation and constraint testing
- Specify index and query performance criteria
- Define migration rollback procedures
- Include data integrity verification`,
      UI: `**UI Domain:**
- Include WCAG 2.1 AA accessibility criteria
- Specify responsive breakpoint behavior
- Define loading, error, and empty states
- Include keyboard navigation requirements`,
      Security: `**Security Domain:**
- Include input sanitization requirements
- Specify audit logging criteria
- Define encryption at rest/in transit
- Include penetration testing scope`,
      Integration: `**Integration Domain:**
- Define API contract boundaries
- Specify retry and backoff logic
- Include failure mode handling
- Define data sync conflict resolution`,
    };

    for (const hint of frameworkHints) {
      if (domainGuidance[hint]) {
        context += domainGuidance[hint] + "\n\n";
      }
    }
  }

  return context;
}

/**
 * Extract partial stories from malformed JSON
 */
function extractPartialStories(
  jsonString: string,
  priorityWeights: PriorityWeights
): UserStory[] {
  const stories: UserStory[] = [];

  // Simple pattern matching to find story-like content
  const storyBlocks = jsonString.split(/\},\s*\{/).map((block, index) => {
    if (!block.startsWith("{")) block = "{" + block;
    if (!block.endsWith("}")) block = block + "}";
    return { block, index };
  });

  for (let i = 0; i < storyBlocks.length; i++) {
    const { block } = storyBlocks[i];

    // Extract basic fields using regex patterns
    const titleMatch = block.match(/"title"\s*:\s*"([^"]*)"/);
    const roleMatch = block.match(/"role"\s*:\s*"([^"]*)"/);
    const wantMatch = block.match(/"want"\s*:\s*"([^"]*)"/);
    const benefitMatch = block.match(/"benefit"\s*:\s*"([^"]*)"/);
    const storyPointsMatch = block.match(/"storyPoints"\s*:\s*(\d+)/);
    const priorityMatch = block.match(/"priority"\s*:\s*"([^"]*)"/);

    // Create story object with extracted or default values
    const story: UserStory = {
      id: `t${nanoid(12)}`,
      title: titleMatch ? titleMatch[1] : `Extracted Story ${i + 1}`,
      role: roleMatch ? roleMatch[1] : "User",
      want: wantMatch ? wantMatch[1] : "to complete this feature",
      benefit: benefitMatch
        ? benefitMatch[1]
        : "to achieve the desired outcome",
      acceptanceCriteria: [
        "Feature is implemented according to requirements",
        "All acceptance criteria are met",
        "Feature is tested and working correctly",
      ],
      storyPoints: storyPointsMatch ? parseInt(storyPointsMatch[1]) : 5,
      businessValue: priorityWeights.businessValue,
      userImpact: priorityWeights.userImpact,
      complexity: priorityWeights.complexity,
      risk: priorityWeights.risk,
      priority: (priorityMatch ? priorityMatch[1] : "Medium") as
        | "Low"
        | "Medium"
        | "High"
        | "Critical",
      tags: ["feature"],
      requirements: ["Implement the requested functionality"],
      estimatedTime: 8,
      description: "Extracted from malformed JSON",
      antiPatternWarnings: ["Extracted from malformed JSON"],
      successPattern: "Extraction pattern",
      completionRate: 0.7,
    };

    stories.push(story);
  }

  return stories;
}

/**
 * Generate fallback stories when JSON parsing fails
 */
function generateFallbackStories(
  params: EnhancedStoryGenerationParams,
  count: number
): UserStory[] {
  const {
    featureDescription,
    complexity = "moderate",
    priorityWeights,
  } = params;

  // Parse the feature description to extract role, want, and benefit
  const roleMatch = featureDescription.match(/As a ([^,]+)/);
  const wantMatch = featureDescription.match(/I want ([^,]+)/);
  const benefitMatch = featureDescription.match(/so that ([^,]+)/);

  const baseRole = roleMatch ? roleMatch[1].trim() : "User";
  const baseWant = wantMatch ? wantMatch[1].trim() : "to complete this feature";
  const baseBenefit = benefitMatch
    ? benefitMatch[1].trim()
    : "to achieve the desired outcome";

  const fallbackStories: UserStory[] = [];

  for (let i = 0; i < count; i++) {
    // Create variations of the base story
    const variations = [
      { role: baseRole, want: baseWant, benefit: baseBenefit },
      {
        role: `${baseRole} Manager`,
        want: `to manage ${baseWant}`,
        benefit: `to ensure ${baseBenefit}`,
      },
      {
        role: `${baseRole} Administrator`,
        want: `to configure ${baseWant}`,
        benefit: `to optimize ${baseBenefit}`,
      },
      {
        role: `${baseRole} Developer`,
        want: `to implement ${baseWant}`,
        benefit: `to deliver ${baseBenefit}`,
      },
      {
        role: `${baseRole} Tester`,
        want: `to validate ${baseWant}`,
        benefit: `to ensure quality ${baseBenefit}`,
      },
    ];

    const variation = variations[i % variations.length];

    const fallbackStory: UserStory = {
      id: `t${nanoid(12)}`,
      title: `Fallback Story ${i + 1}: ${variation.want}`,
      role: variation.role,
      want: variation.want,
      benefit: variation.benefit,
      acceptanceCriteria: [
        "Feature is implemented according to requirements",
        "All acceptance criteria are met",
        "Feature is tested and working correctly",
      ],
      storyPoints:
        complexity === "simple" ? 3 : complexity === "complex" ? 8 : 5,
      businessValue: priorityWeights?.businessValue || 25,
      userImpact: priorityWeights?.userImpact || 20,
      complexity: priorityWeights?.complexity || 20,
      risk: priorityWeights?.risk || 15,
      dependencies: [],
      priority: ["Low", "Medium", "High"][Math.floor(Math.random() * 3)] as
        | "Low"
        | "Medium"
        | "High",
      tags: ["fallback", "feature", complexity],
      requirements: [
        "Implement the requested functionality",
        "Follow coding standards",
        "Include proper error handling",
        "Add unit tests",
      ],
      estimatedTime:
        complexity === "simple" ? 4 : complexity === "complex" ? 12 : 8,
      description: `Fallback story generated due to JSON parsing error: ${featureDescription}`,
      antiPatternWarnings: [
        "Generated as fallback due to parsing error",
        "Review and refine requirements",
        "Consider edge cases",
      ],
      successPattern: "Basic implementation pattern with proper testing",
      completionRate: 0.7,
    };

    fallbackStories.push(fallbackStory);
  }

  return fallbackStories;
}

/**
 * Helper function to get tag colors
 */
function getTagColor(tagName: string): string {
  const colorMap: Record<string, string> = {
    "ai-generated": "#8b5cf6",
    "user-story": "#10b981",
    high: "#f59e0b",
    medium: "#3B82F6",
    low: "#10b981",
    critical: "#ef4444",
  };
  return colorMap[tagName] || "#6b7280";
}

/**
 * Generate relevant tags based on story content
 */
function generateStoryTags(story: UserStory): string[] {
  const tags = new Set<string>();

  // Extract keywords from title, role, want, and benefit sections
  const textToAnalyze = [
    story.title,
    story.role,
    story.want,
    story.benefit,
    ...story.acceptanceCriteria,
  ]
    .join(" ")
    .toLowerCase();

  // Enhanced domain areas and features for better team assignment
  const domainAreas = {
    // User Interface
    ui: [
      "ui",
      "interface",
      "design",
      "layout",
      "responsive",
      "mobile",
      "desktop",
      "theme",
      "style",
    ],

    // User Experience
    ux: [
      "ux",
      "experience",
      "usability",
      "accessibility",
      "a11y",
      "workflow",
      "journey",
    ],

    // Development Areas
    frontend: [
      "frontend",
      "front-end",
      "client",
      "browser",
      "spa",
      "react",
      "vue",
      "angular",
      "javascript",
      "typescript",
      "css",
      "html",
      "web",
    ],
    backend: [
      "backend",
      "back-end",
      "server",
      "api",
      "database",
      "storage",
      "cache",
      "java",
      "spring",
      "node.js",
      "python",
      "c#",
      "microservices",
    ],
    ai: [
      "ai",
      "artificial intelligence",
      "ml",
      "machine learning",
      "deep learning",
      "neural networks",
      "tensorflow",
      "pytorch",
      "ai/ml",
      "python",
    ],
    deploy: [
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

    // Features
    auth: [
      "authentication",
      "authorization",
      "login",
      "signup",
      "password",
      "oauth",
    ],
    data: [
      "data",
      "database",
      "storage",
      "crud",
      "sync",
      "backup",
      "import",
      "export",
    ],
    integration: [
      "integration",
      "api",
      "webhook",
      "sync",
      "connect",
      "third-party",
    ],
    security: ["security", "encryption", "protection", "privacy", "compliance"],

    // User Types
    roles: [
      "admin",
      "user",
      "customer",
      "manager",
      "developer",
      "moderator",
      "editor",
    ],

    // Common Features
    common: [
      "search",
      "filter",
      "sort",
      "notification",
      "report",
      "dashboard",
      "analytics",
      "settings",
    ],
  };

  // Analyze text for each domain area
  for (const [domain, keywords] of Object.entries(domainAreas)) {
    for (const keyword of keywords) {
      if (textToAnalyze.includes(keyword)) {
        // For some domains, use the keyword itself as the tag
        if (["roles", "common"].includes(domain)) {
          tags.add(keyword);
        } else {
          // For technical domains, use the domain as the tag
          tags.add(domain);
        }
        break; // Break after finding first match in this domain
      }
    }
  }

  // Extract specific feature names (words following "implement", "add", "create", "enable", "support")
  const featureRegex =
    /(?:implement|add|create|enable|support)\s+([a-z0-9-]+(?:\s+[a-z0-9-]+){0,2})/g;
  let match;
  while ((match = featureRegex.exec(textToAnalyze)) !== null) {
    const feature = match[1].trim().replace(/\s+/g, "-");
    if (feature.length > 3) {
      // Only add if feature name is meaningful
      tags.add(feature);
    }
  }

  return Array.from(tags);
}

/**
 * Generate user stories using TAWOS approach with Supabase vector data
 */
export async function generateTAWOSStories(
  params: EnhancedStoryGenerationParams & {
    onProgress?: (percent: number, message: string) => Promise<void>;
  }
): Promise<{
  stories: UserStory[];
  error?: string;
  aiUsage?: AIUsageData;
  ragEmpty?: boolean;
  ragDiagnostics?: {
    reason: "outer_catch" | "empty_retrieval";
    retrievedChunkCount: number;
  };
}> {
  // Minimum stories to return — used only as a floor when the AI returns fewer
  // than this, never to pad up to a hardcoded count. The prompt instructs the
  // model to choose the count based on feature complexity; padding below MIN_STORIES
  // is a first-sprint safety net.
  const MIN_STORIES = 3;

  try {
    const {
      featureDescription,
      complexity = "moderate",
      priorityWeights = DEFAULT_WEIGHTS,
      teamMembers = [],
      selectedPersonas = [],
      antiPatternPrevention = true,
      workspaceId,
      useTAWOS = true,
      onProgress,
    } = params;

    // Track timing for analytics
    const startTime = Date.now();

    // Extract framework hints for domain-specific guidance
    const frameworkHints = extractFrameworkHints(featureDescription);

    // Context is already baked into featureDescription by the API route
    const enrichedFeatureDescription = featureDescription;
    const hasProcessedContext = featureDescription.includes('<context>');

    // Tiered TAWOS RAG retrieval
    let ragContext = "";
    let retrievedChunks: Array<{ id: string; similarity: number; metadata: Record<string, unknown> }> = [];
    let storyTemplates: Array<{ id: string; similarity: number; metadata: Record<string, unknown> }> = [];
    let ragEmptyReason: "outer_catch" | "empty_retrieval" | null = null;

    if (useTAWOS) {
      await onProgress?.(10, "Retrieving TAWOS patterns...");
      console.info("[TAWOS] Entering retrieval path", {
        workspaceId,
        workspaceIdType: typeof workspaceId,
        featureLength: featureDescription.length,
        voyageKey: !!process.env.VOYAGE_API_KEY,
      });
      try {
        const {
          getHighPrecisionSuccessPatterns,
          getBalancedRetrieval,
          getAntiPatternsAndRisks,
        } = await import("@/lib/tiered-retrieval-service");

        // Parallel tiered retrieval. Surface per-tier errors — silent catches
        // here are why TAWOS retrieval failures went undiagnosed for ~2 months.
        const logTierFailure = (tier: string) => (err: unknown) => {
          console.warn(`[TAWOS] ${tier} retrieval failed`, {
            workspaceId,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
          return { results: [] };
        };
        const [successPatternsResult, storyTemplatesResult, antiPatternResults] = await Promise.all([
          getHighPrecisionSuccessPatterns(featureDescription, 5, workspaceId).catch(logTierFailure("success_patterns")),
          getBalancedRetrieval(featureDescription, 10, workspaceId).catch(logTierFailure("story_templates")),
          getAntiPatternsAndRisks(featureDescription, 10, workspaceId).catch(logTierFailure("anti_patterns")),
        ]);

        // Extract results arrays
        const successPatterns = successPatternsResult.results || [];
        storyTemplates = storyTemplatesResult.results || [];
        const antiPatterns = antiPatternResults.results || [];

        // Collect all chunks for analytics
        retrievedChunks = [
          ...successPatterns,
          ...storyTemplates,
          ...antiPatterns,
        ].map((r) => ({ id: r.id, similarity: r.similarity, metadata: r.metadata }));

        // Build structured RAG context
        ragContext = buildTieredRAGContext(
          successPatterns,
          storyTemplates,
          antiPatterns,
          {
            maxTokensBudget: 4000,
            prioritizeFrameworks: frameworkHints,
            deduplicateByTitle: true,
          }
        );
      } catch (error) {
        console.error("[TAWOS] Retrieval error, continuing without RAG context", {
          workspaceId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        ragContext = "";
        ragEmptyReason = "outer_catch";
      }
      if (useTAWOS && ragContext.trim().length === 0 && ragEmptyReason === null) {
        ragEmptyReason = "empty_retrieval";
      }
      await onProgress?.(35, "TAWOS patterns retrieved");
    }

    // Build persona context using helper function
    const personaContext = buildPersonaContext(selectedPersonas, frameworkHints);

    const teamContext =
      teamMembers.length > 0
        ? `
    Team composition:
    ${teamMembers
      .map((m) => `- ${m.name} (${m.role}, ${m.level}): ${m.skills.join(", ")}`)
      .join("\n")}

    Consider team member skills and levels when assigning stories and estimating complexity.
    `
        : "";

    // Enhanced anti-pattern prevention context
    const antiPatternContext = antiPatternPrevention
      ? `
    ANTI-PATTERN PREVENTION INTELLIGENCE (ENABLED):
    The following failure patterns have been identified from failed projects and must be avoided:

    1. REQUIREMENTS CONFUSION:
       - Vague acceptance criteria (avoid words like "maybe", "possibly", "nice to have")
       - Unclear success metrics
       - Missing edge cases
       - SOLUTION: Use specific, measurable, achievable criteria

    2. SCOPE OVERLOAD:
       - Too many features in one story
       - Multiple user roles in single story
       - Complex dependencies not broken down
       - SOLUTION: Break into smaller, focused stories

    3. STAKEHOLDER MISALIGNMENT:
       - Technical stories without business value
       - Missing user perspective
       - Unclear communication requirements
       - SOLUTION: Ensure each story has clear business/user benefit

    4. COMPLEXITY MISMATCH:
       - Stories too complex for target persona tech level
       - Technical jargon for non-technical users
       - Missing user guidance for complex features
       - SOLUTION: Adjust language and complexity to persona tech-savviness

    5. DEPENDENCY BLINDNESS:
       - Missing prerequisite stories
       - Unrealistic sequencing
       - Hidden technical dependencies
       - SOLUTION: Identify and document all dependencies

    FAILURE PREVENTION STRATEGIES:
    - For Beginner/Novice personas: Focus on guided workflows, clear instructions, error prevention
    - For Intermediate personas: Balance automation with user control, provide options
    - For Advanced/Expert personas: Enable customization, advanced features, integration capabilities
    `
      : "";

    // Add context-aware instructions when context is present
    const contextInstructions = hasProcessedContext ? getContextAwareInstructions() : "";

    const prompt = `${TAWOS_STORY_GENERATOR_PERSONA}

${personaContext}

---

${ragContext}

---

## Feature Request
${enrichedFeatureDescription}

## Generation Requirements
- Complexity: ${complexity}

## Story Count Guidance
Determine how many user stories this feature requires based on its complexity and risk.
Use these guidelines — never pad or truncate to hit a number:
- Simple feature (low complexity, low risk): 1–3 stories
- Moderate feature: 3–6 stories
- Complex feature (high complexity or high risk): 6–12 stories
If the feature scope exceeds 12 stories, generate the
top 8 highest-priority stories and recommend the user split the feature into smaller chunks.
${teamMembers && teamMembers.length > 0 ? `- Team members available: ${teamMembers.length}` : ""}

${teamContext}

${antiPatternContext}

${contextInstructions}

## Priority Weights
- Business Value (${priorityWeights.businessValue}%): Impact on business goals and revenue
- User Impact (${priorityWeights.userImpact}%): Effect on user experience and satisfaction
- Complexity (${priorityWeights.complexity}%): Technical difficulty and implementation effort
- Risk (${priorityWeights.risk}%): Potential issues and uncertainties
- Dependencies (${priorityWeights.dependencies}%): Reliance on other components or systems

## Output Format
IMPORTANT: Return ONLY a valid JSON array. Do not include any explanations, markdown formatting, or text outside the JSON array.

CRITICAL JSON FORMATTING REQUIREMENTS:
- Return ONLY a valid JSON array of stories
- Do not include any explanations, markdown formatting, or text outside the JSON array
- Ensure all strings are properly quoted and escaped
- No trailing commas in objects or arrays
- All arrays and objects must be properly closed
- Use simple quotes and avoid special characters that could break JSON
- Every property name must be in double quotes
- Every string value must be in double quotes
- Escape any quotes within string values with backslash

Return the results as a JSON array with the following structure for each story:
[
  {
    "title": "Concise story title",
    "priority": "High",
    "storyPoints": 5,
    "estimatedTime": 16,
    "role": "specific user role",
    "want": "specific capability or feature",
    "benefit": "clear business or user benefit",
    "description": "detailed description of the story",
    "acceptanceCriteria": ["specific, measurable criterion 1", "criterion 2", "criterion 3"],
    "requirements": ["specific requirement 1", "requirement 2"],
    "antiPatternWarnings": ["warning 1", "warning 2"],
    "tags": ["technical tag 1", "technical tag 2"],
    "successPattern": "success pattern this story follows",
    "completionRate": 0.85,
    "businessValue": 4,
    "personaAdjusted": true,
    "failurePrevention": "specific prevention strategy"
  }
]

Ensure all JSON is properly formatted with no trailing commas and all strings are properly escaped.
`;

    await onProgress?.(40, "Generating stories with AI...");

    // Validate API key exists before making the call
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[Story Generation] ANTHROPIC_API_KEY is not set!");
      throw new Error("AI service configuration error. Please contact support.");
    }

    // Add timeout wrapper to prevent indefinite hangs
    const timeoutMs = 180000; // 180 seconds (stays under the heavy worker's 300s maxDuration with ≥60s headroom for response handling)
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error(`[Story Generation] Anthropic call timed out after ${timeoutMs}ms`);
      abortController.abort();
    }, timeoutMs);

    // 8000 tokens covers up to ~12 stories (the upper bound in the prompt's
    // complexity-aware guidance) at ~600 tokens/story amortized.
    const modelId = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
    const maxTokens = 8000;

    let message;
    try {
      message = await anthropic.messages.create(
        {
          model: modelId,
          max_tokens: maxTokens,
          temperature: 0.7,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        },
        {
          signal: abortController.signal,
        }
      );
    } catch (apiError: unknown) {
      clearTimeout(timeoutId);
      const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
      console.error(`[Story Generation] Anthropic API error:`, errorMessage);
      console.error(`[Story Generation] Full error:`, apiError);
      if (errorMessage.includes("aborted") || errorMessage.includes("abort")) {
        throw new Error(
          `Story generation timed out after ${timeoutMs / 1000} seconds. The feature may be too complex — try splitting it into smaller scope and regenerating.`
        );
      }
      throw new Error(`AI service error: ${errorMessage}`);
    }
    clearTimeout(timeoutId);
    await onProgress?.(85, "AI generation complete, enriching stories...");

    const aiUsage = extractAIUsage(message);

    // Log truncation loudly so we can monitor it, but do NOT throw — the
    // downstream JSON parser already extracts partial stories and fills with
    // fallbacks, which is a better user experience than a hard failure.
    if (message.stop_reason === "max_tokens") {
      console.error("[Story Generation] Response truncated by max_tokens — continuing with partial/fallback recovery", {
        maxTokensBudget: maxTokens,
        outputTokens: aiUsage?.outputTokens,
        inputTokens: aiUsage?.inputTokens,
        model: modelId,
      });
    }

    const textContent = message.content[0];
    if (textContent.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const text = textContent.text;

    // Parse the JSON response with robust error handling
    let stories: UserStory[] = [];

    try {
      // Try to extract JSON array from the response
      const jsonMatch = text.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const jsonString = jsonMatch[0];

        // Try multiple parsing strategies
        const parsingStrategies = [
          // Strategy 1: Direct parsing
          () => JSON.parse(jsonString),

          // Strategy 2: Basic cleaning
          () =>
            JSON.parse(
              jsonString
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
                .replace(/\\"/g, '"')
                .replace(/\\n/g, " ")
                .replace(/\\t/g, " ")
                .replace(/\s+/g, " ")
                .replace(/,\s*([}\]])/g, "$1")
                .trim()
            ),

          // Strategy 3: Aggressive cleaning
          () => {
            let cleaned = jsonString
              .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
              .replace(/\\"/g, '"')
              .replace(/\\n/g, " ")
              .replace(/\\t/g, " ")
              .replace(/\s+/g, " ")
              .replace(/,\s*([}\]])/g, "$1")
              .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
              .replace(
                /:\s*([a-zA-Z][a-zA-Z0-9\s\-_.,!?()]*[a-zA-Z0-9])\s*([,}])/g,
                ':"$1"$2'
              )
              .replace(/:\s*\[([^\]]*)\]/g, (match, content) => {
                const items = content.split(",").map((item: string) => {
                  const trimmed = item.trim();
                  if (trimmed.startsWith('"') && trimmed.endsWith('"'))
                    return trimmed;
                  if (trimmed.startsWith("'") && trimmed.endsWith("'"))
                    return `"${trimmed.slice(1, -1)}"`;
                  if (!trimmed.startsWith('"') && trimmed.length > 0)
                    return `"${trimmed}"`;
                  return trimmed;
                });
                return `:[${items.join(",")}]`;
              })
              .trim();

            // Fix quote balance
            const quoteCount = (cleaned.match(/"/g) || []).length;
            if (quoteCount % 2 !== 0) {
              cleaned += '"';
            }

            return JSON.parse(cleaned);
          },
        ];

        let parsedSuccessfully = false;

        for (let i = 0; i < parsingStrategies.length; i++) {
          try {
            const result = parsingStrategies[i]();
            if (Array.isArray(result)) {
              stories = result;
              parsedSuccessfully = true;
              break;
            }
          } catch {
            // Try next strategy
          }
        }

        if (!parsedSuccessfully) {
          // Manual extraction as last resort
          const extractedStories = extractPartialStories(
            jsonString,
            params.priorityWeights || {
              businessValue: priorityWeights.businessValue,
              userImpact: priorityWeights.userImpact,
              complexity: priorityWeights.complexity,
              risk: priorityWeights.risk,
              dependencies: priorityWeights.dependencies,
            }
          );
          if (extractedStories.length > 0) {
            stories = extractedStories;
          }
        }
      }

      // If we still don't have stories, generate fallback stories
      if (stories.length === 0) {
        console.warn("[Story Generation] Fallback fired: full-replacement", {
          reason: "parse_failure_empty_result",
          floor: MIN_STORIES,
          stopReason: message.stop_reason,
          outputTokens: aiUsage?.outputTokens,
          maxTokensBudget: maxTokens,
          responseLength: text.length,
          responsePreview: text.slice(0, 500),
        });
        stories = generateFallbackStories(params, MIN_STORIES);
      }
      // Safety floor: if AI returned fewer than MIN_STORIES, top up.
      // Do NOT pad toward any user-specified target — count is AI-determined
      // from the complexity/risk guidance in the prompt. This branch only fires
      // when the AI returned 1 or 2 stories for a feature that warranted at least 3.
      if (stories.length < MIN_STORIES) {
        const needed = MIN_STORIES - stories.length;
        console.warn("[Story Generation] Fallback fired: min-floor-fill", {
          reason: "below_min_stories_floor",
          floor: MIN_STORIES,
          parsed: stories.length,
          fallbackCount: needed,
          stopReason: message.stop_reason,
          outputTokens: aiUsage?.outputTokens,
          maxTokensBudget: maxTokens,
        });
        const additionalStories = generateFallbackStories(params, needed);
        stories.push(...additionalStories);
      }

      // Set priority weight values for all stories (overriding AI-generated 1-5 scores)
      stories = stories.map((story) => ({
        ...story,
        businessValue: priorityWeights.businessValue,
        userImpact: priorityWeights.userImpact,
        complexity: priorityWeights.complexity,
        risk: priorityWeights.risk,
        // Don't override dependencies field as it should remain string[]
      }));

      // PHASE_5_NOOP: was multi-user team-assignment enrichment, OSS is single-user
      const enhancedStories: UserStory[] = stories.map((story) => {
        const { id, ...storyWithoutId } = story;
        return {
          id: `t${nanoid(12)}`,
          ...storyWithoutId,
        };
      });

      // TAWOS retrieval metrics are already logged by each individual tier call
      // (getHighPrecisionSuccessPatterns, getBalancedRetrieval, getAntiPatternsAndRisks)

      const ragEmpty = useTAWOS && ragContext.trim().length === 0;
      return {
        stories: enhancedStories,
        aiUsage,
        ragEmpty,
        ...(ragEmpty && ragEmptyReason && {
          ragDiagnostics: {
            reason: ragEmptyReason,
            retrievedChunkCount: retrievedChunks.length,
          },
        }),
      };
    } catch (parseError: unknown) {
      console.error("Error parsing AI response:", parseError);

      // TAWOS retrieval metrics already logged by individual tier calls above

      const ragEmpty = useTAWOS && ragContext.trim().length === 0;
      return {
        stories: [],
        error: "Failed to parse AI response. Please try again.",
        ragEmpty,
        ...(ragEmpty && ragEmptyReason && {
          ragDiagnostics: {
            reason: ragEmptyReason,
            retrievedChunkCount: retrievedChunks.length,
          },
        }),
      };
    }
  } catch (error: unknown) {
    console.error("Error in generateTAWOSStories:", error);
    return {
      stories: [],
      error: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Save a generated user story to the database
 */
export async function saveUserStory(
  story: UserStory,
  workspaceId: string,
  spaceId: string,
  projectId: string
): Promise<{ success: boolean; error?: string; taskId?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    // Get workspace UUID first
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("workspace_id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      console.error("Workspace not found:", workspaceError);
      return { success: false, error: "Workspace not found" };
    }

    // Get the project's internal UUID and space_id
    const { data: projectInfo, error: projectInfoError } = await supabase
      .from("projects")
      .select("id, space_id")
      .eq("project_id", projectId)
      .eq("workspace_id", workspace.id)
      .single();

    if (projectInfoError || !projectInfo) {
      console.error("Failed to get project info:", projectInfoError);
      return { success: false, error: "Project not found" };
    }

    if (!projectInfo.space_id) {
      console.error("Project has no space_id");
      return { success: false, error: "Project has no associated space" };
    }

    // Use Backlog status for AI-generated stories
    const backlogContext = await getOrCreateBacklogStatus(
      supabase,
      projectInfo.space_id,
      workspace.id
    );

    if (!backlogContext) {
      console.error("Failed to get or create Backlog status for space_id:", projectInfo.space_id);
      return { success: false, error: "Could not find or create Backlog status for this space" };
    }

    const statusId = backlogContext.statusUUID;

    // Get the current user
    const { user } = await getAuthUser(supabase);
    if (!user) {
      console.error("User not authenticated");
      return { success: false, error: "User not authenticated" };
    }

    // Format the acceptance criteria as a markdown list
    const formattedAcceptanceCriteria = story.acceptanceCriteria
      .map((criterion) => `- ${criterion}`)
      .join("\n");

    // Create the description with the full user story and acceptance criteria
    const description = `
## User Story
As a ${story.role}, I want ${story.want}, so that ${story.benefit}.

## Acceptance Criteria
${formattedAcceptanceCriteria}

## Metadata
- Story Points: ${story.storyPoints ? Math.round(story.storyPoints) : "Not estimated"}
- Priority: ${story.priority || "Not specified"}
    `.trim();

    // Build embedding input string
    const embeddingInput = [
      story.title,
      description,
      story.businessValue !== undefined ? `Business Value: ${story.businessValue}` : "",
      story.estimatedTime !== undefined ? `Estimated Time: ${story.estimatedTime}` : "",
      story.storyPoints !== undefined ? `Story Points: ${story.storyPoints}` : "",
      story.antiPatternWarnings ? story.antiPatternWarnings.join("; ") : "",
      story.requirements ? story.requirements.join("; ") : "",
      story.tags ? story.tags.join(", ") : "",
      story.risk !== undefined ? `Risk: ${story.risk}` : "",
      story.dependencies ? story.dependencies.join(", ") : "",
      story.complexity !== undefined ? `Complexity: ${story.complexity}` : "",
      story.priority ? `Priority: ${story.priority}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    let embedding: number[] | null = null;
    try {
      const embeddingResult = await generateEmbedding(embeddingInput);
      embedding = embeddingResult?.embedding ?? null;
    } catch {
      // Continue without embedding
    }

    // Insert the story as a task — task_id uses DB default
    const { data: savedTask, error } = await supabase.from("tasks").insert({
      name: story.title,
      description,
      status_id: statusId,
      priority: story.priority?.toLowerCase() || "medium",
      project_id: projectInfo.id,
      space_id: projectInfo.space_id,
      velocity: story.velocity,
      workspace_id: workspace.id,
      created_by: user.id,
      assignee_id: null,
      generated_by_ai: true,
    }).select("id, task_id").single();

    if (error) {
      console.error("Error saving user story:", error);
      return { success: false, error: error.message };
    }

    // Insert AI metadata (embedding) into separate table
    if (savedTask) {
      const { error: metaError } = await supabase
        .from("task_ai_metadata")
        .insert({
          task_id: savedTask.id,
          embedding: Array.isArray(embedding) ? JSON.stringify(embedding) : null,
        });

      if (metaError) {
        console.error("Error saving task AI metadata:", metaError);
      }
    }

    // Revalidate the project page to show the new task
    revalidatePath(`/${workspaceId}/space/${spaceId}/project/${projectId}`);

    return { success: true, taskId: savedTask?.task_id };
  } catch (error) {
    console.error("=== saveUserStory ERROR ===", error);
    return {
      success: false,
      error: "An error occurred while saving the story. Please try again.",
    };
  }
}

/**
 * Save a user story to a specific destination (project or sprint)
 */
export async function saveUserStoryToDestination(
  story: UserStory,
  workspaceId: string,
  destination: {
    type: "existing" | "new";
    spaceId?: string;
    projectId?: string;
    spaceName?: string;
    projectName?: string;
    statusNames?: string[];
    sprintId?: string;
    statusId?: string;
  },
  priorityWeights?: PriorityWeights
): Promise<{ success: boolean; error?: string; taskId?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    // Get workspace UUID
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("workspace_id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      console.error("Workspace not found:", workspaceError);
      return { success: false, error: "Workspace not found" };
    }

    // Get current user
    const { user } = await getAuthUser(supabase);
    if (!user) {
      console.error("User not authenticated");
      return { success: false, error: "User not authenticated" };
    }

    // CRITICAL FIX: Ensure user has a profile record
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!existingProfile) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: user.id,
        email: user.email || "",
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
        role: "user",
      });

      if (profileError) {
        console.error("Failed to create profile:", profileError);
        return {
          success: false,
          error: "Unable to create user profile. Please contact support.",
        };
      }
    }

    let spaceId: string;
    let projectId: string;
    let statusId: string;

    // Handle existing space/project
    if (!destination.sprintId && (!destination.spaceId || !destination.projectId)) {
      console.error("Missing required parameters for existing destination");
      return {
        success: false,
        error: "Space ID and project ID are required for existing destinations",
      };
    }

    // For sprint mode, we only need spaceId and sprintId
    if (destination.sprintId) {
      if (!destination.spaceId) {
        console.error("Space ID required for sprint destinations");
        return {
          success: false,
          error: "Space ID is required for sprint destinations",
        };
      }
      spaceId = destination.spaceId;
      projectId = "";
    } else {
      if (!destination.spaceId || !destination.projectId) {
        console.error("Missing spaceId or projectId for project destinations");
        return {
          success: false,
          error: "Space ID and project ID are required for project destinations",
        };
      }
      spaceId = destination.spaceId;
      projectId = destination.projectId;
    }

    // Find a status for this project or sprint
    if (destination.sprintId) {
      if (destination.statusId) {
        statusId = destination.statusId;
      } else {
        console.error("Status ID required for sprint destinations");
        return {
          success: false,
          error: "Status ID is required for sprint destinations.",
        };
      }
    } else {
      const backlogContext = await getOrCreateBacklogStatus(supabase, spaceId, workspace.id);

      if (backlogContext) {
        statusId = backlogContext.statusUUID;
      } else {
        console.error("Failed to get or create Backlog status for space_id:", spaceId);
        return {
          success: false,
          error: "Could not find or create Backlog status for this space.",
        };
      }
    }

    // Format the acceptance criteria as a markdown list
    const formattedAcceptanceCriteria = story.acceptanceCriteria
      .map((criterion) => `- ${criterion}`)
      .join("\n");

    // Format requirements if they exist
    const formattedRequirements =
      story.requirements && story.requirements.length > 0
        ? story.requirements.map((req) => `- ${req}`).join("\n")
        : "None specified";

    // Format anti-pattern warnings if they exist
    const formattedAntiPatterns =
      story.antiPatternWarnings && story.antiPatternWarnings.length > 0
        ? story.antiPatternWarnings.map((warning) => `- ⚠️ ${warning}`).join("\n")
        : "None detected";

    // Create enhanced description with all TAWOS metadata
    const description = `
      ## User Story
      As a **${story.role}**, I want **${story.want}**, so that **${story.benefit}**.

      ## Acceptance Criteria
      ${formattedAcceptanceCriteria}

      ## Story Details
      - **Story Points**: ${story.storyPoints ? Math.round(story.storyPoints) : "Not estimated"}
      - **Business Value Weight**: ${story.businessValue ? Math.round(story.businessValue) : "Not specified"}%
      - **User Impact Weight**: ${story.userImpact ? Math.round(story.userImpact) : "Not specified"}%
      - **Complexity Weight**: ${story.complexity ? Math.round(story.complexity) : "Not specified"}%
      - **Risk Weight**: ${story.risk ? Math.round(story.risk) : "Not specified"}%
      - **Dependencies**: ${story.dependencies && story.dependencies.length > 0 ? story.dependencies.join(", ") : "None specified"}
      - **Priority**: ${story.priority || "Medium"}
      - **Estimated Time**: ${story.estimatedTime ? `${Math.round(story.estimatedTime)} hours` : "Not estimated"}
      - **Success Pattern**: ${story.successPattern || "Not specified"}
      - **Completion Rate**: ${story.completionRate ? `${Math.round(story.completionRate * 100)}%` : "Not specified"}
      - **Velocity**: ${story.velocity ? `${Math.round(story.velocity)} points/sprint` : "Not specified"}

      ## Requirements
      ${formattedRequirements}

      ## Anti-Pattern Warnings
      ${formattedAntiPatterns}
    `.trim();

    // Generate tags for the story
    const storyTags = generateStoryTags(story);

    // Build embedding input string
    const embeddingInput = [
      story.title,
      description,
      story.businessValue !== undefined ? `Business Value: ${story.businessValue}` : "",
      story.estimatedTime !== undefined ? `Estimated Time: ${story.estimatedTime}` : "",
      story.storyPoints !== undefined ? `Story Points: ${story.storyPoints}` : "",
      story.antiPatternWarnings ? story.antiPatternWarnings.join("; ") : "",
      story.requirements ? story.requirements.join("; ") : "",
      story.tags ? story.tags.join(", ") : "",
      story.risk !== undefined ? `Risk: ${story.risk}` : "",
      story.dependencies ? story.dependencies.join(", ") : "",
      story.complexity !== undefined ? `Complexity: ${story.complexity}` : "",
      story.priority ? `Priority: ${story.priority}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    let embedding: number[] | null = null;
    try {
      const embeddingResult = await generateEmbedding(embeddingInput);
      embedding = embeddingResult?.embedding ?? null;
    } catch {
      // Continue without embedding
    }

    // Prepare external data for TAWOS metadata
    const externalData = {
      tawos: {
        storyPoints: story.storyPoints,
        businessValue: priorityWeights?.businessValue || story.businessValue,
        userImpact: priorityWeights?.userImpact || story.userImpact,
        complexity: priorityWeights?.complexity || story.complexity,
        risk: priorityWeights?.risk || story.risk,
        dependencies: priorityWeights?.dependencies || story.dependencies,
        estimatedTime: story.estimatedTime,
        successPattern: story.successPattern,
        completionRate: story.completionRate,
        velocity: story.velocity,
        antiPatternWarnings: story.antiPatternWarnings,
        requirements: story.requirements,
        tags: story.tags,
        assignedTeamMember: story.assignedTeamMember
          ? {
              name: story.assignedTeamMember.name,
              role: story.assignedTeamMember.role,
              level: story.assignedTeamMember.level,
              skills: story.assignedTeamMember.skills,
              availability: story.assignedTeamMember.availability,
            }
          : null,
        suggestedDependencies: story.suggestedDependencies,
        childTaskIds: story.childTaskIds,
        parentTaskId: story.parentTaskId,
        role: story.role,
        want: story.want,
        benefit: story.benefit,
        acceptanceCriteria: story.acceptanceCriteria,
      },
      generatedAt: new Date().toISOString(),
      aiGenerated: true,
      version: "1.0",
    };

    // Insert the story as a task — task_id uses DB default
    const { data: insertedTask, error: taskError } = await supabase
      .from("tasks")
      .insert({
        name: story.title,
        description,
        status_id: destination.statusId || statusId,
        priority: story.priority?.toLowerCase() || "medium",
        project_id: destination.sprintId ? null : projectId,
        space_id: spaceId,
        estimated_time: story.estimatedTime ? Math.round(story.estimatedTime) : null,
        story_points: story.storyPoints ? Math.round(story.storyPoints) : null,
        business_value: priorityWeights?.businessValue || story.businessValue || null,
        user_impact: priorityWeights?.userImpact,
        complexity: priorityWeights?.complexity,
        risk: priorityWeights?.risk,
        dependency_score: story.dependencyScore,
        velocity: story.velocity ? Math.round(story.velocity) : null,
        assignee_id: null,
        workspace_id: workspace.id,
        created_by: user.id,
        type: "ai-generated",
        sprint_id: destination.sprintId || null,
        generated_by_ai: true,
      })
      .select("id, task_id")
      .single();

    if (taskError) {
      console.error("Error saving user story:", taskError);
      console.error("Full error object:", JSON.stringify(taskError, null, 2));
      return { success: false, error: taskError.message };
    }

    // Insert AI metadata (embedding, generation metadata) into separate table
    if (insertedTask) {
      const { error: metaError } = await supabase
        .from("task_ai_metadata")
        .insert({
          task_id: insertedTask.id,
          embedding: Array.isArray(embedding) ? JSON.stringify(embedding) : null,
        });

      if (metaError) {
        console.error("Error saving task AI metadata:", metaError);
      }
    }

    // Handle parent-child relationships after task creation
    if (story.parentTaskId) {
      const { data: parentTask } = await supabase
        .from("tasks")
        .select("id")
        .eq("task_id", story.parentTaskId)
        .single();

      if (parentTask) {
        const { error: updateError } = await supabase
          .from("tasks")
          .update({ parent_task_id: parentTask.id })
          .eq("id", insertedTask.id);

        if (updateError) {
          console.error("Error updating parent task relationship:", updateError);
        }
      }
    }

    // If this story has child stories, update their parent_task_id
    if (story.childTaskIds && story.childTaskIds.length > 0) {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ parent_task_id: insertedTask.id })
        .in("task_id", story.childTaskIds);

      if (updateError) {
        console.error("Error updating child tasks:", updateError);
      }
    }

    // Create tags for the task (batch — resolves all tags in 2-3 queries instead of N×3)
    if (storyTags.length > 0) {
      // 1. Batch fetch existing tags
      const { data: existingTags } = await supabase
        .from("tags")
        .select("id, name")
        .eq("workspace_id", workspace.id)
        .in("name", storyTags)
        .is("deleted_at", null);

      const tagIdMap = new Map<string, string>();
      for (const tag of existingTags || []) {
        tagIdMap.set(tag.name, tag.id);
      }

      // 2. Batch create missing tags
      const missingTags = storyTags.filter((name) => !tagIdMap.has(name));
      if (missingTags.length > 0) {
        const { data: newTags } = await supabase
          .from("tags")
          .insert(missingTags.map((name) => ({
            name,
            color: getTagColor(name),
            workspace_id: workspace.id,
          })))
          .select("id, name");

        for (const tag of newTags || []) {
          tagIdMap.set(tag.name, tag.id);
        }
      }

      // 3. Batch insert task_tags
      const taskTagInserts = storyTags
        .map((name) => tagIdMap.get(name))
        .filter((id): id is string => !!id)
        .map((tagId) => ({ task_id: insertedTask.id, tag_id: tagId }));

      if (taskTagInserts.length > 0) {
        await supabase.from("task_tags").insert(taskTagInserts);
      }
    }

    // Revalidate the project page to show the new task
    const revalidatePathString = `/${workspaceId}/space/${spaceId}/project/${projectId}`;
    revalidatePath(revalidatePathString);

    return { success: true, taskId: insertedTask.task_id };
  } catch (error) {
    console.error("=== saveUserStoryToDestination ERROR ===", error);
    console.error("Full error object:", JSON.stringify(error, null, 2));
    return {
      success: false,
      error: "An error occurred while saving the story. Please try again.",
    };
  }
}

/**
 * Analyze story content and suggest dependencies
 *
 * @deprecated Use the `processStoryDependencyAnalysis` worker function via
 * the `ai-fast` queue instead. This function blocks the UI. Kept for backwards
 * compatibility during rollout (US-017).
 */
export async function analyzeStoryDependencies(stories: UserStory[]): Promise<{
  suggestions: {
    storyId: string;
    suggestedDependencies: {
      taskId: string;
      reason: string;
      confidence: number;
    }[];
  }[];
  error?: string;
}> {
  try {
    // Support both CLAUDE_API_KEY and ANTHROPIC_API_KEY
    if (!process.env.CLAUDE_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      return {
        suggestions: [],
        error: "Claude API key is not configured. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY.",
      };
    }

    const prompt = `
      Analyze these user stories and suggest logical dependencies between them.
      Consider:
      1. Prerequisites (e.g., authentication before accessing features)
      2. Sequential dependencies (e.g., setup before configuration)
      3. Common patterns (e.g., data model before CRUD operations)
      4. Technical dependencies (e.g., API endpoints before UI implementation)

      For each story, suggest other stories that should be completed first.
      Provide a confidence score (0-1) and a clear reason for each suggestion.

      Stories to analyze:
      ${stories
        .map(
          (story) => `
        ID: ${story.id}
        Title: ${story.title}
        Role: ${story.role}
        Want: ${story.want}
        Benefit: ${story.benefit}
        Acceptance Criteria:
        ${story.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}
      `
        )
        .join("\n")}

      Return ONLY a valid JSON array with this exact structure, without any markdown formatting or additional text:
      [
        {
          "storyId": "story_id",
          "suggestedDependencies": [
            {
              "taskId": "dependent_story_id",
              "reason": "Clear explanation of why this dependency exists",
              "confidence": 0.95
            }
          ]
        }
      ]
    `;

    // Use AI provider routing - COMPLEX task (always Claude for dependency analysis)
    const aiResult = await analyzeDependenciesCompletion(prompt, stories.length);
    const text = aiResult.text;

    // Clean the response text by removing markdown formatting and any extra text
    const cleanText = text
      .replace(/```json\n?|\n?```/g, "")
      .replace(/^[^\[]*/, "")
      .replace(/[^\]]*$/, "")
      .trim();

    try {
      const suggestions = JSON.parse(cleanText);

      if (!Array.isArray(suggestions)) {
        console.error("Invalid suggestions format:", suggestions);
        return {
          suggestions: [],
          error: "Invalid suggestions format received from AI",
        };
      }

      return { suggestions };
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Raw AI response:", text);
      console.error("Cleaned text:", cleanText);
      return {
        suggestions: [],
        error: "Failed to parse story dependencies",
      };
    }
  } catch (error) {
    console.error("Error analyzing story dependencies:", error);
    return {
      suggestions: [],
      error: "Failed to analyze story dependencies",
    };
  }
}
