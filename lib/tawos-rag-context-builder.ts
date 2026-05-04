/**
 * TAWOS RAG Context Builder
 *
 * Formats tiered retrieval results into structured markdown context for Claude.
 * Handles success patterns, story templates, and anti-patterns with confidence
 * scoring, framework grouping, and deduplication.
 */

// ============================================================================
// Interfaces
// ============================================================================

export interface RetrievedChunk {
  id: string
  similarity: number
  metadata: {
    title?: string
    description?: string
    role?: string
    want?: string
    benefit?: string
    acceptanceCriteria?: string[]
    storyPoints?: number
    estimatedTime?: number
    completionRate?: number
    successPattern?: string
    antiPatterns?: string[]
    tags?: string[]
    category?: string
    domain?: string
    framework?: string
    [key: string]: unknown
  }
}

export interface TieredRetrievalResults {
  successPatterns: RetrievedChunk[]
  storyTemplates: RetrievedChunk[]
  antiPatterns: RetrievedChunk[]
}

export interface RAGContextOptions {
  maxTokensBudget?: number
  confidenceThresholds?: { high: number; medium: number }
  deduplicateByTitle?: boolean
  prioritizeFrameworks?: string[]
}

export type FrameworkCategory =
  | 'Auth'
  | 'API'
  | 'DB'
  | 'UI'
  | 'Security'
  | 'Integration'
  | 'Testing'
  | 'DevOps'
  | 'Analytics'
  | 'Other'

export type ConfidenceLevel = {
  label: 'HIGH' | 'MEDIUM' | 'LOW'
  emoji: string
  instruction: string
}

interface AntiPatternDefinition {
  name: string
  detection: string[]
  reason: string
  remedy: string
}

