/**
 * Database Query Optimization Utilities
 *
 * Provides utilities for optimizing database queries to avoid common
 * performance issues like N+1 queries, missing pagination, and inefficient joins.
 *
 * Features:
 * - Batch loading utilities for N+1 prevention
 * - Efficient pagination with cursor-based support
 * - Query result grouping helpers
 * - DataLoader pattern implementation
 */

import { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Types
// ============================================================================

export interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
  cursorColumn?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor?: string;
  };
}

export interface BatchLoadOptions<K, V> {
  batchSize?: number;
  cacheResults?: boolean;
}

type LoaderFn<K, V> = (keys: K[]) => Promise<Map<K, V>>;

// ============================================================================
// DataLoader Implementation
// ============================================================================

/**
 * Simple DataLoader for batching and caching database queries
 * Prevents N+1 queries by batching multiple requests into a single query
 */
export class DataLoader<K, V> {
  private cache = new Map<K, V>();
  private batch: Set<K> = new Set();
  private batchPromise: Promise<void> | null = null;
  private resolvers: Map<K, { resolve: (value: V | undefined) => void; reject: (error: Error) => void }[]> = new Map();
  private loader: LoaderFn<K, V>;
  private options: BatchLoadOptions<K, V>;

  constructor(loader: LoaderFn<K, V>, options: BatchLoadOptions<K, V> = {}) {
    this.loader = loader;
    this.options = {
      batchSize: options.batchSize || 100,
      cacheResults: options.cacheResults !== false,
    };
  }

