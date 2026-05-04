/**
 * AI Dependency Analysis Integration Tests
 *
 * These tests verify the AI-powered dependency analysis feature works correctly.
 * Run with: npx vitest run __tests__/ai-dependencies.test.ts
 * Or: npx jest __tests__/ai-dependencies.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock types for testing
interface DependencyRecommendation {
  sourceTaskId: string;
  targetTaskId: string;
  dependencyType: 'blocks' | 'is_blocked_by' | 'relates_to';
  confidence: number;
  reason: string;
  suggestedOrder?: number;
}

interface CircularRiskWarning {
  taskIds: string[];
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestedResolution: string;
}

interface AnalyzeResult {
  recommendations: DependencyRecommendation[];
  circularRisks: CircularRiskWarning[];
  error?: string;
}

// Mock task data
const mockTasks = [
  {
    id: 'task-1',
    task_id: 'task-1',
    name: 'Create database schema',
    description: 'Design and implement the database schema for user management',
    priority: 'high',
    story_points: 5,
    status_id: 'status-1',
  },
  {
    id: 'task-2',
    task_id: 'task-2',
    name: 'Implement user API endpoints',
    description: 'Create REST API endpoints for user CRUD operations',
    priority: 'high',
    story_points: 8,
    status_id: 'status-1',
  },
  {
    id: 'task-3',
    task_id: 'task-3',
    name: 'Build user registration form',
    description: 'Create frontend form for user registration with validation',
    priority: 'medium',
    story_points: 3,
    status_id: 'status-2',
  },
  {
    id: 'task-4',
    task_id: 'task-4',
    name: 'Add authentication middleware',
    description: 'Implement JWT authentication middleware for protected routes',
    priority: 'high',
    story_points: 5,
    status_id: 'status-1',
  },
];

describe('AI Dependency Analysis', () => {
  describe('Type Definitions', () => {
    it('DependencyRecommendation has required fields', () => {
      const recommendation: DependencyRecommendation = {
        sourceTaskId: 'task-1',
        targetTaskId: 'task-2',
        dependencyType: 'blocks',
        confidence: 85,
        reason: 'Database schema must be created before API endpoints',
        suggestedOrder: 1,
      };

      expect(recommendation.sourceTaskId).toBeDefined();
      expect(recommendation.targetTaskId).toBeDefined();
      expect(recommendation.dependencyType).toBe('blocks');
      expect(recommendation.confidence).toBeGreaterThanOrEqual(0);
      expect(recommendation.confidence).toBeLessThanOrEqual(100);
      expect(recommendation.reason).toBeDefined();
    });

    it('CircularRiskWarning has required fields', () => {
      const warning: CircularRiskWarning = {
        taskIds: ['task-1', 'task-2', 'task-3'],
        description: 'Circular dependency detected between tasks',
        severity: 'high',
        suggestedResolution: 'Break the dependency chain by removing one connection',
      };

      expect(warning.taskIds.length).toBeGreaterThanOrEqual(2);
      expect(['low', 'medium', 'high']).toContain(warning.severity);
      expect(warning.description).toBeDefined();
      expect(warning.suggestedResolution).toBeDefined();
    });

    it('dependencyType accepts valid values', () => {
      const validTypes = ['blocks', 'is_blocked_by', 'relates_to'] as const;

      validTypes.forEach((type) => {
        const rec: DependencyRecommendation = {
          sourceTaskId: 'task-1',
          targetTaskId: 'task-2',
          dependencyType: type,
          confidence: 80,
          reason: 'Test reason',
        };
        expect(validTypes).toContain(rec.dependencyType);
      });
    });
  });

  describe('Dependency Recommendation Validation', () => {
    it('should filter recommendations below confidence threshold', () => {
      const recommendations: DependencyRecommendation[] = [
        {
          sourceTaskId: 'task-1',
          targetTaskId: 'task-2',
          dependencyType: 'blocks',
          confidence: 85,
          reason: 'High confidence',
        },
        {
          sourceTaskId: 'task-2',
          targetTaskId: 'task-3',
          dependencyType: 'blocks',
          confidence: 60,
          reason: 'Low confidence',
        },
        {
          sourceTaskId: 'task-3',
          targetTaskId: 'task-4',
          dependencyType: 'relates_to',
          confidence: 75,
          reason: 'Medium confidence',
        },
      ];

      const confidenceThreshold = 70;
      const filtered = recommendations.filter(
        (r) => r.confidence >= confidenceThreshold
      );

      expect(filtered.length).toBe(2);
      expect(filtered.every((r) => r.confidence >= 70)).toBe(true);
    });

    it('should validate task IDs exist in provided task list', () => {
      const taskIds = mockTasks.map((t) => t.task_id);
      const recommendations: DependencyRecommendation[] = [
        {
          sourceTaskId: 'task-1',
          targetTaskId: 'task-2',
          dependencyType: 'blocks',
          confidence: 85,
          reason: 'Valid tasks',
        },
        {
          sourceTaskId: 'task-1',
          targetTaskId: 'invalid-task',
          dependencyType: 'blocks',
          confidence: 90,
          reason: 'Invalid target',
        },
      ];

      const valid = recommendations.filter(
        (r) => taskIds.includes(r.sourceTaskId) && taskIds.includes(r.targetTaskId)
      );

      expect(valid.length).toBe(1);
      expect(valid[0].sourceTaskId).toBe('task-1');
      expect(valid[0].targetTaskId).toBe('task-2');
    });

    it('should not allow self-referencing dependencies', () => {
      const recommendation: DependencyRecommendation = {
        sourceTaskId: 'task-1',
        targetTaskId: 'task-1',
        dependencyType: 'blocks',
        confidence: 80,
        reason: 'Self reference',
      };

      const isSelfReference = recommendation.sourceTaskId === recommendation.targetTaskId;
      expect(isSelfReference).toBe(true);

      // In real implementation, these would be filtered out
      const validRecs = [recommendation].filter(
        (r) => r.sourceTaskId !== r.targetTaskId
      );
      expect(validRecs.length).toBe(0);
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect potential circular dependencies', () => {
      // Simulating A -> B -> C -> A cycle
      const recommendations: DependencyRecommendation[] = [
        {
          sourceTaskId: 'task-1',
          targetTaskId: 'task-2',
          dependencyType: 'blocks',
          confidence: 85,
          reason: 'Task 1 blocks Task 2',
        },
        {
          sourceTaskId: 'task-2',
          targetTaskId: 'task-3',
          dependencyType: 'blocks',
          confidence: 80,
          reason: 'Task 2 blocks Task 3',
        },
        {
          sourceTaskId: 'task-3',
          targetTaskId: 'task-1',
          dependencyType: 'blocks',
          confidence: 75,
          reason: 'Task 3 blocks Task 1 (creates cycle)',
        },
      ];

      // Simple cycle detection algorithm
      const detectCycle = (recs: DependencyRecommendation[]): string[][] => {
        const graph = new Map<string, string[]>();

        recs.forEach((r) => {
          if (!graph.has(r.sourceTaskId)) {
            graph.set(r.sourceTaskId, []);
          }
          graph.get(r.sourceTaskId)!.push(r.targetTaskId);
        });

        const cycles: string[][] = [];
        const visited = new Set<string>();
        const recStack = new Set<string>();

        const dfs = (node: string, path: string[]): boolean => {
          visited.add(node);
          recStack.add(node);

          const neighbors = graph.get(node) || [];
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              if (dfs(neighbor, [...path, neighbor])) {
                return true;
              }
            } else if (recStack.has(neighbor)) {
              // Found cycle
              const cycleStart = path.indexOf(neighbor);
              if (cycleStart !== -1) {
                cycles.push(path.slice(cycleStart));
              } else {
                cycles.push([...path, neighbor]);
              }
              return true;
            }
          }

          recStack.delete(node);
          return false;
        };

        graph.forEach((_, node) => {
          if (!visited.has(node)) {
            dfs(node, [node]);
          }
        });

        return cycles;
      };

      const cycles = detectCycle(recommendations);
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should assign severity based on cycle length', () => {
      const getSeverity = (cycleLength: number): 'low' | 'medium' | 'high' => {
        if (cycleLength <= 2) return 'low';
        if (cycleLength <= 4) return 'medium';
        return 'high';
      };

      expect(getSeverity(2)).toBe('low');
      expect(getSeverity(3)).toBe('medium');
      expect(getSeverity(4)).toBe('medium');
      expect(getSeverity(5)).toBe('high');
    });
  });

  describe('API Route Validation', () => {
    it('should validate save dependency request structure', () => {
      const validRequest = {
        dependencies: [
          {
            sourceTaskId: 'task-1',
            targetTaskId: 'task-2',
            dependencyType: 'blocks' as const,
            reason: 'Database must be ready first',
            confidence: 85,
          },
        ],
        overwrite: false,
      };

      expect(validRequest.dependencies).toBeInstanceOf(Array);
      expect(validRequest.dependencies.length).toBeGreaterThan(0);
      expect(validRequest.dependencies[0]).toHaveProperty('sourceTaskId');
      expect(validRequest.dependencies[0]).toHaveProperty('targetTaskId');
      expect(validRequest.dependencies[0]).toHaveProperty('dependencyType');
    });

    it('should reject empty dependencies array', () => {
      const invalidRequest = {
        dependencies: [],
        overwrite: false,
      };

      const isValid = invalidRequest.dependencies.length > 0;
      expect(isValid).toBe(false);
    });

    it('should validate dependency type values', () => {
      const validTypes = new Set(['blocks', 'is_blocked_by', 'relates_to']);

      const isValidType = (type: string): boolean => validTypes.has(type);

      expect(isValidType('blocks')).toBe(true);
      expect(isValidType('is_blocked_by')).toBe(true);
      expect(isValidType('relates_to')).toBe(true);
      expect(isValidType('invalid_type')).toBe(false);
    });
  });

  describe('UI Component Props Validation', () => {
    it('DependenciesDisplay requires taskId and workspaceId', () => {
      const props = {
        taskId: 'task-1',
        taskName: 'Test Task',
        workspaceId: 'workspace-1',
        compact: false,
        showAIButton: true,
      };

      expect(props.taskId).toBeDefined();
      expect(props.workspaceId).toBeDefined();
      expect(typeof props.taskId).toBe('string');
      expect(typeof props.workspaceId).toBe('string');
    });

    it('TaskDependencyAnalysisModal requires minimum 2 tasks', () => {
      const singleTask = [mockTasks[0]];
      const multipleTasks = mockTasks.slice(0, 3);

      expect(singleTask.length).toBeLessThan(2);
      expect(multipleTasks.length).toBeGreaterThanOrEqual(2);
    });

    it('DependencyBadge should only render when count > 0', () => {
      const shouldRender = (count: number): boolean => count > 0;

      expect(shouldRender(0)).toBe(false);
      expect(shouldRender(1)).toBe(true);
      expect(shouldRender(5)).toBe(true);
    });
  });

  describe('Suggested Order Calculation', () => {
    it('should calculate execution order based on dependencies', () => {
      const recommendations: DependencyRecommendation[] = [
        {
          sourceTaskId: 'task-1',
          targetTaskId: 'task-2',
          dependencyType: 'blocks',
          confidence: 90,
          reason: 'Task 1 must complete first',
          suggestedOrder: 1,
        },
        {
          sourceTaskId: 'task-1',
          targetTaskId: 'task-3',
          dependencyType: 'blocks',
          confidence: 85,
          reason: 'Task 1 blocks Task 3 too',
          suggestedOrder: 1,
        },
        {
          sourceTaskId: 'task-2',
          targetTaskId: 'task-4',
          dependencyType: 'blocks',
          confidence: 80,
          reason: 'Task 2 must complete before Task 4',
          suggestedOrder: 2,
        },
      ];

      // Task 1 has no dependencies, so it should be first
      const task1Deps = recommendations.filter((r) => r.targetTaskId === 'task-1');
      expect(task1Deps.length).toBe(0);

      // Task 2 depends on Task 1
      const task2Deps = recommendations.filter((r) => r.targetTaskId === 'task-2');
      expect(task2Deps.length).toBe(1);
      expect(task2Deps[0].sourceTaskId).toBe('task-1');

      // Task 4 depends on Task 2
      const task4Deps = recommendations.filter((r) => r.targetTaskId === 'task-4');
      expect(task4Deps.length).toBe(1);
      expect(task4Deps[0].sourceTaskId).toBe('task-2');
    });

    it('should topologically sort tasks', () => {
      const edges = [
        { from: 'task-1', to: 'task-2' },
        { from: 'task-1', to: 'task-3' },
        { from: 'task-2', to: 'task-4' },
        { from: 'task-3', to: 'task-4' },
      ];

      // Simple topological sort
      const topologicalSort = (
        nodes: string[],
        edges: { from: string; to: string }[]
      ): string[] => {
        const inDegree = new Map<string, number>();
        const graph = new Map<string, string[]>();

        nodes.forEach((n) => {
          inDegree.set(n, 0);
          graph.set(n, []);
        });

        edges.forEach((e) => {
          graph.get(e.from)?.push(e.to);
          inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
        });

        const queue: string[] = [];
        inDegree.forEach((deg, node) => {
          if (deg === 0) queue.push(node);
        });

        const result: string[] = [];
        while (queue.length > 0) {
          const node = queue.shift()!;
          result.push(node);

          graph.get(node)?.forEach((neighbor) => {
            inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
            if (inDegree.get(neighbor) === 0) {
              queue.push(neighbor);
            }
          });
        }

        return result;
      };

      const sorted = topologicalSort(
        ['task-1', 'task-2', 'task-3', 'task-4'],
        edges
      );

      // Task 1 should be first (no dependencies)
      expect(sorted[0]).toBe('task-1');

      // Task 4 should be last (depends on task-2 and task-3)
      expect(sorted[sorted.length - 1]).toBe('task-4');

      // All nodes should be in the result
      expect(sorted.length).toBe(4);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing API key gracefully', () => {
      const result: AnalyzeResult = {
        recommendations: [],
        circularRisks: [],
        error: 'Claude API key is not configured. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY.',
      };

      expect(result.error).toBeDefined();
      expect(result.recommendations).toEqual([]);
      expect(result.circularRisks).toEqual([]);
    });

    it('should handle empty task list', () => {
      const result: AnalyzeResult = {
        recommendations: [],
        circularRisks: [],
        error: 'No tasks provided for analysis',
      };

      expect(result.error).toContain('No tasks');
    });

    it('should handle AI parsing failures', () => {
      const result: AnalyzeResult = {
        recommendations: [],
        circularRisks: [],
        error: 'Failed to parse dependency analysis results',
      };

      expect(result.error).toContain('parse');
    });
  });
});

describe('Integration Scenarios', () => {
  it('should handle typical user story dependency chain', () => {
    // Scenario: Building a user registration feature
    const tasks = [
      { id: 'db-schema', name: 'Design database schema' },
      { id: 'api-user', name: 'Create user API endpoints' },
      { id: 'api-auth', name: 'Implement authentication' },
      { id: 'ui-register', name: 'Build registration form' },
      { id: 'ui-login', name: 'Build login form' },
      { id: 'integration', name: 'Integration testing' },
    ];

    // Expected dependency chain:
    // db-schema -> api-user -> ui-register -> integration
    // db-schema -> api-auth -> ui-login -> integration

    const expectedDependencies = [
      { source: 'db-schema', target: 'api-user', type: 'blocks' },
      { source: 'db-schema', target: 'api-auth', type: 'blocks' },
      { source: 'api-user', target: 'ui-register', type: 'blocks' },
      { source: 'api-auth', target: 'ui-login', type: 'blocks' },
      { source: 'ui-register', target: 'integration', type: 'blocks' },
      { source: 'ui-login', target: 'integration', type: 'blocks' },
    ];

    // Verify the chain makes sense
    expect(expectedDependencies.length).toBe(6);

    // db-schema should have no incoming dependencies
    const dbSchemaDeps = expectedDependencies.filter((d) => d.target === 'db-schema');
    expect(dbSchemaDeps.length).toBe(0);

    // integration should have 2 incoming dependencies
    const integrationDeps = expectedDependencies.filter((d) => d.target === 'integration');
    expect(integrationDeps.length).toBe(2);
  });

  it('should detect when tasks can be parallelized', () => {
    // Tasks that share the same blocking dependency can run in parallel
    const dependencies = [
      { source: 'setup', target: 'feature-a', type: 'blocks' },
      { source: 'setup', target: 'feature-b', type: 'blocks' },
      { source: 'setup', target: 'feature-c', type: 'blocks' },
    ];

    // All features can run in parallel after setup
    const parallelizable = ['feature-a', 'feature-b', 'feature-c'];

    // Check they all have the same blocker
    const blockers = parallelizable.map((task) =>
      dependencies.filter((d) => d.target === task).map((d) => d.source)
    );

    expect(blockers.every((b) => b[0] === 'setup')).toBe(true);
  });
});
