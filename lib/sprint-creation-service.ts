// SprintiQ.ai Enhanced Sprint Creation Service
// Comprehensive algorithm for creating detailed 2-week sprints with AI-Native optimization

import type { UserStory, TeamMember, Sprint } from "@/types";
import { HOURS_PER_STORY_POINT } from "@/lib/constants/statusTypes";
import { nanoid } from "nanoid";
import { generateSprintGoalCompletion } from "@/lib/ai-provider";
import {
  formatSprintDescription,
  formatUserStory,
  mergeAcceptanceCriteria,
  validateGoalStatement,
} from "@/lib/prompts/sprint-description-prompts";
export interface SprintCreationConfig {
  // Sprint Configuration
  sprintDuration: number; // Default 14 days (2 weeks)
  workingDaysPerWeek: number;
  hoursPerDay: number;
  velocityBuffer: number; // 80% of capacity to account for overhead

  // Risk Thresholds
  riskThresholds: {
    low: number;
    medium: number;
    high: number;
  };

  // Priority Weights (from SprintiQ.ai specs)
  priorityWeights: {
    businessValue: number;
    userImpact: number;
    complexity: number;
    risk: number;
    dependencies: number;
  };

  // AI Model Configuration
  aiModel: string;
  maxRetries: number;
}

export interface SprintMetrics {
  storyCount: number;
  totalStoryPoints: number;
  totalHours: number;
  utilization: {
    storyPoints: number;
    hours: number;
  };
  priorityDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  avgBusinessValue: number;
  avgComplexity: number;
  isOverCapacity: boolean;
}

export interface RiskAssessment {
  overallRisk: number;
  riskLevel: "Very-low" | "Low" | "Medium" | "High";
  riskFactors: {
    technicalComplexity: number;
    dependencyRisk: number;
    capacityRisk: number;
    uncertaintyRisk: number;
    velocityRisk: number;
  };
  riskScore: number;
  confidence: number;
}

export interface MitigationStrategy {
  type: "technical" | "dependency" | "capacity" | "uncertainty" | "velocity";
  priority: "critical" | "high" | "medium" | "low";
  description: string;
  action: string;
  effort: "low" | "medium" | "high";
}

export interface SprintDocumentation {
  overview: string;
  objectives: string[];
  stories: string;
  riskSummary: string;
  keyDates: {
    startDate: string;
    endDate: string;
    duration: string;
  };
  success_criteria: string[];
}

export interface SprintRecommendation {
  type: "capacity" | "risk" | "dependencies" | "balance";
  priority: "critical" | "high" | "medium" | "low";
  message: string;
  action: string;
}

export interface EnhancedSprint extends Sprint {
  metrics: SprintMetrics;
  riskAssessment: RiskAssessment;
  mitigationStrategies: MitigationStrategy[];
  documentation: SprintDocumentation;
  recommendations: SprintRecommendation[];
  goal: string;
  generated: {
    timestamp: string;
    version: string;
    agent: string;
  };
}

export class SprintCreationService {
  private config: SprintCreationConfig;

  constructor(config: Partial<SprintCreationConfig> = {}) {
    this.config = {
      // Sprint Configuration
      sprintDuration: 14, // 2 weeks in days
      workingDaysPerWeek: 5,
      hoursPerDay: 8,
      velocityBuffer: 0.8, // 80% of capacity to account for overhead

      // Risk Thresholds
      riskThresholds: {
        low: 2.0,
        medium: 3.5,
        high: 5.0,
      },

      // Priority Weights (from SprintiQ.ai specs)
      priorityWeights: {
        businessValue: 30,
        userImpact: 25,
        complexity: 20,
        risk: 15,
        dependencies: 10,
      },

      // AI Model Configuration
      aiModel: "claude-sonnet-4-6",
      maxRetries: 3,

      ...config,
    };
  }

