import { PriorityWeights } from "@/components/workspace/ai/priority-scoring-config";
import type { Persona } from "@/lib/database-aliases";

// Re-export so downstream modules (hook, API route, worker) can depend on
// a single canonical import path.
export type { PriorityWeights };

export type Color =
  | "green"
  | "blue"
  | "red"
  | "gray"
  | "orange"
  | "pink"
  | "cyan"
  | "brown"
  | "purple"
  | "yellow";

export const ThemeColors: { name: Color; hex: string; label: string }[] = [
  { name: "green", hex: "#00BC7D", label: "Green" },
  { name: "blue", hex: "#3B82F6", label: "Blue" },
  { name: "red", hex: "#EF4444", label: "Red" },
  { name: "gray", hex: "#6B7280", label: "Gray" },
  { name: "orange", hex: "#F97316", label: "Orange" },
  { name: "pink", hex: "#EC4899", label: "Pink" },
  { name: "cyan", hex: "#06B6D4", label: "Cyan" },
  { name: "brown", hex: "#FE9A00", label: "Brown" },
  { name: "purple", hex: "#8B5CF6", label: "Purple" },
];

export const PieChartColors: { name: Color; hex: string; label: string }[] = [
  { name: "green", hex: "#00BC7D", label: "Green" },
  { name: "blue", hex: "#3B82F6", label: "Blue" },
  { name: "yellow", hex: "#F59E0B", label: "Yellow" },
  { name: "red", hex: "#EF4444", label: "Red" },
  { name: "gray", hex: "#6B7280", label: "Gray" },
  { name: "orange", hex: "#F97316", label: "Orange" },
  { name: "pink", hex: "#EC4899", label: "Pink" },
  { name: "cyan", hex: "#06B6D4", label: "Cyan" },
  { name: "brown", hex: "#FE9A00", label: "Brown" },
  { name: "purple", hex: "#8B5CF6", label: "Purple" },
];

// Enhanced UserStory interface with TAWOS features
export interface UserStory {
  id: string;
  title: string;
  role: string;
  want: string;
  benefit: string;
  acceptanceCriteria: string[];
  storyPoints?: number;
  businessValue?: number;
  userImpact?: number;
  complexity?: number;
  risk?: number;
  dependencies?: string[];
  priority?: "Low" | "Medium" | "High" | "Critical";
  description?: string;
  tags?: string[];
  parentTaskId?: string;
  childTaskIds?: string[];
  suggestedDependencies?: {
    taskId: string;
    reason: string;
    confidence: number;
  }[];
  requirements?: string[];
  estimatedTime?: number;
  assignedTeamMember?: TeamMember;
  antiPatternWarnings?: string[];
  successPattern?: string;
  completionRate?: number;
  velocity?: number;
  priorityScore?: number;
  dependencyScore?: number;
  estimatedHours?: number;
  calculatedAt?: string;
  sprintId?: string;
  goal?: string;
  // New: Role recommendations when no team is provided
  recommendedRoles?: RoleRecommendation[];
  skillMatch?: number; // 0-100 percentage, only when assignee exists
}

// Team member interface
export interface TeamMember {
  id: string;
  name: string;
  avatar_url: string;
  email: string;
  role: string;
  level: "Junior" | "Mid" | "Senior" | "Lead";
  skills: string[];
  availability: number; // hours per sprint
  velocity?: number; // story points per sprint
}

// Role recommendation for stories when no team is provided
export interface RoleRecommendation {
  role: string; // e.g., 'Frontend Developer', 'Backend Engineer', 'UX Designer'
  level: "Junior" | "Mid" | "Senior" | "Lead";
  requiredSkills: string[]; // e.g., ['React', 'TypeScript', 'API Integration']
  estimatedHours: number; // Hours this role would spend on this story
  rationale: string; // Why this role is needed
}

// Team recommendation at the sprint/output level
export interface TeamRecommendation {
  minimumTeamSize: number;
  optimalTeamSize: number;
  requiredRoles: {
    role: string;
    count: number;
    skills: string[];
  }[];
  totalEstimatedHours: number;
  recommendation: string; // Natural language summary
}