  async load(key: K): Promise<V | undefined> {
    // Check cache first
    if (this.options.cacheResults && this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Add to batch
    this.batch.add(key);

    // Create promise for this key
    return new Promise<V | undefined>((resolve, reject) => {
      const existing = this.resolvers.get(key) || [];
      existing.push({ resolve, reject });
      this.resolvers.set(key, existing);

      // Schedule batch execution
      this.scheduleBatch();
    });
  }

  async loadMany(keys: K[]): Promise<(V | undefined)[]> {
    return Promise.all(keys.map((key) => this.load(key)));
  }

  private scheduleBatch(): void {
    if (this.batchPromise) return;

    this.batchPromise = Promise.resolve().then(async () => {
      const keys = Array.from(this.batch);
      this.batch.clear();
      this.batchPromise = null;

      if (keys.length === 0) return;

      try {
        // Execute batch in chunks if needed
        const results = new Map<K, V>();
        const batchSize = this.options.batchSize!;

        for (let i = 0; i < keys.length; i += batchSize) {
          const chunk = keys.slice(i, i + batchSize);
          const chunkResults = await this.loader(chunk);
          for (const [k, v] of chunkResults) {
            results.set(k, v);
          }
        }

        // Resolve all promises
        for (const key of keys) {
          const value = results.get(key);
          if (this.options.cacheResults && value !== undefined) {
            this.cache.set(key, value);
          }

          const resolvers = this.resolvers.get(key) || [];
          for (const { resolve } of resolvers) {
            resolve(value);
          }
          this.resolvers.delete(key);
        }
      } catch (error) {
        // Reject all promises on error
        for (const key of keys) {
          const resolvers = this.resolvers.get(key) || [];
          for (const { reject } of resolvers) {
            reject(error as Error);
          }
          this.resolvers.delete(key);
        }
      }
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  prime(key: K, value: V): void {
    this.cache.set(key, value);
  }
}

// ============================================================================
// Batch Loading Utilities
// ============================================================================

/**
 * Create a loader for fetching profiles by user IDs
 */
export function createProfileLoader(supabase: SupabaseClient) {
  return new DataLoader<string, { id: string; full_name: string | null; avatar_url: string | null; email: string | null }>(
    async (userIds) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email")
        .in("id", userIds);

      if (error) throw error;

      const map = new Map();
      for (const profile of data || []) {
        map.set(profile.id, profile);
      }
      return map;
    }
  );
}

/**
 * Create a loader for fetching statuses by workspace ID
 * Returns all statuses for the workspace (cached per request)
 */
export function createStatusLoader(supabase: SupabaseClient) {
  return new DataLoader<string, { id: string; name: string; color: string; type: string; status_type_id: string | null }[]>(
    async (workspaceIds) => {
      const { data, error } = await supabase
        .from("statuses")
        .select("id, name, color, type, status_type_id, workspace_id")
        .in("workspace_id", workspaceIds)
        .is("deleted_at", null);

      if (error) throw error;

      // Group by workspace_id
      const map = new Map<string, any[]>();
      for (const status of data || []) {
        const existing = map.get(status.workspace_id) || [];
        existing.push(status);
        map.set(status.workspace_id, existing);
      }
      return map;
    }
  );
}

// ============================================================================
// Batch Query Helpers
// ============================================================================

/**
 * Fetch all tasks for multiple sprints in a single query
 * Avoids N+1 by fetching all at once and grouping in memory
 */
export async function fetchTasksBySprints(
  supabase: SupabaseClient,
  sprintIds: string[],
  options?: { includeDeleted?: boolean }
): Promise<Map<string, any[]>> {
  if (sprintIds.length === 0) return new Map();

  let query = supabase
    .from("tasks")
    .select("id, name, story_points, status_id, sprint_id, priority, assignee_id")
    .in("sprint_id", sprintIds);

  if (!options?.includeDeleted) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Group by sprint_id
  const tasksBySprint = new Map<string, any[]>();
  for (const task of data || []) {
    if (task.sprint_id) {
      const existing = tasksBySprint.get(task.sprint_id) || [];
      existing.push(task);
      tasksBySprint.set(task.sprint_id, existing);
    }
  }

  return tasksBySprint;
}

/**
 * Fetch all tasks for multiple projects in a single query
 */
export async function fetchTasksByProjects(
  supabase: SupabaseClient,
  projectIds: string[],
  options?: { includeDeleted?: boolean; includeSubtasks?: boolean }
): Promise<Map<string, any[]>> {
  if (projectIds.length === 0) return new Map();

  let query = supabase
    .from("tasks")
    .select("id, name, story_points, status_id, project_id, sprint_id, priority, parent_task_id, assignee_id")
    .in("project_id", projectIds);

  if (!options?.includeDeleted) {
    query = query.is("deleted_at", null);
  }

  if (!options?.includeSubtasks) {
    query = query.is("parent_task_id", null);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Group by project_id
  const tasksByProject = new Map<string, any[]>();
  for (const task of data || []) {
    if (task.project_id) {
      const existing = tasksByProject.get(task.project_id) || [];
      existing.push(task);
      tasksByProject.set(task.project_id, existing);
    }
  }

  return tasksByProject;
}

/**
 * Get completed status IDs for a workspace (cached)
 */
const completedStatusCache = new Map<string, { ids: string[]; timestamp: number }>();
const COMPLETED_STATUS_CACHE_TTL = 60 * 1000; // 1 minute

export async function getCompletedStatusIds(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string[]> {
  // Check cache
  const cached = completedStatusCache.get(workspaceId);
  if (cached && Date.now() - cached.timestamp < COMPLETED_STATUS_CACHE_TTL) {
    return cached.ids;
  }

  const { data: statusTypes } = await supabase
    .from("status_types")
    .select("id")
    .eq("name", "Done")
    .single();

  if (!statusTypes) return [];

  const { data: statuses } = await supabase
    .from("statuses")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("status_type_id", statusTypes.id);

  const ids = (statuses || []).map((s) => s.id);

  // Cache result
  completedStatusCache.set(workspaceId, { ids, timestamp: Date.now() });

  return ids;
}

// ============================================================================
// Pagination Utilities
// ============================================================================

/**
 * Apply pagination to a Supabase query
 */
export function applyPagination<T>(
  query: any,
  options: PaginationOptions
): any {
  const { page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;

  return query.range(offset, offset + limit - 1);
}

/**
 * Create a paginated response from query results
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  options: PaginationOptions
): PaginatedResult<T> {
  const { page = 1, limit = 50 } = options;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

/**
 * Cursor-based pagination helper
 * More efficient for large datasets
 */
export async function fetchWithCursor<T>(
  supabase: SupabaseClient,
  table: string,
  options: {
    select: string;
    limit: number;
    cursor?: string;
    cursorColumn?: string;
    orderDirection?: "asc" | "desc";
    filters?: Record<string, any>;
  }
): Promise<{ data: T[]; nextCursor: string | null }> {
  const {
    select,
    limit,
    cursor,
    cursorColumn = "id",
    orderDirection = "desc",
    filters = {},
  } = options;

  let query = supabase.from(table).select(select);

  // Apply filters
  for (const [key, value] of Object.entries(filters)) {
    if (value === null) {
      query = query.is(key, null);
    } else {
      query = query.eq(key, value);
    }
  }

  // Apply cursor
  if (cursor) {
    query = orderDirection === "desc"
      ? query.lt(cursorColumn, cursor)
      : query.gt(cursorColumn, cursor);
  }

  // Order and limit
  query = query.order(cursorColumn, { ascending: orderDirection === "asc" });
  query = query.limit(limit + 1); // Fetch one extra to check for next page

  const { data, error } = await query;

  if (error) throw error;

  const hasMore = (data?.length || 0) > limit;
  const results = hasMore ? data!.slice(0, limit) : data || [];
  const lastItem = results[results.length - 1] as unknown as Record<string, unknown> | undefined;
  const nextCursor = hasMore && lastItem ? (lastItem[cursorColumn] as string | null) : null;

  return {
    data: results as T[],
    nextCursor,
  };
}

// ============================================================================
// Query Result Grouping Utilities
// ============================================================================

/**
 * Group array items by a key
 */
export function groupBy<T, K extends keyof T>(
  items: T[],
  key: K
): Map<T[K], T[]> {
  const map = new Map<T[K], T[]>();

  for (const item of items) {
    const keyValue = item[key];
    const existing = map.get(keyValue) || [];
    existing.push(item);
    map.set(keyValue, existing);
  }

  return map;
}

/**
 * Create a lookup map from array by key
 */
export function keyBy<T, K extends keyof T>(
  items: T[],
  key: K
): Map<T[K], T> {
  const map = new Map<T[K], T>();

  for (const item of items) {
    map.set(item[key], item);
  }

  return map;
}

/**
 * Efficiently enrich items with related data using batch loading
 */
export async function enrichWithLoader<T, K, V>(
  items: T[],
  getKey: (item: T) => K | undefined,
  loader: DataLoader<K, V>,
  setRelated: (item: T, related: V | undefined) => void
): Promise<T[]> {
  // Collect all keys
  const keys = items
    .map(getKey)
    .filter((k): k is K => k !== undefined);

  // Batch load all related data
  if (keys.length > 0) {
    await loader.loadMany(keys);
  }

  // Enrich items
  for (const item of items) {
    const key = getKey(item);
    if (key !== undefined) {
      const related = await loader.load(key);
      setRelated(item, related);
    }
  }

  return items;
}

// ============================================================================
// Optimized Query Patterns
// ============================================================================

/**
 * Fetch velocity data for multiple sprints efficiently
 * Replaces N+1 pattern in velocity analytics
 */
export async function fetchSprintVelocityData(
  supabase: SupabaseClient,
  workspaceId: string,
  sprintIds: string[]
): Promise<Map<string, { planned: number; completed: number; total: number }>> {
  if (sprintIds.length === 0) return new Map();

  // Batch fetch all tasks
  const tasksBySprint = await fetchTasksBySprints(supabase, sprintIds);

  // Batch fetch completed status IDs
  const completedStatusIds = await getCompletedStatusIds(supabase, workspaceId);
  const completedSet = new Set(completedStatusIds);

  // Calculate velocity per sprint
  const velocityData = new Map<string, { planned: number; completed: number; total: number }>();

  for (const sprintId of sprintIds) {
    const tasks = tasksBySprint.get(sprintId) || [];
    let planned = 0;
    let completed = 0;

    for (const task of tasks) {
      const points = task.story_points || 0;
      planned += points;
      if (completedSet.has(task.status_id)) {
        completed += points;
      }
    }

    velocityData.set(sprintId, {
      planned,
      completed,
      total: tasks.length,
    });
  }

  return velocityData;
}

// ============================================================================
// Exports
// ============================================================================

const queryOptimization = {
  DataLoader,
  createProfileLoader,
  createStatusLoader,
  fetchTasksBySprints,
  fetchTasksByProjects,
  getCompletedStatusIds,
  applyPagination,
  createPaginatedResponse,
  fetchWithCursor,
  groupBy,
  keyBy,
  enrichWithLoader,
  fetchSprintVelocityData,
};

export default queryOptimization;
