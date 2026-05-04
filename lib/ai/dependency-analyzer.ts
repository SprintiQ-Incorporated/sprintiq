/**
 * Advanced Dependency Analyzer
 *
 * Cross-project dependency mapping and impact analysis
 */

export interface DependencyNode {
  id: string;
  type: "story" | "project" | "milestone";
  title: string;
  status: "done" | "in_progress" | "blocked" | "pending";
  storyPoints?: number;
  priority: "critical" | "high" | "medium" | "low";
  owner?: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: "blocks" | "related" | "impacts" | "depends_on";
  strength: "strong" | "medium" | "weak";
  description?: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  criticalPath: string[];
  bottlenecks: Array<{
    nodeId: string;
    blockedCount: number;
    totalImpactedPoints: number;
    severity: "critical" | "high" | "medium";
  }>;
  clusters: Array<{
    id: string;
    name: string;
    nodeIds: string[];
    health: "healthy" | "at_risk" | "blocked";
  }>;
  metrics: {
    totalNodes: number;
    totalEdges: number;
    avgDependencyDepth: number;
    maxDependencyChain: number;
    blockedPercentage: number;
    criticalPathLength: number;
  };
}

export interface DependencyImpact {
  storyId: string;
  directlyBlocked: number;
  transitivelyBlocked: number;
  estimatedDelayDays: number;
  affectedStories: Array<{
    id: string;
    title: string;
    storyPoints: number;
    delayRisk: "high" | "medium" | "low";
  }>;
  recommendations: string[];
}

/**
 * Build dependency graph from stories and their relationships
 */
export function buildDependencyGraph(
  stories: Array<{
    id: string;
    title: string;
    type: "story" | "project" | "milestone";
    status: string;
    storyPoints?: number;
    priority?: string;
    assignee?: string;
    dependencies?: string[];
    relatedTo?: string[];
    blockedBy?: string[];
  }>
): DependencyGraph {
  const nodes: DependencyNode[] = [];
  const edges: DependencyEdge[] = [];

  // Build nodes
  for (const story of stories) {
    nodes.push({
      id: story.id,
      type: story.type || "story",
      title: story.title,
      status: mapStatus(story.status),
      storyPoints: story.storyPoints,
      priority: mapPriority(story.priority),
      owner: story.assignee,
    });

    // Build edges from dependencies
    if (story.dependencies) {
      for (const depId of story.dependencies) {
        edges.push({
          from: depId,
          to: story.id,
          type: "blocks",
          strength: "strong",
        });
      }
    }

    if (story.blockedBy) {
      for (const blockerId of story.blockedBy) {
        edges.push({
          from: blockerId,
          to: story.id,
          type: "blocks",
          strength: "strong",
        });
      }
    }

    if (story.relatedTo) {
      for (const relatedId of story.relatedTo) {
        // Avoid duplicate edges
        const exists = edges.some(
          (e) =>
            (e.from === story.id && e.to === relatedId) ||
            (e.from === relatedId && e.to === story.id)
        );
        if (!exists) {
          edges.push({
            from: story.id,
            to: relatedId,
            type: "related",
            strength: "medium",
          });
        }
      }
    }
  }

  // Find critical path
  const criticalPath = findCriticalPath(nodes, edges);

  // Identify bottlenecks
  const bottlenecks = identifyBottlenecks(nodes, edges);

  // Identify clusters
  const clusters = identifyClusters(nodes, edges);

  // Calculate metrics
  const blockedNodes = nodes.filter((n) => n.status === "blocked").length;
  const metrics = {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    avgDependencyDepth: calculateAverageDependencyDepth(nodes, edges),
    maxDependencyChain: findMaxDependencyChain(nodes, edges),
    blockedPercentage:
      nodes.length > 0 ? Math.round((blockedNodes / nodes.length) * 100) : 0,
    criticalPathLength: criticalPath.length,
  };

  return {
    nodes,
    edges,
    criticalPath,
    bottlenecks,
    clusters,
    metrics,
  };
}

/**
 * Calculate impact of a specific story being blocked
 */
