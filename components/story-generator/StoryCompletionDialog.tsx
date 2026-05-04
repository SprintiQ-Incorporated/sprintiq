"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Save,
  Loader2,
  FolderPlus,
  Folder,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Building2,
  Briefcase,
  FileText,
  AlertTriangle,
  GitBranch,
  Network,
  Info,
  Target,
  Link2,
  Layers,
} from "lucide-react";
import { AlertCircle, Plus } from "lucide-react";
import type { GeneratedStory } from "./StoryCard";
import type { DependencyGraph } from "@/lib/ai/dependency-analyzer";
import { buildDependencyGraph } from "@/lib/ai/dependency-analyzer";

// ============================================================================
// Types
// ============================================================================

export interface Space {
  space_id: string;
  name: string;
  projects: {
    project_id: string;
    name: string;
  }[];
}

export interface SaveResult {
  success: boolean;
  savedCount: number;
  spaceId: string;
  projectId?: string;
  message?: string;
}

export interface StoryCompletionDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Generated stories to save */
  stories: GeneratedStory[];
  /** Current workspace ID */
  workspaceId: string;
  /** Available spaces/portfolios */
  spaces: Space[];
  /** Whether spaces are loading */
  isLoadingSpaces?: boolean;
  /** Whether dependency analysis is enabled */
  dependencyAnalysisEnabled?: boolean;
  /** Analyzed dependencies (if enabled) */
  analyzedDependencies?: DependencyGraph | null;
  /** Callback to save stories */
  onSave: (
    destination: {
      type: "existing" | "new";
      spaceId?: string;
      projectId?: string;
      spaceName?: string;
      projectName?: string;
    },
    includeDependencies: boolean,
    dependencies?: DependencyGraph
  ) => Promise<SaveResult>;
  /** Callback to refresh spaces */
  onRefreshSpaces?: () => void;
}

// ============================================================================
// Dependency Analysis Helpers
// ============================================================================

function analyzeDependenciesFromStories(stories: GeneratedStory[]): DependencyGraph {
  // Convert stories to format expected by buildDependencyGraph
  const storyData = stories.map((story) => ({
    id: story.id,
    title: story.title,
    type: "story" as const,
    status: "pending",
    storyPoints: story.storyPoints,
    priority: story.priority || "Medium",
    dependencies: story.suggestedDependencies?.map((d) => d.taskId) || [],
    relatedTo: story.tags?.filter((t) =>
      stories.some((s) => s.tags?.includes(t) && s.id !== story.id)
    ).length
      ? stories
          .filter(
            (s) =>
              s.id !== story.id &&
              s.tags?.some((t) => story.tags?.includes(t))
          )
          .map((s) => s.id)
      : [],
  }));

  return buildDependencyGraph(storyData);
}

// ============================================================================
// Sub-Components
// ============================================================================

interface DependencyHierarchyViewProps {
  stories: GeneratedStory[];
  dependencies: DependencyGraph;
}