  /**
   * Main function to create 2-week sprints from generated user stories
   */
  async createDetailedSprints(
    userStories: UserStory[],
    teamCapacity: any,
    teamMembers: TeamMember[],
    projectContext: any
  ): Promise<EnhancedSprint[]> {
    try {
      // Step 0: Assign childTaskIds for all stories
      const userStoriesWithChildren = this.assignChildTaskIds(userStories);
      // Step 1: Validate and preprocess data
      const validatedData = this.validateInputData(
        userStoriesWithChildren,
        teamCapacity,
        teamMembers
      );

      // Step 2: Calculate story priorities and dependencies
      const prioritizedStories = await this.calculateStoriesMetrics(
        validatedData.stories
      );

      // Step 3: Analyze dependencies and create dependency graph
      const dependencyGraph = this.buildDependencyGraph(prioritizedStories);

      // Step 4: Calculate team capacity for 2-week sprints
      const sprintCapacity = this.calculateSprintCapacity(
        validatedData.teamCapacity,
        validatedData.teamMembers
      );

      const totalWeeklyHours = teamMembers.reduce(
        (sum, member) => sum + (member.availability || 40),
        0
      );

      // Step 5: Generate optimal sprint assignments
      const sprints = await this.generateOptimalSprints(
        prioritizedStories,
        dependencyGraph,
        sprintCapacity,
        projectContext
      );

      // Step 6: Perform risk assessment for each sprint (pass all stories)
      const riskedSprints = await this.performRiskAssessment(
        sprints,
        prioritizedStories
      );

      // Step 7: Generate sprint documentation and recommendations (directly)
      const documentedSprints: EnhancedSprint[] = [];
      for (const sprint of riskedSprints) {
        const documentation = await this.generateSprintDocs(
          sprint,
          projectContext
        );
        const recommendations = await this.generateSprintRecommendations(
          sprint
        );
        documentedSprints.push({
          ...sprint,
          documentation,
          recommendations,
        });
      }

      return documentedSprints;
    } catch (error) {
      throw new Error(
        `Sprint creation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Validate and preprocess input data
   */
  private validateInputData(
    userStories: UserStory[],
    teamCapacity: any,
    teamMembers: TeamMember[]
  ) {
    if (
      !userStories ||
      !Array.isArray(userStories) ||
      userStories.length === 0
    ) {
      throw new Error("User stories array is required and cannot be empty");
    }

    if (!teamCapacity || typeof teamCapacity !== "object") {
      throw new Error("Team capacity object is required");
    }

    if (
      !teamMembers ||
      !Array.isArray(teamMembers) ||
      teamMembers.length === 0
    ) {
      throw new Error("Team members array is required and cannot be empty");
    }

    // Ensure all stories have required fields
    const validatedStories = userStories.map((story) => ({
      ...story,
      id: story.id || this.generateUniqueId(),
      title: story.title || "Untitled Story",
      description: story.description || "",
      acceptanceCriteria: story.acceptanceCriteria || [],
      // Use provided storyPoints, or default to 1 if missing
      storyPoints: story.storyPoints || 1,
      businessValue: story.businessValue || 3,
      userImpact: story.userImpact || 3,
      complexity: story.complexity || 3,
      risk: story.risk || 3,
      dependencies: story.dependencies || [],
      tags: story.tags || [],
      priority: (story.priority || "medium") as
        | "Low"
        | "Medium"
        | "High"
        | "Critical",
      // Keep estimatedHours for reference only
      estimatedHours: story.estimatedHours || story.estimatedTime || undefined,
    }));

    return {
      stories: validatedStories,
      teamCapacity,
      teamMembers,
    };
  }

  /**
   * Calculate priority scores and story metrics using SprintiQ.ai algorithm
   */
  private async calculateStoriesMetrics(
    stories: UserStory[]
  ): Promise<UserStory[]> {
    const prioritizedStories = stories.map((story) => {
      // Calculate priority score using weighted algorithm
      const priorityScore = this.calculatePriorityScore(story);

      // Assign priority level based on score
      const priorityLevel = this.assignPriorityLevel(priorityScore);

      // Calculate dependency score
      const dependencyScore = this.calculateDependencyScore(story);

      return {
        ...story,
        priorityScore,
        priorityLevel,
        dependencyScore,
        calculatedAt: new Date().toISOString(),
      };
    });

    // Sort by priority score (descending) and dependency score (ascending)
    return prioritizedStories.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return (b.priorityScore || 0) - (a.priorityScore || 0);
      }
      return (a.dependencyScore || 0) - (b.dependencyScore || 0);
    });
  }

  /**
   * Calculate priority score using multi-factor weighted scoring
   */
  private calculatePriorityScore(story: UserStory): number {
    const weights = this.config.priorityWeights;
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);

    // Normalize weights to sum to 100%
    const normalizedWeights: any = {};
    Object.keys(weights).forEach((key) => {
      normalizedWeights[key] =
        (weights[key as keyof typeof weights] / totalWeight) * 100;
    });

    // Calculate weighted score with inversions for negative factors
    const score =
      ((story.businessValue || 3) * normalizedWeights.businessValue) / 100 +
      ((story.userImpact || 3) * normalizedWeights.userImpact) / 100 +
      ((6 - (story.complexity || 3)) * normalizedWeights.complexity) / 100 + // Inverted
      ((6 - (story.risk || 3)) * normalizedWeights.risk) / 100 + // Inverted
      (this.calculateDependencyScore(story) * normalizedWeights.dependencies) /
        100;

    return Math.round(score * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Assign priority level based on score
   */
  private assignPriorityLevel(score: number): string {
    if (score >= 4.5) return "critical";
    if (score >= 3.5) return "high";
    if (score >= 2.5) return "medium";
    if (score >= 1.5) return "low";
    return "backlog";
  }

  /**
   * Calculate dependency score
   */
  private calculateDependencyScore(story: UserStory): number {
    const dependencyCount = story.dependencies ? story.dependencies.length : 0;

    // Stories with fewer dependencies score higher
    // Base score of 3, reduced by 0.5 for each dependency
    let score = 3.0;
    score -= dependencyCount * 0.5;

    // Ensure score stays within 1-5 range
    return Math.max(1, Math.min(5, score));
  }

  /**
   * Build dependency graph to understand story relationships
   */
  private buildDependencyGraph(stories: UserStory[]): Map<string, any> {
    const dependencyGraph = new Map();

    stories.forEach((story) => {
      const dependencies = story.dependencies || [];
      dependencyGraph.set(story.id, {
        story,
        dependencies: dependencies.filter((depId) =>
          stories.find((s) => s.id === depId)
        ),
        dependents: [],
      });
    });

    // Build reverse dependencies (dependents)
    dependencyGraph.forEach((node, storyId) => {
      node.dependencies.forEach((depId: string) => {
        if (dependencyGraph.has(depId)) {
          dependencyGraph.get(depId).dependents.push(storyId);
        }
      });
    });

    // Detect circular dependencies
    this.detectCircularDependencies(dependencyGraph);

    return dependencyGraph;
  }

  /**
   * Detect circular dependencies in the dependency graph
   */
  private detectCircularDependencies(dependencyGraph: Map<string, any>): void {
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        return true;
      }
      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = dependencyGraph.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          if (hasCycle(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of dependencyGraph.keys()) {
      if (hasCycle(nodeId)) {
      }
    }
  }

  /**
   * Calculate team capacity for a sprint, scaling by sprint duration (in days)
   */
  private calculateSprintCapacity(
    teamCapacity: any,
    teamMembers: TeamMember[]
  ) {
    const sprintDurationWeeks = this.config.sprintDuration / 7;
    let totalStoryPoints = 0;
    const memberCapacities = teamMembers.map((member) => {
      const weeklyHours = member.availability || 40;
      const memberPoints = (weeklyHours * sprintDurationWeeks) / HOURS_PER_STORY_POINT;
      const adjustedPoints = Math.floor(
        memberPoints * this.config.velocityBuffer
      );
      totalStoryPoints += adjustedPoints;
      return {
        memberId: member.id,
        name: member.name,
        role: member.role,
        skills: member.skills || [],
        velocity: member.velocity || 10,
        weeklyHours,
        sprintWeeks: sprintDurationWeeks,
        memberPoints,
        adjustedPoints,
      };
    });
    // Calculate totalHours for the sprint (sum of all members' weekly hours * sprint duration in weeks)
    const totalWeeklyHours = teamMembers.reduce(
      (sum, member) => sum + (member.availability || 40),
      0
    );
    const totalHours = totalWeeklyHours * sprintDurationWeeks;
    return {
      totalHours,
      totalStoryPoints,
      memberCapacities,
      velocityBuffer: this.config.velocityBuffer,
    };
  }

  /**
   * Build dependency groups so that all related stories (dependencies, childTaskIds, parentTaskId) are grouped together
   */
  private buildDependencyGroups(stories: UserStory[]): UserStory[][] {
    const groups: UserStory[][] = [];
    const visited = new Set<string>();

    // Helper to collect all related stories recursively
    function collectGroup(
      story: UserStory,
      allStories: UserStory[],
      group: Set<string>
    ) {
      if (group.has(story.id)) return;
      group.add(story.id);
      // Traverse dependencies
      if (story.dependencies) {
        for (const depId of story.dependencies) {
          const depStory = allStories.find((s) => s.id === depId);
          if (depStory) collectGroup(depStory, allStories, group);
        }
      }
      // Traverse childTaskIds
      if (story.childTaskIds) {
        for (const childId of story.childTaskIds) {
          const childStory = allStories.find((s) => s.id === childId);
          if (childStory) collectGroup(childStory, allStories, group);
        }
      }
      // Traverse parentTaskId
      if (story.parentTaskId) {
        const parentStory = allStories.find((s) => s.id === story.parentTaskId);
        if (parentStory) collectGroup(parentStory, allStories, group);
      }
    }

    for (const story of stories) {
      if (visited.has(story.id)) continue;
      const group = new Set<string>();
      collectGroup(story, stories, group);
      // Only add group if it has at least one new story
      const groupStories = Array.from(group)
        .map((id) => stories.find((s) => s.id === id)!)
        .filter(Boolean);
      if (groupStories.length > 0) {
        groupStories.forEach((s) => visited.add(s.id));
        groups.push(groupStories);
      }
    }
    return groups;
  }

  /**
   * Generate optimal sprint assignments using AI-Native optimization
   */
  private async generateOptimalSprints(
    stories: UserStory[],
    dependencyGraph: Map<string, any>,
    sprintCapacity: any,
    projectContext: any
  ): Promise<EnhancedSprint[]> {
    const sprints: EnhancedSprint[] = [];
    const storyMap = new Map(stories.map((s) => [s.id, s]));
    const scheduledStories = new Set<string>();
    const sprintNumber = 1;

    // Check if there are any parent-child dependencies
    const hasDependencies = stories.some((s) => s.parentTaskId);

    if (hasDependencies) {
      // Use dependency-aware assignment
      return this.generateDependencyAwareSprints(
        stories,
        sprintCapacity,
        projectContext,
        sprintNumber
      );
    } else {
      // Use simple capacity-based assignment for independent stories
      return this.generateSimpleSprints(
        stories,
        sprintCapacity,
        projectContext,
        sprintNumber
      );
    }
  }

  /**
   * Generate sprints with dependency awareness
   */
  private async generateDependencyAwareSprints(
    stories: UserStory[],
    sprintCapacity: any,
    projectContext: any,
    startSprintNumber: number
  ): Promise<EnhancedSprint[]> {
    const sprints: EnhancedSprint[] = [];
    const storyMap = new Map(stories.map((s) => [s.id, s]));
    const scheduledStories = new Set<string>();
    let sprintNumber = startSprintNumber;

    // Build parent-child groups: each parent with its children
    const parentStories = stories.filter((s) => !s.parentTaskId);
    // Sort parents by priority (Critical > High > Medium > Low), then by priorityScore
    const priorityOrder = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    parentStories.sort((a, b) => {
      const aPriority = priorityOrder[a.priority || "Medium"];
      const bPriority = priorityOrder[b.priority || "Medium"];
      if (aPriority !== bPriority) return bPriority - aPriority;
      return (b.priorityScore || 0) - (a.priorityScore || 0);
    });

    // Helper to get all children for a parent, sorted by priority
    function getChildren(parent: UserStory): UserStory[] {
      return stories
        .filter((s) => s.parentTaskId === parent.id)
        .sort((a, b) => {
          const aPriority = priorityOrder[a.priority || "Medium"];
          const bPriority = priorityOrder[b.priority || "Medium"];
          if (aPriority !== bPriority) return bPriority - aPriority;
          return (b.priorityScore || 0) - (a.priorityScore || 0);
        });
    }

    // Track unassigned stories
    const unassignedStories = new Set(stories.map((s) => s.id));
    // Maintain a queue of unscheduled children (by parent id)
    let unscheduledChildren: string[] = [];
    let parentIndex = 0;

    while (unassignedStories.size > 0) {
      let remainingCapacity = sprintCapacity.totalStoryPoints;
      const sprintStories: UserStory[] = [];
      let addedInThisSprint = false;

      // 1. Always process unscheduled children first (from previous parent)
      if (unscheduledChildren.length > 0) {
        const childrenToSchedule: string[] = [];
        for (const childId of unscheduledChildren) {
          if (!unassignedStories.has(childId)) continue;
          const child = storyMap.get(childId);
          if (!child) continue;
          if ((child.storyPoints || 0) <= remainingCapacity) {
            sprintStories.push(child);
            unassignedStories.delete(child.id);
            scheduledStories.add(child.id);
            remainingCapacity -= child.storyPoints || 0;
            childrenToSchedule.push(childId);
            addedInThisSprint = true;
          }
        }
        // Remove scheduled children from the queue
        unscheduledChildren = unscheduledChildren.filter(
          (id) => !childrenToSchedule.includes(id)
        );
      }

      // 2. If no unscheduled children, process next parent group
      if (
        unscheduledChildren.length === 0 &&
        parentIndex < parentStories.length
      ) {
        const parent = parentStories[parentIndex];
        if (unassignedStories.has(parent.id)) {
          const children = getChildren(parent).filter((c) =>
            unassignedStories.has(c.id)
          );
          const group = [parent, ...children];
          const groupPoints = group.reduce(
            (sum, s) => sum + (s.storyPoints || 0),
            0
          );
          if (groupPoints <= remainingCapacity) {
            // All fit, schedule together
            for (const s of group) {
              sprintStories.push(s);
              unassignedStories.delete(s.id);
              scheduledStories.add(s.id);
            }
            remainingCapacity -= groupPoints;
            addedInThisSprint = true;
          } else {
            // Not all fit: always schedule parent, then as many children as possible by priority
            if ((parent.storyPoints || 0) <= remainingCapacity) {
              sprintStories.push(parent);
              unassignedStories.delete(parent.id);
              scheduledStories.add(parent.id);
              remainingCapacity -= parent.storyPoints || 0;
              const scheduledChildIds: string[] = [];
              for (const child of children) {
                if ((child.storyPoints || 0) <= remainingCapacity) {
                  sprintStories.push(child);
                  unassignedStories.delete(child.id);
                  scheduledStories.add(child.id);
                  remainingCapacity -= child.storyPoints || 0;
                  scheduledChildIds.push(child.id);
                }
              }
              // Queue up remaining children for next sprint(s)
              unscheduledChildren = children
                .map((c) => c.id)
                .filter((id) => !scheduledChildIds.includes(id));
              addedInThisSprint = true;
            }
          }
        }
        parentIndex++;
      }

      // 3. If nothing could be added (e.g., a single story is too big), force add the smallest unassigned story
      if (!addedInThisSprint && unassignedStories.size > 0) {
        const smallestStoryId = Array.from(unassignedStories).reduce(
          (minId, currId) => {
            const currPoints = storyMap.get(currId)?.storyPoints || Infinity;
            const minPoints = storyMap.get(minId)?.storyPoints || Infinity;
            return currPoints < minPoints ? currId : minId;
          },
          Array.from(unassignedStories)[0]
        );
        const story = storyMap.get(smallestStoryId);
        if (story) {
          sprintStories.push(story);
          unassignedStories.delete(smallestStoryId);
          scheduledStories.add(smallestStoryId);
        }
      }

      // Create sprint
      const sprint = await this.createSprintObject(
        sprintStories,
        sprintCapacity,
        projectContext,
        sprintNumber
      );
      sprints.push(sprint);
      sprintNumber++;

      // Safety check to prevent infinite loops
      if (sprintNumber > 20) {
        break;
      }
    }

    return sprints;
  }

  /**
   * Generate simple sprints for independent stories (no dependencies)
   */
  private async generateSimpleSprints(
    stories: UserStory[],
    sprintCapacity: any,
    projectContext: any,
    startSprintNumber: number
  ): Promise<EnhancedSprint[]> {
    const sprints: EnhancedSprint[] = [];
    const storyMap = new Map(stories.map((s) => [s.id, s]));
    const unassignedStories = new Set(stories.map((s) => s.id));
    let sprintNumber = startSprintNumber;

    // Sort stories by priority (Critical > High > Medium > Low), then by priorityScore
    const priorityOrder = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    const sortedStories = stories.sort((a, b) => {
      const aPriority = priorityOrder[a.priority || "Medium"];
      const bPriority = priorityOrder[b.priority || "Medium"];
      if (aPriority !== bPriority) return bPriority - aPriority;
      return (b.priorityScore || 0) - (a.priorityScore || 0);
    });

    while (unassignedStories.size > 0) {
      let remainingCapacity = sprintCapacity.totalStoryPoints;
      const sprintStories: UserStory[] = [];

      // Add stories to current sprint based on capacity and priority
      for (const story of sortedStories) {
        if (!unassignedStories.has(story.id)) continue;

        const storyPoints = story.storyPoints || 0;
        if (storyPoints <= remainingCapacity) {
          sprintStories.push(story);
          unassignedStories.delete(story.id);
          remainingCapacity -= storyPoints;
        }
      }

      // If no stories could be added (e.g., a single story is too big), force add the smallest unassigned story
      if (sprintStories.length === 0 && unassignedStories.size > 0) {
        const smallestStoryId = Array.from(unassignedStories).reduce(
          (minId, currId) => {
            const currPoints = storyMap.get(currId)?.storyPoints || Infinity;
            const minPoints = storyMap.get(minId)?.storyPoints || Infinity;
            return currPoints < minPoints ? currId : minId;
          },
          Array.from(unassignedStories)[0]
        );
        const story = storyMap.get(smallestStoryId);
        if (story) {
          sprintStories.push(story);
          unassignedStories.delete(smallestStoryId);
        }
      }

      // Create sprint
      const sprint = await this.createSprintObject(
        sprintStories,
        sprintCapacity,
        projectContext,
        sprintNumber
      );
      sprints.push(sprint);
      sprintNumber++;

      // Safety check to prevent infinite loops
      if (sprintNumber > 20) {
        break;
      }
    }

    return sprints;
  }

  /**
   * Create sprint object with common logic
   */
  private async createSprintObject(
    sprintStories: UserStory[],
    sprintCapacity: any,
    projectContext: any,
    sprintNumber: number
  ): Promise<EnhancedSprint> {
    // Calculate sprint dates
    const sprintDates = this.calculateSprintDates(
      sprintNumber,
      projectContext.startDate
    );

    // Calculate sprint metrics
    const sprintMetrics = this.calculateSprintMetrics(
      sprintStories,
      sprintCapacity
    );

    // Generate sprint goal using AI - call method directly instead of HTTP endpoint
    const sprintGoal = await this.generateSprintGoal(sprintStories, projectContext);

    // Create sprint object
    const sprint: EnhancedSprint = {
      id: this.generateUniqueId(),
      name: `Sprint ${sprintNumber}`,
      goal: sprintGoal,
      startDate: new Date(sprintDates.startDate),
      endDate: new Date(sprintDates.endDate),
      duration: this.config.sprintDuration / 7, // Convert to weeks
      capacity: sprintCapacity.totalStoryPoints,
      stories: sprintStories,
      teamMembers: [], // Will be populated later
      velocity: sprintCapacity.totalStoryPoints,
      status: "Planning",
      metrics: sprintMetrics,
      riskAssessment: {} as RiskAssessment, // Will be populated later
      mitigationStrategies: [], // Will be populated later
      documentation: {} as SprintDocumentation, // Will be populated later
      recommendations: [], // Will be populated later
      generated: {
        timestamp: new Date().toISOString(),
        version: "1.0",
        agent: "SprintiQ.ai Sprint Creation Agent",
      },
    };

    return sprint;
  }

  /**
   * Calculate sprint dates based on sprint number and project start date
   */
  private calculateSprintDates(
    sprintNumber: number,
    projectStartDate?: string
  ) {
    const startDate = new Date(projectStartDate || new Date());

    // Calculate sprint start date (skip weekends)
    const daysToAdd = (sprintNumber - 1) * this.config.sprintDuration;
    const sprintStart = this.addBusinessDays(startDate, daysToAdd);

    // Calculate sprint end date
    const sprintEnd = this.addBusinessDays(
      sprintStart,
      this.config.sprintDuration - 1
    );

    return {
      startDate: sprintStart.toISOString().split("T")[0],
      endDate: sprintEnd.toISOString().split("T")[0],
    };
  }

  /**
   * Add business days to a date (skip weekends)
   */
  private addBusinessDays(date: Date, days: number): Date {
    const result = new Date(date);
    let addedDays = 0;

    while (addedDays < days) {
      result.setDate(result.getDate() + 1);
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        addedDays++;
      }
    }

    return result;
  }

  /**
   * Calculate sprint metrics
   */
  private calculateSprintMetrics(
    sprintStories: UserStory[],
    sprintCapacity: any
  ): SprintMetrics {
    const totalStoryPoints = sprintStories.reduce(
      (sum, story) => sum + (story.storyPoints || 0),
      0
    );

    // Calculate total hours from stories' estimated hours
    const totalHours = sprintStories.reduce(
      (sum, story) => sum + (story.estimatedHours || 0),
      0
    );

    // teamCapacity.totalHours should be passed in or calculated as above
    const hoursUtilization = sprintCapacity.totalHours
      ? (totalHours / sprintCapacity.totalHours) * 100
      : 0;

    const utilization = {
      storyPoints: (totalStoryPoints / sprintCapacity.totalStoryPoints) * 100,
      hours: hoursUtilization,
    };

    const priorityDistribution = {
      critical: sprintStories.filter((s) => s.priority === "Critical").length,
      high: sprintStories.filter((s) => s.priority === "High").length,
      medium: sprintStories.filter((s) => s.priority === "Medium").length,
      low: sprintStories.filter((s) => s.priority === "Low").length,
    };

    const avgBusinessValue =
      sprintStories.reduce((sum, s) => sum + (s.businessValue || 0), 0) /
      sprintStories.length;

    const avgComplexity =
      sprintStories.reduce((sum, s) => sum + (s.complexity || 0), 0) /
      sprintStories.length;
    return {
      storyCount: sprintStories.length,
      totalStoryPoints,
      totalHours,
      utilization,
      priorityDistribution,
      avgBusinessValue: Math.round(avgBusinessValue * 10) / 10,
      avgComplexity: Math.round(avgComplexity * 10) / 10,
      isOverCapacity: utilization.storyPoints > 100,
    };
  }

  /**
   * Generate sprint goal using Claude AI based on the sprint's stories
   */
  public async generateSprintGoal(
    sprintStories: UserStory[],
    projectContext: any
  ): Promise<string> {
    try {
      if (!sprintStories || sprintStories.length === 0) {
        return "Complete planned user stories for this sprint.";
      }

      // Check for Anthropic API key
      const apiKey = process.env.ANTHROPIC_API_KEY;

      if (!apiKey) {
        return this.generateFallbackSprintGoal(sprintStories);
      }

      // Prepare stories data for AI analysis
      const storiesData = sprintStories.map((story) => ({
        title: story.title,
        description: story.description,
        role: story.role,
        want: story.want,
        benefit: story.benefit,
        priority: story.priority,
        storyPoints: story.storyPoints,
        businessValue: story.businessValue,
        tags: story.tags || [],
      }));

      // Analyze stories to extract key insights
      const totalStoryPoints = sprintStories.reduce(
        (sum, s) => sum + (s.storyPoints || 0),
        0
      );
      const priorities = sprintStories.map((s) => s.priority).filter(Boolean);
      const roles = [
        ...new Set(sprintStories.map((s) => s.role).filter(Boolean)),
      ];
      const tags = [...new Set(sprintStories.flatMap((s) => s.tags || []))];

      // Extract common themes and business objectives
      const wants = sprintStories.map((s) => s.want).filter(Boolean);
      const benefits = sprintStories.map((s) => s.benefit).filter(Boolean);

      // Calculate business value metrics
      const avgBusinessValue =
        sprintStories.reduce((sum, s) => sum + (s.businessValue || 0), 0) /
        sprintStories.length;
      const highValueStories = sprintStories.filter(
        (s) => (s.businessValue || 0) >= 4
      );

      // Analyze story patterns and themes
      const storyThemes = this.analyzeStoryThemes(sprintStories);
      const userJourney = this.analyzeUserJourney(sprintStories);
      const businessImpact = this.analyzeBusinessImpact(sprintStories);

      const prompt = `
You are an expert Agile coach and product manager with deep experience in creating meaningful sprint goals. Your task is to analyze the user stories in this sprint and create a compelling, business-focused sprint goal that captures the essence of what the team will deliver.

SPRINT CONTEXT:
- Sprint Duration: ${this.config.sprintDuration / 7} weeks
- Total Stories: ${sprintStories.length}
- Total Story Points: ${totalStoryPoints}
- Team Capacity: ${(this.config.sprintDuration / 7) * 40} hours (estimated)

STORY ANALYSIS:
${storiesData
  .map(
    (story, index) => `
${index + 1}. **${story.title}**
   - User Role: ${story.role}
   - User Want: ${story.want}
   - Business Benefit: ${story.benefit}
   - Priority: ${story.priority}
   - Story Points: ${story.storyPoints}
   - Business Value: ${story.businessValue}/5
   - Technical Tags: ${story.tags.join(", ") || "None"}
   - Full Description: ${story.description}
`
  )
  .join("\n")}

KEY INSIGHTS:
- User Roles: ${roles.join(", ")}
- Priority Distribution: ${priorities.join(", ")}
- Technical Focus: ${tags.join(", ")}
- Average Business Value: ${avgBusinessValue.toFixed(1)}/5
- High-Value Stories: ${highValueStories.length} (${(
        (highValueStories.length / sprintStories.length) *
        100
      ).toFixed(0)}%)

STORY THEME ANALYSIS:
- Primary Theme: ${storyThemes.primaryTheme}
- Secondary Themes: ${storyThemes.secondaryThemes.join(", ")}
- Technical Focus Areas: ${storyThemes.technicalFocus.join(", ")}

USER JOURNEY ANALYSIS:
- Primary User: ${userJourney.primaryUser}
- Key User Actions: ${userJourney.userActions.join(", ")}
- User Goals: ${userJourney.userGoals.join(", ")}

BUSINESS IMPACT ANALYSIS:
- Business Objectives: ${businessImpact.businessObjectives.join(", ")}
- Value Metrics: ${businessImpact.valueMetrics.join(", ")}
- Impact Level: ${businessImpact.impactLevel}

ANALYSIS INSTRUCTIONS:
1. **Identify the primary user journey or business objective** that these stories collectively address
2. **Analyze the business value and user impact** - what will users be able to do that they couldn't before?
3. **Look for patterns in user roles, wants, and benefits** to understand the unified goal
4. **Consider the technical complexity and business priority** to understand the scope
5. **Identify the measurable outcome** that stakeholders will see as success

FOCUS ON:
- The ${userJourney.primaryUser} experience and their main goals
- The ${storyThemes.primaryTheme} functionality and its business value
- How the ${businessImpact.businessObjectives.join(
        ", "
      )} objectives will be achieved
- The ${businessImpact.impactLevel} impact level and its significance

SPRINT GOAL REQUIREMENTS:
- **Business-focused**: Focus on user value and business outcomes, not technical implementation
- **Unified objective**: Capture the main theme that connects all stories
- **Measurable success**: Stakeholders should understand what success looks like
- **Inspiring**: Motivate the team with clear purpose
- **Concise**: 1-2 sentences maximum
- **User-centric**: Use language that focuses on user experience and business value

EXAMPLES OF GOOD SPRINT GOALS:
- "Enable secure user authentication and account management to improve user onboarding and retention"
- "Deliver core dashboard functionality to provide users with real-time insights and data visualization"
- "Implement payment processing and order management to enable e-commerce transactions"
- "Build user profile and preferences system to personalize the user experience"
- "Create comprehensive reporting and analytics to empower data-driven decision making"
- "Establish robust data management and backup systems to ensure business continuity"

EXAMPLES OF BAD SPRINT GOALS (avoid these):
- "Deliver the following key stories: User Login and Password Reset"
- "Focus on delivering: Authentication, Dashboard, Profile"
- "Complete 5 user stories with 25 story points"
- "Implement user authentication system and user dashboard interface"

GOAL GENERATION GUIDELINES:
- Start with the primary user action or business capability
- Include the business outcome or user benefit
- Use active, present-tense language
- Focus on the "what" and "why" rather than the "how"
- Make it specific enough to measure success

Based on your analysis of the stories above, create a compelling sprint goal that captures the unified business objective and user value these stories will deliver.

Return ONLY the sprint goal text, no additional formatting or explanations.
`;

      // Use AI provider routing - COMPLEX task (always Claude for sprint goals)
      // 15s timeout — enforces SLA before ai-provider's global 30s fires
      const aiResult = await Promise.race([
        generateSprintGoalCompletion(prompt),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Sprint goal generation timed out (15s SLA)")),
            15_000
          )
        ),
      ]);
      const goal = aiResult.text.trim();

      if (goal && goal.length > 10 && goal.length < 500) {
        return goal;
      } else {
        return this.generateFallbackSprintGoal(sprintStories);
      }
    } catch {
      return this.generateFallbackSprintGoal(sprintStories);
    }
  }

  /**
   * Generate fallback sprint goal when AI is not available
   */
  private generateFallbackSprintGoal(sprintStories: UserStory[]): string {
    try {
      if (!sprintStories || sprintStories.length === 0) {
        return "Complete planned user stories for this sprint.";
      }
      // If 1-2 stories, mention their titles
      if (sprintStories.length <= 2) {
        const titles = sprintStories.map((s) => `"${s.title}"`).join(" and ");
        return `Deliver the following key stories: ${titles}.`;
      }
      // If more, summarize main actions/features from titles and wants
      const mainActions = sprintStories
        .map((s) => s.want || s.title)
        .filter(Boolean)
        .map((want) => want.toLowerCase())
        .map((want) =>
          want.replace(/^(to |implement |add |create |enable |support )/i, "")
        )
        .map((want) => want.charAt(0).toUpperCase() + want.slice(1));
      // Get top 2-3 unique actions/features
      const uniqueActions = Array.from(new Set(mainActions)).slice(0, 3);
      return `Focus on delivering: ${uniqueActions.join(", ")}.`;
    } catch {
      return `Complete ${sprintStories.length} user stories focused on delivering core functionality and user value.`;
    }
  }

  /**
   * Check if a word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = [
      "the",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "from",
      "as",
      "is",
      "was",
      "are",
      "were",
      "been",
      "be",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "must",
      "can",
      "shall",
      "that",
      "this",
      "these",
      "those",
      "a",
      "an",
      "so",
      "want",
      "user",
      "story",
    ];
    return stopWords.includes(word.toLowerCase());
  }

  /**
   * Analyze story themes to identify common patterns
   */
  private analyzeStoryThemes(stories: UserStory[]): {
    primaryTheme: string;
    secondaryThemes: string[];
    technicalFocus: string[];
  } {
    const allText = stories
      .map((s) => `${s.title} ${s.description} ${s.want} ${s.benefit}`)
      .join(" ")
      .toLowerCase();

    // Extract common words and themes
    const words = allText
      .split(/\s+/)
      .filter((word) => word.length > 3 && !this.isStopWord(word));
    const wordCount = new Map<string, number>();
    words.forEach((word) => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    const sortedWords = Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    // Identify technical focus from tags
    const allTags = stories.flatMap((s) => s.tags || []);
    const tagCount = new Map<string, number>();
    allTags.forEach((tag) => {
      tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
    });

    const technicalFocus = Array.from(tagCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    return {
      primaryTheme: sortedWords[0] || "feature",
      secondaryThemes: sortedWords.slice(1, 4),
      technicalFocus,
    };
  }

  /**
   * Analyze user journey patterns
   */
  private analyzeUserJourney(stories: UserStory[]): {
    primaryUser: string;
    userActions: string[];
    userGoals: string[];
  } {
    const roles = stories.map((s) => s.role).filter(Boolean);
    const wants = stories.map((s) => s.want).filter(Boolean);
    const benefits = stories.map((s) => s.benefit).filter(Boolean);

    // Find most common role
    const roleCount = new Map<string, number>();
    roles.forEach((role) => {
      roleCount.set(role, (roleCount.get(role) || 0) + 1);
    });

    const primaryUser =
      Array.from(roleCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "user";

    // Extract user actions from "want" statements
    const userActions = wants
      .map((want) => {
        const match = want.match(/to (.+?)(?: so that|$)/i);
        return match ? match[1].trim() : want;
      })
      .filter(Boolean);

    // Extract user goals from "benefit" statements
    const userGoals = benefits
      .map((benefit) => {
        const match = benefit.match(/so that (.+?)(?:\.|$)/i);
        return match ? match[1].trim() : benefit;
      })
      .filter(Boolean);

    return {
      primaryUser,
      userActions: [...new Set(userActions)].slice(0, 5),
      userGoals: [...new Set(userGoals)].slice(0, 5),
    };
  }

  /**
   * Analyze business impact and value
   */
  private analyzeBusinessImpact(stories: UserStory[]): {
    businessObjectives: string[];
    valueMetrics: string[];
    impactLevel: "high" | "medium" | "low";
  } {
    const benefits = stories.map((s) => s.benefit).filter(Boolean);
    const businessValues = stories.map((s) => s.businessValue || 0);
    const avgValue =
      businessValues.reduce((sum, val) => sum + val, 0) / businessValues.length;

    // Extract business objectives from benefits
    const businessObjectives = benefits
      .map((benefit) => {
        const match = benefit.match(/so that (.+?)(?:\.|$)/i);
        return match ? match[1].trim() : benefit;
      })
      .filter(Boolean)
      .slice(0, 5);

    // Identify value metrics
    const valueMetrics = benefits
      .map((benefit) => {
        const metrics = benefit.match(
          /(?:improve|increase|reduce|enable|provide|support|enhance) (.+?)(?:\.|$)/gi
        );
        return metrics ? metrics.map((m) => m.trim()) : [];
      })
      .flat()
      .filter(Boolean)
      .slice(0, 5);

    const impactLevel =
      avgValue >= 4 ? "high" : avgValue >= 2.5 ? "medium" : "low";

    return {
      businessObjectives: [...new Set(businessObjectives)],
      valueMetrics: [...new Set(valueMetrics)],
      impactLevel,
    };
  }

  /**
   * Perform comprehensive risk assessment for each sprint
   */
  private async performRiskAssessment(
    sprints: EnhancedSprint[],
    allStories: UserStory[]
  ): Promise<EnhancedSprint[]> {
    const assessedSprints: EnhancedSprint[] = [];

    for (const sprint of sprints) {
      const riskAssessment = await this.calculateSprintRisk(sprint, allStories);
      const mitigationStrategies = await this.generateMitigationStrategies(
        sprint,
        riskAssessment
      );

      assessedSprints.push({
        ...sprint,
        riskAssessment,
        mitigationStrategies,
      });
    }

    return assessedSprints;
  }

  /**
   * Build a dependency map for stories based on parent/child relationships
   */
  private buildStoriesDependencyMap(
    stories: UserStory[]
  ): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    for (const story of stories) {
      const deps: string[] = [];
      if (story.parentTaskId) deps.push(story.parentTaskId);
      if (story.childTaskIds && story.childTaskIds.length > 0) {
        deps.push(...story.childTaskIds);
      }
      map[story.id] = deps;
    }
    return map;
  }

  /**
   * Calculate comprehensive sprint risk
   */
  private async calculateSprintRisk(
    sprint: EnhancedSprint,
    allStories: UserStory[]
  ): Promise<RiskAssessment> {
    const stories = sprint.stories;
    let totalRisk = 0;

    const riskFactors = {
      technicalComplexity: 0,
      dependencyRisk: 0,
      capacityRisk: 0,
      uncertaintyRisk: 0,
      velocityRisk: 0,
    };

    // Build stories_dependency map from ALL stories (not just this sprint)
    const storiesDependency = this.buildStoriesDependencyMap(allStories);

    // Technical complexity risk
    stories.forEach((story) => {
      riskFactors.technicalComplexity += (story.complexity || 0) * 0.02;
    });

    // Dependency risk (use storiesDependency, check if dependencies are missing from this sprint)
    stories.forEach((story) => {
      const depRisk = this.calculateStoryDependencyRisk(
        story,
        stories, // only stories in this sprint
        storiesDependency
      );
      riskFactors.dependencyRisk += depRisk * 0.3;
    });

    // Capacity risk from sprint loading
    const capacityUtilization = sprint.metrics.utilization.storyPoints;
    riskFactors.capacityRisk = this.calculateCapacityRisk(capacityUtilization);

    // Uncertainty risk from estimates
    stories.forEach((story) => {
      riskFactors.uncertaintyRisk += (story.risk || 0) * 0.025;
    });

    // Velocity risk for later sprints
    const sprintNumber = parseInt(sprint.name.split(" ")[1]);
    if (sprintNumber > 1) {
      riskFactors.velocityRisk = this.calculateVelocityRisk(sprintNumber);
    }

    // Calculate total risk
    totalRisk = Object.values(riskFactors).reduce((sum, risk) => sum + risk, 0);

    const riskLevel = this.categorizeRisk(totalRisk);

    return {
      overallRisk: Math.min(5, totalRisk),
      riskLevel,
      riskFactors,
      riskScore: Math.round(totalRisk * 10) / 10,
      confidence: this.calculateRiskConfidence(riskFactors),
    };
  }

  /**
   * Calculate dependency risk for a story using storiesDependency map
   */
  private calculateStoryDependencyRisk(
    story: UserStory,
    sprintStories: UserStory[],
    storiesDependency: Record<string, string[]>
  ): number {
    // If this is a parent story (has childTaskIds), risk is proportional to number of missing children
    if (story.childTaskIds && story.childTaskIds.length > 0) {
      const missingChildren = story.childTaskIds.filter(
        (childId) => !sprintStories.find((s) => s.id === childId)
      );
      return missingChildren.length * 0.5;
    }
    // For non-parent stories, risk if parent is not present in the same sprint
    if (story.parentTaskId) {
      const parentMissing = !sprintStories.find(
        (s) => s.id === story.parentTaskId
      );
      return parentMissing ? 0.5 : 0;
    }
    // Otherwise, use the default logic for other dependencies
    const dependencyIds = storiesDependency[story.id] || [];
    const externalDependencies = dependencyIds.filter(
      (depId) => !sprintStories.find((s) => s.id === depId)
    );
    return externalDependencies.length * 0.5;
  }

  /**
   * Calculate capacity risk based on utilization
   */
  private calculateCapacityRisk(utilizationPercent: number): number {
    if (utilizationPercent > 100) return 5.0; // Very high risk
    if (utilizationPercent > 90) return 3.5; // High risk
    if (utilizationPercent > 80) return 2.0; // Medium risk
    if (utilizationPercent > 70) return 1.0; // Low risk
    return 0.5; // Very low risk
  }

  /**
   * Calculate velocity risk for later sprints
   */
  private calculateVelocityRisk(sprintNumber: number): number {
    // Risk increases slightly with sprint number due to velocity uncertainty
    return Math.min(2.0, sprintNumber * 0.1);
  }

  /**
   * Categorize risk level
   */
  private categorizeRisk(
    totalRisk: number
  ): "Very-low" | "Low" | "Medium" | "High" {
    const thresholds = this.config.riskThresholds;

    if (totalRisk >= thresholds.high) return "High";
    if (totalRisk >= thresholds.medium) return "Medium";
    if (totalRisk >= thresholds.low) return "Low";
    return "Very-low";
  }

  /**
   * Calculate risk confidence score
   */
  private calculateRiskConfidence(riskFactors: any): number {
    // Higher confidence when risk factors are more evenly distributed
    const values = Object.values(riskFactors) as number[];
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;

    // Lower variance = higher confidence
    const confidence = Math.max(0.1, 1 - variance / 10);
    return Math.round(confidence * 100) / 100;
  }

  /**
   * Generate mitigation strategies for identified risks, referencing specific stories
   */
  private async generateMitigationStrategies(
    sprint: EnhancedSprint,
    riskAssessment: RiskAssessment
  ): Promise<MitigationStrategy[]> {
    const strategies: MitigationStrategy[] = [];
    const { riskFactors } = riskAssessment;
    const stories = sprint.stories;

    // Technical complexity mitigation
    if (riskFactors.technicalComplexity > 2.0) {
      const complexStories = stories
        .filter((s) => (s.complexity || 0) >= 4)
        .map((s) => `"${s.title}"`)
        .join(", ");
      strategies.push({
        type: "technical",
        priority: "high",
        description:
          complexStories.length > 0
            ? `Consider breaking down complex stories (${complexStories}) into smaller, more manageable tasks.`
            : "Consider breaking down complex stories into smaller, more manageable tasks.",
        action: "story-splitting",
        effort: "medium",
      });
    }

    // Dependency risk mitigation
    if (riskFactors.dependencyRisk > 1.5) {
      const depStories = stories
        .filter((s) => s.dependencies && s.dependencies.length > 0)
        .map((s) => `"${s.title}"`)
        .join(", ");
      strategies.push({
        type: "dependency",
        priority: "high",
        description:
          depStories.length > 0
            ? `Identify and resolve external dependencies for stories: ${depStories} before sprint start.`
            : "Identify and resolve external dependencies before sprint start.",
        action: "dependency-resolution",
        effort: "high",
      });
    }

    // Capacity risk mitigation
    if (riskFactors.capacityRisk > 3.0) {
      strategies.push({
        type: "capacity",
        priority: "critical",
        description: `Reduce sprint scope or increase team capacity. Current utilization: ${Math.round(
          sprint.metrics.utilization.storyPoints
        )}%.`,
        action: "scope-adjustment",
        effort: "low",
      });
    }

    // Uncertainty risk mitigation
    if (riskFactors.uncertaintyRisk > 2.0) {
      const riskyStories = stories
        .filter((s) => (s.risk || 0) >= 4)
        .map((s) => `"${s.title}"`)
        .join(", ");
      strategies.push({
        type: "uncertainty",
        priority: "medium",
        description:
          riskyStories.length > 0
            ? `Conduct estimation review session for high-risk stories: ${riskyStories}.`
            : "Conduct estimation review session with the team.",
        action: "estimation-review",
        effort: "low",
      });
    }

    // Velocity risk mitigation
    if (riskFactors.velocityRisk > 1.0) {
      strategies.push({
        type: "velocity",
        priority: "medium",
        description: `Monitor team velocity and adjust future sprint planning. This is sprint ${sprint.name}.`,
        action: "velocity-tracking",
        effort: "low",
      });
    }

    return strategies.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Generate comprehensive sprint documentation with story-specific objectives and criteria
   */
  private async generateSprintDocs(
    sprint: EnhancedSprint,
    projectContext: any
  ): Promise<SprintDocumentation> {
    // Use new structured format for story list with acceptance criteria checkboxes
    const storyList = sprint.stories
      .map((story, index) => {
        // Merge acceptance criteria and requirements for comprehensive criteria list
        const criteria = mergeAcceptanceCriteria(
          story.acceptanceCriteria,
          story.requirements
        );

        // Format using the standardized user story format
        return formatUserStory(
          {
            ...story,
            acceptanceCriteria: criteria,
          },
          index + 1
        );
      })
      .join("\n\n---\n\n");

    const riskSummary = sprint.riskAssessment
      ? `Risk Level: ${sprint.riskAssessment.riskLevel.toUpperCase()} (${
          sprint.riskAssessment.riskScore
        }/5)`
      : "Risk assessment not available";

    // Objectives: summarize main features/actions from stories
    const mainActions = sprint.stories
      .map((s) => s.want || s.title)
      .filter(Boolean)
      .map((want) => want.toLowerCase())
      .map((want) =>
        want.replace(/^(to |implement |add |create |enable |support )/i, "")
      )
      .map((want) => want.charAt(0).toUpperCase() + want.slice(1));
    const uniqueActions = Array.from(new Set(mainActions)).slice(0, 3);

    // Validate goal statement meets requirements (under 25 words)
    const goalValidation = validateGoalStatement(sprint.goal || "");
    const validatedGoal =
      goalValidation.isValid && sprint.goal
        ? sprint.goal
        : `Enable ${uniqueActions.join(", ")} to deliver user value.`;

    return {
      overview: `**Goal:** ${validatedGoal}`,
      objectives: [
        `Deliver the following features: ${uniqueActions.join(", ")}`,
        `Complete ${sprint.stories.length} user stories totaling ${sprint.metrics.totalStoryPoints} story points`,
        `Achieve ${Math.round(
          sprint.metrics.utilization.storyPoints
        )}% capacity utilization`,
        `Maintain quality standards while delivering user value`,
      ],
      stories: storyList,
      riskSummary,
      keyDates: {
        startDate: sprint.startDate?.toISOString().split("T")[0] || "",
        endDate: sprint.endDate?.toISOString().split("T")[0] || "",
        duration: `${sprint.duration} weeks`,
      },
      success_criteria: [
        ...uniqueActions.map(
          (action) =>
            `- [ ] Feature: ${action} meets acceptance criteria and passes QA`
        ),
        "- [ ] No critical bugs in delivered features",
        "- [ ] Team velocity maintained or improved",
      ],
    };
  }

  /**
   * Generate sprint recommendations referencing specific stories and risks
   */
  private async generateSprintRecommendations(
    sprint: EnhancedSprint
  ): Promise<SprintRecommendation[]> {
    const recommendations: SprintRecommendation[] = [];

    // Capacity recommendations
    if (sprint.metrics.utilization.storyPoints > 90) {
      recommendations.push({
        type: "capacity",
        priority: "high",
        message: `Sprint is at ${Math.round(
          sprint.metrics.utilization.storyPoints
        )}% capacity. Consider reducing scope or adding buffer time.`,
        action:
          "Review story priorities and consider moving lower-priority items to next sprint",
      });
    }

    // Risk recommendations
    if (sprint.riskAssessment && sprint.riskAssessment.riskLevel === "High") {
      const riskyStories = sprint.stories
        .filter((s) => (s.risk || 0) >= 4)
        .map((s) => `"${s.title}"`)
        .join(", ");
      recommendations.push({
        type: "risk",
        priority: "critical",
        message:
          riskyStories.length > 0
            ? `High risk detected in stories: ${riskyStories}. Immediate attention required.`
            : "High risk detected. Immediate attention required.",
        action: "Review and implement suggested mitigation strategies",
      });
    }

    // Dependencies recommendations
    const storiesWithDependencies = sprint.stories.filter(
      (s) => s.dependencies && s.dependencies.length > 0
    );
    if (storiesWithDependencies.length > 0) {
      const depTitles = storiesWithDependencies
        .map((s) => `"${s.title}"`)
        .join(", ");
      recommendations.push({
        type: "dependencies",
        priority: "medium",
        message: `${storiesWithDependencies.length} stories (${depTitles}) have dependencies. Ensure they're resolved before sprint start.`,
        action: "Verify all dependencies are satisfied before sprint start",
      });
    }