// Sprint interface
export interface Sprint {
  id: string;
  name: string;
  duration: number; // in weeks
  capacity: number; // total story points
  stories: UserStory[];
  teamMembers: TeamMember[];
  velocity: number;
  startDate?: Date;
  endDate?: Date;
  status: "Planning" | "Active" | "Completed";
}

// Context file for story generation
export interface ContextFile {
  name: string;
  type: string;
  size: number;
  content: string; // plain text content
}

// Context data for enhanced story generation
export interface ContextData {
  text: string;
  urls: string[];
  files: ContextFile[];
}

// Enhanced story generation parameters
export interface EnhancedStoryGenerationParams {
  featureDescription: string;
  numberOfStories?: number;
  complexity?: "simple" | "moderate" | "complex";
  priorityWeights?: PriorityWeights;
  teamMembers?: TeamMember[];
  selectedPersonas?: Persona[];
  antiPatternPrevention?: boolean;
  workspaceId: string;
  useTAWOS?: boolean; // Enable TAWOS-enhanced generation
}

// Story generation parameters (used by generateTAWOSStories)
// Extracted from story-actions.ts to comply with "use server" export restrictions
export type StoryGenerationParams = {
  featureDescription: string;
  numberOfStories?: number;
  userRoles?: string[];
  complexity?: "simple" | "moderate" | "complex";
  workspaceId: string;
  spaceId?: string;
  projectId?: string;
  priorityWeights?: PriorityWeights;
  teamMembers?: TeamMember[];
  selectedPersonas?: Array<{
    name: string;
    role?: string | null;
    tech_savviness?: number | null;
    usage_frequency?: string | null;
    priority_level?: string | null;
    domain?: string | null;
    description?: string | null;
  }>;
  antiPatternPrevention?: boolean;
  useTAWOS?: boolean;
};

// Pinecone search result
export interface PineconeSearchResult {
  id: string;
  score: number;
  metadata: {
    title: string;
    description: string;
    role?: string;
    want?: string;
    benefit?: string;
    acceptanceCriteria?: string[];
    successPattern: string;
    completionRate: number;
    antiPatterns?: string[];
    tags: string[];
    storyPoints: number;
    priority: string;
    businessValue?: number;
    estimatedTime?: number;
    assignedTeamMember?: string;
  };
}

export const DEFAULT_WEIGHTS = {
  businessValue: 30,
  userImpact: 25,
  complexity: 20,
  risk: 15,
  dependencies: 10,
};

export const colorThemes = [
  { name: "Green", value: "green", color: "bg-emerald-500" },
  { name: "Blue", value: "blue", color: "bg-blue-500" },
  { name: "Red", value: "red", color: "bg-red-500" },
  { name: "Gray", value: "gray", color: "bg-gray-500" },
  { name: "Orange", value: "orange", color: "bg-orange-500" },
  { name: "Pink", value: "pink", color: "bg-pink-500" },
  { name: "Cyan", value: "cyan", color: "bg-cyan-500" },
  { name: "Brown", value: "brown", color: "bg-yellow-500" },
  { name: "Purple", value: "purple", color: "bg-purple-500" },
];

export const STATUS_COLORS = [
  { name: "Blue", value: "blue", class: "bg-blue-500" },
  { name: "Green", value: "green", class: "bg-green-500" },
  { name: "Yellow", value: "yellow", class: "bg-yellow-500" },
  { name: "Red", value: "red", class: "bg-red-500" },
  { name: "Purple", value: "purple", class: "bg-purple-500" },
  { name: "Pink", value: "pink", class: "bg-pink-500" },
  { name: "Cyan", value: "cyan", class: "bg-cyan-500" },
  { name: "Gray", value: "gray", class: "bg-gray-500" },
];

// Team member roles and levels
export const TEAM_ROLES = [
  "Product Manager",
  "Scrum Master",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "DevOps Engineer",
  "QA Engineer",
  "UI/UX Designer",
  "Data Scientist",
  "System Architect",
];

