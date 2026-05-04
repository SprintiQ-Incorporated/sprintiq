import { Anthropic } from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { extractAIUsage, trackAIUsage } from "@/lib/ai-usage-tracker";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const TAWOS_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";

// TAWOS Issue Type
export interface TAWOSIssue {
  ID: number;
  Issue_Key: string;
  URL: string;
  Title: string;
  Description: string;
  Description_Text: string;
  Description_Code: string;
  Type: string;
  Priority: string;
  Status: string;
  Resolution: string | null;
  Creation_Date: string;
  Estimation_Date: string;
  Resolution_Date: string | null;
  Last_Updated: string;
  Story_Point: number;
  Timespent: number | null;
  In_Progress_Minutes: number;
  Total_Effort_Minutes: number;
  Resolution_Time_Minutes: number;
  Title_Changed_After_Estimation: number;
  Description_Changed_After_Estimation: number;
  Story_Point_Changed_After_Estimation: number;
  Pull_Request_URL: string;
  Creator_ID: number;
  Reporter_ID: number;
  Assignee_ID: number | null;
  Project_ID: number;
  Sprint_ID: number | null;
}

// Enhanced User Story with team assignment
export interface EnhancedUserStory {
  id: string;
  title: string;
  role: string;
  want: string;
  benefit: string;
  acceptanceCriteria: string[];
  storyPoints: number;
  businessValue: number;
  priority: "Low" | "Medium" | "High" | "Critical";
  tags: string[];
  subtasks: Subtask[];
  suggestedTeamMembers: TeamMemberSuggestion[];
  estimatedEffort: {
    totalHours: number;
    breakdown: {
      frontend?: number;
      backend?: number;
      testing?: number;
      design?: number;
      devops?: number;
    };
  };
  dependencies: string[];
  complexity: "simple" | "moderate" | "complex";
  riskLevel: "low" | "medium" | "high";
}

export interface Subtask {
  id: string;
  title: string;
  description: string;
  storyPoints: number;
  assignedRole: string;
  estimatedHours: number;
  dependencies: string[];
  acceptanceCriteria: string[];
}

export interface TeamMemberSuggestion {
  role: string;
  level: "Junior" | "Mid-Level" | "Senior";
  estimatedHours: number;
  skills: string[];
  reason: string;
}

// Team member type
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  level: "Junior" | "Mid-Level" | "Senior";
  skills: string[];
  availability: number; // hours per week
  currentWorkload: number; // current hours assigned
}

/**
 * Analyze TAWOS dataset to extract patterns and insights
 */
export async function analyzeTAWOSDataset(issues: TAWOSIssue[]): Promise<{
  patterns: {
    storyPointPatterns: Record<string, number>;
    priorityPatterns: Record<string, string>;
    typePatterns: Record<string, string[]>;
    effortPatterns: Record<string, number>;
  };
  insights: {
    averageStoryPoints: number;
    commonPriorities: string[];
    commonTypes: string[];
    effortCorrelation: number;
  };
  error?: string;
}> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        patterns: {
          storyPointPatterns: {},
          priorityPatterns: {},
          typePatterns: {},
          effortPatterns: {},
        },
        insights: {
          averageStoryPoints: 0,
          commonPriorities: [],
          commonTypes: [],
          effortCorrelation: 0,
        },
        error: "Anthropic API key is not configured. Please set ANTHROPIC_API_KEY.",
      };
    }

    // Prepare sample data for analysis (limit to 100 issues to avoid token limits)
    const sampleIssues = issues.slice(0, 100);

    const prompt = `
      Analyze this dataset to extract patterns and insights for story generation.
      
      Dataset sample (${sampleIssues.length} issues):
      ${sampleIssues
        .map(
          (issue) => `
        Issue: ${issue.Issue_Key}
        Title: ${issue.Title}
        Type: ${issue.Type}
        Priority: ${issue.Priority}
        Story Points: ${issue.Story_Point}
        Description: ${issue.Description_Text}
        Resolution Time: ${issue.Resolution_Time_Minutes} minutes
        Total Effort: ${issue.Total_Effort_Minutes} minutes
      `
        )
        .join("\n")}
      
      Please analyze and return:
      1. Story point patterns based on issue type and complexity
      2. Priority patterns based on business impact and urgency
      3. Type patterns and common characteristics
      4. Effort patterns and time estimation correlations
      5. Key insights for story generation
      
      Return the analysis as JSON with this structure:
      {
        "patterns": {
          "storyPointPatterns": {
            "bug": 2,
            "feature": 5,
            "enhancement": 3
          },
          "priorityPatterns": {
            "critical": "High business impact + urgent",
            "high": "High business impact",
            "medium": "Moderate business impact",
            "low": "Low business impact"
          },
          "typePatterns": {
            "bug": ["urgent", "regression", "user-facing"],
            "feature": ["new functionality", "user value", "business requirement"],
            "enhancement": ["improvement", "optimization", "user experience"]
          },
          "effortPatterns": {
            "simple": 4,
            "moderate": 8,
            "complex": 16
          }
        },
        "insights": {
          "averageStoryPoints": 3.5,
          "commonPriorities": ["Medium", "High"],
          "commonTypes": ["Bug", "Feature"],
          "effortCorrelation": 0.85
        }
      }
    `;

    const message = await anthropic.messages.create({
      model: TAWOS_MODEL,
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const aiUsage = extractAIUsage(message);
    trackAIUsage({ route: "tawos/analyze", usage: aiUsage }).catch(() => {});

    const textBlock = message.content[0];
    if (textBlock.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }
    const text = textBlock.text;

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);

      return {
        patterns: analysis.patterns,
        insights: analysis.insights,
      };
    } catch (parseError) {
      return {
        patterns: {
          storyPointPatterns: {},
          priorityPatterns: {},
          typePatterns: {},
          effortPatterns: {},
        },
        insights: {
          averageStoryPoints: 0,
          commonPriorities: [],
          commonTypes: [],
          effortCorrelation: 0,
        },
        error: "Failed to parse analysis results",
      };
    }
  } catch {
    return {
      patterns: {
        storyPointPatterns: {},
        priorityPatterns: {},
        typePatterns: {},
        effortPatterns: {},
      },
      insights: {
        averageStoryPoints: 0,
        commonPriorities: [],
        commonTypes: [],
        effortCorrelation: 0,
      },
      error: "Failed to analyze dataset",
    };
  }
}

