-- Verification script for canonical tags migration (20260309)
-- Run this in Supabase SQL Editor to confirm everything landed correctly.

-- 1. Verify columns exist
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tags'
  AND column_name IN ('canonical_tag_id', 'aliases', 'deleted_at')
ORDER BY column_name;
-- Expected: 3 rows
--   aliases        | ARRAY    | NO  | '{}'::text[]
--   canonical_tag_id | uuid   | YES | NULL
--   deleted_at     | timestamp with time zone | YES | NULL

-- 2. Verify self-referential FK on canonical_tag_id
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'tags'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'canonical_tag_id';
-- Expected: 1 row pointing tags.canonical_tag_id → tags.id

-- 3. Verify CHECK constraint (no self-referencing canonical)
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'tags_canonical_not_self';
-- Expected: 1 row with check_clause containing canonical_tag_id != id

-- 4. Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'tags'
  AND indexname IN (
    'idx_tags_canonical_tag_id',
    'idx_tags_aliases',
    'idx_tags_deleted_at'
  )
ORDER BY indexname;
-- Expected: 3 rows
--   idx_tags_aliases          — GIN index on aliases
--   idx_tags_canonical_tag_id — btree WHERE canonical_tag_id IS NOT NULL
--   idx_tags_deleted_at       — btree WHERE deleted_at IS NULL

-- 5. Sanity: no tags have been soft-deleted yet
SELECT count(*) AS soft_deleted_count
FROM public.tags
WHERE deleted_at IS NOT NULL;
-- Expected: 0

-- 6. Sanity: no canonical mappings exist yet
SELECT count(*) AS canonical_mapped_count
FROM public.tags
WHERE canonical_tag_id IS NOT NULL;
-- Expected: 0
