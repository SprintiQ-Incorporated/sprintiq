/**
 * Shared TAWOS training helpers.
 * Extracted from train-tawos/route.ts so both the API route and
 * the background worker can reuse the same conversion logic.
 */

import { v4 as uuidv4 } from "uuid";

// Re-export the canonical TAWOSIssue from tawos-training-service
export type { TAWOSIssue } from "@/lib/tawos-training-service";

export interface VectorStory {
  id: string;
  embedding: number[];
  metadata: {
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
    estimatedTime: number;
    completionRate: number;
    successPattern: string;
    antiPatterns: string[];
    originalIssueKey: string;
    originalType: string;
    originalStatus: string;
    resolutionTime: number;
    totalEffort: number;
    complexity: "simple" | "moderate" | "complex";
  };
  created_at: string;
  updated_at: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function convertIssueToStory(issue: {
  ID?: number;
  Issue_Key: string;
  Title: string;
  Description?: string;
  Description_Text?: string;
  Type: string;
  Priority: string;
  Status: string;
  Resolution?: string | null;
  Story_Point: number;
  Total_Effort_Minutes: number;
  Resolution_Time_Minutes?: number;
}): {
  story: VectorStory;
  textForEmbedding: string;
} {
  const descText = issue.Description_Text || issue.Description || "";

  const role = extractRole(issue.Type, descText);
  const { want, benefit } = extractWantAndBenefit(issue.Title, descText);
  const acceptanceCriteria = generateAcceptanceCriteria(issue.Type, descText);
  const businessValue = calculateBusinessValue(issue.Priority, issue.Type);
  const tags = generateTags(issue.Type, descText, issue.Title);
  const completionRate = calculateCompletionRate(issue.Status, issue.Resolution ?? null);
  const successPattern = generateSuccessPattern(issue.Type, issue.Status, issue.Resolution ?? null);
  const antiPatterns = generateAntiPatterns(issue.Type, issue.Status, issue.Resolution ?? null);
  const complexity = determineComplexity(issue.Story_Point, issue.Total_Effort_Minutes);
  const estimatedTime = Math.round(issue.Total_Effort_Minutes / 60);

  const story: VectorStory = {
    id: uuidv4(),
    embedding: [],
    metadata: {
      title: issue.Title,
      description: descText,
      role,
      want,
      benefit,
      acceptanceCriteria,
      storyPoints: issue.Story_Point,
      businessValue,
      priority: issue.Priority,
      tags,
      estimatedTime,
      completionRate,
      successPattern,
      antiPatterns,
      originalIssueKey: issue.Issue_Key,
      originalType: issue.Type,
      originalStatus: issue.Status,
      resolutionTime: issue.Resolution_Time_Minutes ?? 0,
      totalEffort: issue.Total_Effort_Minutes,
      complexity,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const textForEmbedding = `${issue.Title} ${descText} ${role} ${want} ${benefit} ${tags.join(" ")}`;

  return { story, textForEmbedding };
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

function extractRole(type: string, description: string): string {
  const text = (description || "").toLowerCase();

  if (type.toLowerCase() === "bug") {
    return "QA Engineer";
  } else if (type.toLowerCase() === "feature") {
    if (text.includes("ui") || text.includes("design") || text.includes("frontend")) {
      return "UI/UX Designer";
    } else if (text.includes("api") || text.includes("backend") || text.includes("database")) {
      return "Backend Developer";
    } else {
      return "Product Manager";
    }
  } else if (type.toLowerCase() === "enhancement") {
    return "Full Stack Developer";
  } else if (type.toLowerCase() === "task") {
    return "Developer";
  } else {
    return "User";
  }
}

function extractWantAndBenefit(
  title: string,
  description: string
): { want: string; benefit: string } {
  const text = `${title} ${description || ""}`.toLowerCase();

  let want = "to complete this feature";
  if (text.includes("implement") || text.includes("add") || text.includes("create")) {
    want = "to have this functionality implemented";
  } else if (text.includes("fix") || text.includes("resolve") || text.includes("correct")) {
    want = "to have this issue fixed";
  } else if (text.includes("improve") || text.includes("enhance") || text.includes("optimize")) {
    want = "to have this improved";
  }

  let benefit = "to achieve the desired outcome";
  if (text.includes("user experience") || text.includes("ux")) {
    benefit = "to improve user experience";
  } else if (text.includes("performance") || text.includes("speed")) {
    benefit = "to improve performance";
  } else if (text.includes("security") || text.includes("secure")) {
    benefit = "to improve security";
  } else if (text.includes("reliability") || text.includes("stability")) {
    benefit = "to improve reliability";
  }

  return { want, benefit };
}

function generateAcceptanceCriteria(type: string, description: string): string[] {
  const criteria: string[] = [];
  const text = (description || "").toLowerCase();

  if (type.toLowerCase() === "bug") {
    criteria.push("The bug is fixed and no longer occurs");
    criteria.push("The fix does not introduce new bugs");
    criteria.push("The fix is tested and verified");
  } else if (type.toLowerCase() === "feature") {
    criteria.push("The feature is implemented according to requirements");
    criteria.push("The feature is tested and working correctly");
    criteria.push("The feature is documented");
  } else if (type.toLowerCase() === "enhancement") {
    criteria.push("The enhancement improves the existing functionality");
    criteria.push("The enhancement is backward compatible");
    criteria.push("The enhancement is tested and verified");
  } else {
    criteria.push("The task is completed according to requirements");
    criteria.push("The task is tested and verified");
    criteria.push("The task meets quality standards");
  }

  if (text.includes("ui") || text.includes("design")) {
    criteria.push("The UI is responsive and works on all devices");
    criteria.push("The design follows the established design system");
  }

  if (text.includes("api") || text.includes("backend")) {
    criteria.push("The API endpoints are properly documented");
    criteria.push("The API includes proper error handling");
  }

  if (text.includes("security")) {
    criteria.push("Security requirements are met");
    criteria.push("The implementation follows security best practices");
  }

  return criteria;
}

function calculateBusinessValue(priority: string, type: string): number {
  let value = 3;

  switch (priority.toLowerCase()) {
    case "critical": value = 5; break;
    case "high": value = 4; break;
    case "medium": value = 3; break;
    case "low": value = 2; break;
  }

  switch (type.toLowerCase()) {
    case "bug": value = Math.max(value - 1, 1); break;
    case "feature": value = Math.min(value + 1, 5); break;
  }

  return value;
}

function generateTags(type: string, description: string, title: string): string[] {
  const tags: string[] = [];
  const text = `${title} ${description || ""}`.toLowerCase();

  tags.push(type.toLowerCase());

  if (text.includes("react") || text.includes("frontend") || text.includes("ui")) {
    tags.push("frontend", "react");
  }
  if (text.includes("api") || text.includes("backend") || text.includes("database")) {
    tags.push("backend", "api");
  }
  if (text.includes("auth") || text.includes("authentication") || text.includes("login")) {
    tags.push("authentication", "security");
  }
  if (text.includes("test") || text.includes("testing")) {
    tags.push("testing", "qa");
  }
  if (text.includes("design") || text.includes("ui/ux")) {
    tags.push("design", "ui-ux");
  }
  if (text.includes("performance") || text.includes("optimization")) {
    tags.push("performance", "optimization");
  }
  if (text.includes("mobile") || text.includes("responsive")) {
    tags.push("mobile", "responsive");
  }

  return [...new Set(tags)];
}

function calculateCompletionRate(status: string, resolution: string | null): number {
  if (status.toLowerCase() === "done" && resolution?.toLowerCase() === "fixed") {
    return 1.0;
  } else if (status.toLowerCase() === "done") {
    return 0.9;
  } else if (status.toLowerCase() === "in progress") {
    return 0.5;
  } else if (status.toLowerCase() === "to do") {
    return 0.0;
  } else {
    return 0.7;
  }
}

function generateSuccessPattern(type: string, status: string, resolution: string | null): string {
  if (status.toLowerCase() === "done" && resolution?.toLowerCase() === "fixed") {
    switch (type.toLowerCase()) {
      case "bug": return "Thorough testing and validation approach";
      case "feature": return "Incremental development with regular feedback";
      case "enhancement": return "Careful analysis of existing functionality";
      default: return "Clear requirements and systematic implementation";
    }
  } else {
    return "Standard development process";
  }
}

function generateAntiPatterns(type: string, status: string, resolution: string | null): string[] {
  const antiPatterns: string[] = [];

  if (status.toLowerCase() !== "done") {
    antiPatterns.push("Incomplete implementation");
  }

  if (
    type.toLowerCase() === "bug" &&
    status.toLowerCase() === "done" &&
    resolution?.toLowerCase() !== "fixed"
  ) {
    antiPatterns.push("Insufficient testing");
  }

  if (type.toLowerCase() === "feature") {
    antiPatterns.push("Scope creep");
    antiPatterns.push("Lack of user feedback");
  }

  return antiPatterns;
}

function determineComplexity(
  storyPoints: number,
  totalEffort: number
): "simple" | "moderate" | "complex" {
  const effortHours = totalEffort / 60;

  if (storyPoints <= 3 && effortHours <= 8) {
    return "simple";
  } else if (storyPoints <= 8 && effortHours <= 24) {
    return "moderate";
  } else {
    return "complex";
  }
}
