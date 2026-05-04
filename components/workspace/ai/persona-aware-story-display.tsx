"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertTriangle,
  Shield,
  User,
  Target,
  Clock,
  Goal,
  CheckCircle,
  Info,
  Zap,
} from "lucide-react";
import { UserStory } from "@/types";
import type { Persona } from "@/lib/database-aliases";
import { getPriorityColor } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Typewriter } from "react-simple-typewriter";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PersonaAwareStoryDisplayProps {
  stories: UserStory[];
  selectedPersonas: Persona[];
  antiPatternPrevention: boolean;
  onEditStory?: (story: UserStory) => void;
  onDuplicateStory?: (story: UserStory) => void;
  onDeleteStory?: (storyId: string) => void;
  onManageDependencies?: (story: UserStory) => void;
}

export default function PersonaAwareStoryDisplay({
  stories,
  selectedPersonas,
  antiPatternPrevention,
  onEditStory,
  onDuplicateStory,
  onDeleteStory,
  onManageDependencies,
}: PersonaAwareStoryDisplayProps) {
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const { toast } = useEnhancedToast();

  const getTechSavvinessLabel = (level: number) => {
    const labels = {
      1: "Beginner",
      2: "Novice",
      3: "Intermediate",
      4: "Advanced",
      5: "Expert",
    };
    return labels[level as keyof typeof labels] || "Unknown";
  };

  const getPersonaMatchScore = (story: UserStory, personas: Persona[]) => {
    if (personas.length === 0) return null;

    // Calculate how well the story matches the selected personas
    let totalScore = 0;
    const maxScore = personas.length * 100;

    personas.forEach((persona) => {
      let score = 0;

      // Check language complexity match
      const storyComplexity = story.complexity || 3;
      const personaTechLevel = persona.tech_savviness || 3;

      if (Math.abs(storyComplexity - personaTechLevel) <= 1) {
        score += 30; // Good complexity match
      } else if (Math.abs(storyComplexity - personaTechLevel) <= 2) {
        score += 15; // Moderate complexity match
      }

      // Check domain relevance
      if (
        persona.domain &&
        story.tags?.some((tag) =>
          tag.toLowerCase().includes(persona.domain.toLowerCase())
        )
      ) {
        score += 25; // Domain match
      }

      // Check role alignment
      if (
        persona.role &&
        story.role &&
        story.role.toLowerCase().includes(persona.role.toLowerCase())
      ) {
        score += 25; // Role match
      }

      // Check priority alignment
      if (persona.priority_level === "high" && story.priority === "High") {
        score += 20; // Priority match
      }

      totalScore += score;
    });

    return Math.round((totalScore / maxScore) * 100);
  };

  const getAntiPatternSeverity = (warnings: string[]) => {
    if (!warnings || warnings.length === 0) return "none";

    const highSeverityKeywords = ["critical", "severe", "major", "blocking"];
    const mediumSeverityKeywords = ["warning", "caution", "potential"];

    const hasHighSeverity = warnings.some((warning) =>
      highSeverityKeywords.some((keyword) =>
        warning.toLowerCase().includes(keyword)
      )
    );

    const hasMediumSeverity = warnings.some((warning) =>
      mediumSeverityKeywords.some((keyword) =>
        warning.toLowerCase().includes(keyword)
      )
    );

    if (hasHighSeverity) return "high";
    if (hasMediumSeverity) return "medium";
    return "low";
  };

  return (
    <div className="space-y-6">
      {/* Persona Summary Header */}
      {selectedPersonas.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Persona-Aware Story Generation
              {antiPatternPrevention && (
                <Badge variant="secondary" className="ml-auto">
                  <Shield className="h-3 w-3 mr-1" />
                  Anti-Pattern Prevention Active
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {selectedPersonas.map((persona) => (
                <Badge key={persona.id} variant="outline" className="text-xs">
                  {persona.name} (
                  {getTechSavvinessLabel(persona.tech_savviness || 3)})
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Stories have been adjusted for {selectedPersonas.length} target
              persona{selectedPersonas.length !== 1 ? "s" : ""} with{" "}
              {antiPatternPrevention
                ? "anti-pattern prevention"
                : "standard generation"}
              .
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stories List */}
      <div className="space-y-4">
        {stories.map((story, index) => {
          const personaMatchScore = getPersonaMatchScore(
            story,
            selectedPersonas
          );
          const antiPatternSeverity = getAntiPatternSeverity(
            story.antiPatternWarnings || []
          );
          const isExpanded = expandedStory === story.id;

          return (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{
                delay: index * 0.1,
                duration: 0.5,
                type: "spring",
              }}
            >
              <Card
                className={`transition-all duration-200 ${
                  antiPatternSeverity === "high"
                    ? "border-red-300 bg-red-50"
                    : antiPatternSeverity === "medium"
                    ? "border-yellow-300 bg-yellow-50"
                    : "border-gray-200"
                }`}
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Story Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-sm">
                            <Typewriter
                              words={[story.title]}
                              typeSpeed={30}
                              cursor={false}
                            />
                          </h3>
                          {personaMatchScore && (
                            <Badge
                              variant="secondary"
                              className="text-xs cursor-pointer group overflow-hidden transition-all duration-300 ease-in-out hover:w-auto w-12"
                            >
                              <span className="h-4 mr-1 flex-shrink-0 transition-transform duration-500 ease-in-out group-hover:scale-110">
                                {personaMatchScore}%
                              </span>
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out whitespace-nowrap">
                                persona match
                              </span>
                            </Badge>
                          )}
                          {(story as any).personaAdjusted && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-emerald-100 text-emerald-700 cursor-pointer group overflow-hidden transition-all duration-300 ease-in-out px-1 hover:px-2 hover:w-auto w-6"
                            >
                              <Zap className="h-3 w-4 flex-shrink-0 transition-transform duration-500 ease-in-out group-hover:rotate-[360deg]" />
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out whitespace-nowrap ml-1">
                                Persona-adjusted
                              </span>
                            </Badge>
                          )}
                        </div>

                        {/* Priority and Story Points */}
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            className={`${getPriorityColor(
                              story.priority || "Medium"
                            )} text-xs flex items-center`}
                          >
                            <Goal className="h-3 w-3 mr-1" />
                            {story.priority || "Medium"}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="text-xs flex items-center"
                          >
                            <Target className="h-3 w-3 mr-1" />
                            {story.storyPoints || 0} pts
                          </Badge>
                          {story.estimatedTime && (
                            <Badge
                              variant="secondary"
                              className="text-xs flex items-center"
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              {story.estimatedTime}h
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Anti-Pattern Warning Indicator */}
                      {story.antiPatternWarnings &&
                        story.antiPatternWarnings.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="secondary"
                              className={`text-xs ${
                                antiPatternSeverity === "high"
                                  ? "bg-red-100 text-red-700"
                                  : antiPatternSeverity === "medium"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-orange-100 text-orange-700"
                              }`}
                            >
                              <AlertTriangle
                                className={`h-3 w-4 mr-1 ${
                                  antiPatternSeverity === "high"
                                    ? "text-red-500"
                                    : antiPatternSeverity === "medium"
                                    ? "text-yellow-500"
                                    : "text-orange-500"
                                }`}
                              />
                              {story.antiPatternWarnings.length} warning
                              {story.antiPatternWarnings.length !== 1
                                ? "s"
                                : ""}
                            </Badge>
                          </div>
                        )}
                    </div>

                    {/* User Story */}
                    <div className="text-sm text-muted-foreground">
                      As a{" "}
                      <span className="font-medium">
                        <Typewriter
                          words={[story.role]}
                          typeSpeed={30}
                          cursor={false}
                        />
                      </span>
                      , I want{" "}
                      <span className="font-medium">
                        <Typewriter
                          words={[story.want]}
                          typeSpeed={30}
                          cursor={false}
                        />
                      </span>
                      , so that{" "}
                      <span className="font-medium">
                        <Typewriter
                          words={[story.benefit]}
                          typeSpeed={30}
                          cursor={false}
                        />
                      </span>
                    </div>

                    {/* Expandable Content */}
                    <div className="space-y-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedStory(isExpanded ? null : story.id)
                        }
                        className="h-6 px-2 text-xs"
                      >
                        {isExpanded ? "Show less" : "Show details"}
                      </Button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-3 overflow-hidden"
                          >
                            {/* Acceptance Criteria */}
                            <div>
                              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <CheckCircle className="h-4 w-4" />
                                Acceptance Criteria
                              </h4>
                              <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                                {story.acceptanceCriteria.map(
                                  (criteria, idx) => (
                                    <li
                                      key={idx}
                                      className="text-muted-foreground"
                                    >
                                      {criteria}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>

                            {/* Requirements */}
                            {story.requirements &&
                              story.requirements.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                    <Info className="h-4 w-4" />
                                    Requirements
                                  </h4>
                                  <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                                    {story.requirements.map((req, idx) => (
                                      <li
                                        key={idx}
                                        className="text-muted-foreground"
                                      >
                                        {req}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                            {/* Anti-Pattern Warnings */}
                            {story.antiPatternWarnings &&
                              story.antiPatternWarnings.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                                    Anti-Pattern Warnings
                                  </h4>
                                  <div className="space-y-2">
                                    {story.antiPatternWarnings.map(
                                      (warning, idx) => (
                                        <div
                                          key={idx}
                                          className={`p-2 rounded text-sm ${
                                            antiPatternSeverity === "high"
                                              ? "bg-red-100 text-red-800 border border-red-200"
                                              : antiPatternSeverity === "medium"
                                              ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                                              : "bg-orange-100 text-orange-800 border border-orange-200"
                                          }`}
                                        >
                                          ⚠️ {warning}
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}

                            {/* Failure Prevention Strategy */}
                            {(story as any).failurePrevention && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                  <Shield className="h-4 w-4 text-emerald-500" />
                                  Failure Prevention Strategy
                                </h4>
                                <div className="p-2 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-sm">
                                  🛡️ {(story as any).failurePrevention}
                                </div>
                              </div>
                            )}

                            {/* Tags */}
                            {story.tags && story.tags.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2">
                                  Tags
                                </h4>
                                <div className="flex flex-wrap gap-1">
                                  {story.tags.map((tag, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Team Assignment */}
                            {story.assignedTeamMember && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2">
                                  Assigned To
                                </h4>
                                <div className="flex items-center gap-2">
                                  <div className="relative">
                                    <Avatar className="h-7 w-7">
                                      <AvatarImage
                                        src={
                                          story.assignedTeamMember.avatar_url
                                        }
                                      />
                                      <AvatarFallback className="text-xs text-workspace-primary workspace-component-bg">
                                        {story.assignedTeamMember.name
                                          .split(" ")
                                          .map((n) => n[0])
                                          .join("")
                                          .toUpperCase()
                                          .slice(0, 2)}
                                      </AvatarFallback>
                                    </Avatar>
                                    {story.antiPatternWarnings?.some(
                                      (warning) =>
                                        warning.includes("LOW SKILL MATCH") &&
                                        story.assignedTeamMember &&
                                        warning.includes(
                                          story.assignedTeamMember.name
                                        )
                                    ) && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="absolute -top-1 -right-1 h-3 w-3 p-0 text-[10px] bg-red-500 hover:bg-red-600 text-white rounded-full border border-white"
                                            onClick={() => {
                                              const warning =
                                                story.antiPatternWarnings?.find(
                                                  (w) =>
                                                    w.includes(
                                                      "LOW SKILL MATCH"
                                                    ) &&
                                                    story.assignedTeamMember &&
                                                    w.includes(
                                                      story.assignedTeamMember
                                                        .name
                                                    )
                                                );
                                              if (warning) {
                                                toast({
                                                  title: "Skill Match Alert",
                                                  description: warning,
                                                  variant: "destructive",
                                                  duration: 5000,
                                                });
                                              }
                                            }}
                                          >
                                            !
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <p className="text-xs">
                                            Low skill match - Click for details
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                  <span className="text-sm">
                                    {story.assignedTeamMember.name} (
                                    {story.assignedTeamMember.role})
                                  </span>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                      {onManageDependencies && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onManageDependencies(story)}
                          className="h-6 px-2 text-xs"
                        >
                          Dependencies
                        </Button>
                      )}
                      {onEditStory && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEditStory(story)}
                          className="h-6 px-2 text-xs"
                        >
                          Edit
                        </Button>
                      )}
                      {onDuplicateStory && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDuplicateStory(story)}
                          className="h-6 px-2 text-xs"
                        >
                          Duplicate
                        </Button>
                      )}
                      {onDeleteStory && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onDeleteStory(story.id)}
                          className="h-6 px-2 text-xs"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