/**
 * Generate fallback stories when AI JSON parsing fails
 */
function generateFallbackStories(
  featureDescription: string,
  teamMembers: TeamMember[],
  numberOfStories: number
): EnhancedUserStory[] {
  const stories: EnhancedUserStory[] = [];

  // Create basic story templates based on common patterns
  const storyTemplates = [
    {
      title: `Implement ${featureDescription} Core Functionality`,
      role: "User",
      want: `to use ${featureDescription.toLowerCase()} features`,
      benefit: "I can accomplish my tasks efficiently",
      storyPoints: 8,
      priority: "High" as const,
      complexity: "moderate" as const,
      riskLevel: "medium" as const,
    },
    {
      title: `Design ${featureDescription} User Interface`,
      role: "User",
      want: `to interact with ${featureDescription.toLowerCase()} through a user-friendly interface`,
      benefit: "I can easily navigate and use the system",
      storyPoints: 5,
      priority: "Medium" as const,
      complexity: "moderate" as const,
      riskLevel: "low" as const,
    },
    {
      title: `Test ${featureDescription} Functionality`,
      role: "Quality Assurance",
      want: `to verify that ${featureDescription.toLowerCase()} works correctly`,
      benefit: "I can ensure the system is reliable and bug-free",
      storyPoints: 3,
      priority: "Medium" as const,
      complexity: "simple" as const,
      riskLevel: "low" as const,
    },
    {
      title: `Document ${featureDescription} Usage`,
      role: "User",
      want: `to understand how to use ${featureDescription.toLowerCase()}`,
      benefit: "I can learn and use the system effectively",
      storyPoints: 2,
      priority: "Low" as const,
      complexity: "simple" as const,
      riskLevel: "low" as const,
    },
    {
      title: `Optimize ${featureDescription} Performance`,
      role: "User",
      want: `to experience fast and responsive ${featureDescription.toLowerCase()} performance`,
      benefit: "I can work efficiently without delays",
      storyPoints: 5,
      priority: "Medium" as const,
      complexity: "moderate" as const,
      riskLevel: "medium" as const,
    },
  ];

  for (let i = 0; i < Math.min(numberOfStories, storyTemplates.length); i++) {
    const template = storyTemplates[i];
    const storyId = `fallback_story_${i + 1}_${Date.now()}`;

    // Create subtasks based on the story
    const subtasks: Subtask[] = [
      {
        id: `subtask_${storyId}_1`,
        title: `Plan ${template.title}`,
        description: `Create a detailed plan for implementing ${template.title.toLowerCase()}`,
        storyPoints: Math.max(1, Math.floor(template.storyPoints / 3)),
        assignedRole: "Project Manager",
        estimatedHours: 4,
        dependencies: [],
        acceptanceCriteria: [
          "Plan is documented",
          "Timeline is defined",
          "Resources are allocated",
        ],
      },
      {
        id: `subtask_${storyId}_2`,
        title: `Develop ${template.title}`,
        description: `Implement the core functionality for ${template.title.toLowerCase()}`,
        storyPoints: template.storyPoints,
        assignedRole: "Developer",
        estimatedHours: template.storyPoints * 2,
        dependencies: [`subtask_${storyId}_1`],
        acceptanceCriteria: [
          "Feature is implemented",
          "Code is reviewed",
          "Basic tests pass",
        ],
      },
      {
        id: `subtask_${storyId}_3`,
        title: `Test ${template.title}`,
        description: `Verify that ${template.title.toLowerCase()} works as expected`,
        storyPoints: Math.max(1, Math.floor(template.storyPoints / 2)),
        assignedRole: "QA Engineer",
        estimatedHours: template.storyPoints,
        dependencies: [`subtask_${storyId}_2`],
        acceptanceCriteria: [
          "All tests pass",
          "No critical bugs found",
          "Performance is acceptable",
        ],
      },
    ];

    // Assign team members based on available roles
    const suggestedTeamMembers: TeamMemberSuggestion[] = [];
    const totalHours = subtasks.reduce(
      (sum, task) => sum + task.estimatedHours,
      0
    );

    // Find team members for different roles
    const developers = teamMembers.filter((m) =>
      m.role.toLowerCase().includes("developer")
    );
    const qaEngineers = teamMembers.filter(
      (m) =>
        m.role.toLowerCase().includes("qa") ||
        m.role.toLowerCase().includes("test")
    );
    const projectManagers = teamMembers.filter(
      (m) =>
        m.role.toLowerCase().includes("manager") ||
        m.role.toLowerCase().includes("pm")
    );

    if (developers.length > 0) {
      suggestedTeamMembers.push({
        role: developers[0].role,
        level: developers[0].level,
        estimatedHours: Math.floor(totalHours * 0.6),
        skills: developers[0].skills,
        reason: "Primary development work",
      });
    }

    if (qaEngineers.length > 0) {
      suggestedTeamMembers.push({
        role: qaEngineers[0].role,
        level: qaEngineers[0].level,
        estimatedHours: Math.floor(totalHours * 0.3),
        skills: qaEngineers[0].skills,
        reason: "Testing and quality assurance",
      });
    }

    if (projectManagers.length > 0) {
      suggestedTeamMembers.push({
        role: projectManagers[0].role,
        level: projectManagers[0].level,
        estimatedHours: Math.floor(totalHours * 0.1),
        skills: projectManagers[0].skills,
        reason: "Project planning and coordination",
      });
    }

    // If no specific roles found, assign to available team members
    if (suggestedTeamMembers.length === 0 && teamMembers.length > 0) {
      suggestedTeamMembers.push({
        role: teamMembers[0].role,
        level: teamMembers[0].level,
        estimatedHours: totalHours,
        skills: teamMembers[0].skills,
        reason: "General development work",
      });
    }

    stories.push({
      id: storyId,
      title: template.title,
      role: template.role,
      want: template.want,
      benefit: template.benefit,
      acceptanceCriteria: [
        "Feature is implemented according to requirements",
        "All acceptance criteria are met",
        "Code follows project standards",
        "Documentation is updated",
      ],
      storyPoints: template.storyPoints,
      businessValue: 3,
      priority: template.priority,
      tags: [featureDescription.toLowerCase().replace(/\s+/g, "-")],
      subtasks,
      suggestedTeamMembers,
      estimatedEffort: {
        totalHours,
        breakdown: {
          frontend: Math.floor(totalHours * 0.4),
          backend: Math.floor(totalHours * 0.2),
          testing: Math.floor(totalHours * 0.3),
          design: Math.floor(totalHours * 0.05),
          devops: Math.floor(totalHours * 0.05),
        },
      },
      dependencies: [],
      complexity: template.complexity,
      riskLevel: template.riskLevel,
    });
  }

  return stories;
}

