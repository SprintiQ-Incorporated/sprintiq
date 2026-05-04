-- ============================================================================
-- Verification Script: tasks.assigned_member_id FK Constraint
-- Run this script to verify the ON DELETE SET NULL constraint is properly set
-- ============================================================================

-- Step 1: Check if the FK constraint exists and its delete rule
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column,
    rc.delete_rule,
    CASE
        WHEN rc.delete_rule = 'SET NULL' THEN '✅ CORRECT: ON DELETE SET NULL'
        WHEN rc.delete_rule = 'CASCADE' THEN '⚠️ WARNING: ON DELETE CASCADE'
        WHEN rc.delete_rule = 'NO ACTION' THEN '❌ ERROR: ON DELETE NO ACTION (blocking)'
        WHEN rc.delete_rule = 'RESTRICT' THEN '❌ ERROR: ON DELETE RESTRICT (blocking)'
        ELSE '❓ UNKNOWN: ' || COALESCE(rc.delete_rule, 'NULL')
    END AS status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON rc.unique_constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'tasks'
    AND kcu.column_name = 'assigned_member_id';

-- Step 2: Check if the index exists for performance
SELECT
    indexname,
    indexdef,
    CASE
        WHEN indexname IS NOT NULL THEN '✅ Index exists'
        ELSE '❌ Index missing'
    END AS status
FROM pg_indexes
WHERE tablename = 'tasks'
    AND indexname = 'idx_tasks_assigned_member_id';

-- Step 3: Check column definition
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE
        WHEN is_nullable = 'YES' THEN '✅ Column is nullable (correct for SET NULL)'
        ELSE '❌ Column is NOT nullable (SET NULL will fail)'
    END AS status
FROM information_schema.columns
WHERE table_name = 'tasks'
    AND column_name = 'assigned_member_id';

-- Step 4: Count tasks with assigned members (for impact assessment)
SELECT
    COUNT(*) AS total_tasks,
    COUNT(assigned_member_id) AS tasks_with_assignee,
    COUNT(*) - COUNT(assigned_member_id) AS tasks_without_assignee,
    ROUND(COUNT(assigned_member_id)::numeric / NULLIF(COUNT(*), 0) * 100, 2) AS percent_assigned
FROM tasks
WHERE deleted_at IS NULL;

-- Step 5: Verify team_members table exists and has data
SELECT
    COUNT(*) AS total_team_members,
    CASE
        WHEN COUNT(*) > 0 THEN '✅ Team members exist'
        ELSE '⚠️ No team members found'
    END AS status
FROM team_members
WHERE deleted_at IS NULL;

-- Step 6: Test simulation - what would happen if we deleted a team member
-- (This is a read-only check, does not actually delete anything)
SELECT
    tm.id AS team_member_id,
    tm.name AS team_member_name,
    COUNT(t.id) AS assigned_tasks_count,
    CASE
        WHEN COUNT(t.id) > 0 THEN 'Deleting this member would SET NULL on ' || COUNT(t.id) || ' tasks'
        ELSE 'No tasks assigned'
    END AS impact_assessment
FROM team_members tm
LEFT JOIN tasks t ON t.assigned_member_id = tm.id AND t.deleted_at IS NULL
WHERE tm.deleted_at IS NULL
GROUP BY tm.id, tm.name
ORDER BY assigned_tasks_count DESC
LIMIT 10;

-- ============================================================================
-- Expected Results Summary:
-- 1. FK constraint should show delete_rule = 'SET NULL'
-- 2. Index idx_tasks_assigned_member_id should exist
-- 3. assigned_member_id column should be nullable (is_nullable = 'YES')
-- 4. Statistics on current task assignments
-- 5. Team members count
-- 6. Impact assessment for top 10 team members
-- ============================================================================
