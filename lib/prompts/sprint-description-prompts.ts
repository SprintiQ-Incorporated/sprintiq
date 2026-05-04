/**
 * Sprint Description Formatting Prompts
 *
 * These prompts are integrated into the sprint generation pipeline to ensure
 * consistent, readable output. The checkbox format (`- [ ]`) enables future
 * integration with task tracking and completion status.
 */

import type { UserStory } from "@/types";

/**
 * Prompt 1: Sprint Summary Generator
 *
 * When generating a sprint description, this prompt structures the output
 * with a clear goal and formatted user stories with acceptance criteria.
 */
export const SPRINT_SUMMARY_GENERATOR_PROMPT = `
When generating a sprint description, structure the output as follows:

**Goal:** [One clear sentence stating the sprint's primary objective]

---

### User Stories

For each user story, format as:

**[Story Title]**
As a [persona], I want to [action], so that [benefit].

**Acceptance Criteria:**
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

---

Rules:
1. Never combine multiple user stories into a single paragraph
2. Each acceptance criterion must be on its own line with a checkbox
3. Keep the Goal statement under 25 words
4. Separate stories with horizontal rules for visual clarity
5. Use sentence case for acceptance criteria
`;

/**
 * Prompt 2: Reformatter for Existing Descriptions
 *
 * This prompt reformats existing unstructured sprint descriptions
 * into the standardized format.
 */
export const SPRINT_DESCRIPTION_REFORMATTER_PROMPT = `
Reformat the following sprint description into a structured format:

INPUT: [paste jumbled description]

OUTPUT FORMAT:

**Goal:** [Extract the overarching sprint objective]

---

**Story 1: [Descriptive Title]**
As a [extract persona], I want to [extract action], so that [extract benefit].

**Acceptance Criteria:**
- [ ] [Parse each criterion as separate bullet]

Repeat for each story found in the input.

Parsing rules:
- Look for "As a..." patterns to identify story boundaries
- Look for "**acceptance criteria:**" or "AC:" markers
- Numbered items (1. 2. 3.) become individual bullets
- Remove redundant words and tighten language
`;

/**
 * Generates a formatted sprint description with goal and user stories
 */
export function generateSprintDescriptionPrompt(
  goal: string,
  stories: UserStory[]
): string {
  return `
Generate a structured sprint description following this exact format:

**Goal:** ${goal}

---

### User Stories

${stories
  .map(
    (story, index) => `
**Story ${index + 1}: ${story.title}**
As a ${story.role || "user"}, I want to ${story.want || story.description || "complete the task"}, so that ${story.benefit || "I can achieve my goal"}.

**Acceptance Criteria:**
${
  story.acceptanceCriteria?.length
    ? story.acceptanceCriteria.map((criterion) => `- [ ] ${criterion}`).join("\n")
    : "- [ ] Feature is implemented as described\n- [ ] All tests pass\n- [ ] Code is reviewed and approved"
}
`
  )
  .join("\n---\n")}

---

Rules:
1. Never combine multiple user stories into a single paragraph
2. Each acceptance criterion must be on its own line with a checkbox
3. Keep the Goal statement under 25 words
4. Separate stories with horizontal rules for visual clarity
5. Use sentence case for acceptance criteria
`;
}

/**
 * Generates a prompt to reformat an existing unstructured description
 */
export function generateReformatterPrompt(existingDescription: string): string {
  return `
${SPRINT_DESCRIPTION_REFORMATTER_PROMPT}

INPUT:
${existingDescription}

Generate the reformatted output now.
`;
}

/**
 * Format a single user story into the structured format
 */
export function formatUserStory(story: UserStory, index: number): string {
  const title = story.title || `Story ${index + 1}`;
  const role = story.role || "user";
  const want = story.want || story.description || "complete the task";
  const benefit = story.benefit || "I can achieve my goal";

  const acceptanceCriteria =
    story.acceptanceCriteria?.length && story.acceptanceCriteria.length > 0
      ? story.acceptanceCriteria.map((criterion) => `- [ ] ${criterion}`).join("\n")
      : "- [ ] Feature is implemented as described\n- [ ] All tests pass\n- [ ] Code is reviewed and approved";

  return `**Story ${index + 1}: ${title}**
As a ${role}, I want to ${want}, so that ${benefit}.

**Acceptance Criteria:**
${acceptanceCriteria}`;
}

/**
 * Format multiple user stories with separators
 */
export function formatUserStories(stories: UserStory[]): string {
  return stories.map((story, index) => formatUserStory(story, index + 1)).join("\n\n---\n\n");
}

/**
 * Generate a complete formatted sprint description
 */
export function formatSprintDescription(goal: string, stories: UserStory[]): string {
  const formattedGoal = goal.length > 150 ? goal.substring(0, 147) + "..." : goal;

  return `**Goal:** ${formattedGoal}

---

### User Stories

${formatUserStories(stories)}`;
}

