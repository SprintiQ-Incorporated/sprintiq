-- ============================================================================
-- Test Script: Verify Predefined Roles Migration
-- Created: 2025-01-01
-- Description: Test all aspects of the predefined roles feature
-- ============================================================================

-- ============================================================================
-- TEST 1: Verify predefined_role_templates table exists and has data
-- ============================================================================

SELECT 'TEST 1: Predefined Templates' as test_name;
SELECT 
    category,
    COUNT(*) as template_count,
    STRING_AGG(name, ', ' ORDER BY sort_order) as role_names
FROM predefined_role_templates
WHERE is_active = true
GROUP BY category
ORDER BY MIN(sort_order);

-- Expected: 8 categories with 15 total templates
-- Engineering: 7 roles
-- Design: 2 roles
-- Product: 1 role
-- Operations: 1 role
-- Business: 1 role
-- Marketing: 2 roles
-- Sales: 1 role

-- ============================================================================
-- TEST 2: Verify competencies are stored correctly
-- ============================================================================

SELECT 'TEST 2: Competency Data' as test_name;
SELECT 
    name,
    category,
    jsonb_array_length(default_competencies) as competency_count,
    default_competencies
FROM predefined_role_templates
WHERE name = 'Front-end Developer';

-- Expected: Front-end Developer has 7 competencies
-- ["React", "Vue", "Angular", "JavaScript", "TypeScript", "CSS", "HTML"]

-- ============================================================================
-- TEST 3: Verify helper functions exist
-- ============================================================================

SELECT 'TEST 3: Helper Functions' as test_name;
SELECT 
    proname as function_name,
    pg_get_function_result(oid) as return_type
FROM pg_proc
WHERE proname IN (
    'get_workspace_role_count',
    'get_workspace_tier_role_limit',
    'get_workspace_role_usage',
    'check_role_limit_before_insert',
    'check_role_has_members_before_delete'
)
ORDER BY proname;

-- Expected: All 5 functions should exist

-- ============================================================================
-- TEST 4: Verify triggers are active
-- ============================================================================

SELECT 'TEST 4: Active Triggers' as test_name;
SELECT 
    tgname as trigger_name,
    tgenabled as is_enabled
FROM pg_trigger
WHERE tgrelid = 'roles'::regclass
AND tgname IN (
    'enforce_role_limit_trigger',
    'prevent_role_delete_with_members_trigger',
    'maintain_workspace_role_count_trigger'
)
ORDER BY tgname;

-- Expected: All 3 triggers should be enabled

-- ============================================================================
-- TEST 5: Verify RLS policies on roles table
-- ============================================================================

SELECT 'TEST 5: RLS Policies' as test_name;
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'roles'
ORDER BY policyname;

-- Expected: 4 policies (SELECT, INSERT, UPDATE, DELETE)

-- ============================================================================
-- TEST 6: Verify indexes on roles table
-- ============================================================================

SELECT 'TEST 6: Role Indexes' as test_name;
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'roles'
AND indexname LIKE '%roles%'
ORDER BY indexname;

-- Expected: Indexes on workspace_id, created_by, category, composite

-- ============================================================================
-- TEST 7: Test workspace role count function
-- (Replace with actual workspace UUID)
-- ============================================================================

-- Uncomment and replace UUID to test:
-- SELECT 'TEST 7: Role Count Function' as test_name;
-- SELECT * FROM get_workspace_role_count('your-workspace-uuid-here'::uuid);

-- ============================================================================
-- TEST 8: Test workspace role usage function
-- (Replace with actual workspace UUID)
-- ============================================================================

-- Uncomment and replace UUID to test:
-- SELECT 'TEST 8: Role Usage Function' as test_name;
-- SELECT * FROM get_workspace_role_usage('your-workspace-uuid-here'::uuid);

-- Expected output columns:
-- current_count, limit_count, tier, percentage, is_warning, is_blocked, can_create, remaining

-- ============================================================================
-- TEST 9: Verify workspaces table has role_count column
-- ============================================================================

SELECT 'TEST 9: Workspace Role Count Cache' as test_name;
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'workspaces'
AND column_name = 'role_count';

-- Expected: role_count column with INTEGER type, default 0

-- ============================================================================
-- TEST 10: Test tier limit function
-- (Replace with actual workspace UUID)
-- ============================================================================

-- Uncomment and replace UUID to test:
-- SELECT 'TEST 10: Tier Limit Function' as test_name;
-- SELECT get_workspace_tier_role_limit('your-workspace-uuid-here'::uuid) as role_limit;

-- Expected: 10 for trial/launch, 25 for velocity, -1 for enterprise

-- ============================================================================
-- TEST 11: Verify predefined templates are read-only
-- ============================================================================

SELECT 'TEST 11: Template Read-Only Check' as test_name;

-- This should FAIL (no workspace_id, read-only templates):
-- INSERT INTO predefined_role_templates (name, category, default_competencies)
-- VALUES ('Test Role', 'Engineering', '["test"]'::jsonb);

-- This is the correct way to use templates (copy to roles table):
-- INSERT INTO roles (name, description, workspace_id, created_by, category, core_competencies)
-- SELECT 
--     name,
--     description,
--     'your-workspace-uuid-here'::uuid,
--     auth.uid(),
--     category,
--     default_competencies
-- FROM predefined_role_templates
-- WHERE name = 'Front-end Developer';

-- ============================================================================
-- SAMPLE DATA CHECK: Get all templates grouped by category
-- ============================================================================

SELECT 'SAMPLE DATA: All Templates by Category' as test_name;
SELECT 
    category,
    jsonb_agg(
        jsonb_build_object(
            'name', name,
            'description', description,
            'competencies', default_competencies
        ) ORDER BY sort_order
    ) as roles
FROM predefined_role_templates
WHERE is_active = true
GROUP BY category
ORDER BY MIN(sort_order);

-- ============================================================================
-- NOTES
-- ============================================================================

-- To test the tier limit enforcement:
-- 1. Create roles up to your tier limit
-- 2. Try to create one more - should fail with TIER_LIMIT_REACHED error
-- 3. Verify error message includes tier name and limit

-- To test the member assignment guard:
-- 1. Assign a team member to a role
-- 2. Try to delete that role - should fail with ROLE_HAS_MEMBERS error
-- 3. Verify error message includes member names

-- To test RLS policies:
-- 1. Create a role in your workspace
-- 2. Verify you can see it
-- 3. Verify you can update/delete it
-- 4. Create another user and verify they can't see/modify your roles
