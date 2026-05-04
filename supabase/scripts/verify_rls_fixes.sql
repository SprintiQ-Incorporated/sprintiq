-- ============================================================================
-- RLS Policy Verification Script
-- Created: 2025-12-18
-- Updated: 2025-12-30 (Added duplicate policy detection and auth pattern checks)
-- Description: Verify RLS fixes have been applied correctly
-- ============================================================================
--
-- HOW TO RUN:
-- 1. Connect to your Supabase database via psql or the SQL Editor
-- 2. Run this entire script
-- 3. Review the output for any issues
--
-- AFTER RUNNING ALL MIGRATIONS:
-- Run the Supabase linter to verify all issues are resolved:
--   npx supabase db lint
--
-- Or via the Supabase CLI:
--   supabase db lint --linked
--
-- CHECKS PERFORMED:
-- 1. List all current RLS policies
-- 2. Detect policies using direct auth.uid() (performance issue)
-- 3. Detect policies using direct auth.is_authenticated() (performance issue)
-- 4. Detect duplicate permissive policies per table/role/action
-- 5. Check helper function exists
-- 6. Verify RLS is enabled on all tables
-- 7. Summary statistics
--
-- MIGRATION HISTORY:
-- - 20251218_fix_rls_performance_helper.sql: Created is_workspace_member()
-- - 20251230_fix_rls_policy_performance_and_duplicates.sql: Fixed auth patterns + merged duplicates
--
-- ============================================================================

-- ============================================================================
-- 1. LIST ALL CURRENT RLS POLICIES (ordered by table and command)
-- ============================================================================
SELECT '=== CURRENT RLS POLICIES ===' AS section;

SELECT
  tablename AS table_name,
  policyname AS policy_name,
  cmd AS operation,
  permissive,
  roles::text,
  CASE
    WHEN qual IS NOT NULL THEN LEFT(qual, 80) || CASE WHEN LENGTH(qual) > 80 THEN '...' ELSE '' END
    ELSE NULL
  END AS using_clause_preview
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- ============================================================================
-- 2. CHECK FOR POLICIES NOT USING (SELECT auth.uid()) PATTERN
-- Performance Issue: Direct auth.uid() calls are re-evaluated per row
-- ============================================================================
SELECT '=== POLICIES POTENTIALLY MISSING (SELECT auth.uid()) PATTERN ===' AS section;

SELECT
  tablename AS table_name,
  policyname AS policy_name,
  cmd AS operation,
  'USING clause' AS location
FROM pg_policies
WHERE schemaname = 'public'
  AND qual LIKE '%auth.uid()%'
  AND qual NOT LIKE '%(SELECT auth.uid())%'
  AND qual NOT LIKE '%( SELECT auth.uid())%'
UNION ALL
SELECT
  tablename AS table_name,
  policyname AS policy_name,
  cmd AS operation,
  'WITH CHECK clause' AS location
FROM pg_policies
WHERE schemaname = 'public'
  AND with_check LIKE '%auth.uid()%'
  AND with_check NOT LIKE '%(SELECT auth.uid())%'
  AND with_check NOT LIKE '%( SELECT auth.uid())%'
ORDER BY table_name, policy_name;

-- ============================================================================
-- 3. CHECK FOR POLICIES USING DIRECT auth.is_authenticated()
-- Performance Issue: Should be wrapped in (SELECT auth.is_authenticated())
-- ============================================================================
SELECT '=== POLICIES USING DIRECT auth.is_authenticated() ===' AS section;

SELECT
  tablename AS table_name,
  policyname AS policy_name,
  cmd AS operation
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    (qual LIKE '%auth.is_authenticated()%' AND qual NOT LIKE '%(SELECT auth.is_authenticated())%')
    OR
    (with_check LIKE '%auth.is_authenticated()%' AND with_check NOT LIKE '%(SELECT auth.is_authenticated())%')
  )
ORDER BY tablename, policyname;

-- ============================================================================
-- 4. DUPLICATE PERMISSIVE POLICIES (same table, role, action)
-- Efficiency Issue: Multiple permissive policies for same role/action add overhead
-- ============================================================================
SELECT '=== DUPLICATE PERMISSIVE POLICIES PER TABLE/ROLE/ACTION ===' AS section;

SELECT
  tablename AS table_name,
  cmd AS operation,
  roles::text AS role,
  COUNT(*) AS policy_count,
  STRING_AGG(policyname, ', ' ORDER BY policyname) AS policy_names
FROM pg_policies
WHERE schemaname = 'public'
  AND permissive = 'PERMISSIVE'
GROUP BY tablename, cmd, roles
HAVING COUNT(*) > 1
ORDER BY policy_count DESC, tablename, cmd;