interface FrameworkDistribution {
  framework: FrameworkCategory
  count: number
  avgSimilarity: number
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Confidence label thresholds — single source of truth for the HIGH/MEDIUM/LOW
 * bands applied to retrieved chunks. Also imported by the Anthropic prompt in
 * story-actions.ts so the LLM's confidence calibration instructions always
 * match what the context builder actually emits.
 */
export const CONFIDENCE_THRESHOLDS = { high: 0.80, medium: 0.70 } as const

const DEFAULT_OPTIONS: Required<RAGContextOptions> = {
  maxTokensBudget: 4000,
  confidenceThresholds: CONFIDENCE_THRESHOLDS,
  deduplicateByTitle: true,
  prioritizeFrameworks: [],
}

const KNOWN_ANTI_PATTERNS: AntiPatternDefinition[] = [
  {
    name: 'Requirements Confusion',
    detection: ['unclear', 'ambiguous', 'vague requirements', 'undefined'],
    reason: 'Ambiguous requirements lead to misaligned implementations and rework',
    remedy: 'Define specific, measurable acceptance criteria with concrete examples',
  },
  {
    name: 'Scope Overload',
    detection: ['too many', 'everything', 'all features', 'massive', 'huge scope'],
    reason: 'Overly broad stories cannot be completed in a single sprint',
    remedy: 'Split into smaller, independently deliverable user stories',
  },
  {
    name: 'Missing Dependencies',
    detection: ['depends on', 'waiting for', 'blocked by', 'needs first'],
    reason: 'Unidentified dependencies cause delays and incomplete work',
    remedy: 'Map all dependencies explicitly and resolve blockers before sprint',
  },
  {
    name: 'Unrealistic Estimates',
    detection: ['quick', 'simple', 'just', 'only takes', 'easy'],
    reason: 'Underestimated complexity leads to missed deadlines and technical debt',
    remedy: 'Use historical data and team velocity for realistic story points',
  },
  {
    name: 'Missing Edge Cases',
    detection: ['happy path', 'normal flow', 'basic', 'standard case'],
    reason: 'Ignoring edge cases results in fragile implementations',
    remedy: 'Include error handling, boundary conditions, and failure scenarios',
  },
  {
    name: 'Vague Acceptance Criteria',
    detection: ['should work', 'must be good', 'needs to be fast', 'user-friendly'],
    reason: 'Subjective criteria cannot be objectively verified',
    remedy: 'Define testable, binary pass/fail acceptance criteria',
  },
  {
    name: 'Missing Non-Functionals',
    detection: ['performance', 'security', 'scalability', 'accessibility'],
    reason: 'Non-functional requirements often discovered too late',
    remedy: 'Include explicit NFRs: response time, load capacity, security standards',
  },
  {
    name: 'Implicit User Assumptions',
    detection: ['users will', 'obviously', 'everyone knows', 'common sense'],
    reason: 'Assumed user behavior rarely matches reality',
    remedy: 'Validate assumptions with user research and explicit persona definitions',
  },
]

const FRAMEWORK_KEYWORDS: Record<FrameworkCategory, string[]> = {
  Auth: ['authentication', 'authorization', 'login', 'logout', 'session', 'oauth', 'jwt', 'token', 'password', 'mfa', '2fa', 'sso'],
  API: ['api', 'endpoint', 'rest', 'graphql', 'webhook', 'request', 'response', 'http', 'fetch', 'axios'],
  DB: ['database', 'query', 'schema', 'migration', 'model', 'orm', 'sql', 'nosql', 'postgres', 'mongodb', 'prisma'],
  UI: ['component', 'button', 'form', 'modal', 'page', 'layout', 'style', 'css', 'tailwind', 'react', 'vue', 'frontend'],
  Security: ['security', 'encryption', 'vulnerability', 'xss', 'csrf', 'injection', 'sanitize', 'validate', 'audit'],
  Integration: ['integration', 'third-party', 'external', 'service', 'sdk', 'plugin', 'connector', 'sync'],
  Testing: ['test', 'spec', 'mock', 'stub', 'fixture', 'coverage', 'unit', 'e2e', 'integration test', 'jest', 'cypress'],
  DevOps: ['deploy', 'ci', 'cd', 'pipeline', 'docker', 'kubernetes', 'terraform', 'infrastructure', 'monitoring'],
  Analytics: ['analytics', 'tracking', 'metrics', 'dashboard', 'report', 'logging', 'telemetry', 'event'],
  Other: [],
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines confidence level based on similarity score
 */
export function getConfidenceLevel(
  similarity: number,
  thresholds: { high: number; medium: number } = DEFAULT_OPTIONS.confidenceThresholds
): ConfidenceLevel {
  if (similarity >= thresholds.high) {
    return {
      label: 'HIGH',
      emoji: '🟢',
      instruction: 'Strongly recommended - follow this pattern closely',
    }
  }
  if (similarity >= thresholds.medium) {
    return {
      label: 'MEDIUM',
      emoji: '🟡',
      instruction: 'Consider adapting - may need modification for your context',
    }
  }
  return {
    label: 'LOW',
    emoji: '🔴',
    instruction: 'Use with caution - review carefully before applying',
  }
}

/**
 * Infers framework category from chunk metadata or content keywords
 */
export function inferFramework(chunk: RetrievedChunk): FrameworkCategory {
  // Check explicit framework metadata first
  if (chunk.metadata.framework) {
    const explicit = chunk.metadata.framework.toLowerCase()
    for (const [category, keywords] of Object.entries(FRAMEWORK_KEYWORDS)) {
      if (keywords.some(kw => explicit.includes(kw))) {
        return category as FrameworkCategory
      }
    }
  }

  // Check category metadata
  if (chunk.metadata.category) {
    const category = chunk.metadata.category as FrameworkCategory
    if (Object.keys(FRAMEWORK_KEYWORDS).includes(category)) {
      return category
    }
  }

  // Infer from content keywords
  const searchText = [
    chunk.metadata.title,
    chunk.metadata.description,
    chunk.metadata.want,
    chunk.metadata.domain,
    ...(chunk.metadata.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  for (const [category, keywords] of Object.entries(FRAMEWORK_KEYWORDS)) {
    if (category === 'Other') continue
    if (keywords.some(kw => searchText.includes(kw))) {
      return category as FrameworkCategory
    }
  }

  return 'Other'
}

/**
 * Groups chunks by their inferred framework
 */
export function groupByFramework(
  chunks: RetrievedChunk[]
): Map<FrameworkCategory, RetrievedChunk[]> {
  const groups = new Map<FrameworkCategory, RetrievedChunk[]>()

  for (const chunk of chunks) {
    const framework = inferFramework(chunk)
    const existing = groups.get(framework) || []
    existing.push(chunk)
    groups.set(framework, existing)
  }

  return groups
}

/**
 * Analyzes framework distribution across all tiers
 */
export function analyzeFrameworkDistribution(
  results: TieredRetrievalResults
): FrameworkDistribution[] {
  const allChunks = [
    ...results.successPatterns,
    ...results.storyTemplates,
    ...results.antiPatterns,
  ]

  const frameworkStats = new Map<
    FrameworkCategory,
    { count: number; totalSimilarity: number }
  >()

  for (const chunk of allChunks) {
    const framework = inferFramework(chunk)
    const stats = frameworkStats.get(framework) || { count: 0, totalSimilarity: 0 }
    stats.count++
    stats.totalSimilarity += chunk.similarity
    frameworkStats.set(framework, stats)
  }

  const distribution: FrameworkDistribution[] = []
  for (const [framework, stats] of frameworkStats) {
    distribution.push({
      framework,
      count: stats.count,
      avgSimilarity: stats.count > 0 ? stats.totalSimilarity / stats.count : 0,
    })
  }

  return distribution.sort((a, b) => b.count - a.count)
}

/**
 * Deduplicates results across tiers, prioritizing success patterns
 */
function deduplicateResults(results: TieredRetrievalResults): TieredRetrievalResults {
  const seenTitles = new Set<string>()
  const seenIds = new Set<string>()

  const dedupe = (chunks: RetrievedChunk[]): RetrievedChunk[] => {
    return chunks.filter(chunk => {
      const title = chunk.metadata.title?.toLowerCase().trim()
      const id = chunk.id

      // Check by ID first
      if (seenIds.has(id)) return false
      seenIds.add(id)

      // Check by title if available
      if (title) {
        if (seenTitles.has(title)) return false
        seenTitles.add(title)
      }

      return true
    })
  }

  // Process in priority order: success patterns first
  const successPatterns = dedupe(results.successPatterns)
  const storyTemplates = dedupe(results.storyTemplates)
  const antiPatterns = dedupe(results.antiPatterns)

  return { successPatterns, storyTemplates, antiPatterns }
}

// ============================================================================
// Formatters
// ============================================================================

/**
 * Formats a success pattern chunk with confidence badge and metrics
 */
function formatSuccessPatternChunk(
  chunk: RetrievedChunk,
  index: number,
  thresholds: { high: number; medium: number }
): string {
  const confidence = getConfidenceLevel(chunk.similarity, thresholds)
  const lines: string[] = []

  lines.push(`### ${index + 1}. ${chunk.metadata.title || 'Untitled Pattern'}`)
  lines.push('')
  lines.push(`**Confidence:** ${confidence.emoji} ${confidence.label} (${(chunk.similarity * 100).toFixed(1)}%)`)
  lines.push(`> ${confidence.instruction}`)
  lines.push('')

  // User story format if available
  if (chunk.metadata.role && chunk.metadata.want) {
    lines.push('**User Story:**')
    lines.push(`> As a ${chunk.metadata.role},`)
    lines.push(`> I want ${chunk.metadata.want}`)
    if (chunk.metadata.benefit) {
      lines.push(`> so that ${chunk.metadata.benefit}`)
    }
    lines.push('')
  } else if (chunk.metadata.description) {
    lines.push('**Description:**')
    lines.push(`> ${chunk.metadata.description}`)
    lines.push('')
  }

  // Acceptance criteria
  if (chunk.metadata.acceptanceCriteria?.length) {
    lines.push('**Acceptance Criteria:**')
    for (const criterion of chunk.metadata.acceptanceCriteria.slice(0, 5)) {
      lines.push(`- [ ] ${criterion}`)
    }
    if (chunk.metadata.acceptanceCriteria.length > 5) {
      lines.push(`- ... and ${chunk.metadata.acceptanceCriteria.length - 5} more`)
    }
    lines.push('')
  }

  // Metrics
  const metrics: string[] = []
  if (chunk.metadata.storyPoints !== undefined) {
    metrics.push(`Story Points: ${chunk.metadata.storyPoints}`)
  }
  if (chunk.metadata.estimatedTime !== undefined) {
    metrics.push(`Est. Time: ${chunk.metadata.estimatedTime}h`)
  }
  if (chunk.metadata.completionRate !== undefined) {
    metrics.push(`Completion Rate: ${(chunk.metadata.completionRate * 100).toFixed(0)}%`)
  }

  if (metrics.length > 0) {
    lines.push(`**Metrics:** ${metrics.join(' | ')}`)
    lines.push('')
  }

  // Success pattern note
  if (chunk.metadata.successPattern) {
    lines.push('**Success Pattern:**')
    lines.push(`> ${chunk.metadata.successPattern}`)
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Formats a template chunk with framework tag
 */
function formatTemplateChunk(
  chunk: RetrievedChunk,
  framework: FrameworkCategory,
  thresholds: { high: number; medium: number }
): string {
  const confidence = getConfidenceLevel(chunk.similarity, thresholds)
  const lines: string[] = []

  lines.push(`- **[${framework}]** ${chunk.metadata.title || 'Untitled Template'} ${confidence.emoji}`)

  if (chunk.metadata.description) {
    lines.push(`  - ${chunk.metadata.description.slice(0, 150)}${chunk.metadata.description.length > 150 ? '...' : ''}`)
  }

  if (chunk.metadata.acceptanceCriteria?.length) {
    const sampleCriteria = chunk.metadata.acceptanceCriteria.slice(0, 2)
    for (const criterion of sampleCriteria) {
      lines.push(`  - _Sample:_ ${criterion}`)
    }
  }

  return lines.join('\n')
}

/**
 * Formats an anti-pattern warning box for high-similarity matches
 */
function formatAntiPatternExample(chunk: RetrievedChunk): string {
  const lines: string[] = []

  lines.push('> ⚠️ **Anti-Pattern Detected**')
  lines.push('>')
  lines.push(`> **${chunk.metadata.title || 'Warning'}** (${(chunk.similarity * 100).toFixed(1)}% match)`)

  if (chunk.metadata.description) {
    lines.push('>')
    lines.push(`> ${chunk.metadata.description}`)
  }

  if (chunk.metadata.antiPatterns?.length) {
    lines.push('>')
    lines.push('> **Issues:** ' + chunk.metadata.antiPatterns.join(', '))
  }

  return lines.join('\n')
}

/**
 * Extracts relevant known anti-patterns based on chunk content
 */
function extractUniqueAntiPatterns(
  chunks: RetrievedChunk[]
): AntiPatternDefinition[] {
  const matchedPatterns = new Set<string>()
  const results: AntiPatternDefinition[] = []

  const searchableContent = chunks
    .map(c => [
      c.metadata.title,
      c.metadata.description,
      c.metadata.want,
      ...(c.metadata.antiPatterns || []),
    ].filter(Boolean).join(' '))
    .join(' ')
    .toLowerCase()

  for (const pattern of KNOWN_ANTI_PATTERNS) {
    if (matchedPatterns.has(pattern.name)) continue

    const hasMatch = pattern.detection.some(trigger =>
      searchableContent.includes(trigger.toLowerCase())
    )

    if (hasMatch) {
      matchedPatterns.add(pattern.name)
      results.push(pattern)
    }
  }

  return results
}

/**
 * Builds fallback content when no results are found
 */
function buildNoResultsFallback(): string {
  return `## No Matching Patterns Found

When no historical patterns match your query, apply these foundational principles:

### INVEST Principles for User Stories

| Principle | Description | Verification Question |
|-----------|-------------|----------------------|
| **I**ndependent | Story can be developed separately | Can this be built without other stories? |
| **N**egotiable | Details can be discussed | Is the scope flexible until sprint start? |
| **V**aluable | Delivers user/business value | What problem does this solve? |
| **E**stimable | Team can estimate effort | Do we understand enough to size it? |
| **S**mall | Fits within a sprint | Can we complete this in <5 days? |
| **T**estable | Has clear acceptance criteria | How will we verify it works? |

### Quality Checklist

- [ ] User story follows "As a [role], I want [feature], so that [benefit]" format
- [ ] Acceptance criteria are specific and testable
- [ ] Edge cases and error scenarios identified
- [ ] Non-functional requirements specified (performance, security, accessibility)
- [ ] Dependencies mapped and resolved
- [ ] Story points assigned based on team velocity
- [ ] Definition of Done criteria met

### Recommended Actions

1. **Refine your query** - Try more specific keywords related to your domain
2. **Check framework tags** - Filter by Auth, API, DB, UI, Security, etc.
3. **Consult team patterns** - Your team may have undocumented patterns
4. **Start fresh** - Use INVEST principles to craft a new high-quality story
`
}

// ============================================================================
// Main Builder Function
// ============================================================================

/**
 * Builds formatted RAG context from tiered retrieval results
 *
 * @param successPatterns - High-confidence success pattern chunks
 * @param storyTemplates - Template chunks grouped by framework
 * @param antiPatterns - Anti-pattern warning chunks
 * @param options - Configuration options
 * @returns Formatted markdown string for Claude context
 */
export function buildTieredRAGContext(
  successPatterns: RetrievedChunk[],
  storyTemplates: RetrievedChunk[],
  antiPatterns: RetrievedChunk[],
  options?: RAGContextOptions
): string {
  const opts: Required<RAGContextOptions> = { ...DEFAULT_OPTIONS, ...options }

  // Check for empty results
  const totalChunks = successPatterns.length + storyTemplates.length + antiPatterns.length
  if (totalChunks === 0) {
    return buildNoResultsFallback()
  }

  // Prepare results object
  let results: TieredRetrievalResults = {
    successPatterns,
    storyTemplates,
    antiPatterns,
  }

  // Deduplicate if enabled
  if (opts.deduplicateByTitle) {
    results = deduplicateResults(results)
  }

  // Sort by similarity descending
  results.successPatterns.sort((a, b) => b.similarity - a.similarity)
  results.storyTemplates.sort((a, b) => b.similarity - a.similarity)
  results.antiPatterns.sort((a, b) => b.similarity - a.similarity)

  const sections: string[] = []

  // -------------------------------------------------------------------------
  // Section 1: Retrieval Summary Table
  // -------------------------------------------------------------------------
  sections.push('## RAG Retrieval Summary\n')

  const calcAvgSimilarity = (chunks: RetrievedChunk[]): string => {
    if (chunks.length === 0) return 'N/A'
    const avg = chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length
    return `${(avg * 100).toFixed(1)}%`
  }

  const getGuidanceWeight = (tier: string, count: number): string => {
    if (count === 0) return 'None'
    switch (tier) {
      case 'Success Patterns':
        return 'Primary'
      case 'Story Templates':
        return 'Secondary'
      case 'Anti-Patterns':
        return 'Cautionary'
      default:
        return 'Reference'
    }
  }

  sections.push('| Tier | Chunks | Avg Similarity | Guidance Weight |')
  sections.push('|------|--------|----------------|-----------------|')
  sections.push(
    `| Success Patterns | ${results.successPatterns.length} | ${calcAvgSimilarity(results.successPatterns)} | ${getGuidanceWeight('Success Patterns', results.successPatterns.length)} |`
  )
  sections.push(
    `| Story Templates | ${results.storyTemplates.length} | ${calcAvgSimilarity(results.storyTemplates)} | ${getGuidanceWeight('Story Templates', results.storyTemplates.length)} |`
  )
  sections.push(
    `| Anti-Patterns | ${results.antiPatterns.length} | ${calcAvgSimilarity(results.antiPatterns)} | ${getGuidanceWeight('Anti-Patterns', results.antiPatterns.length)} |`
  )
  sections.push('')

  // -------------------------------------------------------------------------
  // Section 2: Success Patterns (limit 5)
  // -------------------------------------------------------------------------
  if (results.successPatterns.length > 0) {
    sections.push('## Success Patterns\n')
    sections.push('_Proven patterns from successful implementations. Higher confidence = stronger recommendation._\n')

    const patternsToShow = results.successPatterns.slice(0, 5)
    for (let i = 0; i < patternsToShow.length; i++) {
      sections.push(formatSuccessPatternChunk(patternsToShow[i], i, opts.confidenceThresholds))
    }

    if (results.successPatterns.length > 5) {
      sections.push(`_... and ${results.successPatterns.length - 5} more patterns available_\n`)
    }
  }

  // -------------------------------------------------------------------------
  // Section 3: Story Templates (grouped by framework, max 2 per framework)
  // -------------------------------------------------------------------------
  if (results.storyTemplates.length > 0) {
    sections.push('## Story Templates\n')
    sections.push('_Reusable templates organized by framework. Adapt to your specific context._\n')

    const grouped = groupByFramework(results.storyTemplates)

    // Prioritize specified frameworks
    const frameworkOrder: FrameworkCategory[] = [
      ...(opts.prioritizeFrameworks as FrameworkCategory[]),
      ...Object.keys(FRAMEWORK_KEYWORDS).filter(
        f => !opts.prioritizeFrameworks.includes(f)
      ) as FrameworkCategory[],
    ]

    for (const framework of frameworkOrder) {
      const chunks = grouped.get(framework)
      if (!chunks || chunks.length === 0) continue

      sections.push(`### ${framework}\n`)

      const chunksToShow = chunks.slice(0, 2)
      for (const chunk of chunksToShow) {
        sections.push(formatTemplateChunk(chunk, framework, opts.confidenceThresholds))
      }

      if (chunks.length > 2) {
        sections.push(`  - _... and ${chunks.length - 2} more ${framework} templates_`)
      }
      sections.push('')
    }
  }

  // -------------------------------------------------------------------------
  // Section 4: Anti-Patterns
  // -------------------------------------------------------------------------
  sections.push('## Anti-Patterns & Warnings\n')
  sections.push('_Patterns to avoid. Learn from past mistakes._\n')

  // Known anti-patterns based on content analysis
  const knownPatterns = extractUniqueAntiPatterns([
    ...results.successPatterns,
    ...results.storyTemplates,
    ...results.antiPatterns,
  ])

  if (knownPatterns.length > 0) {
    sections.push('### Known Anti-Patterns to Avoid\n')
    sections.push('| Pattern | Detection Triggers | Why It Fails | Remedy |')
    sections.push('|---------|-------------------|--------------|--------|')

    for (const pattern of knownPatterns) {
      const triggers = pattern.detection.slice(0, 3).map(t => `\`${t}\``).join(', ')
      sections.push(`| **${pattern.name}** | ${triggers} | ${pattern.reason} | ${pattern.remedy} |`)
    }
    sections.push('')
  }

  // High-similarity anti-pattern warnings
  const highSimilarityAntiPatterns = results.antiPatterns.filter(
    c => c.similarity >= opts.confidenceThresholds.medium
  )

  if (highSimilarityAntiPatterns.length > 0) {
    sections.push('### High-Similarity Anti-Pattern Warnings\n')

    for (const chunk of highSimilarityAntiPatterns.slice(0, 3)) {
      sections.push(formatAntiPatternExample(chunk))
      sections.push('')
    }
  } else if (results.antiPatterns.length === 0 && knownPatterns.length === 0) {
    sections.push('_No specific anti-patterns detected for this query._\n')
  }

  // -------------------------------------------------------------------------
  // Section 5: Framework Coverage Analysis
  // -------------------------------------------------------------------------
  const distribution = analyzeFrameworkDistribution(results)

  if (distribution.length > 0) {
    sections.push('## Framework Coverage Analysis\n')

    const maxCount = Math.max(...distribution.map(d => d.count))
    for (const { framework, count, avgSimilarity } of distribution.slice(0, 6)) {
      const barLength = Math.round((count / maxCount) * 20)
      const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength)
      const confidence = getConfidenceLevel(avgSimilarity, opts.confidenceThresholds)
      sections.push(
        `- **${framework}** ${bar} ${count} chunks (${(avgSimilarity * 100).toFixed(0)}% avg) ${confidence.emoji}`
      )
    }
    sections.push('')
  }

  // -------------------------------------------------------------------------
  // Footer
  // -------------------------------------------------------------------------
  sections.push('---')
  sections.push(
    `_Context generated from ${totalChunks} retrieved chunks. Budget: ${opts.maxTokensBudget} tokens._`
  )

  return sections.join('\n')
}
