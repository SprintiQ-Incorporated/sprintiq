-- ============================================================================
-- Schema Alignment Verification Script
-- ============================================================================
-- Run this script to verify your database schema matches the codebase requirements
-- Usage: psql $DATABASE_URL -f scripts/verify-schema-alignment.sql
-- ============================================================================

\echo '============================================================================'
\echo 'Schema Alignment Verification Report'
\echo '============================================================================'
\echo ''

-- ============================================================================
-- 1. CHECK STRIPE INTEGRATION COLUMNS
-- ============================================================================

\echo '1. STRIPE INTEGRATION COLUMNS'
\echo '------------------------------'

SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id'
    ) THEN '✅ stripe_customer_id exists'
    ELSE '❌ stripe_customer_id MISSING - Run migration'
  END AS stripe_customer_id,

  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'stripe_subscription_id'
    ) THEN '✅ stripe_subscription_id exists'
    ELSE '❌ stripe_subscription_id MISSING - Run migration'
  END AS stripe_subscription_id,

  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'subscription_period_end'
    ) THEN '✅ subscription_period_end exists'
    ELSE '❌ subscription_period_end MISSING - Run migration'
  END AS subscription_period_end;

\echo ''

-- ============================================================================
-- 2. CHECK ANALYTICS EVENTS TABLE
-- ============================================================================

\echo '2. ANALYTICS EVENTS TABLE'
\echo '-------------------------'

SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics_events')
    THEN '✅ analytics_events table exists'
    ELSE '❌ analytics_events table MISSING - Create table'
  END AS table_status;

\echo ''

-- ============================================================================
-- 3. CHECK CRITICAL INDEXES
-- ============================================================================

\echo '3. CRITICAL INDEXES'
\echo '-------------------'

SELECT
  index_name,
  CASE
    WHEN index_exists THEN '✅ Exists'
    ELSE '❌ MISSING'
  END AS status