export function calculateDependencyImpact(
  storyId: string,
  graph: DependencyGraph,
  velocityPerDay: number = 5
): DependencyImpact {
  const directlyBlocked = new Set<string>();
  const transitivelyBlocked = new Set<string>();

  // Find directly blocked stories
  for (const edge of graph.edges) {
    if (edge.from === storyId && edge.type === "blocks") {
      directlyBlocked.add(edge.to);
    }
  }

  // Find transitively blocked (BFS)
  const queue = [...directlyBlocked];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of graph.edges) {
      if (edge.from === current && edge.type === "blocks") {
        if (!directlyBlocked.has(edge.to) && !transitivelyBlocked.has(edge.to)) {
          transitivelyBlocked.add(edge.to);
          queue.push(edge.to);
        }
      }
    }
  }

  // Calculate affected stories with details
  const allBlockedIds = new Set([...directlyBlocked, ...transitivelyBlocked]);
  const affectedStories = graph.nodes
    .filter((n) => allBlockedIds.has(n.id))
    .map((n) => ({
      id: n.id,
      title: n.title,
      storyPoints: n.storyPoints || 0,
      delayRisk: n.priority === "critical" ? ("high" as const) : n.priority === "high" ? ("medium" as const) : ("low" as const),
    }));

  // Estimate delay
  const totalBlockedPoints = affectedStories.reduce(
    (sum, s) => sum + s.storyPoints,
    0
  );
  const estimatedDelayDays = Math.ceil(totalBlockedPoints / velocityPerDay);

  // Generate recommendations
  const recommendations = generateDependencyRecommendations(
    storyId,
    graph,
    directlyBlocked.size,
    transitivelyBlocked.size
  );

  return {
    storyId,
    directlyBlocked: directlyBlocked.size,
    transitivelyBlocked: transitivelyBlocked.size,
    estimatedDelayDays,
    affectedStories,
    recommendations,
  };
}

/**
 * Find the critical path through the dependency graph
 */
function findCriticalPath(
  nodes: DependencyNode[],
  edges: DependencyEdge[]
): string[] {
  // Build adjacency list
  const adjacency: Map<string, string[]> = new Map();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    if (edge.type === "blocks") {
      adjacency.get(edge.from)?.push(edge.to);
    }
  }

  // Find longest path using DFS
  let longestPath: string[] = [];

  function dfs(nodeId: string, path: string[], visited: Set<string>): void {
    if (visited.has(nodeId)) return;

    const newPath = [...path, nodeId];
    if (newPath.length > longestPath.length) {
      longestPath = newPath;
    }

    visited.add(nodeId);
    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      dfs(neighbor, newPath, visited);
    }
    visited.delete(nodeId);
  }

  // Find nodes with no incoming edges (roots)
  const hasIncoming = new Set(
    edges.filter((e) => e.type === "blocks").map((e) => e.to)
  );
  const roots = nodes.filter((n) => !hasIncoming.has(n.id));

  for (const root of roots) {
    dfs(root.id, [], new Set());
  }

  return longestPath;
}

/**
 * Identify bottleneck nodes
 */
function identifyBottlenecks(
  nodes: DependencyNode[],
  edges: DependencyEdge[]
): DependencyGraph["bottlenecks"] {
  const blockingCount: Map<string, Set<string>> = new Map();

  // Count how many stories each node blocks (directly + transitively)
  for (const node of nodes) {
    const blocked = new Set<string>();
    const queue = [node.id];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      for (const edge of edges) {
        if (edge.from === current && edge.type === "blocks") {
          blocked.add(edge.to);
          queue.push(edge.to);
        }
      }
    }

    blockingCount.set(node.id, blocked);
  }

  // Identify significant bottlenecks (blocking 3+ stories)
  const bottlenecks: DependencyGraph["bottlenecks"] = [];

  for (const [nodeId, blockedSet] of blockingCount) {
    if (blockedSet.size >= 3) {
      const totalPoints = [...blockedSet]
        .map((id) => nodes.find((n) => n.id === id)?.storyPoints || 0)
        .reduce((sum, p) => sum + p, 0);

      bottlenecks.push({
        nodeId,
        blockedCount: blockedSet.size,
        totalImpactedPoints: totalPoints,
        severity:
          blockedSet.size >= 7
            ? "critical"
            : blockedSet.size >= 5
            ? "high"
            : "medium",
      });
    }
  }

  return bottlenecks.sort((a, b) => b.blockedCount - a.blockedCount);
}

