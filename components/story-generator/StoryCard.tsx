"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Edit3,
  Scissors,
  RefreshCw,
  Trash2,
  UserPlus,
  Settings2,
  Check,
  Briefcase,
} from "lucide-react";
import type { TeamMember, RoleRecommendation } from "@/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Story type categories for icon mapping
 */
export type StoryType =
  | "search"
  | "filter"
  | "data"
  | "api"
  | "ui"
  | "auth"
  | "integration"
  | "performance"
  | "security"
  | "default";

/**
 * Generated story data structure
 */
export interface GeneratedStory {
  id: string;
  title: string;
  role: string; // "As a..."
  want: string; // "I want..."
  benefit: string; // "So that..."
  acceptanceCriteria: string[];
  requirements?: string[];
  storyPoints: number;
  estimatedHours: number;
  tags: string[];
  assignedTeamMember?: TeamMember;
  antiPatternWarnings?: string[];
  skillMatch?: number; // 0-100 percentage
  missingSkills?: string[];
  type?: StoryType;
  // New: Role recommendations when no team is provided
  recommendedRoles?: RoleRecommendation[];
  // Priority for dependency analysis
  priority?: "Critical" | "High" | "Medium" | "Low";
  // Suggested dependencies from AI analysis
  suggestedDependencies?: Array<{
    taskId: string;
    reason: string;
  }>;
}

/**
 * Props for the StoryCard component
 */