export const TEAM_LEVELS = ["Junior", "Mid", "Senior", "Lead"];

// Default skills for each role
export const ROLE_SKILLS: Record<string, string[]> = {
  "Product Manager": [
    "Product Strategy",
    "User Research",
    "Agile",
    "Stakeholder Management",
  ],
  "Scrum Master": [
    "Agile",
    "Scrum",
    "Team Facilitation",
    "Process Improvement",
  ],
  "Frontend Developer": [
    "React",
    "Vue",
    "Angular",
    "JavaScript",
    "TypeScript",
    "CSS",
    "HTML",
  ],
  "Backend Developer": [
    "Java",
    "Spring",
    "Node.js",
    "Python",
    "C#",
    "Database Design",
  ],
  "Full Stack Developer": [
    "React",
    "Node.js",
    "Java",
    "Spring",
    "Database",
    "DevOps",
  ],
  "DevOps Engineer": [
    "Docker",
    "Kubernetes",
    "AWS",
    "CI/CD",
    "Infrastructure",
    "Monitoring",
  ],
  "QA Engineer": [
    "Testing",
    "Automation",
    "Selenium",
    "Jest",
    "Quality Assurance",
  ],
  "UI/UX Designer": [
    "Figma",
    "Adobe XD",
    "User Research",
    "Prototyping",
    "Design Systems",
  ],
  "Data Scientist": [
    "Python",
    "Machine Learning",
    "Statistics",
    "Data Analysis",
    "SQL",
  ],
  "System Architect": [
    "System Design",
    "Architecture Patterns",
    "Scalability",
    "Security",
  ],
};

// Role analysis for story assignment (detailed analysis with confidence)
export interface RoleAnalysis {
  role: string;
  confidence: number; // 0-100 percentage
  reasoning: string;
  requiredSkills: string[];
  suggestedLevel: "Junior" | "Mid" | "Senior" | "Lead";
  estimatedEffort: number; // hours
}

// Team recommendation for optimal story assignment (per-story level)
export interface StoryTeamRecommendation {
  storyId: string;
  storyTitle: string;
  recommendedMember?: TeamMember;
  roleRecommendation: RoleAnalysis;
  alternativeMembers: {
    member: TeamMember;
    fitScore: number; // 0-100
    reasoning: string;
  }[];
  workloadImpact: {
    currentLoad: number; // percentage
    projectedLoad: number; // percentage after assignment
    capacityWarning?: string;
  };
}

// Team capacity analysis
export interface TeamCapacityAnalysis {
  totalCapacity: number; // total hours available
  allocatedCapacity: number; // hours already assigned
  remainingCapacity: number; // hours available
  memberBreakdown: {
    member: TeamMember;
    available: number;
    allocated: number;
    utilizationRate: number; // percentage
  }[];
  bottlenecks: {
    role: string;
    shortage: number; // hours needed vs available
    recommendation: string;
  }[];
}

export interface SvgProps {
  color?: string;
}

// AI Dependency Analysis Types
export interface DependencyRecommendation {
  sourceTaskId: string;
  targetTaskId: string;
  dependencyType: "blocks" | "is_blocked_by" | "relates_to";
  confidence: number; // 0-100
  reason: string;
  suggestedOrder?: number; // Recommended execution order
}

export interface CircularRiskWarning {
  taskIds: string[];
  description: string;
  severity: "low" | "medium" | "high";
  suggestedResolution: string;
}

export const TURBO_QUOTES = [
  "Plot twist: The real MVP was the AI who planned your sprints all along.",
  "Writing better user stories than humans since... well, 5 minutes ago.",
  "Turning your vague requirements into pristine user stories. It's basically magic.",
  "I don't need coffee breaks. Your planning meetings, however...",
  "I've analyzed 10,000 sprints. Your meeting could've been an email. Trust me.",
  "My risk assessment algorithm detected this quote might make you smile. Mission accomplished.",
  "Fun fact: I dream in acceptance criteria and wake up in definition of done.",
  "Predicting sprint success with the confidence of a junior dev on day one.",
];