-- ============================================================================
-- 5. VERIFY HELPER FUNCTIONS EXIST
-- ============================================================================
SELECT '=== HELPER FUNCTION VERIFICATION ===' AS section;

SELECT
  routine_name AS function_name,
  routine_type,
  data_type AS return_type,
  security_type,
  CASE WHEN routine_definition IS NOT NULL THEN 'YES' ELSE 'NO' END AS has_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_workspace_member', 'is_project_member')
ORDER BY routine_name;

-- ============================================================================
-- 6. TEST is_workspace_member FUNCTION
-- ============================================================================
SELECT '=== HELPER FUNCTION TEST ===' AS section;

SELECT
  CASE
    WHEN public.is_workspace_member(NULL) = false THEN 'PASS: is_workspace_member returns false for NULL'
    ELSE 'FAIL: is_workspace_member should return false for NULL'
  END AS test_result;

-- ============================================================================
-- 7. SUMMARY STATISTICS
-- ============================================================================
SELECT '=== SUMMARY STATISTICS ===' AS section;

SELECT
  COUNT(DISTINCT tablename) AS tables_with_policies,
  COUNT(*) AS total_policies,
  COUNT(*) FILTER (WHERE cmd = 'SELECT') AS select_policies,
  COUNT(*) FILTER (WHERE cmd = 'INSERT') AS insert_policies,
  COUNT(*) FILTER (WHERE cmd = 'UPDATE') AS update_policies,
  COUNT(*) FILTER (WHERE cmd = 'DELETE') AS delete_policies,
  COUNT(*) FILTER (WHERE cmd = 'ALL') AS all_policies
FROM pg_policies
WHERE schemaname = 'public';

-- ============================================================================
-- 8. TABLES WITHOUT RLS ENABLED (potential security issue)
-- ============================================================================
SELECT '=== TABLES WITHOUT RLS ENABLED ===' AS section;

SELECT
  c.relname AS table_name,
  'DISABLED' AS rls_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
  AND c.relname NOT LIKE 'pg_%'
  AND c.relname NOT LIKE 'sql_%'
  AND c.relname NOT LIKE 'spatial_%'
ORDER BY c.relname;

-- ============================================================================
-- 9. POLICIES ON FIXED TABLES (verify 2025-12-30 migration worked)
-- ============================================================================
SELECT '=== POLICIES ON FIXED TABLES (verify migration) ===' AS section;

SELECT
  tablename,
  policyname,
  cmd,
  permissive,
  roles::text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'story_generator_usage',
    'project_personas',
    'statuses',
    'priority_weight_configs',
    'projects',
    'spaces',
    'space_members',
    'analytics_events',
    'waitlist'
  )
ORDER BY tablename, cmd;

-- ============================================================================
-- 10. EXPECTED POLICY COUNTS (after 2025-12-30 migration)
-- Each table should have exactly 1 policy per action per role
-- ============================================================================
SELECT '=== EXPECTED vs ACTUAL POLICY COUNTS ===' AS section;

WITH expected AS (
  SELECT 'story_generator_usage' AS table_name, 2 AS expected_policies UNION ALL
  SELECT 'project_personas', 4 UNION ALL
  SELECT 'statuses', 4 UNION ALL
  SELECT 'priority_weight_configs', 4 UNION ALL
  SELECT 'projects', 4 UNION ALL
  SELECT 'spaces', 4 UNION ALL
  SELECT 'space_members', 4 UNION ALL
  SELECT 'analytics_events', 2 UNION ALL
  SELECT 'waitlist', 3
),
actual AS (
  SELECT
    tablename AS table_name,
    COUNT(*) AS actual_policies
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
)
SELECT
  e.table_name,
  e.expected_policies,
  COALESCE(a.actual_policies, 0) AS actual_policies,
  CASE
    WHEN e.expected_policies = COALESCE(a.actual_policies, 0) THEN 'OK'
    ELSE 'MISMATCH'
  END AS status
FROM expected e
LEFT JOIN actual a ON e.table_name = a.table_name
ORDER BY e.table_name;

-- ============================================================================
-- NEXT STEPS
-- ============================================================================
-- If issues are found:
-- 1. Review policies in section 2-3 and update to use (SELECT auth.xxx()) pattern
-- 2. Review duplicate policies in section 4 and consolidate with OR logic
-- 3. Enable RLS on tables in section 8
-- 4. Run: npx supabase db lint
-- 5. Re-run this script to verify fixes
--
-- The is_workspace_member() helper function centralizes workspace access checks
-- and already uses the (SELECT auth.uid()) pattern internally for performance.
-- ============================================================================
