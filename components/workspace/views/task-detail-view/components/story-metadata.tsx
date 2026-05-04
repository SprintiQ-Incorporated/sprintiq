"use client";

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, react-hooks/rules-of-hooks */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Link2,
  Wrench,
  User,
  UserCircle,
  CheckSquare,
  Square
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, Profile } from "@/lib/database-aliases";

interface StoryMetadataProps {
  task: Task;
  workspaceMembers?: Profile[];
  teamMembers?: any[];
}

interface AIGenerationMetadata {
  acceptanceCriteria?: string[];
  acceptance_criteria?: string[];
  antiPatternWarnings?: string[];
  dependencies?: string[];
  requiredSkills?: string[];
  required_skills?: string[];
  recommendedRoles?: RoleRecommendation[];
  recommended_roles?: RoleRecommendation[];
  acceptanceCriteriaChecked?: Record<number, boolean>;
  [key: string]: unknown;
}

interface RoleRecommendation {
  role: string;
  level?: string;
}

export function StoryMetadata({ task, workspaceMembers = [], teamMembers = [] }: StoryMetadataProps) {
  const aiMeta = task.task_ai_metadata;

  // Only show for AI-generated stories or stories with metadata
  if (!task.generated_by_ai && !aiMeta?.ai_generation_metadata) {
    return null;
  }

  const metadata = (aiMeta?.ai_generation_metadata as AIGenerationMetadata) || {};
  const acceptanceCriteria = metadata.acceptanceCriteria || metadata.acceptance_criteria || [];
  const antiPatternWarnings = task.anti_pattern_warnings || metadata.antiPatternWarnings || [];
  const dependencies = metadata.dependencies || [];
  const requiredSkills = metadata.requiredSkills || metadata.required_skills || [];
  const recommendedRoles = metadata.recommendedRoles || metadata.recommended_roles || [];

  // Local state for acceptance criteria checkboxes (client-side only)
  const [checkedCriteria, setCheckedCriteria] = useState<Record<number, boolean>>(() => {
    // Initialize from metadata if available
    return metadata.acceptanceCriteriaChecked || {};
  });

  const completedCount = Object.values(checkedCriteria).filter(Boolean).length;
  const totalCount = acceptanceCriteria.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const toggleCriteria = (index: number) => {
    setCheckedCriteria((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Check if we have a persona
  const persona = task.persona;

  // Don't render if no story metadata exists at all
  if (
    acceptanceCriteria.length === 0 &&
    antiPatternWarnings.length === 0 &&
    dependencies.length === 0 &&
    requiredSkills.length === 0 &&
    recommendedRoles.length === 0 &&
    (task.risk === null || task.risk === undefined) &&
    (task.business_value === null || task.business_value === undefined) &&
    (task.user_impact === null || task.user_impact === undefined) &&
    (task.complexity === null || task.complexity === undefined) &&
    !persona
  ) {
    return null;
  }

  return (
    <div className="space-y-4 mb-8">
      <div className="flex items-center justify-between">
        <h3 className="text-md font-medium workspace-sidebar-text">Story Details</h3>
        {task.generated_by_ai && (
          <Badge variant="secondary" className="text-xs">
            AI Generated
          </Badge>
        )}
      </div>

      {/* Persona */}
      {persona && (
        <Card className="p-4 workspace-header-bg border workspace-border">
          <div className="flex items-center gap-2 mb-3">
            <UserCircle className="h-4 w-4 text-blue-600" />
            <h4 className="text-sm font-medium workspace-sidebar-text">Persona</h4>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium workspace-sidebar-text">{persona.name}</span>
              {persona.role && (
                <Badge variant="secondary" className="text-xs">
                  {persona.role}
                </Badge>
              )}
            </div>
            {persona.description && (
              <p className="text-sm text-muted-foreground">{persona.description}</p>
            )}
            {(persona.tech_savviness || persona.usage_frequency || persona.priority_level) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {persona.tech_savviness && (
                  <Badge variant="outline" className="text-xs">
                    Tech Savviness: {persona.tech_savviness}/5
                  </Badge>
                )}
                {persona.usage_frequency && (
                  <Badge variant="outline" className="text-xs">
                    Usage: {persona.usage_frequency}
                  </Badge>
                )}
                {persona.priority_level && (
                  <Badge variant="outline" className="text-xs">
                    Priority: {persona.priority_level}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Acceptance Criteria - Interactive Checklist */}
      {acceptanceCriteria.length > 0 && (
        <Card className="p-4 workspace-header-bg border workspace-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <h4 className="text-sm font-medium workspace-sidebar-text">Acceptance Criteria</h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {completedCount}/{totalCount}
              </span>
              {progress === 100 && (
                <Badge variant="success" className="text-xs">
                  Complete
                </Badge>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {totalCount > 0 && (
            <div className="mb-3">
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    progress === 100 ? "bg-green-500" : "bg-primary"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Checklist Items */}
          <div className="space-y-2">
            {acceptanceCriteria.map((criteria: string, index: number) => {
              const isChecked = checkedCriteria[index] || false;
              return (
                <button
                  key={index}
                  onClick={() => toggleCriteria(index)}
                  className={cn(
                    "w-full flex items-start gap-3 p-2 rounded-md text-left transition-colors min-h-[44px]",
                    "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    isChecked && "opacity-70"
                  )}
                >
                  <div className="shrink-0 mt-0.5">
                    {isChecked ? (
                      <CheckSquare className="h-4 w-4 text-green-600" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm workspace-sidebar-text leading-relaxed",
                      isChecked && "line-through text-muted-foreground"
                    )}
                  >
                    {criteria}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Anti-pattern Warnings */}
      {antiPatternWarnings.length > 0 && (
        <Card className="p-4 workspace-header-bg border workspace-border border-orange-200 dark:border-orange-900">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <h4 className="text-sm font-medium workspace-sidebar-text">Anti-pattern Warnings</h4>
          </div>
          <ul className="space-y-2 ml-6 list-disc workspace-sidebar-text">
            {antiPatternWarnings.map((warning: string, index: number) => (
              <li key={index} className="text-sm text-orange-700 dark:text-orange-400">
                {warning}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Risk Assessment */}
      {task.risk !== null && task.risk !== undefined && (
        <Card className="p-4 workspace-header-bg border workspace-border">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <h4 className="text-sm font-medium workspace-sidebar-text">Risk Assessment</h4>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted rounded-full h-2">
              <div
                className={`h-full rounded-full transition-all ${
                  task.risk > 70
                    ? "bg-red-500"
                    : task.risk > 40
                    ? "bg-orange-500"
                    : "bg-green-500"
                }`}
                style={{ width: `${task.risk}%` }}
              />
            </div>
            <span className="text-sm font-medium workspace-sidebar-text">{task.risk}%</span>
          </div>
        </Card>
      )}

      {/* Story Metrics */}
      {(task.business_value !== null && task.business_value !== undefined) ||
       (task.user_impact !== null && task.user_impact !== undefined) ||
       (task.complexity !== null && task.complexity !== undefined) ? (
        <Card className="p-4 workspace-header-bg border workspace-border">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            <h4 className="text-sm font-medium workspace-sidebar-text">Story Metrics</h4>
          </div>
          <div className="space-y-3">
            {task.business_value !== null && task.business_value !== undefined && (
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Business Value</span>
                  <span className="font-medium workspace-sidebar-text">{task.business_value}/10</span>
                </div>
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${(task.business_value / 10) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {task.user_impact !== null && task.user_impact !== undefined && (
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">User Impact</span>
                  <span className="font-medium workspace-sidebar-text">{task.user_impact}/10</span>
                </div>
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${(task.user_impact / 10) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {task.complexity !== null && task.complexity !== undefined && (
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Complexity</span>
                  <span className="font-medium workspace-sidebar-text">{task.complexity}/10</span>
                </div>
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all"
                    style={{ width: `${(task.complexity / 10) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>
      ) : null}

      {/* Dependencies */}
      {dependencies.length > 0 && (
        <Card className="p-4 workspace-header-bg border workspace-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-purple-600" />
              <h4 className="text-sm font-medium workspace-sidebar-text">Dependencies</h4>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled
              title="Feature coming soon"
            >
              Manage
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {dependencies.map((dep: string, index: number) => (
              <Badge key={index} variant="outline" className="text-xs">
                {dep}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Required Skills */}
      {requiredSkills.length > 0 && (
        <Card className="p-4 workspace-header-bg border workspace-border">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="h-4 w-4 text-indigo-600" />
            <h4 className="text-sm font-medium workspace-sidebar-text">Required Skills</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {requiredSkills.map((skill: string, index: number) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Recommended Roles */}
      {recommendedRoles.length > 0 && (
        <Card className="p-4 workspace-header-bg border workspace-border">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-teal-600" />
            <h4 className="text-sm font-medium workspace-sidebar-text">Recommended Roles</h4>
          </div>
          <div className="space-y-2">
            {recommendedRoles.map((roleRec: RoleRecommendation, index: number) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="workspace-sidebar-text">{roleRec.role}</span>
                {roleRec.level && (
                  <Badge variant="outline" className="text-xs">
                    {roleRec.level}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