/**
 * Identify connected clusters of dependencies
 */
function identifyClusters(
  nodes: DependencyNode[],
  edges: DependencyEdge[]
): DependencyGraph["clusters"] {
  const visited = new Set<string>();
  const clusters: DependencyGraph["clusters"] = [];

  // Build undirected adjacency for clustering
  const adjacency: Map<string, Set<string>> = new Map();
  for (const node of nodes) {
    adjacency.set(node.id, new Set());
  }
  for (const edge of edges) {
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }

  // Find connected components
  function bfs(startId: string): string[] {
    const cluster: string[] = [];
    const queue = [startId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      cluster.push(current);

      const neighbors = adjacency.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    return cluster;
  }

  let clusterNum = 1;
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const nodeIds = bfs(node.id);
      if (nodeIds.length > 1) {
        // Only track multi-node clusters
        const clusterNodes = nodes.filter((n) => nodeIds.includes(n.id));
        const blockedCount = clusterNodes.filter(
          (n) => n.status === "blocked"
        ).length;
        const health: "healthy" | "at_risk" | "blocked" =
          blockedCount === 0
            ? "healthy"
            : blockedCount / clusterNodes.length > 0.3
            ? "blocked"
            : "at_risk";

        clusters.push({
          id: `cluster-${clusterNum++}`,
          name: `Dependency Cluster ${clusterNum - 1}`,
          nodeIds,
          health,
        });
      }
    }
  }

  return clusters;
}

/**
 * Calculate average dependency depth
 */
