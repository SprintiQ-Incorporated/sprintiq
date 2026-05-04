-- ============================================================================
-- VERIFICATION: Sprint Archiving Migration
-- Run this after applying 20260215_sprint_archiving.sql
-- Each query should return results. If any returns empty, that piece failed.
-- ============================================================================

-- 1. Tables exist
-- Expected: 2 rows (archived_sprints, archived_tasks)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('archived_sprints', 'archived_tasks')
ORDER BY table_name;

-- 2. archived_sprints columns
-- Expected: 28 rows
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'archived_sprints'
ORDER BY ordinal_position;

-- 3. archived_tasks columns
-- Expected: 28 rows
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'archived_tasks'
ORDER BY ordinal_position;

-- 4. Foreign keys on archived_sprints
-- Expected: 4 (workspace_id, space_id, project_id, archived_by)
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'archived_sprints'
  AND tc.constraint_type = 'FOREIGN KEY';

-- 5. Foreign key on archived_tasks (cascade delete)
-- Expected: 1 (archived_sprint_id -> archived_sprints.id)
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS referenced_table,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'archived_tasks'
  AND tc.constraint_type = 'FOREIGN KEY';

-- 6. Indexes
-- Expected: 13 total (6 on archived_sprints + 7 on archived_tasks)
SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('archived_sprints', 'archived_tasks')
ORDER BY tablename, indexname;

-- 7. Unique indexes (prevent double-archive)
-- Expected: 2 (idx_archived_sprints_original, idx_archived_tasks_original)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_archived_sprints_original', 'idx_archived_tasks_original');

-- 8. RLS enabled on both tables
-- Expected: 2 rows, both with rowsecurity = true
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('archived_sprints', 'archived_tasks');

-- 9. RLS policies
-- Expected: 4 policies (2 per table: SELECT + INSERT)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('archived_sprints', 'archived_tasks')
ORDER BY tablename, cmd;

-- 10. archive_sprint function exists with correct signature
-- Expected: 1 row
SELECT
  routine_name,
  data_type AS return_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'archive_sprint';

-- 11. archive_sprint function parameters
-- Expected: 3 rows (p_sprint_id, p_archived_by, p_archive_notes)
SELECT
  parameter_name,
  data_type,
  parameter_default
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND specific_name LIKE 'archive_sprint%'
  AND parameter_mode = 'IN'
ORDER BY ordinal_position;

-- 12. Grants (authenticated role can SELECT and INSERT)
-- Expected: rows showing SELECT, INSERT for authenticated
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('archived_sprints', 'archived_tasks')
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;

-- 13. Table comments exist
-- Expected: 2 rows with non-null descriptions
SELECT
  c.relname AS table_name,
  d.description
FROM pg_catalog.pg_description d
JOIN pg_catalog.pg_class c ON d.objoid = c.oid
JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname IN ('archived_sprints', 'archived_tasks')
  AND d.objsubid = 0;

-- ============================================================================
-- FUNCTIONAL TEST: Dry-run validation (no data modified)
-- ============================================================================

-- 14. Verify archive_sprint rejects non-existent sprint
-- Expected: ERROR with 'Sprint not found'
DO $$
BEGIN
  PERFORM archive_sprint(
    '00000000-0000-0000-0000-000000000000'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
  RAISE EXCEPTION 'Should have raised an error for non-existent sprint';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%Sprint not found%' THEN
      RAISE NOTICE 'PASS: archive_sprint correctly rejects non-existent sprint';
    ELSE
      RAISE EXCEPTION 'FAIL: Unexpected error: %', SQLERRM;
    END IF;
END;
$$;

-- 15. Count check: tables start empty
-- Expected: both 0
SELECT 'archived_sprints' AS table_name, COUNT(*) AS row_count FROM archived_sprints
UNION ALL
SELECT 'archived_tasks', COUNT(*) FROM archived_tasks;