/**
 * Generate enhanced user stories with subtasks and team assignment
 */
export async function generateEnhancedStories(
  featureDescription: string,
  teamMembers: TeamMember[],
  tawosPatterns?: any,
  numberOfStories: number = 3
): Promise<{
  stories: EnhancedUserStory[];
  error?: string;
}> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        stories: [],
        error: "Anthropic API key is not configured. Please set ANTHROPIC_API_KEY.",
      };
    }

    const teamInfo = teamMembers
      .map(
        (member) =>
          `${member.name} (${member.role}, ${
            member.level
          }, Skills: ${member.skills.join(", ")})`
      )
      .join("\n");

    const tawosContext = tawosPatterns
      ? `
      Use these patterns for better estimation:
      - Story Point Patterns: ${JSON.stringify(
        tawosPatterns.storyPointPatterns
      )}
      - Priority Patterns: ${JSON.stringify(tawosPatterns.priorityPatterns)}
      - Type Patterns: ${JSON.stringify(tawosPatterns.typePatterns)}
      - Effort Patterns: ${JSON.stringify(tawosPatterns.effortPatterns)}
    `
      : "";

    const prompt = `
      Generate ${numberOfStories} comprehensive user stories for: "${featureDescription}"
      
      Available team members:
      ${teamInfo}
      
      ${tawosContext}
      
      For each story, create:
      1. Main user story with proper acceptance criteria
      2. 3-5 subtasks that break down the work
      3. Team member assignments based on skills and availability
      4. Effort estimation in hours
      5. Dependencies between subtasks
      6. Risk assessment
      
      Consider:
      - Junior developers: 1-3 story points, simple tasks
      - Mid-level developers: 3-8 story points, moderate complexity
      - Senior developers: 5-13 story points, complex tasks
      - Balance workload across team members
      - Match skills to task requirements
      
      IMPORTANT: Return ONLY valid JSON without any markdown formatting, explanations, or additional text.
      
      Return as a JSON array with this exact structure:
      [
        {
          "id": "unique_id",
          "title": "Story title",
          "role": "user role",
          "want": "what they want",
          "benefit": "the benefit",
          "acceptanceCriteria": ["criterion 1", "criterion 2"],
          "storyPoints": 5,
          "businessValue": 4,
          "priority": "High",
          "tags": ["frontend", "auth"],
          "subtasks": [
            {
              "id": "subtask_id",
              "title": "Subtask title",
              "description": "Detailed description",
              "storyPoints": 2,
              "assignedRole": "Frontend Developer",
              "estimatedHours": 8,
              "dependencies": [],
              "acceptanceCriteria": ["subtask criterion 1"]
            }
          ],
          "suggestedTeamMembers": [
            {
              "role": "Frontend Developer",
              "level": "Mid-Level",
              "estimatedHours": 8,
              "skills": ["React", "TypeScript"],
              "reason": "UI implementation required"
            }
          ],
          "estimatedEffort": {
            "totalHours": 16,
            "breakdown": {
              "frontend": 8,
              "backend": 6,
              "testing": 2
            }
          },
          "dependencies": [],
          "complexity": "moderate",
          "riskLevel": "medium"
        }
      ]
      
      Ensure the JSON is properly formatted with no trailing commas and valid syntax.
    `;

    const message = await anthropic.messages.create({
      model: TAWOS_MODEL,
      max_tokens: 4000,
      temperature: 0.7,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const aiUsage2 = extractAIUsage(message);
    trackAIUsage({ route: "tawos/enhance", usage: aiUsage2 }).catch(() => {});

    const textBlock = message.content[0];
    if (textBlock.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }
    const text = textBlock.text;

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      let stories: EnhancedUserStory[] = [];

      if (jsonMatch) {
        try {
          // Clean the JSON string before parsing
          const cleanedJson = jsonMatch[0]
            .replace(/,\s*}/g, "}") // Remove trailing commas in objects
            .replace(/,\s*]/g, "]") // Remove trailing commas in arrays
            .replace(/,\s*,/g, ",") // Remove double commas
            .replace(/,\s*}/g, "}") // Remove trailing commas before closing braces
            .replace(/,\s*]/g, "]"); // Remove trailing commas before closing brackets
          stories = JSON.parse(cleanedJson);
        } catch (parseError) {
          console.error(
            "Failed to parse matched JSON, trying full text:",
            parseError
          );
          // If the matched JSON fails, try parsing the full text
          try {
            const cleanedFullText = text
              .replace(/,\s*}/g, "}")
              .replace(/,\s*]/g, "]")
              .replace(/,\s*,/g, ",")
              .replace(/,\s*}/g, "}")
              .replace(/,\s*]/g, "]");

            stories = JSON.parse(cleanedFullText);
          } catch (fullTextError) {
            console.error("Failed to parse full text:", fullTextError);
            console.error("Raw AI response:", text);

            // Generate fallback stories when JSON parsing completely fails
            stories = generateFallbackStories(
              featureDescription,
              teamMembers,
              numberOfStories
            );
          }
        }
      } else {
        try {
          const cleanedText = text
            .replace(/,\s*}/g, "}")
            .replace(/,\s*]/g, "]")
            .replace(/,\s*,/g, ",")
            .replace(/,\s*}/g, "}")
            .replace(/,\s*]/g, "]");

          stories = JSON.parse(cleanedText);
        } catch (parseError) {
          console.error("Failed to parse entire response:", parseError);
          console.error("Raw AI response:", text);

          // Generate fallback stories when JSON parsing completely fails
          stories = generateFallbackStories(
            featureDescription,
            teamMembers,
            numberOfStories
          );
        }
      }

      // Validate that stories is an array
      if (!Array.isArray(stories)) {
        console.error("AI response is not an array:", stories);
        stories = generateFallbackStories(
          featureDescription,
          teamMembers,
          numberOfStories
        );
      }

      // Validate and enhance stories
      const enhancedStories = stories.map((story: any, index: number) => ({
        ...story,
        id: story.id || `story_${index + 1}_${Date.now()}`,
        title: story.title || `User Story ${index + 1}`,
        role: story.role || "User",
        want: story.want || "perform an action",
        benefit: story.benefit || "achieve a goal",
        acceptanceCriteria: Array.isArray(story.acceptanceCriteria)
          ? story.acceptanceCriteria
          : ["Acceptance criteria to be defined"],
        storyPoints:
          typeof story.storyPoints === "number" ? story.storyPoints : 3,
        businessValue:
          typeof story.businessValue === "number" ? story.businessValue : 3,
        priority: story.priority || "Medium",
        tags: Array.isArray(story.tags) ? story.tags : [],
        subtasks: Array.isArray(story.subtasks) ? story.subtasks : [],
        suggestedTeamMembers: Array.isArray(story.suggestedTeamMembers)
          ? story.suggestedTeamMembers
          : [],
        estimatedEffort: story.estimatedEffort || {
          totalHours: 0,
          breakdown: {},
        },
        dependencies: Array.isArray(story.dependencies)
          ? story.dependencies
          : [],
        complexity: story.complexity || "moderate",
        riskLevel: story.riskLevel || "medium",
      }));

      return { stories: enhancedStories };
    } catch (parseError) {
      console.error("Failed to parse enhanced stories:", parseError);
      console.error("Raw AI response:", text);

      // Generate fallback stories as last resort
      const fallbackStories = generateFallbackStories(
        featureDescription,
        teamMembers,
        numberOfStories
      );
      return { stories: fallbackStories };
    }
  } catch (error) {
    console.error("Error generating enhanced stories:", error);
    return {
      stories: [],
      error: "Failed to generate enhanced stories",
    };
  }
}