    // Balance recommendations
    const priorityDist = sprint.metrics.priorityDistribution;
    const totalStories = sprint.stories.length;
    const highPriorityRatio =
      (priorityDist.critical + priorityDist.high) / totalStories;

    if (highPriorityRatio > 0.8) {
      recommendations.push({
        type: "balance",
        priority: "medium",
        message: `Sprint heavily loaded with high-priority items (${
          priorityDist.critical + priorityDist.high
        } of ${totalStories} stories). Consider risk of scope creep.`,
        action: "Ensure team has bandwidth for unexpected high-priority work",
      });
    }

    return recommendations;
  }

  /**
   * Generate unique ID
   */
  private generateUniqueId(): string {
    return `st${nanoid(6)}`;
  }

  // Utility: For each story, set childTaskIds to the array of ids of stories whose parentTaskId matches this story's id
  private assignChildTaskIds(stories: UserStory[]): UserStory[] {
    const idToChildren: Record<string, string[]> = {};
    for (const story of stories) {
      if (story.parentTaskId) {
        if (!idToChildren[story.parentTaskId])
          idToChildren[story.parentTaskId] = [];
        idToChildren[story.parentTaskId].push(story.id);
      }
    }
    return stories.map((story) => ({
      ...story,
      childTaskIds: idToChildren[story.id] || [],
    }));
  }
}

