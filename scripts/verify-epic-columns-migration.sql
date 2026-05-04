-- Verification script for 20260129_add_missing_epic_columns migration
-- Run this after the migration to confirm all changes were applied correctly
--
-- Usage:
--   supabase db execute --file scripts/verify-epic-columns-migration.sql
--   OR run directly in Supabase SQL Editor

-- Check 1: Verify owner_id column exists
DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'epics'
        AND column_name = 'owner_id'
    ) INTO col_exists;

    IF NOT col_exists THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: owner_id column does not exist in epics table';
    END IF;

    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'epics'
    AND column_name = 'owner_id';

    IF col_type != 'uuid' THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: owner_id column has wrong type: %, expected uuid', col_type;
    END IF;

    RAISE NOTICE 'CHECK 1 PASSED: owner_id column exists with correct type (uuid)';
END $$;

-- Check 2: Verify start_date column exists
DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'epics'
        AND column_name = 'start_date'
    ) INTO col_exists;

    IF NOT col_exists THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: start_date column does not exist in epics table';
    END IF;

    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'epics'
    AND column_name = 'start_date';

    IF col_type != 'date' THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: start_date column has wrong type: %, expected date', col_type;
    END IF;

    RAISE NOTICE 'CHECK 2 PASSED: start_date column exists with correct type (date)';
END $$;

-- Check 3: Verify foreign key constraint on owner_id
DO $$
DECLARE
    fk_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = 'epics'
        AND kcu.column_name = 'owner_id'
        AND ccu.table_name = 'profiles'
    ) INTO fk_exists;

    IF NOT fk_exists THEN
        RAISE WARNING 'CHECK 3 WARNING: Foreign key constraint on owner_id -> profiles may not exist (non-critical)';
    ELSE
        RAISE NOTICE 'CHECK 3 PASSED: Foreign key constraint exists (owner_id -> profiles)';
    END IF;
END $$;

-- Check 4: Verify index on owner_id
DO $$
DECLARE
    idx_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'epics'
        AND indexname = 'idx_epics_owner_id'
    ) INTO idx_exists;

    IF NOT idx_exists THEN
        RAISE WARNING 'CHECK 4 WARNING: Index idx_epics_owner_id does not exist (non-critical, may affect performance)';
    ELSE
        RAISE NOTICE 'CHECK 4 PASSED: Index idx_epics_owner_id exists';
    END IF;
END $$;

-- Check 5: Test that we can update an epic with owner_id (dry run)
DO $$
DECLARE
    test_epic_id UUID;
BEGIN
    -- Find any existing epic to test against
    SELECT id INTO test_epic_id FROM epics LIMIT 1;

    IF test_epic_id IS NOT NULL THEN
        -- This will fail if the column doesn't exist or has wrong type
        -- We update with NULL to avoid changing actual data
        UPDATE epics
        SET owner_id = owner_id,
            start_date = start_date,
            updated_at = updated_at
        WHERE id = test_epic_id;

        RAISE NOTICE 'CHECK 5 PASSED: Successfully tested update on epics with owner_id and start_date columns';
    ELSE
        RAISE NOTICE 'CHECK 5 SKIPPED: No epics found in database to test against';
    END IF;
END $$;

-- Summary: Display epics table structure
SELECT
    '=== EPICS TABLE COLUMNS ===' as info
UNION ALL
SELECT column_name || ' | ' || data_type || ' | nullable: ' || is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'epics'
ORDER BY 1;

-- Final verification summary
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '  MIGRATION VERIFICATION COMPLETE';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'If you see this message without EXCEPTION errors,';
    RAISE NOTICE 'the migration was applied successfully.';
    RAISE NOTICE '';
    RAISE NOTICE 'The Edit Epic modal should now work correctly';
    RAISE NOTICE 'with owner_id and start_date fields.';
    RAISE NOTICE '';
END $$;