function calculateAverageDependencyDepth(
  nodes: DependencyNode[],
  edges: DependencyEdge[]
): number {
  const blockingEdges = edges.filter((e) => e.type === "blocks");
  if (blockingEdges.length === 0) return 0;

  // Build adjacency list
  const inDegree: Map<string, number> = new Map();
  const outEdges: Map<string, string[]> = new Map();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    outEdges.set(node.id, []);
  }

  for (const edge of blockingEdges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    outEdges.get(edge.from)?.push(edge.to);
  }

  // Topological sort with depth tracking
  const depths: Map<string, number> = new Map();
  const queue = nodes
    .filter((n) => (inDegree.get(n.id) || 0) === 0)
    .map((n) => n.id);

  for (const id of queue) {
    depths.set(id, 0);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depths.get(current) || 0;

    for (const neighbor of outEdges.get(current) || []) {
      const newDepth = currentDepth + 1;
      depths.set(neighbor, Math.max(depths.get(neighbor) || 0, newDepth));
      inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  const depthValues = Array.from(depths.values());
  return depthValues.length > 0
    ? Math.round(
        (depthValues.reduce((a, b) => a + b, 0) / depthValues.length) * 10
      ) / 10
    : 0;
}

/**
 * Find the maximum dependency chain length
 */
function findMaxDependencyChain(
  nodes: DependencyNode[],
  edges: DependencyEdge[]
): number {
  const criticalPath = findCriticalPath(nodes, edges);
  return criticalPath.length;
}

/**
 * Generate recommendations for dependency issues
 */
function generateDependencyRecommendations(
  storyId: string,
  graph: DependencyGraph,
  directBlocked: number,
  transitiveBlocked: number
): string[] {
  const recommendations: string[] = [];
  const totalBlocked = directBlocked + transitiveBlocked;

  if (totalBlocked >= 10) {
    recommendations.push(
      "CRITICAL: This story is a major bottleneck. Prioritize resolution immediately."
    );
    recommendations.push(
      "Consider splitting this story into smaller, independently completable pieces."
    );
  } else if (totalBlocked >= 5) {
    recommendations.push(
      "HIGH PRIORITY: Multiple stories are waiting on this work."
    );
    recommendations.push("Assign dedicated resources to unblock this item.");
  }

  if (transitiveBlocked > directBlocked * 2) {
    recommendations.push(
      "Cascade effect detected: Consider restructuring dependencies."
    );
  }

  const node = graph.nodes.find((n) => n.id === storyId);
  if (node?.status === "blocked") {
    recommendations.push(
      "This story is also blocked. Identify and resolve upstream blockers first."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Dependency impact is manageable. Continue monitoring.");
  }

  return recommendations;
}

/**
 * Map status string to typed status
 */
function mapStatus(
  status: string
): "done" | "in_progress" | "blocked" | "pending" {
  const lower = status?.toLowerCase() || "";
  if (lower.includes("done") || lower.includes("complete")) return "done";
  if (lower.includes("progress") || lower.includes("active")) return "in_progress";
  if (lower.includes("block")) return "blocked";
  return "pending";
}

/**
 * Map priority string to typed priority
 */
function mapPriority(
  priority?: string
): "critical" | "high" | "medium" | "low" {
  const lower = priority?.toLowerCase() || "";
  if (lower.includes("critical") || lower.includes("urgent")) return "critical";
  if (lower.includes("high")) return "high";
  if (lower.includes("low")) return "low";
  return "medium";
}

/**
 * Analyze cross-project dependencies
 */
export function analyzeCrossProjectDependencies(
  projects: Array<{
    id: string;
    name: string;
    stories: Array<{
      id: string;
      title: string;
      dependencies?: string[];
      projectId: string;
    }>;
  }>
): {
  crossProjectEdges: Array<{
    fromProject: string;
    toProject: string;
    dependencyCount: number;
    stories: Array<{ from: string; to: string }>;
  }>;
  riskScore: number;
  recommendations: string[];
} {
  const crossProjectEdges: Map<
    string,
    { count: number; stories: Array<{ from: string; to: string }> }
  > = new Map();

  // Build story to project mapping
  const storyToProject: Map<string, string> = new Map();
  for (const project of projects) {
    for (const story of project.stories) {
      storyToProject.set(story.id, project.id);
    }
  }

  // Find cross-project dependencies
  for (const project of projects) {
    for (const story of project.stories) {
      for (const depId of story.dependencies || []) {
        const depProject = storyToProject.get(depId);
        if (depProject && depProject !== project.id) {
          const key = `${depProject}->${project.id}`;
          const existing = crossProjectEdges.get(key) || { count: 0, stories: [] };
          existing.count++;
          existing.stories.push({ from: depId, to: story.id });
          crossProjectEdges.set(key, existing);
        }
      }
    }
  }

  // Convert to array
  const edges = Array.from(crossProjectEdges.entries()).map(([key, value]) => {
    const [fromProject, toProject] = key.split("->") as [string, string];
    return {
      fromProject,
      toProject,
      dependencyCount: value.count,
      stories: value.stories,
    };
  });

  // Calculate risk score
  const totalCrossProjectDeps = edges.reduce(
    (sum, e) => sum + e.dependencyCount,
    0
  );
  const riskScore = Math.min(100, totalCrossProjectDeps * 5);

  // Generate recommendations
  const recommendations: string[] = [];
  if (riskScore >= 75) {
    recommendations.push(
      "CRITICAL: High cross-project coupling detected. Consider architectural review."
    );
  } else if (riskScore >= 50) {
    recommendations.push(
      "Cross-project dependencies may cause coordination challenges."
    );
  }

  edges.forEach((edge) => {
    if (edge.dependencyCount >= 5) {
      const fromName =
        projects.find((p) => p.id === edge.fromProject)?.name || edge.fromProject;
      const toName =
        projects.find((p) => p.id === edge.toProject)?.name || edge.toProject;
      recommendations.push(
        `${edge.dependencyCount} dependencies from "${fromName}" to "${toName}" - consider closer team alignment.`
      );
    }
  });

  return {
    crossProjectEdges: edges,
    riskScore,
    recommendations,
  };
}