/**
 * Optimize team assignment based on workload and skills
 */
export function optimizeTeamAssignment(
  stories: EnhancedUserStory[],
  teamMembers: TeamMember[]
): EnhancedUserStory[] {
  return stories.map((story) => {
    const optimizedMembers = story.suggestedTeamMembers.map((suggestion) => {
      // Find best matching team member
      const matchingMembers = teamMembers.filter(
        (member) =>
          member.role.toLowerCase().includes(suggestion.role.toLowerCase()) &&
          member.level === suggestion.level &&
          member.currentWorkload + suggestion.estimatedHours <=
            member.availability
      );

      if (matchingMembers.length > 0) {
        // Sort by workload (prefer less busy members)
        const bestMatch = matchingMembers.sort(
          (a, b) => a.currentWorkload - b.currentWorkload
        )[0];

        return {
          ...suggestion,
          assignedMemberId: bestMatch.id,
          assignedMemberName: bestMatch.name,
        };
      }

      return suggestion;
    });

    return {
      ...story,
      suggestedTeamMembers: optimizedMembers,
    };
  });
}

/**
 * Save TAWOS training data to database
 */
export async function saveTAWOSTrainingData(
  workspaceId: string,
  analysis: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    const { error } = await (supabase as any).from("tawos_training_data").insert({
      workspace_id: workspaceId,
      patterns: analysis.patterns,
      insights: analysis.insights,
      created_at: new Date().toISOString(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Failed to save training data" };
  }
}

/**
 * Load TAWOS training data from database
 */
export async function loadTAWOSTrainingData(
  workspaceId: string
): Promise<{ data: any; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await (supabase as any)
      .from("tawos_training_data")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data };
  } catch {
    return { data: null, error: "Failed to load training data" };
  }
}