function DependencyHierarchyView({ stories, dependencies }: DependencyHierarchyViewProps) {
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());

  const toggleCluster = (clusterId: string) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  };

  // Group stories by clusters
  const clusterGroups = useMemo(() => {
    const groups: Map<string, GeneratedStory[]> = new Map();
    const unclusteredStories: GeneratedStory[] = [];

    // Create a map of story ID to cluster
    const storyToCluster = new Map<string, string>();
    dependencies.clusters.forEach((cluster) => {
      cluster.nodeIds.forEach((id) => {
        storyToCluster.set(id, cluster.id);
      });
    });

    // Group stories
    stories.forEach((story) => {
      const clusterId = storyToCluster.get(story.id);
      if (clusterId) {
        const existing = groups.get(clusterId) || [];
        existing.push(story);
        groups.set(clusterId, existing);
      } else {
        unclusteredStories.push(story);
      }
    });

    return { groups, unclusteredStories };
  }, [stories, dependencies.clusters]);

  // Get dependency edges for a story
  const getStoryDependencies = (storyId: string) => {
    return dependencies.edges.filter(
      (e) => e.from === storyId || e.to === storyId
    );
  };

  return (
    <div className="space-y-4">
      {/* Metrics Summary */}
      <div className="grid grid-cols-4 gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {dependencies.metrics.totalNodes}
          </p>
          <p className="text-xs text-muted-foreground">Stories</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {dependencies.metrics.totalEdges}
          </p>
          <p className="text-xs text-muted-foreground">Dependencies</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {dependencies.clusters.length}
          </p>
          <p className="text-xs text-muted-foreground">Clusters</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {dependencies.metrics.criticalPathLength}
          </p>
          <p className="text-xs text-muted-foreground">Critical Path</p>
        </div>
      </div>

      {/* Bottlenecks Warning */}
      {dependencies.bottlenecks.length > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {dependencies.bottlenecks.length} Bottleneck{dependencies.bottlenecks.length !== 1 ? "s" : ""} Detected
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                These stories block multiple other stories. Prioritize them to avoid delays.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dependency Clusters */}
      <ScrollArea className="h-64">
        <div className="space-y-2">
          {dependencies.clusters.map((cluster) => {
            const clusterStories = clusterGroups.groups.get(cluster.id) || [];
            const isExpanded = expandedClusters.has(cluster.id);

            return (
              <Collapsible
                key={cluster.id}
                open={isExpanded}
                onOpenChange={() => toggleCluster(cluster.id)}
              >
                <CollapsibleTrigger asChild>
                  <div
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                      cluster.health === "healthy"
                        ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800"
                        : cluster.health === "at_risk"
                        ? "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800"
                        : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Layers className="h-4 w-4" />
                      <span className="font-medium text-sm">{cluster.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {clusterStories.length} stories
                      </Badge>
                    </div>
                    <Badge
                      variant={
                        cluster.health === "healthy"
                          ? "default"
                          : cluster.health === "at_risk"
                          ? "secondary"
                          : "destructive"
                      }
                      className="text-xs"
                    >
                      {cluster.health}
                    </Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-6 mt-2 space-y-2">
                    {clusterStories.map((story) => {
                      const storyDeps = getStoryDependencies(story.id);
                      const isBottleneck = dependencies.bottlenecks.some(
                        (b) => b.nodeId === story.id
                      );
                      const isOnCriticalPath = dependencies.criticalPath.includes(
                        story.id
                      );

                      return (
                        <div
                          key={story.id}
                          className={cn(
                            "p-2 rounded border bg-white dark:bg-slate-800",
                            isBottleneck && "border-amber-400 dark:border-amber-600",
                            isOnCriticalPath && "border-red-400 dark:border-red-600"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm truncate max-w-[200px]">
                                {story.title}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              {isBottleneck && (
                                <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700">
                                  Bottleneck
                                </Badge>
                              )}
                              {isOnCriticalPath && (
                                <Badge variant="outline" className="text-xs bg-red-100 text-red-700">
                                  Critical
                                </Badge>
                              )}
                            </div>
                          </div>
                          {storyDeps.length > 0 && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Link2 className="h-3 w-3" />
                              <span>{storyDeps.length} dependencies</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {/* Unclustered Stories */}
          {clusterGroups.unclusteredStories.length > 0 && (
            <div className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Independent Stories</span>
                <Badge variant="outline" className="text-xs">
                  {clusterGroups.unclusteredStories.length}
                </Badge>
              </div>
              <div className="space-y-1">
                {clusterGroups.unclusteredStories.map((story) => (
                  <div
                    key={story.id}
                    className="p-2 rounded bg-white dark:bg-slate-800 text-sm"
                  >
                    {story.title}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StoryCompletionDialog({
  isOpen,
  onClose,
  stories,
  workspaceId,
  spaces,
  isLoadingSpaces,
  dependencyAnalysisEnabled = false,
  analyzedDependencies,
  onSave,
  onRefreshSpaces,
}: StoryCompletionDialogProps) {
  const [activeTab, setActiveTab] = useState("save");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Save form state
  const [destinationType, setDestinationType] = useState<"existing" | "hybrid" | "new">("existing");
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [includeDependencies, setIncludeDependencies] = useState(true);

  // Local dependency analysis
  const [localDependencies, setLocalDependencies] = useState<DependencyGraph | null>(null);

  const selectedSpace = spaces.find((s) => s.space_id === selectedSpaceId);

  // Calculate dependencies when dialog opens with dependency analysis enabled
  useEffect(() => {
    if (isOpen && dependencyAnalysisEnabled && !analyzedDependencies && stories.length > 0) {
      const deps = analyzeDependenciesFromStories(stories);
      setLocalDependencies(deps);
    }
  }, [isOpen, dependencyAnalysisEnabled, analyzedDependencies, stories]);

  // Refresh spaces when dialog opens
  useEffect(() => {
    if (isOpen) {
      onRefreshSpaces?.();
    }
  }, [isOpen, onRefreshSpaces]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSaveSuccess(false);
      setSaveError(null);
      setDestinationType("existing");
      setSelectedSpaceId("");
      setSelectedProjectId("");
      setNewSpaceName("");
      setNewProjectName("");
      setActiveTab("save");
    }
  }, [isOpen]);

  const dependencies = analyzedDependencies || localDependencies;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const destination =
        destinationType === "existing"
          ? {
              type: "existing" as const,
              spaceId: selectedSpaceId,
              projectId: selectedProjectId,
            }
          : {
              type: "new" as const,
              spaceName: newSpaceName,
              projectName: newProjectName,
            };

      const result = await onSave(
        destination,
        includeDependencies && dependencyAnalysisEnabled,
        dependencies || undefined
      );

      if (result.success) {
        setSaveSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setSaveError(result.message || "Failed to save stories");
      }
    } catch (error) {
      console.error("Save error:", error);
      setSaveError("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  }, [
    destinationType,
    selectedSpaceId,
    selectedProjectId,
    newSpaceName,
    newProjectName,
    includeDependencies,
    dependencyAnalysisEnabled,
    dependencies,
    onSave,
    onClose,
  ]);

  const isSaveDisabled =
    destinationType === "existing"
      ? !selectedSpaceId || !selectedProjectId
      : destinationType === "hybrid"
      ? !selectedSpaceId || !newProjectName
      : !newSpaceName || !newProjectName;

  // Calculate totals
  const totalPoints = stories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
  const totalHours = stories.reduce((sum, s) => sum + (s.estimatedHours || 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Stories Generated Successfully!
          </DialogTitle>
          <DialogDescription>
            {stories.length} {stories.length === 1 ? "story" : "stories"} ready ({totalPoints} points, ~{totalHours}h)
          </DialogDescription>
        </DialogHeader>

        {saveSuccess ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-slate-800 dark:text-slate-200">
              Stories Saved Successfully!
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {stories.length} {stories.length === 1 ? "story" : "stories"} added to your project
            </p>
          </div>
        ) : (
          <>
            {dependencyAnalysisEnabled && dependencies ? (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="save" className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Save Location
                  </TabsTrigger>
                  <TabsTrigger value="dependencies" className="flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    Dependencies
                    {dependencies.bottlenecks.length > 0 && (
                      <Badge variant="destructive" className="text-xs ml-1">
                        {dependencies.bottlenecks.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="save" className="space-y-4 mt-4">
                  <SaveLocationForm
                    destinationType={destinationType}
                    setDestinationType={setDestinationType}
                    selectedSpaceId={selectedSpaceId}
                    setSelectedSpaceId={setSelectedSpaceId}
                    selectedProjectId={selectedProjectId}
                    setSelectedProjectId={setSelectedProjectId}
                    newSpaceName={newSpaceName}
                    setNewSpaceName={setNewSpaceName}
                    newProjectName={newProjectName}
                    setNewProjectName={setNewProjectName}
                    spaces={spaces}
                    selectedSpace={selectedSpace}
                    isLoadingSpaces={isLoadingSpaces}
                  />

                  {/* Include Dependencies Toggle */}
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Save with Dependencies</p>
                        <p className="text-xs text-muted-foreground">
                          Include analyzed dependency relationships
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={includeDependencies}
                      onCheckedChange={setIncludeDependencies}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="dependencies" className="mt-4">
                  <DependencyHierarchyView
                    stories={stories}
                    dependencies={dependencies}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-4 py-4">
                <SaveLocationForm
                  destinationType={destinationType}
                  setDestinationType={setDestinationType}
                  selectedSpaceId={selectedSpaceId}
                  setSelectedSpaceId={setSelectedSpaceId}
                  selectedProjectId={selectedProjectId}
                  setSelectedProjectId={setSelectedProjectId}
                  newSpaceName={newSpaceName}
                  setNewSpaceName={setNewSpaceName}
                  newProjectName={newProjectName}
                  setNewProjectName={setNewProjectName}
                  spaces={spaces}
                  selectedSpace={selectedSpace}
                  isLoadingSpaces={isLoadingSpaces}
                />
              </div>
            )}

            {saveError && (
              <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">{saveError}</p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Save Later
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaveDisabled || isSaving}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save {stories.length} {stories.length === 1 ? "Story" : "Stories"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Save Location Form Sub-Component
// ============================================================================

interface SaveLocationFormProps {
  destinationType: "existing" | "hybrid" | "new";
  setDestinationType: (type: "existing" | "hybrid" | "new") => void;
  selectedSpaceId: string;
  setSelectedSpaceId: (id: string) => void;
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  newSpaceName: string;
  setNewSpaceName: (name: string) => void;
  newProjectName: string;
  setNewProjectName: (name: string) => void;
  spaces: Space[];
  selectedSpace?: Space;
  isLoadingSpaces?: boolean;
}

function SaveLocationForm({
  destinationType,
  setDestinationType,
  selectedSpaceId,
  setSelectedSpaceId,
  selectedProjectId,
  setSelectedProjectId,
  newSpaceName,
  setNewSpaceName,
  newProjectName,
  setNewProjectName,
  spaces,
  selectedSpace,
  isLoadingSpaces,
}: SaveLocationFormProps) {
  return (
    <>
      {/* Hierarchy explanation */}
      <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-xs text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">Save Hierarchy</p>
            <div className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              <span>Workspace</span>
              <ChevronRight className="h-3 w-3" />
              <Briefcase className="h-3 w-3" />
              <span>Portfolio</span>
              <ChevronRight className="h-3 w-3" />
              <Target className="h-3 w-3" />
              <span>Project</span>
            </div>
          </div>
        </div>
      </div>

      <RadioGroup
        value={destinationType}
        onValueChange={(value) => setDestinationType(value as "existing" | "hybrid" | "new")}
        className="space-y-3"
      >
        <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer">
          <RadioGroupItem value="existing" id="existing" />
          <Label htmlFor="existing" className="flex items-center gap-2 cursor-pointer flex-1">
            <Folder className="h-4 w-4 text-slate-500" />
            <div>
              <p className="font-medium">Use Existing Portfolio/Project</p>
              <p className="text-xs text-muted-foreground">
                Save to an existing location
              </p>
            </div>
          </Label>
        </div>
        <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer">
          <RadioGroupItem value="hybrid" id="hybrid" />
          <Label htmlFor="hybrid" className="flex items-center gap-2 cursor-pointer flex-1">
            <Folder className="h-4 w-4 text-blue-500" />
            <Plus className="h-3 w-3 -ml-1.5 text-blue-500" />
            <div>
              <p className="font-medium">Existing Portfolio + New Project</p>
              <p className="text-xs text-muted-foreground">
                Add a new project to an existing portfolio
              </p>
            </div>
          </Label>
        </div>
        <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer">
          <RadioGroupItem value="new" id="new" />
          <Label htmlFor="new" className="flex items-center gap-2 cursor-pointer flex-1">
            <FolderPlus className="h-4 w-4 text-slate-500" />
            <div>
              <p className="font-medium">Create New Portfolio/Project</p>
              <p className="text-xs text-muted-foreground">
                Set up a new location for these stories
              </p>
            </div>
          </Label>
        </div>
      </RadioGroup>

      {destinationType === "existing" && (
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Select Portfolio
            </Label>
            <Select value={selectedSpaceId} onValueChange={(v) => {
              setSelectedSpaceId(v);
              setSelectedProjectId(""); // Reset project when space changes
            }}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingSpaces ? "Loading..." : "Select a portfolio"} />
              </SelectTrigger>
              <SelectContent>
                {spaces.map((space) => (
                  <SelectItem key={space.space_id} value={space.space_id}>
                    {space.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSpaceId && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Select Project
              </Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {(selectedSpace?.projects || []).map((project) => (
                    <SelectItem key={project.project_id} value={project.project_id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {destinationType === "hybrid" && (
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Select Portfolio
            </Label>
            <Select value={selectedSpaceId} onValueChange={(v) => {
              setSelectedSpaceId(v);
              setSelectedProjectId(""); // Reset project when space changes
            }}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingSpaces ? "Loading..." : "Select a portfolio"} />
              </SelectTrigger>
              <SelectContent>
                {spaces.map((space) => (
                  <SelectItem key={space.space_id} value={space.space_id}>
                    {space.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              New Project Name
            </Label>
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Enter project name"
            />
          </div>

        </div>
      )}

      {destinationType === "new" && (
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Portfolio Name
            </Label>
            <Input
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              placeholder="Enter portfolio name"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Project Name
            </Label>
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Enter project name"
            />
          </div>

        </div>
      )}
    </>
  );
}

export default StoryCompletionDialog;