/**
 * Validate that a goal statement meets the requirements
 * - Under 25 words
 * - Clear and specific
 */
export function validateGoalStatement(goal: string): {
  isValid: boolean;
  wordCount: number;
  message?: string;
} {
  const wordCount = goal.split(/\s+/).filter((word) => word.length > 0).length;

  if (wordCount > 25) {
    return {
      isValid: false,
      wordCount,
      message: `Goal exceeds 25 words (currently ${wordCount} words). Please shorten.`,
    };
  }

  return {
    isValid: true,
    wordCount,
  };
}

/**
 * Parse an acceptance criterion and ensure proper formatting
 */
export function formatAcceptanceCriterion(criterion: string): string {
  // Remove existing bullet points or checkboxes
  let cleaned = criterion.replace(/^[\s]*[-*•][\s]*(\[[\sx]\])?[\s]*/i, "");

  // Capitalize first letter (sentence case)
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // Remove trailing period if present (for consistency)
  cleaned = cleaned.replace(/\.+$/, "");

  return `- [ ] ${cleaned}`;
}

/**
 * Merge and format acceptance criteria from multiple sources
 */
export function mergeAcceptanceCriteria(
  criteria: string[] | undefined,
  requirements: string[] | undefined
): string[] {
  const merged: string[] = [];

  if (criteria && criteria.length > 0) {
    merged.push(...criteria);
  }

  if (requirements && requirements.length > 0) {
    // Filter out requirements that are already in criteria
    const criteriaLower = merged.map((c) => c.toLowerCase());
    const uniqueRequirements = requirements.filter(
      (req) => !criteriaLower.includes(req.toLowerCase())
    );
    merged.push(...uniqueRequirements);
  }

  // Limit to 5 criteria as per best practices
  return merged.slice(0, 5);
}

/**
 * AI Prompt for generating structured sprint descriptions
 * This is used when we need the AI to generate a formatted description
 */
export function getSprintDescriptionGeneratorSystemPrompt(): string {
  return `You are an expert Agile coach specializing in creating clear, structured sprint documentation.

When generating sprint descriptions, ALWAYS follow this exact format:

**Goal:** [One clear sentence stating the sprint's primary objective - MUST be under 25 words]

---

### User Stories

For each user story, format as:

**[Story Title]**
As a [persona], I want to [action], so that [benefit].

**Acceptance Criteria:**
- [ ] [Criterion 1 - specific and measurable]
- [ ] [Criterion 2 - specific and measurable]
- [ ] [Criterion 3 - specific and measurable]

---

STRICT RULES:
1. NEVER combine multiple user stories into a single paragraph
2. Each acceptance criterion MUST be on its own line with a checkbox (- [ ])
3. Keep the Goal statement under 25 words
4. Separate stories with horizontal rules (---) for visual clarity
5. Use sentence case for acceptance criteria
6. Each story must have 3-5 acceptance criteria
7. Acceptance criteria must be specific, measurable, and testable

The checkbox format (- [ ]) is required for integration with task tracking systems.`;
}

/**
 * AI Prompt for reformatting existing descriptions
 * This is used when we need to convert unstructured descriptions to structured format
 */
export function getDescriptionReformatterSystemPrompt(): string {
  return `You are an expert at parsing and reformatting agile documentation.

Your task is to take unstructured or poorly formatted sprint descriptions and reformat them into a clear, structured format.

OUTPUT FORMAT:

**Goal:** [Extract or synthesize the overarching sprint objective - MUST be under 25 words]

---

**Story 1: [Descriptive Title]**
As a [extracted persona], I want to [extracted action], so that [extracted benefit].

**Acceptance Criteria:**
- [ ] [Parse each criterion as separate bullet]
- [ ] [Additional criteria]

---

(Repeat for each story found in the input)

PARSING RULES:
1. Look for "As a..." patterns to identify story boundaries
2. Look for "Acceptance Criteria:", "AC:", or numbered lists to identify criteria
3. Numbered items (1. 2. 3.) should become individual checkbox bullets
4. Remove redundant words and tighten language
5. If no clear user story format exists, infer role/want/benefit from context
6. Each criterion must start with "- [ ]" for task tracking integration
7. Ensure all criteria are in sentence case

If the input is severely unstructured, do your best to extract meaningful user stories and acceptance criteria. When in doubt, create clear, actionable criteria based on the described functionality.`;
}

const sprintDescriptionPrompts = {
  SPRINT_SUMMARY_GENERATOR_PROMPT,
  SPRINT_DESCRIPTION_REFORMATTER_PROMPT,
  generateSprintDescriptionPrompt,
  generateReformatterPrompt,
  formatUserStory,
  formatUserStories,
  formatSprintDescription,
  validateGoalStatement,
  formatAcceptanceCriterion,
  mergeAcceptanceCriteria,
  getSprintDescriptionGeneratorSystemPrompt,
  getDescriptionReformatterSystemPrompt,
};

export default sprintDescriptionPrompts;