FROM (
  VALUES
    ('idx_profiles_stripe_customer_id', EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_stripe_customer_id')),
    ('idx_analytics_events_type', EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_analytics_events_type')),
    ('idx_analytics_events_created_at', EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_analytics_events_created_at')),
    ('idx_analytics_events_payload_gin', EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_analytics_events_payload_gin')),
    ('idx_tasks_workspace_status', EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_workspace_status')),
    ('idx_workspace_members_user_workspace', EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_workspace_members_user_workspace')),
    ('idx_sprint_metrics_workspace_calculated', EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sprint_metrics_workspace_calculated')),
    ('idx_story_generation_workspace_status', EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_story_generation_workspace_status'))
) AS checks(index_name, index_exists)
ORDER BY
  CASE WHEN index_exists THEN 1 ELSE 0 END,
  index_name;

\echo ''

-- ============================================================================
-- 4. CHECK INDEX USAGE (if data exists)
-- ============================================================================

\echo '4. INDEX USAGE STATISTICS (Top 10 most used)'
\echo '--------------------------------------------'

SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  CASE
    WHEN idx_scan > 100 THEN '✅ High usage'
    WHEN idx_scan > 10 THEN '⚠️  Medium usage'
    WHEN idx_scan > 0 THEN '⚠️  Low usage'
    ELSE '❌ Never used'
  END AS usage_level
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'analytics_events', 'tasks', 'workspace_members', 'sprint_metrics')
ORDER BY idx_scan DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 5. CHECK TABLE SIZES
-- ============================================================================

\echo '5. TABLE SIZES (Performance Impact)'
\echo '------------------------------------'

SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size,
  CASE
    WHEN pg_total_relation_size(schemaname||'.'||tablename) > 100000000 THEN '⚠️  Large (>100MB) - Indexes critical'
    WHEN pg_total_relation_size(schemaname||'.'||tablename) > 10000000 THEN '✅ Medium (10-100MB)'
    ELSE '✅ Small (<10MB)'
  END AS size_category
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'analytics_events', 'tasks', 'workspaces', 'workspace_members', 'sprints', 'sprint_metrics')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

\echo ''

-- ============================================================================
-- 6. CHECK SUBSCRIPTION TIER DATA
-- ============================================================================

\echo '6. SUBSCRIPTION TIER DISTRIBUTION'
\echo '----------------------------------'

SELECT
  COALESCE(subscription_tier, 'NULL') as tier,
  COUNT(*) as user_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM profiles
GROUP BY subscription_tier
ORDER BY user_count DESC;

\echo ''

-- ============================================================================
-- 7. CHECK FOR SLOW QUERIES (Missing Indexes)
-- ============================================================================

\echo '7. POTENTIAL SLOW QUERIES (Sequential Scans on Large Tables)'
\echo '-------------------------------------------------------------'

SELECT
  schemaname,
  tablename,
  seq_scan as sequential_scans,
  seq_tup_read as rows_scanned,
  idx_scan as index_scans,
  CASE
    WHEN seq_scan > idx_scan AND seq_scan > 100 THEN '❌ HIGH - Add indexes!'
    WHEN seq_scan > idx_scan THEN '⚠️  MEDIUM - Consider indexes'
    ELSE '✅ Good index usage'
  END AS status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND tablename IN ('tasks', 'analytics_events', 'workspace_members', 'sprints', 'profiles')
ORDER BY seq_scan DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 8. CHECK ANALYTICS EVENTS COUNT
-- ============================================================================

\echo '8. ANALYTICS EVENTS DATA'
\echo '------------------------'

SELECT
  COUNT(*) as total_events,
  COUNT(DISTINCT type) as event_types,
  MIN(created_at) as oldest_event,
  MAX(created_at) as newest_event,
  CASE
    WHEN COUNT(*) > 10000 THEN '⚠️  Large dataset - Indexes critical'
    WHEN COUNT(*) > 1000 THEN '✅ Medium dataset'
    WHEN COUNT(*) > 0 THEN '✅ Small dataset'
    ELSE 'ℹ️  No events yet'
  END AS dataset_size
FROM analytics_events;

\echo ''

-- ============================================================================
-- 9. CHECK FOREIGN KEY CONSTRAINTS
-- ============================================================================

\echo '9. FOREIGN KEY CONSTRAINTS (Data Integrity)'
\echo '--------------------------------------------'

SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  '✅ Valid' as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('tasks', 'workspace_members', 'sprints', 'analytics_events', 'personas')
ORDER BY tc.table_name, tc.constraint_name
LIMIT 15;

\echo ''

-- ============================================================================
-- 10. SUMMARY & RECOMMENDATIONS
-- ============================================================================

\echo '10. SUMMARY & RECOMMENDATIONS'
\echo '-----------------------------'

WITH checks AS (
  SELECT
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('stripe_customer_id', 'stripe_subscription_id', 'subscription_period_end')) AS stripe_columns,
    (SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE 'idx_analytics_events_%') AS analytics_indexes,
    (SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE 'idx_tasks_%') AS task_indexes,
    (SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE 'idx_workspace_members_%') AS member_indexes
)
SELECT
  CASE WHEN stripe_columns >= 3 THEN '✅' ELSE '❌' END || ' Stripe columns: ' || stripe_columns || '/3' as stripe_status,
  CASE WHEN analytics_indexes >= 5 THEN '✅' ELSE '❌' END || ' Analytics indexes: ' || analytics_indexes || '/7+' as analytics_status,
  CASE WHEN task_indexes >= 4 THEN '✅' ELSE '❌' END || ' Task indexes: ' || task_indexes || '/5+' as task_status,
  CASE WHEN member_indexes >= 2 THEN '✅' ELSE '❌' END || ' Member indexes: ' || member_indexes || '/2+' as member_status
FROM checks;

\echo ''
\echo 'If you see ❌ MISSING above, run: supabase/migrations/20251122_subscription_billing_schema.sql'
\echo 'Documentation: docs/SCHEMA_ALIGNMENT_AND_OPTIMIZATION.md'
\echo ''
\echo '============================================================================'
\echo 'End of Report'
\echo '============================================================================'