// Export for use in SprintiQ.ai platform
export default SprintCreationService;

/**
 * Simple function to create an enhanced sprint from stories and team members
 */
export async function createEnhancedSprint(
  stories: UserStory[],
  teamMembers: TeamMember[],
  config?: Partial<SprintCreationConfig>
): Promise<EnhancedSprint[]> {
  const service = new SprintCreationService(config);

  const enhancedSprints = await service.createDetailedSprints(
    stories,
    { totalStoryPoints: 0, totalHours: 0 }, // Will be calculated by service
    teamMembers,
    { startDate: new Date().toISOString() }
  );

  if (enhancedSprints.length === 0) {
    throw new Error("Failed to create enhanced sprints");
  }

  return enhancedSprints;
}

/**
 * Calculate an EnhancedSprint for a manual sprint using the same logic as AI sprints,
 * but with user-provided goal, startDate, endDate, duration, and name.
 */
export async function calculateManualSprintAnalysis(
  stories: UserStory[],
  teamMembers: TeamMember[],
  manualSprint: {
    name: string;
    goal: string;
    startDate: string;
    endDate: string;
    duration: number;
    capacity: number;
  },
  config?: Partial<SprintCreationConfig>
): Promise<EnhancedSprint> {
  const service = new SprintCreationService(config);

  // Calculate team capacity for metrics
  const sprintCapacity = {
    totalStoryPoints: manualSprint.capacity,
    totalHours:
      teamMembers.reduce((sum, m) => sum + (m.availability || 40), 0) *
      manualSprint.duration,
    memberCapacities: teamMembers.map((member) => ({
      ...member,
      weeklyHours: member.availability || 40,
      sprintHours: (member.availability || 40) * manualSprint.duration,
      sprintPoints: Math.floor(
        ((member.availability || 40) * manualSprint.duration) / 8
      ),
    })),
    velocityBuffer: config?.velocityBuffer || 1,
  };

  // Calculate metrics
  const metrics = service["calculateSprintMetrics"](stories, sprintCapacity);

  // Build a minimal EnhancedSprint object for risk calculation
  const sprintObj: EnhancedSprint = {
    id: `manual-sprint-${Date.now()}`,
    name: manualSprint.name,
    goal: manualSprint.goal,
    startDate: new Date(manualSprint.startDate),
    endDate: new Date(manualSprint.endDate),
    duration: manualSprint.duration,
    capacity: manualSprint.capacity,
    stories,
    teamMembers,
    velocity: sprintCapacity.totalStoryPoints,
    status: "Planning",
    metrics,
    riskAssessment: {} as RiskAssessment,
    mitigationStrategies: [],
    documentation: {} as SprintDocumentation,
    recommendations: [],
    generated: {
      timestamp: new Date().toISOString(),
      version: "1.0",
      agent: "SprintiQ.ai Manual Sprint Analysis",
    },
  };

  // Calculate risk assessment
  sprintObj.riskAssessment = await service["calculateSprintRisk"](
    sprintObj,
    stories
  );
  // Mitigation strategies
  sprintObj.mitigationStrategies = await service[
    "generateMitigationStrategies"
  ](sprintObj, sprintObj.riskAssessment);
  // Documentation
  sprintObj.documentation = await service["generateSprintDocs"](sprintObj, {
    startDate: manualSprint.startDate,
  });
  // Recommendations
  sprintObj.recommendations = await service["generateSprintRecommendations"](
    sprintObj
  );

  return sprintObj;
}
