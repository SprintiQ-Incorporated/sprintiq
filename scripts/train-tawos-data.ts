#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import { generateEmbedding } from "../lib/embedding-service";

// Types
interface TAWOSIssue {
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

interface VectorStory {
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
    assignedTeamMember?: string;
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

// Configuration
const BATCH_SIZE = 50; // Process stories in batches to avoid rate limits
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!VOYAGE_API_KEY) {
  console.error("❌ VOYAGE_API_KEY environment variable is required");
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Supabase environment variables are required");
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Convert TAWOS issue to user story format
 */
function convertIssueToStory(issue: TAWOSIssue): {
  story: VectorStory;
  textForEmbedding: string;
} {
  // Extract role from issue type and description
  const role = extractRole(issue.Type, issue.Description_Text);

  // Extract want and benefit from title and description
  const { want, benefit } = extractWantAndBenefit(
    issue.Title,
    issue.Description_Text
  );

  // Generate acceptance criteria
  const acceptanceCriteria = generateAcceptanceCriteria(
    issue.Type,
    issue.Description_Text
  );

  // Calculate business value based on priority and type
  const businessValue = calculateBusinessValue(issue.Priority, issue.Type);

  // Generate tags based on content
  const tags = generateTags(issue.Type, issue.Description_Text, issue.Title);

  // Calculate completion rate based on status and resolution
  const completionRate = calculateCompletionRate(
    issue.Status,
    issue.Resolution
  );

  // Generate success pattern
  const successPattern = generateSuccessPattern(
    issue.Type,
    issue.Status,
    issue.Resolution
  );

  // Generate anti-patterns
  const antiPatterns = generateAntiPatterns(
    issue.Type,
    issue.Status,
    issue.Resolution
  );

  // Determine complexity
  const complexity = determineComplexity(
    issue.Story_Point,
    issue.Total_Effort_Minutes
  );

  // Calculate estimated time in hours
  const estimatedTime = Math.round(issue.Total_Effort_Minutes / 60);

  const story: VectorStory = {
    id: uuidv4(),
    embedding: [], // Will be filled later
    metadata: {
      title: issue.Title,
      description: issue.Description_Text || issue.Description,
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
      resolutionTime: issue.Resolution_Time_Minutes,
      totalEffort: issue.Total_Effort_Minutes,
      complexity,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Create text for embedding
  const textForEmbedding = `${issue.Title} ${
    issue.Description_Text || issue.Description
  } ${role} ${want} ${benefit} ${tags.join(" ")}`;

  return { story, textForEmbedding };
}

/**
 * Extract user role from issue type and description
 */
function extractRole(type: string, description: string): string {
  const text = (description || "").toLowerCase();

  if (type.toLowerCase() === "bug") {
    return "QA Engineer";
  } else if (type.toLowerCase() === "feature") {
    if (
      text.includes("ui") ||
      text.includes("design") ||
      text.includes("frontend")
    ) {
      return "UI/UX Designer";
    } else if (
      text.includes("api") ||
      text.includes("backend") ||
      text.includes("database")
    ) {
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

/**
 * Extract want and benefit from title and description
 */
function extractWantAndBenefit(
  title: string,
  description: string
): { want: string; benefit: string } {
  const text = `${title} ${description || ""}`.toLowerCase();

  // Extract want (what the user wants to do)
  let want = "to complete this feature";
  if (
    text.includes("implement") ||
    text.includes("add") ||
    text.includes("create")
  ) {
    want = "to have this functionality implemented";
  } else if (
    text.includes("fix") ||
    text.includes("resolve") ||
    text.includes("correct")
  ) {
    want = "to have this issue fixed";
  } else if (
    text.includes("improve") ||
    text.includes("enhance") ||
    text.includes("optimize")
  ) {
    want = "to have this improved";
  }

  // Extract benefit (why they want it)
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

/**
 * Generate acceptance criteria based on issue type and description
 */
function generateAcceptanceCriteria(
  type: string,
  description: string
): string[] {
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

  // Add specific criteria based on content
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

/**
 * Calculate business value based on priority and type
 */
function calculateBusinessValue(priority: string, type: string): number {
  let value = 3; // Default medium value

  // Adjust based on priority
  switch (priority.toLowerCase()) {
    case "critical":
      value = 5;
      break;
    case "high":
      value = 4;
      break;
    case "medium":
      value = 3;
      break;
    case "low":
      value = 2;
      break;
  }

  // Adjust based on type
  switch (type.toLowerCase()) {
    case "bug":
      value = Math.max(value - 1, 1); // Bugs typically have lower business value
      break;
    case "feature":
      value = Math.min(value + 1, 5); // Features typically have higher business value
      break;
  }

  return value;
}

/**
 * Generate tags based on content
 */
function generateTags(
  type: string,
  description: string,
  title: string
): string[] {
  const tags: string[] = [];
  const text = `${title} ${description || ""}`.toLowerCase();

  // Add type-based tags
  tags.push(type.toLowerCase());

  // Add technology tags
  if (
    text.includes("react") ||
    text.includes("frontend") ||
    text.includes("ui")
  ) {
    tags.push("frontend", "react");
  }
  if (
    text.includes("api") ||
    text.includes("backend") ||
    text.includes("database")
  ) {
    tags.push("backend", "api");
  }
  if (
    text.includes("auth") ||
    text.includes("authentication") ||
    text.includes("login")
  ) {
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

  // Remove duplicates and return
  return [...new Set(tags)];
}

/**
 * Calculate completion rate based on status and resolution
 */
function calculateCompletionRate(
  status: string,
  resolution: string | null
): number {
  if (
    status.toLowerCase() === "done" &&
    resolution?.toLowerCase() === "fixed"
  ) {
    return 1.0; // 100% completion
  } else if (status.toLowerCase() === "done") {
    return 0.9; // 90% completion
  } else if (status.toLowerCase() === "in progress") {
    return 0.5; // 50% completion
  } else if (status.toLowerCase() === "to do") {
    return 0.0; // 0% completion
  } else {
    return 0.7; // Default 70% completion
  }
}

/**
 * Generate success pattern based on issue characteristics
 */
function generateSuccessPattern(
  type: string,
  status: string,
  resolution: string | null
): string {
  if (
    status.toLowerCase() === "done" &&
    resolution?.toLowerCase() === "fixed"
  ) {
    switch (type.toLowerCase()) {
      case "bug":
        return "Thorough testing and validation approach";
      case "feature":
        return "Incremental development with regular feedback";
      case "enhancement":
        return "Careful analysis of existing functionality";
      default:
        return "Clear requirements and systematic implementation";
    }
  } else {
    return "Standard development process";
  }
}

/**
 * Generate anti-patterns based on issue characteristics
 */
function generateAntiPatterns(
  type: string,
  status: string,
  resolution: string | null
): string[] {
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

/**
 * Determine complexity based on story points and effort
 */
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

/**
 * Process TAWOS data and store in Supabase
 */
async function processTAWOSData(filePath: string): Promise<void> {
  try {
    // Read and parse JSON file
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const issues: TAWOSIssue[] = JSON.parse(fileContent);

    // Convert issues to stories
    const stories: VectorStory[] = [];
    const embeddingTexts: string[] = [];

    for (const issue of issues) {
      const { story, textForEmbedding } = convertIssueToStory(issue);
      stories.push(story);
      embeddingTexts.push(textForEmbedding);
    }

    // Generate embeddings in batches
    const batches = [];
    for (let i = 0; i < stories.length; i += BATCH_SIZE) {
      batches.push({
        stories: stories.slice(i, i + BATCH_SIZE),
        texts: embeddingTexts.slice(i, i + BATCH_SIZE),
      });
    }

    let totalProcessed = 0;
    let totalSuccess = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      // Generate embeddings for this batch
      const embeddingResults = await Promise.all(
        batch.texts.map((text) => generateEmbedding(text))
      );

      // Update stories with embeddings
      const storiesWithEmbeddings = batch.stories.map((story, index) => ({
        ...story,
        embedding: embeddingResults[index]?.embedding || [],
      }));

      // Filter out stories without embeddings
      const validStories = storiesWithEmbeddings.filter(
        (story) => story.embedding.length > 0
      );

      if (validStories.length === 0) {
        continue;
      }

      // Store in Supabase
      const { error } = await supabase
        .from("tawos_user_stories")
        .insert(validStories);

      if (error) {
        console.error(`❌ Error storing batch ${batchIndex + 1}:`, error);
      } else {
        totalSuccess += validStories.length;
      }

      totalProcessed += batch.stories.length;

      // Add delay between batches to avoid rate limits
      if (batchIndex < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  } catch (error) {
    console.error("Error processing TAWOS data:", error);
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: tsx scripts/train-tawos-data.ts <path-to-json-file>");
    console.log(
      "Example: tsx scripts/train-tawos-data.ts public/sample-tawos-dataset.json"
    );
    process.exit(1);
  }

  const filePath = args[0];

  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    process.exit(1);
  }

  await processTAWOSData(filePath);
}

// Run the script
main().catch(console.error);
