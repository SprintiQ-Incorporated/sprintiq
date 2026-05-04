"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

export interface DeathSpiralIndicator {
  id: string;
  name: string;
  value: number;
  threshold: number;
  status: "healthy" | "warning" | "critical";
  weight: number;
  trend: "improving" | "stable" | "worsening";
  description: string;
}

export interface DeathSpiralIntervention {
  id: string;
  priority: "immediate" | "short_term" | "long_term";
  action: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  targetIndicator: string;
}

export interface DeathSpiralData {
  riskScore: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  predictionAccuracy: number;
  indicators: DeathSpiralIndicator[];
  interventions: DeathSpiralIntervention[];
  daysToIntervention: number | null;
  confidenceInterval: { low: number; high: number };
  historicalAccuracy: number;
  sprintsAnalyzed: number;
}

export interface VelocityDataPoint {
  sprint: string;
  actual?: number;
  predicted?: number;
  confidenceLow?: number;
  confidenceHigh?: number;
  isPrediction: boolean;
}

export interface RiskFactor {
  id: string;
  name: string;
  impact: "high" | "medium" | "low";
  description: string;
}

export interface PredictiveVelocityData {
  dataPoints: VelocityDataPoint[];
  averageVelocity: number;
  predictedTrend: "up" | "down" | "stable";
  trendPercentage: number;
  predictionAccuracy: number;
  confidenceLevel: number;
  riskFactors: RiskFactor[];
  recommendations: string[];
}

export interface DependencyNode {
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

export interface DependencyEdge {
  from: string;
  to: string;
  type: "blocks" | "depends_on" | "related";
  isOnCriticalPath: boolean;
}

export interface DependencyBottleneck {
  nodeId: string;
  title: string;
  blockedCount: number;
  totalImpactedPoints: number;
  severity: "critical" | "high" | "medium";
}

export interface DependencyCluster {
  id: string;
  name: string;
  nodeIds: string[];
  health: "healthy" | "at_risk" | "blocked";
}

export interface DependencyGraphData {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  criticalPath: string[];
  bottlenecks: DependencyBottleneck[];
  clusters: DependencyCluster[];
  metrics: {
    totalNodes: number;
    totalEdges: number;
    criticalPathLength: number;
    maxDepth: number;
    averageDependencies: number;
    blockedStories: number;
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  return response.json();
}

async function fetchDeathSpiral(workspaceId: string): Promise<DeathSpiralData> {
  return fetchJson(
    `/api/workspace/${workspaceId}/analytics/advanced/death-spiral`
  );
}

async function fetchPredictiveVelocity(
  workspaceId: string
): Promise<PredictiveVelocityData> {
  return fetchJson(
    `/api/workspace/${workspaceId}/analytics/advanced/predictive-velocity`
  );
}

async function fetchDependencyGraph(
  workspaceId: string,
  sprintId?: string
): Promise<DependencyGraphData> {
  const url = sprintId
    ? `/api/workspace/${workspaceId}/analytics/advanced/dependencies?sprintId=${sprintId}`
    : `/api/workspace/${workspaceId}/analytics/advanced/dependencies`;
  return fetchJson(url);
}

export function useDeathSpiral(workspaceId: string) {
  return useQuery<DeathSpiralData, Error>({
    queryKey: ["analytics", "death-spiral", workspaceId],
    queryFn: () => fetchDeathSpiral(workspaceId),
    enabled: !!workspaceId,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePredictiveVelocity(workspaceId: string) {
  return useQuery<PredictiveVelocityData, Error>({
    queryKey: ["analytics", "predictive-velocity", workspaceId],
    queryFn: () => fetchPredictiveVelocity(workspaceId),
    enabled: !!workspaceId,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useDependencyGraph(workspaceId: string, sprintId?: string) {
  return useQuery<DependencyGraphData, Error>({
    queryKey: ["analytics", "dependencies", workspaceId, sprintId],
    queryFn: () => fetchDependencyGraph(workspaceId, sprintId),
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useAllAdvancedAnalytics(workspaceId: string) {
  const deathSpiralQuery = useDeathSpiral(workspaceId);
  const predictiveVelocityQuery = usePredictiveVelocity(workspaceId);
  const dependencyQuery = useDependencyGraph(workspaceId);

  const isLoading =
    deathSpiralQuery.isLoading ||
    predictiveVelocityQuery.isLoading ||
    dependencyQuery.isLoading;

  const isError =
    deathSpiralQuery.isError ||
    predictiveVelocityQuery.isError ||
    dependencyQuery.isError;

  const refetchAll = useCallback(() => {
    deathSpiralQuery.refetch();
    predictiveVelocityQuery.refetch();
    dependencyQuery.refetch();
  }, [
    deathSpiralQuery,
    predictiveVelocityQuery,
    dependencyQuery,
  ]);

  return {
    deathSpiral: deathSpiralQuery.data,
    predictiveVelocity: predictiveVelocityQuery.data,
    dependencies: dependencyQuery.data,
    isLoading,
    isError,
    refetchAll,
    queries: {
      deathSpiral: deathSpiralQuery,
      predictiveVelocity: predictiveVelocityQuery,
      dependencies: dependencyQuery,
    },
  };
}

export function useProfessionalHealthSummary(workspaceId: string) {
  const { deathSpiral } = useAllAdvancedAnalytics(workspaceId);

  return useMemo(() => {
    const overallScore = deathSpiral
      ? 100 - deathSpiral.riskScore
      : null;

    const status =
      overallScore === null
        ? "unknown"
        : overallScore >= 80
        ? "healthy"
        : overallScore >= 60
        ? "fair"
        : overallScore >= 40
        ? "at_risk"
        : "critical";

    return {
      overallScore,
      status,
      components: {
        riskHealth: deathSpiral ? 100 - deathSpiral.riskScore : null,
      },
      criticalIssues:
        deathSpiral?.indicators.filter((i) => i.status === "critical")
          .length ?? 0,
    };
  }, [deathSpiral]);
}
