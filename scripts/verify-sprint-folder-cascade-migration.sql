-- ============================================================================
-- Verification Script: Sprint Folder Space/Project Cascade Migration
-- Migration: 20260129_cascade_sprint_folder_space.sql
--
-- Run this script in Supabase SQL Editor to verify the migration was applied
-- ============================================================================

-- ============================================================================
-- STEP 1: Verify triggers exist
-- ============================================================================
SELECT
  '1. TRIGGER CHECK' as step,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  CASE tgenabled
    WHEN 'O' THEN 'enabled (origin)'
    WHEN 'D' THEN 'DISABLED'
    WHEN 'R' THEN 'enabled (replica)'
    WHEN 'A' THEN 'enabled (always)'
    ELSE tgenabled::text
  END as status
FROM pg_trigger
WHERE tgname LIKE 'trigger_cascade_sprint_folder%'
ORDER BY tgname;

-- Expected output:
-- | trigger_name                         | table_name      | status           |
-- |--------------------------------------|-----------------|------------------|
-- | trigger_cascade_sprint_folder_project| sprint_folders  | enabled (origin) |
-- | trigger_cascade_sprint_folder_space  | sprint_folders  | enabled (origin) |

-- ============================================================================
-- STEP 2: Verify functions exist
-- ============================================================================
SELECT
  '2. FUNCTION CHECK' as step,
  proname as function_name,
  pg_get_function_result(oid) as return_type
FROM pg_proc
WHERE proname IN ('cascade_sprint_folder_space_id', 'cascade_sprint_folder_project_id')
ORDER BY proname;

-- Expected output:
-- | function_name                    | return_type |
-- |----------------------------------|-------------|
-- | cascade_sprint_folder_project_id | trigger     |
-- | cascade_sprint_folder_space_id   | trigger     |

-- ============================================================================
-- STEP 3: Test the cascade (DRY RUN - uses transaction rollback)
-- ============================================================================
DO $$
DECLARE
  v_test_folder_id UUID;
  v_test_sprint_id UUID;
  v_original_space_id UUID;
  v_new_space_id UUID;
  v_sprint_space_before UUID;
  v_sprint_space_after UUID;
BEGIN
  RAISE NOTICE '3. CASCADE TEST (DRY RUN)';
  RAISE NOTICE '============================';

  -- Find a sprint folder with at least one sprint
  SELECT sf.id, sf.space_id, s.id
  INTO v_test_folder_id, v_original_space_id, v_test_sprint_id
  FROM sprint_folders sf
  JOIN sprints s ON s.sprint_folder_id = sf.id
  WHERE sf.deleted_at IS NULL AND s.deleted_at IS NULL
  LIMIT 1;

  IF v_test_folder_id IS NULL THEN
    RAISE NOTICE 'SKIPPED: No sprint folder with sprints found for testing';
    RAISE NOTICE 'Migration verification passed (triggers exist, no data to test)';
    RETURN;
  END IF;

  -- Find a different space to move to
  SELECT id INTO v_new_space_id
  FROM spaces
  WHERE id != v_original_space_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_new_space_id IS NULL THEN
    RAISE NOTICE 'SKIPPED: No alternate space found for testing';
    RAISE NOTICE 'Migration verification passed (triggers exist, single space workspace)';
    RETURN;
  END IF;

  -- Get sprint's space_id before update
  SELECT space_id INTO v_sprint_space_before
  FROM sprints WHERE id = v_test_sprint_id;

  RAISE NOTICE 'Test folder ID: %', v_test_folder_id;
  RAISE NOTICE 'Test sprint ID: %', v_test_sprint_id;
  RAISE NOTICE 'Original space: %', v_original_space_id;
  RAISE NOTICE 'New space: %', v_new_space_id;
  RAISE NOTICE 'Sprint space BEFORE: %', v_sprint_space_before;

  -- Update sprint folder's space_id (this should trigger cascade)
  UPDATE sprint_folders
  SET space_id = v_new_space_id, updated_at = NOW()
  WHERE id = v_test_folder_id;

  -- Check if sprint's space_id was updated
  SELECT space_id INTO v_sprint_space_after
  FROM sprints WHERE id = v_test_sprint_id;

  RAISE NOTICE 'Sprint space AFTER: %', v_sprint_space_after;

  IF v_sprint_space_after = v_new_space_id THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ CASCADE TEST PASSED: Sprint space_id was updated correctly';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '❌ CASCADE TEST FAILED: Sprint space_id was NOT updated';
    RAISE NOTICE '   Expected: %', v_new_space_id;
    RAISE NOTICE '   Got: %', v_sprint_space_after;
  END IF;

  -- Rollback to not actually change any data
  RAISE EXCEPTION 'ROLLBACK_TEST_DATA';

EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM = 'ROLLBACK_TEST_DATA' THEN
      RAISE NOTICE '';
      RAISE NOTICE 'Test complete (changes rolled back - no data modified)';
    ELSE
      RAISE NOTICE 'Error during test: %', SQLERRM;
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Check for any sprint folders where sprints have mismatched space_id
-- (These would be pre-existing data inconsistencies)
-- ============================================================================
SELECT
  '4. DATA CONSISTENCY CHECK' as step,
  sf.id as folder_id,
  sf.name as folder_name,
  sf.space_id as folder_space_id,
  s.id as sprint_id,
  s.name as sprint_name,
  s.space_id as sprint_space_id,
  CASE
    WHEN sf.space_id = s.space_id THEN '✅ OK'
    ELSE '❌ MISMATCH'
  END as status
FROM sprint_folders sf
JOIN sprints s ON s.sprint_folder_id = sf.id
WHERE sf.deleted_at IS NULL
  AND s.deleted_at IS NULL
  AND sf.space_id != s.space_id
LIMIT 10;

-- If this returns rows, those are pre-existing inconsistencies that should be fixed:
-- UPDATE sprints s
-- SET space_id = sf.space_id
-- FROM sprint_folders sf
-- WHERE s.sprint_folder_id = sf.id
--   AND s.space_id != sf.space_id
--   AND s.deleted_at IS NULL;

-- ============================================================================
-- STEP 5: Summary
-- ============================================================================
SELECT
  '5. MIGRATION SUMMARY' as step,
  (SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE 'trigger_cascade_sprint_folder%') as triggers_found,
  (SELECT COUNT(*) FROM pg_proc WHERE proname IN ('cascade_sprint_folder_space_id', 'cascade_sprint_folder_project_id')) as functions_found,
  CASE
    WHEN (SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE 'trigger_cascade_sprint_folder%') = 2
     AND (SELECT COUNT(*) FROM pg_proc WHERE proname IN ('cascade_sprint_folder_space_id', 'cascade_sprint_folder_project_id')) = 2
    THEN '✅ MIGRATION VERIFIED'
    ELSE '❌ MIGRATION INCOMPLETE'
  END as status;