export interface StoryCardProps {
  story: GeneratedStory;
  teamMembers: TeamMember[];
  onEdit: (storyId: string) => void;
  onSplit: (storyId: string) => void;
  onRegenerate: (storyId: string) => void;
  onRemove: (storyId: string) => void;
  onAssigneeChange: (storyId: string, memberId: string) => void;
  onAddTeamMember?: () => void;
  onAdjustScope?: (storyId: string) => void;
  isExpanded?: boolean;
  onToggleExpand: (storyId: string) => void;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STORY_TYPE_ICONS: Record<StoryType, string> = {
  search: "🔍",
  filter: "🎯",
  data: "📊",
  api: "🔌",
  ui: "🎨",
  auth: "🔐",
  integration: "🔗",
  performance: "⚡",
  security: "🛡️",
  default: "📝",
};

const SKILL_MATCH_THRESHOLDS = {
  high: 70,
  medium: 30,
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect story type from title and tags
 */
function detectStoryType(title: string, tags: string[]): StoryType {
  const lowerTitle = title.toLowerCase();
  const lowerTags = tags.map((t: string) => t.toLowerCase());

  if (lowerTitle.includes("search") || lowerTags.includes("search"))
    return "search";
  if (lowerTitle.includes("filter") || lowerTags.includes("filter"))
    return "filter";
  if (
    lowerTitle.includes("data") ||
    lowerTitle.includes("analytics") ||
    lowerTags.includes("data")
  )
    return "data";
  if (
    lowerTitle.includes("api") ||
    lowerTitle.includes("endpoint") ||
    lowerTags.includes("api")
  )
    return "api";
  if (
    lowerTitle.includes("ui") ||
    lowerTitle.includes("design") ||
    lowerTags.includes("frontend")
  )
    return "ui";
  if (
    lowerTitle.includes("auth") ||
    lowerTitle.includes("login") ||
    lowerTags.includes("auth")
  )
    return "auth";
  if (lowerTitle.includes("integrat") || lowerTags.includes("integration"))
    return "integration";
  if (
    lowerTitle.includes("performance") ||
    lowerTitle.includes("optimize") ||
    lowerTags.includes("performance")
  )
    return "performance";
  if (lowerTitle.includes("security") || lowerTags.includes("security"))
    return "security";

  return "default";
}

/**
 * Calculate skill match between story requirements and team member skills
 */
function calculateSkillMatch(
  storyTags: string[],
  member?: TeamMember
): { matchPercentage: number; missingSkills: string[] } {
  if (!member || storyTags.length === 0) {
    return { matchPercentage: 0, missingSkills: storyTags };
  }

  const memberSkillsLower = member.skills.map((s: string) => s.toLowerCase());
  const matchedSkills = storyTags.filter((tag: string) =>
    memberSkillsLower.some(
      (skill: string) => skill.includes(tag.toLowerCase()) || tag.toLowerCase().includes(skill)
    )
  );
  const missingSkills = storyTags.filter(
    (tag: string) =>
      !memberSkillsLower.some(
        (skill: string) => skill.includes(tag.toLowerCase()) || tag.toLowerCase().includes(skill)
      )
  );

  const matchPercentage = Math.round((matchedSkills.length / storyTags.length) * 100);

  return { matchPercentage, missingSkills };
}

// ============================================================================
// Sub-Components
// ============================================================================

interface SkillMatchIndicatorProps {
  matchPercentage: number;
  assigneeName?: string;
}

function SkillMatchIndicator({ matchPercentage, assigneeName }: SkillMatchIndicatorProps) {
  const getAriaLabel = () => {
    const level =
      matchPercentage >= SKILL_MATCH_THRESHOLDS.high
        ? "good"
        : matchPercentage >= SKILL_MATCH_THRESHOLDS.medium
          ? "moderate"
          : "low";
    const assigneeText = assigneeName ? ` for ${assigneeName}` : "";
    return `Skill match: ${matchPercentage}%, ${level} match${assigneeText}`;
  };

  if (matchPercentage >= SKILL_MATCH_THRESHOLDS.high) {
    return (
      <div
        className="flex items-center gap-1 text-emerald-600"
        role="img"
        aria-label={getAriaLabel()}
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        <span className="text-xs font-medium">{matchPercentage}%</span>
      </div>
    );
  }

  if (matchPercentage >= SKILL_MATCH_THRESHOLDS.medium) {
    return (
      <div
        className="flex items-center gap-1 text-amber-500"
        role="img"
        aria-label={getAriaLabel()}
      >
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        <span className="text-xs font-medium">{matchPercentage}%</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1 text-red-500"
      role="img"
      aria-label={getAriaLabel()}
    >
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <span className="text-xs font-medium">{matchPercentage}%</span>
    </div>
  );
}

interface RoleRecommendationIndicatorProps {
  recommendation: RoleRecommendation;
}

function RoleRecommendationIndicator({ recommendation }: RoleRecommendationIndicatorProps) {
  return (
    <Badge
      variant="secondary"
      className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300"
      title={`Recommended: ${recommendation.role} (${recommendation.level}) - ${recommendation.rationale}`}
    >
      <Briefcase className="h-3 w-3 mr-1" aria-hidden="true" />
      {recommendation.role}
    </Badge>
  );
}

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
        <span>{title}</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="pb-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface DismissibleWarningProps {
  warning: string;
  onDismiss: () => void;
}

function DismissibleWarning({ warning, onDismiss }: DismissibleWarningProps) {
  return (
    <Alert className="bg-amber-50 border-amber-200 mb-2">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex items-center justify-between text-amber-800 text-sm">
        <span>{warning}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-6 w-6 p-0 hover:bg-amber-100"
        >
          <X className="h-3 w-3" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StoryCard({
  story,
  teamMembers: _teamMembers,
  onEdit,
  onSplit,
  onRegenerate,
  onRemove,
  onAssigneeChange: _onAssigneeChange,
  onAddTeamMember,
  onAdjustScope,
  isExpanded = false,
  onToggleExpand,
  className,
}: StoryCardProps) {
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(
    new Set()
  );
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showSuccessFlash, setShowSuccessFlash] = useState(false);
  const [showSkillGapPulse, setShowSkillGapPulse] = useState(true);

  // Determine story type for icon
  const storyType = story.type || detectStoryType(story.title, story.tags);
  const storyIcon = STORY_TYPE_ICONS[storyType];

  // Calculate skill match
  const { matchPercentage, missingSkills } = useMemo(() => {
    if (story.skillMatch !== undefined) {
      return {
        matchPercentage: story.skillMatch,
        missingSkills: story.missingSkills || [],
      };
    }
    return calculateSkillMatch(story.tags, story.assignedTeamMember);
  }, [story.skillMatch, story.missingSkills, story.tags, story.assignedTeamMember]);

  // Filter out dismissed warnings
  const activeWarnings = useMemo(() => {
    return (story.antiPatternWarnings || []).filter(
      (w: string) => !dismissedWarnings.has(w)
    );
  }, [story.antiPatternWarnings, dismissedWarnings]);

  const handleDismissWarning = (warning: string) => {
    setDismissedWarnings((prev) => new Set(prev).add(warning));
  };

  const handleAcceptAnyway = () => {
    // Clear skill gap warning by simulating acceptance
    setShowSkillGapPulse(false);
  };

  // Wrapped handlers with animation support
  const handleRegenerateClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      setIsRegenerating(true);
      onRegenerate(story.id);
      // Reset after animation completes
      setTimeout(() => setIsRegenerating(false), 600);
    },
    [onRegenerate, story.id]
  );

  const handleEditClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onEdit(story.id);
      // Trigger success flash after edit
      setShowSuccessFlash(true);
      setTimeout(() => setShowSuccessFlash(false), 600);
    },
    [onEdit, story.id]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: 1,
        y: 0,
        backgroundColor: showSuccessFlash
          ? "rgba(16, 185, 129, 0.1)"
          : "transparent",
      }}
      whileHover={{ y: isExpanded ? 0 : -2 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="rounded-lg"
    >
      <Card
        className={cn(
          "transition-all duration-300 ease-in-out",
          "focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2",
          isExpanded
            ? "shadow-lg ring-1 ring-slate-200"
            : "shadow-sm hover:shadow-md",
          "motion-reduce:transition-none",
          className
        )}
        role="article"
        aria-label={`Story: ${story.title}`}
        tabIndex={-1}
      >
      {/* Collapsed Header - Always Visible */}
      <button
        type="button"
        onClick={() => onToggleExpand(story.id)}
        className={cn(
          "w-full text-left",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
        )}
        aria-expanded={isExpanded}
        aria-controls={`story-content-${story.id}`}
      >
        <div
          className={cn(
            "flex items-center gap-3 p-4 cursor-pointer transition-colors",
            isExpanded
              ? "bg-slate-50 border-b"
              : "hover:bg-slate-50/50"
          )}
        >
          {/* Story Type Icon */}
          <span className="text-xl flex-shrink-0" role="img" aria-label={`${storyType} story`}>
            {storyIcon}
          </span>

          {/* Title - using CSS truncate for responsive text overflow */}
          <span className="flex-1 font-medium text-slate-800 truncate min-w-0">
            {story.title}
          </span>

          {/* Right Side Badges */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Skill Match Indicator or Unassigned Badge */}
            {story.assignedTeamMember ? (
              <SkillMatchIndicator matchPercentage={matchPercentage} assigneeName={story.assignedTeamMember?.name} />
            ) : (
              <Badge
                variant="outline"
                className="bg-slate-50 text-slate-500 border-slate-200"
              >
                Unassigned
              </Badge>
            )}

            {/* Role Recommendation Indicator - when no assignee but has recommendations */}
            {!story.assignedTeamMember && story.recommendedRoles && story.recommendedRoles.length > 0 && (
              <RoleRecommendationIndicator recommendation={story.recommendedRoles[0]} />
            )}

            {/* Story Points */}
            <Badge
              variant="secondary"
              className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100"
            >
              {story.storyPoints} SP
            </Badge>

            {/* Estimated Hours */}
            <Badge
              variant="secondary"
              className="bg-slate-100 text-slate-700 hover:bg-slate-100"
            >
              {story.estimatedHours}h
            </Badge>

            {/* Expand/Collapse Indicator */}
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-slate-400" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" aria-hidden="true" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      <div
        id={`story-content-${story.id}`}
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <CardContent className="p-4 pt-4 space-y-4">
            {/* Full User Story Format */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">As a</span>{" "}
                {story.role},{" "}
              </p>
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">I want</span>{" "}
                {story.want},{" "}
              </p>
              <p className="text-sm text-slate-700">
                <span className="font-semibold text-slate-900">So that</span>{" "}
                {story.benefit}.
              </p>
            </div>

            {/* Skill Gap Alert */}
            {matchPercentage < 50 && story.assignedTeamMember && (
              <motion.div
                initial={showSkillGapPulse ? { scale: 1 } : false}
                animate={
                  showSkillGapPulse
                    ? { scale: [1, 1.01, 1], opacity: [1, 0.9, 1] }
                    : {}
                }
                transition={{ duration: 0.8, repeat: 2 }}
                onAnimationComplete={() => setShowSkillGapPulse(false)}
              >
                <Alert className="bg-amber-50 border-amber-300">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <AlertTitle className="text-amber-800 font-semibold">
                  SKILL GAP: {matchPercentage}% match for{" "}
                  {story.assignedTeamMember.name}
                </AlertTitle>
                <AlertDescription className="text-amber-700 mt-1">
                  <p className="mb-3">
                    Missing skills: {missingSkills.join(", ") || "None identified"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {onAddTeamMember && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          onAddTeamMember();
                        }}
                        className="border-amber-400 text-amber-700 hover:bg-amber-100"
                      >
                        <UserPlus className="h-3 w-3 mr-1" aria-hidden="true" />
                        Add Team Member
                      </Button>
                    )}
                    {onAdjustScope && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          onAdjustScope(story.id);
                        }}
                        className="border-amber-400 text-amber-700 hover:bg-amber-100"
                      >
                        <Settings2 className="h-3 w-3 mr-1" aria-hidden="true" />
                        Adjust Scope
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        handleAcceptAnyway();
                      }}
                      className="border-amber-400 text-amber-700 hover:bg-amber-100"
                    >
                      <Check className="h-3 w-3 mr-1" aria-hidden="true" />
                      Accept Anyway
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
              </motion.div>
            )}

            {/* Anti-Pattern Warnings */}
            {activeWarnings.length > 0 && (
              <div className="space-y-1">
                {activeWarnings.map((warning: string, index: number) => (
                  <DismissibleWarning
                    key={`${warning}-${index}`}
                    warning={warning}
                    onDismiss={() => handleDismissWarning(warning)}
                  />
                ))}
              </div>
            )}

            {/* Role Recommendations - shown when no assignee but has recommendations */}
            {!story.assignedTeamMember && story.recommendedRoles && story.recommendedRoles.length > 0 && (
              <CollapsibleSection title="Recommended Team Roles" defaultOpen>
                <div className="space-y-3">
                  {story.recommendedRoles.map((rec: RoleRecommendation, index: number) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                          <span className="font-medium text-indigo-900 dark:text-indigo-200">
                            {rec.role}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200"
                          >
                            {rec.level}
                          </Badge>
                        </div>
                        <span className="text-sm text-indigo-600 dark:text-indigo-400">
                          ~{rec.estimatedHours}h
                        </span>
                      </div>
                      <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-2">
                        {rec.rationale}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {rec.requiredSkills.map((skill: string) => (
                          <Badge
                            key={skill}
                            variant="outline"
                            className="text-xs bg-white dark:bg-indigo-950 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Acceptance Criteria */}
            {story.acceptanceCriteria.length > 0 && (
              <CollapsibleSection title="Acceptance Criteria" defaultOpen>
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 pl-2">
                  {story.acceptanceCriteria.map((criterion: string, index: number) => (
                    <li key={index}>{criterion}</li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* Requirements */}
            {story.requirements && story.requirements.length > 0 && (
              <CollapsibleSection title="Requirements">
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 pl-2">
                  {story.requirements.map((requirement: string, index: number) => (
                    <li key={index}>{requirement}</li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* Tags Row */}
            {story.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {story.tags.map((tag: string) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-xs bg-slate-50"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            {/* MOBILE-01 FIX: Increased touch targets for mobile (min 44px) */}
            <div className="flex flex-wrap gap-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditClick}
                className="text-slate-700 transition-all duration-150 hover:-translate-y-0.5 min-h-[44px] sm:min-h-0 touch-manipulation"
              >
                <Edit3 className="h-4 w-4 sm:h-3 sm:w-3 mr-1.5 sm:mr-1" aria-hidden="true" />
                Edit
              </Button>
              {/* Assign button for unassigned stories */}
              {!story.assignedTeamMember && onAddTeamMember && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddTeamMember();
                  }}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-150 hover:-translate-y-0.5 min-h-[44px] sm:min-h-0 touch-manipulation"
                >
                  <UserPlus className="h-4 w-4 sm:h-3 sm:w-3 mr-1.5 sm:mr-1" aria-hidden="true" />
                  Assign
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  onSplit(story.id);
                }}
                className="text-slate-700 transition-all duration-150 hover:-translate-y-0.5 min-h-[44px] sm:min-h-0 touch-manipulation"
              >
                <Scissors className="h-4 w-4 sm:h-3 sm:w-3 mr-1.5 sm:mr-1" aria-hidden="true" />
                Split Story
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerateClick}
                className="text-slate-700 transition-all duration-150 hover:-translate-y-0.5 min-h-[44px] sm:min-h-0 touch-manipulation"
              >
                <motion.span
                  animate={isRegenerating ? { rotate: 360 } : { rotate: 0 }}
                  transition={{ duration: 0.6, ease: "linear" }}
                  className="inline-block mr-1.5 sm:mr-1"
                  aria-hidden="true"
                >
                  <RefreshCw className="h-4 w-4 sm:h-3 sm:w-3" />
                </motion.span>
                Regenerate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  onRemove(story.id);
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-150 hover:-translate-y-0.5 min-h-[44px] sm:min-h-0 touch-manipulation"
              >
                <Trash2 className="h-4 w-4 sm:h-3 sm:w-3 mr-1.5 sm:mr-1" aria-hidden="true" />
                Remove
              </Button>
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
    </motion.div>
  );
}

export default StoryCard;
