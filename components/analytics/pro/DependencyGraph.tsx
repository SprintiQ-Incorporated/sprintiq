"use client";

/**
 * Dependency Graph Component
 *
 * Interactive visualization of story dependencies with
 * critical path highlighting, bottleneck detection, and cluster analysis.
 */

import React, { useState, useMemo } from "react";
import {
  GitBranch,
  AlertTriangle,
  Target,
  Layers,
  ChevronDown,
  ChevronUp,
  Clock,
  ArrowRight,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface DependencyNode {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done" | "blocked";
  storyPoints: number;
  sprintId?: string;
  sprintName?: string;
  dependencies: string[];
  dependents: string[];
  isOnCriticalPath: boolean;
  isBottleneck: boolean;
  clusterId?: string;
}

interface DependencyEdge {
  from: string;
  to: string;
  type: "blocks" | "depends_on" | "related";
  isOnCriticalPath: boolean;
}

interface Bottleneck {
  nodeId: string;
  title: string;
  blockedCount: number;
  totalImpactedPoints: number;
  severity: "critical" | "high" | "medium";
}

interface Cluster {
  id: string;
  name: string;
  nodeIds: string[];
  health: "healthy" | "at_risk" | "blocked";
}

interface DependencyMetrics {
  totalNodes: number;
  totalEdges: number;
  criticalPathLength: number;
  maxDepth: number;
  averageDependencies: number;
  blockedStories: number;
}

interface DependencyGraphData {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  criticalPath: string[];
  bottlenecks: Bottleneck[];
  clusters: Cluster[];
  metrics: DependencyMetrics;
}

interface DependencyGraphProps {
  data?: DependencyGraphData;
  isLoading?: boolean;
  className?: string;
  onNodeClick?: (nodeId: string) => void;
}

// ============================================================================
// Skeleton Component
// ============================================================================

function DependencyGraphSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6 animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        ))}
      </div>
      <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Node Component
// ============================================================================

