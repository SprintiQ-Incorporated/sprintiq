/**
 * Batch database utilities to prevent N+1 queries
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database-aliases';

type TableName = keyof Database['public']['Tables'];

/**
 * Batch fetch records by IDs
 */
export async function batchFetchByIds<T>(
  supabase: SupabaseClient<Database>,
  table: TableName,
  ids: string[],
  idColumn: string = 'id'
): Promise<Map<string, T>> {
  if (ids.length === 0) return new Map();

  const uniqueIds = [...new Set(ids)];
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .in(idColumn, uniqueIds);

  if (error) throw error;

  const map = new Map<string, T>();
  for (const record of (data || [])) {
    map.set((record as any)[idColumn], record as unknown as T);
  }
  return map;
}

/**
 * Batch fetch records by foreign key
 */
export async function batchFetchByForeignKey<T>(
  supabase: SupabaseClient<Database>,
  table: TableName,
  foreignKey: string,
  foreignIds: string[]
): Promise<Map<string, T[]>> {
  if (foreignIds.length === 0) return new Map();

  const uniqueIds = [...new Set(foreignIds)];
  const { data, error } = await (supabase
    .from(table) as any)
    .select('*')
    .in(foreignKey, uniqueIds);

  if (error) throw error;

  const map = new Map<string, T[]>();
  for (const id of uniqueIds) {
    map.set(id, []);
  }
  for (const record of (data || [])) {
    const key = (record as any)[foreignKey];
    const arr = map.get(key) || [];
    arr.push(record as unknown as T);
    map.set(key, arr);
  }
  return map;
}

/**
 * Batch update records by IDs
 */
export async function batchUpdateByIds(
  supabase: SupabaseClient<Database>,
  table: TableName,
  ids: string[],
  updates: Record<string, any>
): Promise<number> {
  if (ids.length === 0) return 0;

  const uniqueIds = [...new Set(ids)];
  const { error, count } = await supabase
    .from(table)
    .update(updates)
    .in('id', uniqueIds);

  if (error) throw error;
  return count || uniqueIds.length;
}

/**
 * Chunk array for batch processing
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
