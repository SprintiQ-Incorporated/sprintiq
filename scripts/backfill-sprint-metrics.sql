-- Backfill Script: Populate Sprint Metrics for Existing Sprints
-- Description: One-time script to populate sprint_metrics and team_velocity_history
--              for all existing sprints in the database
-- Usage: Run this AFTER applying the 20260115_populate_sprint_metrics.sql migration
-- Created: 2026-01-15
-- Fixed: 2026-01-15 - Corrected RAISE statement formatting issues

DO $$
DECLARE
  v_sprint_record RECORD;
  v_total_sprints INTEGER;
  v_processed_sprints INTEGER := 0;
  v_failed_sprints INTEGER := 0;
  v_start_time TIMESTAMP;
BEGIN
  v_start_time := clock_timestamp();
  
  -- Count total sprints to process
  SELECT COUNT(*) INTO v_total_sprints
  FROM sprints
  WHERE deleted_at IS NULL;

  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Starting Sprint Metrics Backfill';
  RAISE NOTICE 'Total sprints to process: %', v_total_sprints;
  RAISE NOTICE '====================================================================';

  -- Process each sprint
  FOR v_sprint_record IN 
    SELECT id, sprint_id, name, status
    FROM sprints 
    WHERE deleted_at IS NULL
    ORDER BY created_at ASC
  LOOP
    BEGIN
      -- Calculate metrics for this sprint
      PERFORM populate_sprint_metrics_for_sprint(v_sprint_record.id);
      
      v_processed_sprints := v_processed_sprints + 1;
      
      -- Log progress every 10 sprints
      IF v_processed_sprints % 10 = 0 THEN
        RAISE NOTICE 'Progress: % of % sprints processed (% failed)', 
          v_processed_sprints, v_total_sprints, v_failed_sprints;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_failed_sprints := v_failed_sprints + 1;
      RAISE WARNING 'Failed to process sprint % (ID: %): %', 
        v_sprint_record.name, v_sprint_record.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Backfill Complete!';
  RAISE NOTICE 'Total sprints: %', v_total_sprints;
  RAISE NOTICE 'Successfully processed: %', v_processed_sprints;
  RAISE NOTICE 'Failed: %', v_failed_sprints;
  RAISE NOTICE 'Duration: % seconds', EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time));
  RAISE NOTICE '====================================================================';

  -- Show summary statistics
  RAISE NOTICE '';
  RAISE NOTICE 'Sprint Metrics Summary:';
  RAISE NOTICE '====================================================================';
  
  -- Total metrics created
  DECLARE
    v_metrics_count INTEGER;
    v_history_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_metrics_count FROM sprint_metrics;
    SELECT COUNT(*) INTO v_history_count FROM team_velocity_history;
    
    RAISE NOTICE 'Sprint metrics records: %', v_metrics_count;
    RAISE NOTICE 'Velocity history records: %', v_history_count;
  END;

  -- Top 5 sprints by velocity
  RAISE NOTICE '';
  RAISE NOTICE 'Top 5 Sprints by Velocity:';
  RAISE NOTICE '-------------------------------------------------------------------';
  
  FOR v_sprint_record IN
    SELECT 
      s.name,
      s.sprint_id,
      sm.velocity,
      sm.planned_points,
      sm.completed_points,
      ROUND(sm.completion_rate, 1) as completion_rate
    FROM sprint_metrics sm
    JOIN sprints s ON s.id = sm.sprint_id
    ORDER BY sm.velocity DESC
    LIMIT 5
  LOOP
    RAISE NOTICE '  Sprint: %, ID: %, Velocity: % pts, Completed: % of % pts, Rate: %',
      v_sprint_record.name,
      v_sprint_record.sprint_id,
      v_sprint_record.velocity,
      v_sprint_record.completed_points,
      v_sprint_record.planned_points,
      v_sprint_record.completion_rate;
  END LOOP;

  -- Sprints with low completion rates
  RAISE NOTICE '';
  RAISE NOTICE 'Sprints with < 50 percent Completion Rate:';
  RAISE NOTICE '-------------------------------------------------------------------';
  
  DECLARE
    v_low_completion_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_low_completion_count
    FROM sprint_metrics
    WHERE completion_rate < 50;
    
    IF v_low_completion_count > 0 THEN
      FOR v_sprint_record IN
        SELECT 
          s.name,
          s.sprint_id,
          sm.completed_points,
          sm.planned_points,
          ROUND(sm.completion_rate, 1) as completion_rate
        FROM sprint_metrics sm
        JOIN sprints s ON s.id = sm.sprint_id
        WHERE sm.completion_rate < 50
        ORDER BY sm.completion_rate ASC
        LIMIT 5
      LOOP
        RAISE NOTICE '  Sprint: %, ID: %, Rate: %, Points: % of %',
          v_sprint_record.name,
          v_sprint_record.sprint_id,
          v_sprint_record.completion_rate,
          v_sprint_record.completed_points,
          v_sprint_record.planned_points;
      END LOOP;
    ELSE
      RAISE NOTICE '  None - all sprints above 50 percent completion!';
    END IF;
  END;

  RAISE NOTICE '====================================================================';
  
END $$;

-- Verify the backfill results
DO $$
DECLARE
  v_sprints_without_metrics INTEGER;
BEGIN
  -- Check if any sprints are missing metrics
  SELECT COUNT(*) INTO v_sprints_without_metrics
  FROM sprints s
  LEFT JOIN sprint_metrics sm ON s.id = sm.sprint_id
  WHERE s.deleted_at IS NULL
    AND sm.sprint_id IS NULL;
  
  IF v_sprints_without_metrics > 0 THEN
    RAISE WARNING 'Found % sprints without metrics - backfill may have failed for these', 
      v_sprints_without_metrics;
  ELSE
    RAISE NOTICE 'Verification: All sprints have metrics - SUCCESS';
  END IF;
END $$;