function NodeCard({
  node,
  isSelected,
  onClick,
}: {
  node: DependencyNode;
  isSelected: boolean;
  onClick: () => void;
}) {
  const getStatusColor = () => {
    switch (node.status) {
      case "done":
        return "bg-emerald-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400";
      case "in_progress":
        return "bg-blue-500/20 border-blue-500/30 text-blue-600 dark:text-blue-400";
      case "blocked":
        return "bg-red-500/20 border-red-500/30 text-red-600 dark:text-red-400";
      default:
        return "bg-slate-200 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400";
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border text-left transition-all w-full",
        getStatusColor(),
        isSelected && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900",
        node.isOnCriticalPath && "border-l-4 border-l-amber-500",
        node.isBottleneck && "border-r-4 border-r-red-500"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
            {node.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-500">
              {node.storyPoints} pts
            </span>
            {node.sprintName && (
              <span className="text-xs text-slate-500">
                • {node.sprintName}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {node.isOnCriticalPath && (
            <Target className="h-3 w-3 text-amber-600 dark:text-amber-400" aria-label="Critical Path" />
          )}
          {node.isBottleneck && (
            <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" aria-label="Bottleneck" />
          )}
        </div>
      </div>
      {(node.dependencies.length > 0 || node.dependents.length > 0) && (
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
          {node.dependencies.length > 0 && (
            <span>↑ {node.dependencies.length} deps</span>
          )}
          {node.dependents.length > 0 && (
            <span>↓ {node.dependents.length} blocking</span>
          )}
        </div>
      )}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DependencyGraph({
  data,
  isLoading,
  className,
  onNodeClick,
}: DependencyGraphProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showCriticalPath, setShowCriticalPath] = useState(true);
  const [showBottlenecks, setShowBottlenecks] = useState(true);
  const [filterCluster, setFilterCluster] = useState<string | null>(null);

  // Filter nodes based on selected cluster
  const filteredNodes = useMemo(() => {
    if (!data) return [];
    if (!filterCluster) return data.nodes;
    const cluster = data.clusters.find(c => c.id === filterCluster);
    return cluster
      ? data.nodes.filter(n => cluster.nodeIds.includes(n.id))
      : data.nodes;
  }, [data, filterCluster]);

  // Group nodes by level (dependencies satisfied)
  const nodesByLevel = useMemo(() => {
    const levels: DependencyNode[][] = [];
    const placed = new Set<string>();
    const remaining = [...filteredNodes];

    while (remaining.length > 0) {
      const level: DependencyNode[] = [];

      for (let i = remaining.length - 1; i >= 0; i--) {
        const node = remaining[i];
        const depsPlaced = node.dependencies.every(
          depId => placed.has(depId) || !filteredNodes.find(n => n.id === depId)
        );

        if (depsPlaced || node.dependencies.length === 0) {
          level.push(node);
          placed.add(node.id);
          remaining.splice(i, 1);
        }
      }

      if (level.length === 0 && remaining.length > 0) {
        // Circular dependency - just add remaining
        level.push(...remaining);
        remaining.length = 0;
      }

      if (level.length > 0) {
        levels.push(level);
      }
    }

    return levels;
  }, [filteredNodes]);

  if (isLoading) {
    return <DependencyGraphSkeleton />;
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className={cn("rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6", className)}>
        <div className="text-center text-slate-500 dark:text-slate-400">
          <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No dependency data available</p>
        </div>
      </div>
    );
  }

  // Get selected node details
  const selectedNodeData = selectedNode
    ? data.nodes.find(n => n.id === selectedNode)
    : null;

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(selectedNode === nodeId ? null : nodeId);
    onNodeClick?.(nodeId);
  };

  return (
    <div className={cn("rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-500/20">
            <GitBranch className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Dependency Graph
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {data.metrics.totalNodes} stories • {data.metrics.totalEdges} dependencies
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.clusters.length > 1 && (
            <select
              value={filterCluster || ""}
              onChange={(e) => setFilterCluster(e.target.value || null)}
              aria-label="Filter by cluster"
              className="bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="">All Clusters</option>
              {data.clusters.map((cluster) => (
                <option key={cluster.id} value={cluster.id}>
                  {cluster.name} ({cluster.nodeIds.length})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Critical Path</span>
          </div>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
            {data.criticalPath.length}
            <span className="text-sm text-slate-500 ml-1">stories</span>
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Bottlenecks</span>
          </div>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">
            {data.bottlenecks.length}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Max Depth</span>
          </div>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {data.metrics.maxDepth}
            <span className="text-sm text-slate-500 ml-1">levels</span>
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-2 mb-1">
            <CircleDot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Blocked</span>
          </div>
          <p className={cn(
            "text-xl font-bold",
            data.metrics.blockedStories > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
          )}>
            {data.metrics.blockedStories}
          </p>
        </div>
      </div>

      {/* Critical Path Section */}
      {data.criticalPath.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowCriticalPath(!showCriticalPath)}
            aria-expanded={showCriticalPath}
            className="flex items-center justify-between w-full py-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100 transition-colors"
          >
            <span className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Critical Path ({data.criticalPath.length} stories)
            </span>
            {showCriticalPath ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showCriticalPath && (
            <div className="mt-2 bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
              <div className="flex flex-wrap items-center gap-2">
                {data.criticalPath.map((nodeId, index) => {
                  const node = data.nodes.find(n => n.id === nodeId);
                  return (
                    <React.Fragment key={nodeId}>
                      <button
                        onClick={() => handleNodeClick(nodeId)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                          node?.status === "done"
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : node?.status === "in_progress"
                            ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                            : node?.status === "blocked"
                            ? "bg-red-500/20 text-red-600 dark:text-red-400"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300",
                          selectedNode === nodeId && "ring-2 ring-amber-500"
                        )}
                      >
                        {node?.title?.slice(0, 20) || nodeId}
                        {(node?.title?.length || 0) > 20 && "..."}
                      </button>
                      {index < data.criticalPath.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-amber-600 dark:text-amber-400/50" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                <Clock className="h-3 w-3 inline mr-1" />
                Longest chain of dependencies - delays here affect the entire project
              </p>
            </div>
          )}
        </div>
      )}

      {/* Bottlenecks Section */}
      {data.bottlenecks.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowBottlenecks(!showBottlenecks)}
            aria-expanded={showBottlenecks}
            className="flex items-center justify-between w-full py-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100 transition-colors"
          >
            <span className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              Bottlenecks ({data.bottlenecks.length})
            </span>
            {showBottlenecks ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showBottlenecks && (
            <div className="mt-2 space-y-2">
              {data.bottlenecks.map((bottleneck) => (
                <button
                  key={bottleneck.nodeId}
                  onClick={() => handleNodeClick(bottleneck.nodeId)}
                  className={cn(
                    "w-full rounded-lg p-3 border text-left transition-all",
                    bottleneck.severity === "critical"
                      ? "bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20"
                      : bottleneck.severity === "high"
                      ? "bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20"
                      : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/50",
                    selectedNode === bottleneck.nodeId && "ring-2 ring-red-500"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {bottleneck.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Blocking {bottleneck.blockedCount} stories ({bottleneck.totalImpactedPoints} points)
                      </p>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium",
                      bottleneck.severity === "critical"
                        ? "bg-red-500/20 text-red-600 dark:text-red-400"
                        : bottleneck.severity === "high"
                        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                    )}>
                      {bottleneck.severity}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Visual Graph - Layered Layout */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-900/30 overflow-x-auto">
        <p className="text-xs text-slate-500 mb-3">
          Dependency Levels (left to right)
        </p>
        <div className="flex gap-4">
          {nodesByLevel.map((level, levelIndex) => (
            <div
              key={levelIndex}
              className="flex flex-col gap-2 min-w-[200px]"
            >
              <p className="text-xs text-slate-500 text-center mb-1">
                Level {levelIndex + 1}
              </p>
              {level.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  isSelected={selectedNode === node.id}
                  onClick={() => handleNodeClick(node.id)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Selected Node Details */}
      {selectedNodeData && (
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg">
          <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
            {selectedNodeData.title}
          </h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-slate-500">Status</p>
              <p className={cn(
                "font-medium capitalize",
                selectedNodeData.status === "done" ? "text-emerald-600 dark:text-emerald-400" :
                selectedNodeData.status === "in_progress" ? "text-blue-600 dark:text-blue-400" :
                selectedNodeData.status === "blocked" ? "text-red-600 dark:text-red-400" :
                "text-slate-700 dark:text-slate-300"
              )}>
                {selectedNodeData.status.replace("_", " ")}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Story Points</p>
              <p className="text-slate-700 dark:text-slate-300">{selectedNodeData.storyPoints}</p>
            </div>
            <div>
              <p className="text-slate-500">Dependencies</p>
              <p className="text-slate-700 dark:text-slate-300">
                {selectedNodeData.dependencies.length} blocking this
              </p>
            </div>
            <div>
              <p className="text-slate-500">Dependents</p>
              <p className="text-slate-700 dark:text-slate-300">
                {selectedNodeData.dependents.length} waiting on this
              </p>
            </div>
          </div>
          {(selectedNodeData.isOnCriticalPath || selectedNodeData.isBottleneck) && (
            <div className="flex gap-2 mt-3">
              {selectedNodeData.isOnCriticalPath && (
                <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  Critical Path
                </span>
              )}
              {selectedNodeData.isBottleneck && (
                <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-600 dark:text-red-400">
                  Bottleneck
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" />
          <span>Done</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/30" />
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" />
          <span>Blocked</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600" />
          <span>To Do</span>
        </div>
        <div className="flex items-center gap-1">
          <Target className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          <span>Critical Path</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" />
          <span>Bottleneck</span>
        </div>
      </div>
    </div>
  );
}

export default DependencyGraph;
