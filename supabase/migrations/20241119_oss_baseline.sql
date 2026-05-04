-- ============================================================================
-- OSS Baseline Migration — SprintiQ Turbo
-- ============================================================================
--
-- Single squashed migration that creates the complete OSS schema in one pass.
-- Replaces the 189-file SaaS migration history that accumulated during
-- pre-OSS development. The full SaaS migration history is preserved on the
-- `pre-oss-migrations-archive` branch.
--
-- Source of truth: pg_dump --schema public from the dev project (after OSS
-- reduction was applied to remote). All 40 OSS-surviving tables, OSS-correct
-- function bodies, RLS policies, indexes, and FK constraints are included.
--
-- This file produces an identical schema to a fresh self-host running
-- `supabase db reset`.
--
-- Sections (in order):
--   1. Extensions
--   2. Schema dump (types, functions, tables, indexes, FK constraints,
--      RLS policies, GRANTs)
--   3. Auth trigger (handle_new_user on auth.users INSERT)
--   4. Seed data (status_types, days)
-- ============================================================================

-- ============================================================================
-- 1. Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector       WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto     WITH SCHEMA extensions;

-- ============================================================================
-- 2. Schema (from pg_dump of dev — OSS-reduced state)
-- ============================================================================




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "postgres";


CREATE TYPE "public"."priority_level_type" AS ENUM (
    'low',
    'medium',
    'high',
    'critical',
    'urgent'
);


ALTER TYPE "public"."priority_level_type" OWNER TO "postgres";


CREATE TYPE "public"."status_type" AS ENUM (
    'submitted',
    'under_review',
    'planned',
    'in_development',
    'completed',
    'rejected',
    'reported',
    'investigating',
    'in_progress',
    'resolved',
    'closed',
    'open'
);


ALTER TYPE "public"."status_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_uid_check"() RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT auth.uid();
$$;


ALTER FUNCTION "public"."auth_uid_check"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_activate_sprint"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  sprint_record RECORD;
  new_status_type TEXT;
BEGIN
  -- Only process if task has a sprint_id and status changed
  IF NEW.sprint_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  -- Get the sprint info
  SELECT id, status, start_date INTO sprint_record
  FROM sprints
  WHERE id = NEW.sprint_id;

  -- Only activate if sprint is currently 'planned'
  IF sprint_record.status != 'planned' THEN
    RETURN NEW;
  END IF;

  -- Get the status type for the new status
  SELECT st.name INTO new_status_type
  FROM statuses s
  JOIN status_types st ON s.status_type_id = st.id
  WHERE s.id = NEW.status_id;

  -- If task is moving to any non-'todo' status, activate the sprint
  IF new_status_type IS NOT NULL AND new_status_type != 'todo' THEN
    UPDATE sprints
    SET
      status = 'active',
      start_date = COALESCE(start_date, CURRENT_DATE),
      updated_at = NOW()
    WHERE id = NEW.sprint_id
      AND status = 'planned';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_activate_sprint"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_mark_acceptance_criteria_met"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  DECLARE
    new_status_type TEXT;
  BEGIN
    IF OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
      RETURN NEW;
    END IF;

    SELECT st.name INTO new_status_type
    FROM statuses s
    JOIN status_types st ON s.status_type_id = st.id
    WHERE s.id = NEW.status_id;

    IF new_status_type = 'done' THEN
      IF NEW.acceptance_criteria_met IS NULL
         AND NEW.acceptance_criteria IS NOT NULL
         AND array_length(NEW.acceptance_criteria, 1) > 0 THEN
        NEW.acceptance_criteria_met := true;
        NEW.acceptance_criteria_met_at := NOW();
      END IF;
    END IF;

    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."auto_mark_acceptance_criteria_met"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_sprint_metrics"("p_sprint_id" "uuid") RETURNS TABLE("total_stories" bigint, "completed_stories" bigint, "planned_points" bigint, "completed_points" bigint, "velocity" integer, "completion_rate" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_stories,
    COUNT(*) FILTER (WHERE s.type = 'done') as completed_stories,
    COALESCE(SUM(t.story_points), 0) as planned_points,
    COALESCE(SUM(t.story_points) FILTER (WHERE s.type = 'done'), 0) as completed_points,
    COALESCE(SUM(t.story_points) FILTER (WHERE s.type = 'done'), 0)::INTEGER as velocity,
    CASE
      WHEN COUNT(*) > 0
      THEN (COUNT(*) FILTER (WHERE s.type = 'done')::NUMERIC / COUNT(*)::NUMERIC * 100)
      ELSE 0
    END as completion_rate
  FROM public.tasks t
  LEFT JOIN public.statuses s ON t.status_id = s.id
  WHERE t.sprint_id = p_sprint_id
    AND t.deleted_at IS NULL;
END;
$$;


ALTER FUNCTION "public"."calculate_sprint_metrics"("p_sprint_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cascade_project_soft_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE tasks SET deleted_at = NEW.deleted_at, updated_at = NOW() WHERE project_id = NEW.id AND deleted_at IS NULL;
    UPDATE statuses SET deleted_at = NEW.deleted_at, updated_at = NOW() WHERE project_id = NEW.id AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cascade_project_soft_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cascade_space_soft_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE projects SET deleted_at = NEW.deleted_at, updated_at = NOW() WHERE space_id = NEW.id AND deleted_at IS NULL;
    UPDATE sprint_folders SET deleted_at = NEW.deleted_at, updated_at = NOW() WHERE space_id = NEW.id AND deleted_at IS NULL;
    UPDATE sprints SET deleted_at = NEW.deleted_at, updated_at = NOW() WHERE space_id = NEW.id AND deleted_at IS NULL;
    UPDATE tasks SET deleted_at = NEW.deleted_at, updated_at = NOW() WHERE space_id = NEW.id AND deleted_at IS NULL;
    UPDATE statuses SET deleted_at = NEW.deleted_at, updated_at = NOW() WHERE space_id = NEW.id AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cascade_space_soft_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cascade_sprint_folder_project_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Only run if project_id actually changed
  IF OLD.project_id IS DISTINCT FROM NEW.project_id THEN
    -- Update all sprints in this folder
    UPDATE public.sprints
    SET
      project_id = NEW.project_id,
      updated_at = NOW()
    WHERE sprint_folder_id = NEW.id
      AND deleted_at IS NULL;
 
    RAISE NOTICE 'Cascaded project_id % to sprints in folder % (old project: %)',
      NEW.project_id, NEW.id, OLD.project_id;
  END IF;
 
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cascade_sprint_folder_project_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cascade_sprint_folder_project_id"() IS 'Automatically cascades project_id changes from sprint_folders to child sprints.
   Ensures data consistency when sprint folders are reassigned to different projects.';



CREATE OR REPLACE FUNCTION "public"."cascade_sprint_folder_soft_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE sprints SET deleted_at = NEW.deleted_at, updated_at = NOW() WHERE sprint_folder_id = NEW.id AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cascade_sprint_folder_soft_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cascade_sprint_folder_space_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Only run if space_id actually changed
  IF OLD.space_id IS DISTINCT FROM NEW.space_id THEN
    -- Update all sprints in this folder
    UPDATE public.sprints
    SET
      space_id = NEW.space_id,
      updated_at = NOW()
    WHERE sprint_folder_id = NEW.id
      AND deleted_at IS NULL;
 
    -- Log the cascade for debugging (visible in Supabase logs)
    RAISE NOTICE 'Cascaded space_id % to sprints in folder % (old space: %)',
      NEW.space_id, NEW.id, OLD.space_id;
  END IF;
 
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cascade_sprint_folder_space_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cascade_sprint_folder_space_id"() IS 'Automatically cascades space_id changes from sprint_folders to child sprints.
   Ensures data consistency when sprint folders are moved between spaces.
   See audit: docs/audits/project-story-flow-audit-2026-01.md (Issue C2)';



CREATE OR REPLACE FUNCTION "public"."cascade_sprint_soft_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE tasks SET deleted_at = NEW.deleted_at, updated_at = NOW() WHERE sprint_id = NEW.id AND deleted_at IS NULL;
    UPDATE statuses SET deleted_at = NEW.deleted_at, updated_at = NOW() WHERE sprint_id = NEW.id AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cascade_sprint_soft_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cascade_workspace_soft_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE spaces SET deleted_at = NEW.deleted_at, updated_at = NOW() WHERE workspace_id = NEW.id AND deleted_at IS NULL;
    UPDATE projects SET deleted_at = NEW.deleted_at, updated_at = NOW() WHERE workspace_id = NEW.id AND deleted_at IS NULL;
    UPDATE tasks SET deleted_at = NEW.deleted_at, updated_at = NOW() WHERE workspace_id = NEW.id AND deleted_at IS NULL;
    UPDATE sprints SET deleted_at = NEW.deleted_at, updated_at = NOW() WHERE workspace_id = NEW.id AND deleted_at IS NULL;
    UPDATE statuses SET deleted_at = NEW.deleted_at, updated_at = NOW() WHERE workspace_id = NEW.id AND deleted_at IS NULL;
    UPDATE personas SET deleted_at = NEW.deleted_at, updated_at = NOW() WHERE workspace_id = NEW.id AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cascade_workspace_soft_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_sprint_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  DECLARE
    sprint_record RECORD;
    total_tasks INTEGER;
    completed_tasks INTEGER;
    new_status_type TEXT;
  BEGIN
    IF NEW.sprint_id IS NULL THEN
      RETURN NEW;
    END IF;

    IF OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
      RETURN NEW;
    END IF;

    SELECT st.name INTO new_status_type
    FROM statuses s
    JOIN status_types st ON s.status_type_id = st.id
    WHERE s.id = NEW.status_id;

    IF new_status_type != 'done' THEN
      RETURN NEW;
    END IF;

    SELECT id, status INTO sprint_record
    FROM sprints
    WHERE id = NEW.sprint_id;

    IF sprint_record.status != 'active' THEN
      RETURN NEW;
    END IF;

    SELECT
      COUNT(*),
      COUNT(CASE WHEN st.name = 'done' THEN 1 END)
    INTO total_tasks, completed_tasks
    FROM tasks t
    JOIN statuses s ON t.status_id = s.id
    JOIN status_types st ON s.status_type_id = st.id
    WHERE t.sprint_id = NEW.sprint_id
      AND t.deleted_at IS NULL
      AND t.id != NEW.id;

    completed_tasks := completed_tasks + 1;

    IF total_tasks > 0 AND completed_tasks >= total_tasks THEN
      UPDATE sprints
      SET
        status = 'completed',
        end_date = COALESCE(end_date, CURRENT_DATE),
        updated_at = NOW()
      WHERE id = NEW.sprint_id
        AND status = 'active';
    END IF;

    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."check_sprint_completion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_sprint_revert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  DECLARE
    v_sprint_status TEXT;
    v_new_status_type TEXT;
  BEGIN
    IF NEW.sprint_id IS NULL THEN
      RETURN NEW;
    END IF;

    IF OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
      RETURN NEW;
    END IF;

    SELECT status INTO v_sprint_status
    FROM sprints
    WHERE id = NEW.sprint_id;

    IF v_sprint_status != 'completed' THEN
      RETURN NEW;
    END IF;

    SELECT st.name INTO v_new_status_type
    FROM statuses s
    JOIN status_types st ON s.status_type_id = st.id
    WHERE s.id = NEW.status_id;

    IF v_new_status_type != 'done' THEN
      UPDATE sprints
      SET
        status = 'active',
        updated_at = NOW()
      WHERE id = NEW.sprint_id
        AND status = 'completed';
    END IF;

    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."check_sprint_revert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_rate_limits"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$

BEGIN

  DELETE FROM public.rate_limits

  WHERE window_end < NOW() - INTERVAL '1 day';

END;

$$;


ALTER FUNCTION "public"."cleanup_expired_rate_limits"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_rate_limits"() IS 'Cleans up rate limit records older than 1 day. Run periodically via cron or manually.';



CREATE OR REPLACE FUNCTION "public"."cleanup_old_audit_logs"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM security_audit_log WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_audit_logs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_project_statuses"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    INSERT INTO public.statuses (name, type, position, project_id, workspace_id, space_id, is_default, color) VALUES
        ('To Do', 'todo', 0, NEW.id, NEW.workspace_id, NEW.space_id, true, 'gray'),
        ('In Progress', 'in_progress', 1, NEW.id, NEW.workspace_id, NEW.space_id, false, 'blue'),
        ('Done', 'done', 2, NEW.id, NEW.workspace_id, NEW.space_id, false, 'green');
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_project_statuses"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_workspace_with_defaults"("p_name" "text", "p_purpose" "text" DEFAULT NULL::"text", "p_type" "text" DEFAULT 'general'::"text", "p_category" "text" DEFAULT 'other'::"text", "p_owner_id" "uuid" DEFAULT NULL::"uuid", "p_workspace_id" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_owner_id UUID;
  v_workspace_uuid UUID;
  v_workspace_short_id TEXT;
  v_result JSON;
BEGIN
  v_owner_id := COALESCE(p_owner_id, auth.uid());
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Owner ID is required';
  END IF;

  -- Match workspaces.workspace_id format constraint: 'w_' + 8 hex chars
  v_workspace_short_id := COALESCE(
    p_workspace_id,
    'w_' || substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8)
  );

  INSERT INTO workspaces (name, workspace_id, purpose, type, category, owner_id, created_at, updated_at)
  VALUES (p_name, v_workspace_short_id, p_purpose, p_type, p_category, v_owner_id, NOW(), NOW())
  RETURNING id INTO v_workspace_uuid;

  PERFORM setup_new_workspace(v_owner_id, v_workspace_uuid);

  v_result := json_build_object(
    'workspace_id', v_workspace_uuid,
    'workspace_short_id', v_workspace_short_id,
    'workspace_name', p_name
  );
  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Workspace creation failed: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."create_workspace_with_defaults"("p_name" "text", "p_purpose" "text", "p_type" "text", "p_category" "text", "p_owner_id" "uuid", "p_workspace_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_workspace_with_defaults"("p_name" "text", "p_purpose" "text", "p_type" "text", "p_category" "text", "p_owner_id" "uuid", "p_workspace_id" "text") IS 'OSS: atomically create a workspace plus default space/project/statuses/tags. No tier/billing/membership logic. Owner_id is the sole access truth.';



CREATE OR REPLACE FUNCTION "public"."delete_sprint_cascade"("sprint_id_param" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Delete in the correct order to respect foreign key constraints
  
  -- 1. Delete task_tags for tasks in this sprint
  DELETE FROM task_tags 
  WHERE task_id IN (
    SELECT id FROM tasks WHERE sprint_id = sprint_id_param
  );
  
  -- 2. Delete tasks in this sprint
  DELETE FROM tasks WHERE sprint_id = sprint_id_param;
  
  -- 3. Finally delete the sprint itself
  DELETE FROM sprints WHERE id = sprint_id_param;
  
END;
$$;


ALTER FUNCTION "public"."delete_sprint_cascade"("sprint_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_sprint_metrics_on_soft_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM public.sprint_metrics WHERE sprint_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."delete_sprint_metrics_on_soft_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_single_default_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF NEW.is_default = true AND NEW.project_id IS NOT NULL THEN
        UPDATE public.statuses SET is_default = false WHERE project_id = NEW.project_id AND id != NEW.id AND is_default = true AND deleted_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_single_default_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_project_id"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_id TEXT;
  done BOOL := FALSE;
BEGIN
  WHILE NOT done LOOP
      new_id := 'p' || LPAD(FLOOR(RANDOM() * 1000000000000)::TEXT, 12, '0');
      IF NOT EXISTS (SELECT 1 FROM projects WHERE project_id = new_id) THEN
          done := TRUE;
      END IF;
  END LOOP;
  RETURN new_id;
END;
$$;


ALTER FUNCTION "public"."generate_project_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_space_id"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_id TEXT;
  done BOOL := FALSE;
BEGIN
  WHILE NOT done LOOP
      new_id := 's' || LPAD(FLOOR(RANDOM() * 1000000000000)::TEXT, 12, '0');
      IF NOT EXISTS (SELECT 1 FROM spaces WHERE space_id = new_id) THEN
          done := TRUE;
      END IF;
  END LOOP;
  RETURN new_id;
END;
$$;


ALTER FUNCTION "public"."generate_space_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_task_id"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
     DECLARE
       new_id TEXT;
       done BOOL := FALSE;
     BEGIN
       WHILE NOT done LOOP
         new_id := 't_' || substr(gen_random_uuid()::text, 1, 8);
         IF NOT EXISTS (SELECT 1 FROM tasks WHERE task_id = new_id) THEN
           done := TRUE;
         END IF;
       END LOOP;
       RETURN new_id;
     END;
     $$;


ALTER FUNCTION "public"."generate_task_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_workspace_id"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    new_id TEXT;
    done BOOL := FALSE;
BEGIN
    WHILE NOT done LOOP
        -- Generate w + 12 random digits
        new_id := 'w' || LPAD(FLOOR(RANDOM() * 1000000000000)::TEXT, 12, '0');
        
        -- Check if this ID already exists
        IF NOT EXISTS (SELECT 1 FROM workspaces WHERE workspace_id = new_id) THEN
            done := TRUE;
        END IF;
    END LOOP;
    
    RETURN new_id;
END;
$$;


ALTER FUNCTION "public"."generate_workspace_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_blocks_count"("p_workspace_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.task_blocks
    WHERE workspace_id = p_workspace_id
      AND unblocked_at IS NULL
  );
END;
$$;


ALTER FUNCTION "public"."get_active_blocks_count"("p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_predefined_statuses"("p_workspace_id" "uuid", "p_space_id" "uuid") RETURNS TABLE("id" "uuid", "status_id" "text", "name" "text", "color" "text", "position" integer, "status_type_id" "uuid", "is_default" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_status_type_not_started UUID;
  v_status_type_active UUID;
  v_status_type_testing UUID;
  v_status_type_blocked UUID;
  v_status_type_done UUID;
  v_existing_count INTEGER;
BEGIN
  -- Get status type IDs (with table alias to avoid ambiguity)
  SELECT st.id INTO v_status_type_not_started FROM status_types st WHERE st.name = 'not-started';
  SELECT st.id INTO v_status_type_active FROM status_types st WHERE st.name = 'active';
  SELECT st.id INTO v_status_type_testing FROM status_types st WHERE st.name = 'testing';
  SELECT st.id INTO v_status_type_blocked FROM status_types st WHERE st.name = 'blocked';
  SELECT st.id INTO v_status_type_done FROM status_types st WHERE st.name = 'done';

  -- Check if statuses already exist for this space
  SELECT COUNT(*) INTO v_existing_count
  FROM statuses
  WHERE space_id = p_space_id
    AND deleted_at IS NULL;

  -- If statuses exist, return them
  IF v_existing_count > 0 THEN
    RETURN QUERY
    SELECT 
      s.id,
      s.status_id::TEXT,
      s.name::TEXT,
      s.color::TEXT,
      s.position,
      s.status_type_id,
      s.is_default
    FROM statuses s
    WHERE s.space_id = p_space_id
      AND s.deleted_at IS NULL
    ORDER BY s.position;
    RETURN;
  END IF;

  -- Create predefined statuses
  INSERT INTO statuses (
    name,
    color,
    position,
    workspace_id,
    space_id,
    type,
    status_type_id,
    is_default
  )
  VALUES
    ('Backlog', 'gray', 0, p_workspace_id, p_space_id, 'space', v_status_type_not_started, true),
    ('To Do', 'blue', 1, p_workspace_id, p_space_id, 'space', v_status_type_not_started, false),
    ('In Progress', 'yellow', 2, p_workspace_id, p_space_id, 'space', v_status_type_active, false),
    ('In Review', 'purple', 3, p_workspace_id, p_space_id, 'space', v_status_type_testing, false),
    ('Blocked', 'red', 4, p_workspace_id, p_space_id, 'space', v_status_type_blocked, false),
    ('Done', 'green', 5, p_workspace_id, p_space_id, 'space', v_status_type_done, false);

  -- Return the created statuses
  RETURN QUERY
  SELECT 
    s.id,
    s.status_id::TEXT,
    s.name::TEXT,
    s.color::TEXT,
    s.position,
    s.status_type_id,
    s.is_default
  FROM statuses s
  WHERE s.space_id = p_space_id
    AND s.deleted_at IS NULL
  ORDER BY s.position;
END;
$$;


ALTER FUNCTION "public"."get_or_create_predefined_statuses"("p_workspace_id" "uuid", "p_space_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_project_view_data"("p_project_id" "uuid", "p_workspace_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'project', (
      SELECT row_to_json(p)
      FROM projects p 
      WHERE p.id = p_project_id
    ),
    'tasks', (
      SELECT COALESCE(json_agg(t), '[]'::json)
      FROM tasks t 
      WHERE t.project_id = p_project_id 
        AND t.workspace_id = p_workspace_id
        AND t.deleted_at IS NULL
    ),
    'statuses', (
      SELECT COALESCE(json_agg(s), '[]'::json)
      FROM statuses s 
      WHERE s.project_id = p_project_id
        AND s.workspace_id = p_workspace_id
        AND s.deleted_at IS NULL
    ),
    'sprints', (
      SELECT COALESCE(json_agg(sp), '[]'::json)
      FROM sprints sp 
      WHERE sp.workspace_id = p_workspace_id
        AND sp.deleted_at IS NULL
      ORDER BY sp.start_date DESC
    )
  ) INTO result;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_project_view_data"("p_project_id" "uuid", "p_workspace_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_project_view_data"("p_project_id" "uuid", "p_workspace_id" "uuid") IS 'Consolidates project view queries into single RPC call';



CREATE OR REPLACE FUNCTION "public"."get_sprint_view_data"("p_sprint_id" "uuid", "p_workspace_id" "uuid") RETURNS TABLE("tasks" "jsonb", "statuses" "jsonb", "team_members" "jsonb", "sprint" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_sprint_id UUID := p_sprint_id;
  v_workspace_id UUID := p_workspace_id;
BEGIN
  RETURN QUERY
  SELECT
    -- Tasks for this sprint
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'task_id', t.task_id,
          'name', t.name,
          'description', t.description,
          'status_id', t.status_id,
          'priority', t.priority,
          'assignee_id', t.assignee_id,
          'estimated_hours', t.estimated_hours,
          'story_points', t.story_points,
          'created_at', t.created_at,
          'updated_at', t.updated_at
        ) ORDER BY t.created_at DESC
      )
      FROM tasks t
      WHERE t.sprint_id = v_sprint_id
        AND t.deleted_at IS NULL),
      '[]'::JSONB
    ) AS tasks,
    -- Statuses for the workspace
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'status_id', s.status_id,
          'name', s.name,
          'type', s.type,
          'color', s.color,
          'position', s.position
        ) ORDER BY s.position ASC
      )
      FROM statuses s
      WHERE s.workspace_id = v_workspace_id
        AND s.deleted_at IS NULL),
      '[]'::JSONB
    ) AS statuses,
    -- Team members: single-user OSS, return owner-as-only-member
    COALESCE(
      (SELECT jsonb_build_array(
        jsonb_build_object(
          'id', w.owner_id,
          'user_id', w.owner_id,
          'workspace_id', w.id,
          'role', 'owner',
          'email', u.email,
          'full_name', COALESCE(p.full_name, u.email),
          'avatar_url', p.avatar_url
        )
      )
      FROM workspaces w
      JOIN auth.users u ON u.id = w.owner_id
      LEFT JOIN profiles p ON p.id = w.owner_id
      WHERE w.id = v_workspace_id),
      '[]'::JSONB
    ) AS team_members,
    -- Sprint details
    COALESCE(
      (SELECT jsonb_build_object(
        'id', sp.id,
        'sprint_id', sp.sprint_id,
        'name', sp.name,
        'goal', sp.goal,
        'start_date', sp.start_date,
        'end_date', sp.end_date,
        'status', sp.status,
        'space_id', sp.space_id,
        'sprint_folder_id', sp.sprint_folder_id,
        'created_at', sp.created_at,
        'updated_at', sp.updated_at
      )
      FROM sprints sp
      WHERE sp.id = v_sprint_id),
      'null'::JSONB
    ) AS sprint;
END;
$$;


ALTER FUNCTION "public"."get_sprint_view_data"("p_sprint_id" "uuid", "p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_workspace_analytics"("p_workspace_id" "uuid", "p_days_back" integer DEFAULT 30) RETURNS TABLE("total_tasks" bigint, "completed_tasks" bigint, "active_sprints" bigint, "team_members_count" bigint, "recent_activity" bigint, "completion_rate" numeric, "average_story_points" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_workspace_id UUID := p_workspace_id;
  v_days_back INT := p_days_back;
  v_cutoff_date TIMESTAMP := NOW() - (v_days_back || ' days')::INTERVAL;
BEGIN
  RETURN QUERY
  SELECT
    -- Total tasks in workspace
    COALESCE(
      (SELECT COUNT(*) FROM tasks t
       JOIN sprints sp ON t.sprint_id = sp.id
       WHERE sp.workspace_id = v_workspace_id AND t.deleted_at IS NULL),
      0
    )::BIGINT AS total_tasks,
    -- Completed tasks
    COALESCE(
      (SELECT COUNT(*) FROM tasks t
       JOIN sprints sp ON t.sprint_id = sp.id
       JOIN statuses s ON t.status_id = s.id
       WHERE sp.workspace_id = v_workspace_id
       AND s.type = 'done'
       AND t.deleted_at IS NULL),
      0
    )::BIGINT AS completed_tasks,
    -- Active sprints
    COALESCE(
      (SELECT COUNT(*) FROM sprints
       WHERE workspace_id = v_workspace_id
       AND status IN ('active', 'in_progress')
       AND deleted_at IS NULL),
      0
    )::BIGINT AS active_sprints,
    -- Team members count: single-user OSS = always 1 (the owner)
    1::BIGINT AS team_members_count,
    -- Recent activity (tasks updated in last N days)
    COALESCE(
      (SELECT COUNT(*) FROM tasks t
       JOIN sprints sp ON t.sprint_id = sp.id
       WHERE sp.workspace_id = v_workspace_id
       AND t.updated_at >= v_cutoff_date
       AND t.deleted_at IS NULL),
      0
    )::BIGINT AS recent_activity,
    -- Completion rate (percentage)
    CASE
      WHEN (SELECT COUNT(*) FROM tasks t
            JOIN sprints sp ON t.sprint_id = sp.id
            WHERE sp.workspace_id = v_workspace_id AND t.deleted_at IS NULL) = 0
      THEN 0
      ELSE ROUND(
        100.0 * (SELECT COUNT(*) FROM tasks t
                 JOIN sprints sp ON t.sprint_id = sp.id
                 JOIN statuses s ON t.status_id = s.id
                 WHERE sp.workspace_id = v_workspace_id
                 AND s.type = 'done'
                 AND t.deleted_at IS NULL) /
        (SELECT COUNT(*) FROM tasks t
         JOIN sprints sp ON t.sprint_id = sp.id
         WHERE sp.workspace_id = v_workspace_id AND t.deleted_at IS NULL),
        2
      )
    END::NUMERIC AS completion_rate,
    -- Average story points per task
    ROUND(
      COALESCE(
        (SELECT AVG(story_points) FROM tasks t
         JOIN sprints sp ON t.sprint_id = sp.id
         WHERE sp.workspace_id = v_workspace_id
         AND t.story_points IS NOT NULL
         AND t.deleted_at IS NULL),
        0
      )::NUMERIC,
      2
    ) AS average_story_points;
END;
$$;


ALTER FUNCTION "public"."get_workspace_analytics"("p_workspace_id" "uuid", "p_days_back" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision DEFAULT 0.65, "match_count" integer DEFAULT 10, "filter" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("id" "uuid", "similarity" double precision, "metadata" "jsonb")
    LANGUAGE "sql" STABLE
    SET "statement_timeout" TO '6s'
    AS $$
    SELECT
        sub.id,
        sub.similarity,
        sub.metadata
    FROM (
        SELECT
            tawos_user_stories.id,
            1 - (tawos_user_stories.embedding <=> query_embedding) AS similarity,
            tawos_user_stories.metadata
        FROM tawos_user_stories
        WHERE tawos_user_stories.embedding IS NOT NULL
        ORDER BY tawos_user_stories.embedding <=> query_embedding
        LIMIT match_count
    ) sub
    WHERE sub.similarity > match_threshold;
$$;


ALTER FUNCTION "public"."match_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."match_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") IS 'Vector similarity search for TAWOS user stories.
- Uses HNSW index for fast approximate nearest-neighbor search
- Subquery pattern ensures the index is used (ORDER BY + LIMIT in inner query)
- Threshold filtering applied post-index in outer query
- Has 6-second timeout (returns error 57014 on timeout)
- Expected performance: <500ms with valid HNSW index on 200K+ rows';



CREATE OR REPLACE FUNCTION "public"."populate_sprint_metrics_for_sprint"("p_sprint_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
  DECLARE
    v_workspace_id UUID;
    v_space_id UUID;
    v_planned_points INTEGER;
    v_completed_points INTEGER;
    v_total_stories INTEGER;
    v_completed_stories INTEGER;
    v_in_progress_stories INTEGER;
    v_pending_stories INTEGER;
    v_blocked_stories INTEGER;
    v_completion_rate NUMERIC;
    v_on_track BOOLEAN;
  BEGIN
    SELECT workspace_id, space_id INTO v_workspace_id, v_space_id
    FROM sprints WHERE id = p_sprint_id;

    IF v_workspace_id IS NULL THEN
      RETURN;
    END IF;

    IF v_space_id IS NULL THEN
      RAISE NOTICE 'Sprint % has no space_id, skipping metrics calculation', p_sprint_id;
      RETURN;
    END IF;

    SELECT
      COALESCE(SUM(t.story_points), 0),
      COALESCE(SUM(CASE WHEN sty.name = 'done' THEN t.story_points ELSE 0 END), 0),
      COUNT(*),
      COUNT(*) FILTER (WHERE sty.name = 'done'),
      COUNT(*) FILTER (WHERE sty.name IN ('active', 'testing')),
      COUNT(*) FILTER (WHERE sty.name = 'not-started' OR sty.name IS NULL),
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM task_blocks tb
        WHERE tb.task_id = t.id AND tb.unblocked_at IS NULL
      ))
    INTO
      v_planned_points,
      v_completed_points,
      v_total_stories,
      v_completed_stories,
      v_in_progress_stories,
      v_pending_stories,
      v_blocked_stories
    FROM tasks t
    LEFT JOIN statuses st ON t.status_id = st.id
    LEFT JOIN status_types sty ON st.status_type_id = sty.id
    WHERE t.sprint_id = p_sprint_id
      AND t.deleted_at IS NULL;

    v_completion_rate := CASE
      WHEN v_total_stories > 0 THEN (v_completed_stories::NUMERIC / v_total_stories) * 100
      ELSE 0
    END;

    v_on_track := COALESCE((v_completed_stories::NUMERIC / NULLIF(v_total_stories, 0)) >= 0.7, false);

    INSERT INTO sprint_metrics (
      sprint_id, workspace_id, space_id,
      planned_points, completed_points, velocity,
      total_stories, completed_stories, in_progress_stories,
      pending_stories, blocked_stories,
      completion_rate, on_track, variance_points,
      calculated_at, created_at, updated_at
    ) VALUES (
      p_sprint_id, v_workspace_id, v_space_id,
      v_planned_points, v_completed_points, v_completed_points,
      v_total_stories, v_completed_stories, v_in_progress_stories,
      v_pending_stories, v_blocked_stories,
      v_completion_rate, v_on_track, v_completed_points - v_planned_points,
      NOW(), NOW(), NOW()
    )
    ON CONFLICT (sprint_id) DO UPDATE SET
      planned_points = EXCLUDED.planned_points,
      completed_points = EXCLUDED.completed_points,
      velocity = EXCLUDED.velocity,
      total_stories = EXCLUDED.total_stories,
      completed_stories = EXCLUDED.completed_stories,
      in_progress_stories = EXCLUDED.in_progress_stories,
      pending_stories = EXCLUDED.pending_stories,
      blocked_stories = EXCLUDED.blocked_stories,
      completion_rate = EXCLUDED.completion_rate,
      on_track = EXCLUDED.on_track,
      variance_points = EXCLUDED.variance_points,
      calculated_at = NOW(),
      updated_at = NOW();

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to update sprint metrics for sprint %: %', p_sprint_id, SQLERRM;
  END;
  $$;


ALTER FUNCTION "public"."populate_sprint_metrics_for_sprint"("p_sprint_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."populate_sprint_metrics_for_sprint"("p_sprint_id" "uuid") IS 'Calculates and caches sprint metrics for a given sprint. Counts both done and closed status types as completed. Called automatically by triggers when tasks or sprints change.';



CREATE OR REPLACE FUNCTION "public"."record_task_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  from_status RECORD;
  to_status RECORD;
  time_in_prev_status BIGINT;
BEGIN
  -- Only process if status_id actually changed
  IF OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  -- Get from status details
  SELECT s.id, s.name, st.name as status_type
  INTO from_status
  FROM statuses s
  LEFT JOIN status_types st ON s.status_type_id = st.id
  WHERE s.id = OLD.status_id;

  -- Get to status details
  SELECT s.id, s.name, st.name as status_type
  INTO to_status
  FROM statuses s
  LEFT JOIN status_types st ON s.status_type_id = st.id
  WHERE s.id = NEW.status_id;

  -- Calculate time in previous status (milliseconds)
  SELECT EXTRACT(EPOCH FROM (NOW() - MAX(changed_at))) * 1000
  INTO time_in_prev_status
  FROM task_status_history
  WHERE task_id = NEW.id;

  -- If no previous history, use task created_at
  IF time_in_prev_status IS NULL THEN
    time_in_prev_status := EXTRACT(EPOCH FROM (NOW() - OLD.created_at)) * 1000;
  END IF;

  -- Insert the status change record
  INSERT INTO task_status_history (
    task_id,
    from_status_id,
    to_status_id,
    from_status_name,
    to_status_name,
    from_status_type,
    to_status_type,
    changed_by,
    changed_at,
    time_in_status_ms,
    workspace_id
  ) VALUES (
    NEW.id,
    OLD.status_id,
    NEW.status_id,
    from_status.name,
    to_status.name,
    from_status.status_type,
    to_status.status_type,
    NEW.updated_by,
    NOW(),
    time_in_prev_status,
    NEW.workspace_id
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."record_task_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_ai_task_queue_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."set_ai_task_queue_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_project_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.project_id IS NULL THEN
      NEW.project_id := generate_project_id();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_project_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_space_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.space_id IS NULL THEN
      NEW.space_id := generate_space_id();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_space_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_task_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.task_id IS NULL THEN
      NEW.task_id := generate_task_id();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_task_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_workspace_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF NEW.workspace_id IS NULL THEN
        NEW.workspace_id := generate_workspace_id();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_workspace_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."setup_new_workspace"("owner_id_param" "uuid", "workspace_id_param" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_space_id UUID;
BEGIN
  INSERT INTO spaces (name, workspace_id, created_at, updated_at)
  VALUES ('General', workspace_id_param, NOW(), NOW())
  RETURNING id INTO v_space_id;

  INSERT INTO projects (name, space_id, workspace_id, type, created_at, updated_at)
  VALUES ('Getting Started', v_space_id, workspace_id_param, 'default', NOW(), NOW());

  INSERT INTO statuses (space_id, name, color, position, created_at, updated_at)
  VALUES
    (v_space_id, 'Backlog',     'gray',   0, NOW(), NOW()),
    (v_space_id, 'To Do',       'cyan',   1, NOW(), NOW()),
    (v_space_id, 'In Progress', 'blue',   2, NOW(), NOW()),
    (v_space_id, 'Review',      'purple', 3, NOW(), NOW()),
    (v_space_id, 'Done',        'green',  4, NOW(), NOW());

  INSERT INTO tags (workspace_id, name, color, created_at, updated_at)
  VALUES
    (workspace_id_param, 'Bug',             'red',    NOW(), NOW()),
    (workspace_id_param, 'Feature',         'blue',   NOW(), NOW()),
    (workspace_id_param, 'Enhancement',     'purple', NOW(), NOW()),
    (workspace_id_param, 'Documentation',   'gray',   NOW(), NOW()),
    (workspace_id_param, 'Critical',        'red',    NOW(), NOW()),
    (workspace_id_param, 'High Priority',   'orange', NOW(), NOW()),
    (workspace_id_param, 'Medium Priority', 'yellow', NOW(), NOW()),
    (workspace_id_param, 'Low Priority',    'green',  NOW(), NOW()),
    (workspace_id_param, 'Blocked',         'red',    NOW(), NOW()),
    (workspace_id_param, 'In Review',       'blue',   NOW(), NOW()),
    (workspace_id_param, 'QA',              'purple', NOW(), NOW()),
    (workspace_id_param, 'Deployed',        'green',  NOW(), NOW()),
    (workspace_id_param, 'Mobile',          'cyan',   NOW(), NOW()),
    (workspace_id_param, 'Web',             'blue',   NOW(), NOW()),
    (workspace_id_param, 'API',             'indigo', NOW(), NOW()),
    (workspace_id_param, 'UX',              'pink',   NOW(), NOW());
END;
$$;


ALTER FUNCTION "public"."setup_new_workspace"("owner_id_param" "uuid", "workspace_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."task_has_acceptance_criteria"("p_task_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(array_length(acceptance_criteria, 1), 0) > 0
  FROM public.tasks
  WHERE id = p_task_id;
$$;


ALTER FUNCTION "public"."task_has_acceptance_criteria"("p_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_sprint_metrics_on_sprint_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Recalculate metrics when sprint is marked as completed or when it changes
  IF TG_OP = 'UPDATE' AND (NEW.status != OLD.status OR NEW.end_date != OLD.end_date) THEN
    PERFORM populate_sprint_metrics_for_sprint(NEW.id);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM populate_sprint_metrics_for_sprint(NEW.id);
  END IF;
 
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Sprint metrics update on sprint change failed: %', SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_update_sprint_metrics_on_sprint_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_sprint_metrics_on_task_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_sprint_id UUID;
BEGIN
  -- Determine which sprint(s) to update
  IF TG_OP = 'DELETE' THEN
    v_sprint_id := OLD.sprint_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update both old and new sprint if sprint changed
    IF OLD.sprint_id IS NOT NULL AND OLD.sprint_id != COALESCE(NEW.sprint_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      PERFORM populate_sprint_metrics_for_sprint(OLD.sprint_id);
    END IF;
    v_sprint_id := NEW.sprint_id;
  ELSE -- INSERT
    v_sprint_id := NEW.sprint_id;
  END IF;
 
  -- Update the sprint metrics if sprint_id exists
  IF v_sprint_id IS NOT NULL THEN
    PERFORM populate_sprint_metrics_for_sprint(v_sprint_id);
  END IF;
 
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Log but don't fail the task update
  RAISE WARNING 'Sprint metrics update failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."trigger_update_sprint_metrics_on_task_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."try_requeue_task"("p_task_id" "uuid", "p_max_requeues" integer DEFAULT 2) RETURNS TABLE("requeued" boolean, "new_count" integer)
    LANGUAGE "sql"
    AS $$
    UPDATE public.ai_task_queue
    SET rl_requeue_count = rl_requeue_count + 1,
        status = CASE
          WHEN rl_requeue_count + 1 >= p_max_requeues THEN 'failed'
          ELSE 'queued'
        END,
        error_code = CASE
          WHEN rl_requeue_count + 1 >= p_max_requeues THEN 'RATE_LIMITED_EXHAUSTED'
          ELSE error_code
        END,
        error_message = CASE
          WHEN rl_requeue_count + 1 >= p_max_requeues
          THEN 'Rate limit exhausted after ' || (rl_requeue_count + 1) || ' requeues'
          ELSE error_message
        END,
        failed_at = CASE
          WHEN rl_requeue_count + 1 >= p_max_requeues THEN NOW()
          ELSE failed_at
        END
    WHERE id = p_task_id AND status IN ('queued', 'running')
    RETURNING (rl_requeue_count < p_max_requeues) AS requeued, rl_requeue_count AS new_count;
  $$;


ALTER FUNCTION "public"."try_requeue_task"("p_task_id" "uuid", "p_max_requeues" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ai_sprint_metrics"("p_sprint_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  DECLARE
    v_workspace_id uuid;
    v_space_id uuid;
  BEGIN
    SELECT workspace_id, space_id INTO v_workspace_id, v_space_id
    FROM sprints
    WHERE id = p_sprint_id;

    IF v_workspace_id IS NULL THEN
      RETURN;
    END IF;

    INSERT INTO sprint_metrics (sprint_id, workspace_id, space_id)
    VALUES (p_sprint_id, v_workspace_id, v_space_id)
    ON CONFLICT (sprint_id) DO NOTHING;

    UPDATE sprint_metrics
    SET
      ai_sessions_count = sub.sessions_count,
      ai_sessions_completed = sub.sessions_completed,
      ai_points_completed = sub.points_completed,
      ai_ac_met_rate = CASE
        WHEN sub.total_ac_total > 0
        THEN sub.total_ac_met::numeric / sub.total_ac_total
        ELSE NULL
      END,
      ai_bugs_detected = sub.total_bugs,
      ai_tech_debt_detected = sub.total_tech_debt,
      ai_avg_session_duration_ms = sub.avg_duration_ms,
      ai_quality_score = CASE
        WHEN sub.total_ac_total > 0 AND sub.sessions_count > 0
        THEN (
          (sub.total_ac_met::numeric / sub.total_ac_total) * 0.75
        ) + (
          (1 - LEAST(sub.total_bugs::numeric / NULLIF(sub.sessions_count, 0), 1)) * 0.25
        )
        ELSE NULL
      END,
      updated_at = now()
    FROM (
      SELECT
        COUNT(*) AS sessions_count,
        COUNT(*) FILTER (WHERE s.status = 'completed') AS sessions_completed,
        COALESCE(SUM(
          CASE WHEN s.status = 'completed' AND t.story_points IS NOT NULL
          THEN t.story_points ELSE 0 END
        ), 0) AS points_completed,
        COALESCE(SUM(s.ac_met), 0) AS total_ac_met,
        COALESCE(SUM(s.ac_total), 0) AS total_ac_total,
        COALESCE(SUM(s.bugs_detected), 0) AS total_bugs,
        COALESCE(SUM(s.tech_debt_detected), 0) AS total_tech_debt,
        AVG(
          EXTRACT(EPOCH FROM (s.completed_at - s.started_at)) * 1000
        )::bigint AS avg_duration_ms
      FROM claude_code_sessions s
      JOIN tasks t ON t.id = s.task_id
      WHERE t.sprint_id = p_sprint_id
        AND s.status IN ('completed', 'failed', 'stopped')
    ) sub
    WHERE sprint_metrics.sprint_id = p_sprint_id;
  END;
  $$;


ALTER FUNCTION "public"."update_ai_sprint_metrics"("p_sprint_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_mcp_auth_tokens_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_mcp_auth_tokens_updated_at"() OWNER TO "postgres";




CREATE OR REPLACE FUNCTION "public"."update_priorities_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_priorities_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_sprint_folders_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$

BEGIN

    NEW.updated_at = now();

    RETURN NEW;

END;

$$;


ALTER FUNCTION "public"."update_sprint_folders_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_sprint_status_from_dates"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND (OLD.start_date IS DISTINCT FROM NEW.start_date OR OLD.end_date IS DISTINCT FROM NEW.end_date) THEN
        NEW.status := CASE
            WHEN NEW.end_date < CURRENT_DATE THEN 'completed'
            WHEN NEW.start_date <= CURRENT_DATE AND (NEW.end_date IS NULL OR NEW.end_date >= CURRENT_DATE) THEN 'active'
            ELSE 'planned'
        END;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_sprint_status_from_dates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_sprints_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$

BEGIN

    NEW.updated_at = now();

    RETURN NEW;

END;

$$;


ALTER FUNCTION "public"."update_sprints_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tawos_training_data_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tawos_training_data_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_task_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "error_code" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_task_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_task_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid",
    "provider" "text" NOT NULL,
    "model" "text" NOT NULL,
    "queue" "text" NOT NULL,
    "task_type" "text",
    "success" boolean NOT NULL,
    "input_tokens" integer DEFAULT 0 NOT NULL,
    "output_tokens" integer DEFAULT 0 NOT NULL,
    "cost_usd" numeric(10,6) DEFAULT 0 NOT NULL,
    "duration_ms" integer DEFAULT 0 NOT NULL,
    "error_code" "text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_task_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_task_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "queue" "text" DEFAULT 'fast'::"text" NOT NULL,
    "task_type" "text" NOT NULL,
    "source" "text" DEFAULT 'web'::"text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "qstash_message_id" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "result" "jsonb",
    "result_meta" "jsonb",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "rl_requeue_count" integer DEFAULT 0 NOT NULL,
    "error_code" "text",
    CONSTRAINT "ai_task_queue_queue_check" CHECK (("queue" = ANY (ARRAY['fast'::"text", 'heavy'::"text", 'embeddings'::"text"]))),
    CONSTRAINT "ai_task_queue_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'complete'::"text", 'failed'::"text", 'dead_lettered'::"text"])))
);


ALTER TABLE "public"."ai_task_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_usage_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "route" "text" NOT NULL,
    "ai_model" "text" DEFAULT ''::"text" NOT NULL,
    "input_tokens" integer DEFAULT 0 NOT NULL,
    "output_tokens" integer DEFAULT 0 NOT NULL,
    "total_tokens" integer DEFAULT 0 NOT NULL,
    "cost_usd" numeric(10,6) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_usage_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."claude_code_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "issue_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "severity" "text",
    "file_path" "text",
    "line_number" integer,
    "suggested_points" integer,
    "subtask_id" "uuid",
    "status" "text" DEFAULT 'detected'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "claude_code_issues_issue_type_check" CHECK (("issue_type" = ANY (ARRAY['bug'::"text", 'tech_debt'::"text", 'followup'::"text"]))),
    CONSTRAINT "claude_code_issues_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "claude_code_issues_status_check" CHECK (("status" = ANY (ARRAY['detected'::"text", 'subtask_created'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."claude_code_issues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."claude_code_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "session_token" "text" NOT NULL,
    "task_context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error_message" "text",
    "last_heartbeat_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "heartbeat_sequence" integer DEFAULT 0,
    "session_metrics" "jsonb",
    "conflict_detected" boolean DEFAULT false NOT NULL,
    "conflict_data" "jsonb",
    "conflict_resolved_at" timestamp with time zone,
    "conflict_resolution" "text",
    "is_late_arrival" boolean DEFAULT false NOT NULL,
    "task_snapshot_at_start" "jsonb",
    "completion_report" "jsonb",
    "developer_notes" "text",
    "proposed_status" "text",
    "ac_met" integer DEFAULT 0,
    "ac_total" integer DEFAULT 0,
    "bugs_detected" integer DEFAULT 0,
    "tech_debt_detected" integer DEFAULT 0,
    "subtasks_created" "uuid"[] DEFAULT '{}'::"uuid"[],
    "status_accepted" boolean,
    "late_arrival_reported_status" "text",
    "source" "text" DEFAULT 'claude_code'::"text" NOT NULL,
    "input_tokens" integer DEFAULT 0 NOT NULL,
    "output_tokens" integer DEFAULT 0 NOT NULL,
    "total_tokens" integer DEFAULT 0 NOT NULL,
    "cost_usd" numeric(10,4) DEFAULT 0 NOT NULL,
    CONSTRAINT "chk_conflict_resolution" CHECK ((("conflict_resolution" IS NULL) OR ("conflict_resolution" = ANY (ARRAY['keep_manual'::"text", 'apply_ai'::"text", 'field_level'::"text"])))),
    CONSTRAINT "claude_code_sessions_source_check" CHECK (("source" = ANY (ARRAY['claude_code'::"text", 'cursor'::"text"]))),
    CONSTRAINT "claude_code_sessions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'completed'::"text", 'failed'::"text", 'stopped'::"text"])))
);


ALTER TABLE "public"."claude_code_sessions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."claude_code_sessions"."late_arrival_reported_status" IS 'Status the CLI reported on a late-arriving completion, stored for audit trail.';



COMMENT ON COLUMN "public"."claude_code_sessions"."input_tokens" IS 'Total input tokens consumed by Claude during the session
  (includes cache reads).';



COMMENT ON COLUMN "public"."claude_code_sessions"."output_tokens" IS 'Total output tokens produced by Claude during the
  session.';



COMMENT ON COLUMN "public"."claude_code_sessions"."total_tokens" IS 'Sum of input + output tokens. Stored explicitly for query
   convenience.';



COMMENT ON COLUMN "public"."claude_code_sessions"."cost_usd" IS 'Estimated session cost in USD based on model-specific
  Claude pricing at time of write.';



CREATE TABLE IF NOT EXISTS "public"."cli_api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key_hash" "text" NOT NULL,
    "email" "text" NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL,
    "revoked" boolean DEFAULT false,
    "revoked_at" timestamp with time zone,
    "last_used_at" timestamp with time zone,
    "client_info" "jsonb"
);


ALTER TABLE "public"."cli_api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."days" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."days" OWNER TO "postgres";


COMMENT ON TABLE "public"."days" IS 'Reference table for days of the week, used for sprint start day configuration';



CREATE TABLE IF NOT EXISTS "public"."insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "insight_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "post_image" "text",
    "category" "text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "author" "text",
    "read_time" "text",
    "featured" boolean DEFAULT false,
    "published" boolean DEFAULT true,
    "post_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "links" "jsonb" DEFAULT '[]'::"jsonb",
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."insights" OWNER TO "postgres";


COMMENT ON TABLE "public"."insights" IS 'Blog posts, case studies, and knowledge base articles. Supports categorization, featured content, and published/draft states.';



CREATE TABLE IF NOT EXISTS "public"."mcp_auth_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "session_data" "jsonb",
    CONSTRAINT "mcp_auth_tokens_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text", 'active_session'::"text"])))
);


ALTER TABLE "public"."mcp_auth_tokens" OWNER TO "postgres";


COMMENT ON TABLE "public"."mcp_auth_tokens" IS 'Model Context Protocol authentication tokens for Claude Code integration. Tracks email verification and session states.';



CREATE TABLE IF NOT EXISTS "public"."personas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "persona_id" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tech_savviness" integer,
    "usage_frequency" character varying(20),
    "priority_level" character varying(20),
    "role" character varying(255),
    "domain" character varying(100),
    "tawos_patterns" "jsonb",
    "auto_detected" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "personas_priority_level_check" CHECK ((("priority_level")::"text" = ANY (ARRAY[('high'::character varying)::"text", ('medium'::character varying)::"text", ('low'::character varying)::"text"]))),
    CONSTRAINT "personas_tech_savviness_check" CHECK ((("tech_savviness" >= 1) AND ("tech_savviness" <= 5))),
    CONSTRAINT "personas_usage_frequency_check" CHECK ((("usage_frequency")::"text" = ANY (ARRAY[('daily'::character varying)::"text", ('weekly'::character varying)::"text", ('monthly'::character varying)::"text"])))
);


ALTER TABLE "public"."personas" OWNER TO "postgres";


COMMENT ON TABLE "public"."personas" IS 'User personas representing different user types with characteristics like tech savviness, usage frequency, and domain expertise for story generation.';



COMMENT ON COLUMN "public"."personas"."tech_savviness" IS 'Technical skill level from 1 (beginner) to 5 (expert)';



COMMENT ON COLUMN "public"."personas"."usage_frequency" IS 'How often the persona uses the system: daily, weekly, or monthly';



COMMENT ON COLUMN "public"."personas"."priority_level" IS 'Priority level for this persona: high, medium, or low';



COMMENT ON COLUMN "public"."personas"."role" IS 'Specific role of the persona (e.g., Data Scientist, Product Manager)';



COMMENT ON COLUMN "public"."personas"."domain" IS 'Industry domain (e.g., fintech, ecommerce, healthcare, enterprise)';



COMMENT ON COLUMN "public"."personas"."tawos_patterns" IS 'TAWOS success patterns and insights for this persona type';



COMMENT ON COLUMN "public"."personas"."auto_detected" IS 'Whether attributes were auto-detected from description';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone,
    "username" "text",
    "full_name" "text",
    "avatar_url" "text",
    "email" "text",
    "company" "text",
    "language" "text" DEFAULT 'English'::"text",
    "start_of_week" "text" DEFAULT 'Sunday'::"text",
    "time_format" "text" DEFAULT '12-hour'::"text",
    "date_format" "text" DEFAULT 'mm/dd/yyyy'::"text",
    "timezone" "uuid" DEFAULT '1ef20f1f-ac58-4e40-bb45-ade56cecfee2'::"uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'User profiles synced with auth.users via trigger. Single-user OSS: stores user identity and preferences only.';



COMMENT ON COLUMN "public"."profiles"."company" IS 'User company/organization name';



COMMENT ON COLUMN "public"."profiles"."created_at" IS 'Timestamp when the profile was created';



CREATE TABLE IF NOT EXISTS "public"."project_personas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "persona_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."project_personas" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_personas" IS 'Junction table linking personas to projects for targeted story generation';



COMMENT ON COLUMN "public"."project_personas"."project_id" IS 'Reference to the project';



COMMENT ON COLUMN "public"."project_personas"."persona_id" IS 'Reference to the persona';



COMMENT ON COLUMN "public"."project_personas"."created_by" IS 'User who created this association';



CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "text" DEFAULT ('proj_'::"text" || "substr"(("gen_random_uuid"())::"text", 1, 8)) NOT NULL,
    "name" "text" NOT NULL,
    "space_id" "uuid",
    "workspace_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "type" character varying(50) DEFAULT 'default'::character varying,
    "external_id" character varying(255),
    "external_data" "jsonb",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "projects_project_id_format" CHECK (("project_id" ~ '^proj_[a-f0-9]{8}$'::"text"))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


COMMENT ON TABLE "public"."projects" IS 'Organizational containers within spaces for grouping related tasks. Can be synced with external tools like Jira.';



CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "identifier" character varying(255) NOT NULL,
    "action_type" character varying(100) NOT NULL,
    "attempt_count" integer DEFAULT 1,
    "window_start" timestamp with time zone NOT NULL,
    "window_end" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "actor_id" "uuid",
    "workspace_id" "uuid",
    "resource_type" "text",
    "resource_id" "text",
    "action" "text" NOT NULL,
    "status" "text" DEFAULT 'success'::"text" NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."security_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_id" "text" DEFAULT ('sp_'::"text" || "substr"(("gen_random_uuid"())::"text", 1, 8)) NOT NULL,
    "name" "text" NOT NULL,
    "workspace_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "icon" "text" DEFAULT 'blue'::"text",
    "is_private" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "risk_level" character varying,
    "portfolio_status" character varying DEFAULT 'planning'::character varying,
    "color" character varying DEFAULT 'blue'::character varying,
    "progress" numeric DEFAULT 0,
    "due_date" timestamp with time zone,
    "portfolio_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "spaces_portfolio_status_check" CHECK ((("portfolio_status")::"text" = ANY (ARRAY[('active'::character varying)::"text", ('planning'::character varying)::"text", ('on-hold'::character varying)::"text", ('completed'::character varying)::"text"]))),
    CONSTRAINT "spaces_progress_check" CHECK ((("progress" >= (0)::numeric) AND ("progress" <= (100)::numeric))),
    CONSTRAINT "spaces_risk_level_check" CHECK ((("risk_level")::"text" = ANY (ARRAY[('low'::character varying)::"text", ('medium'::character varying)::"text", ('high'::character varying)::"text"]))),
    CONSTRAINT "spaces_space_id_format" CHECK (("space_id" ~ '^sp_[a-f0-9]{8}$'::"text"))
);


ALTER TABLE "public"."spaces" OWNER TO "postgres";


COMMENT ON TABLE "public"."spaces" IS 'Projects or product areas within a workspace. Can be portfolios, products, or initiatives with their own teams and sprint cadences.';



COMMENT ON COLUMN "public"."spaces"."risk_level" IS 'Portfolio item risk level';



COMMENT ON COLUMN "public"."spaces"."portfolio_status" IS 'Portfolio item status (active, planning, on-hold, completed)';



COMMENT ON COLUMN "public"."spaces"."progress" IS 'Portfolio completion percentage (0-100)';



CREATE TABLE IF NOT EXISTS "public"."sprint_folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sprint_folder_id" "text" DEFAULT ('sf_'::"text" || "substr"(("gen_random_uuid"())::"text", 1, 8)) NOT NULL,
    "name" "text" NOT NULL,
    "sprint_start_day_id" "uuid",
    "duration_week" integer DEFAULT 2 NOT NULL,
    "space_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "project_id" "uuid",
    CONSTRAINT "sprint_folders_id_format" CHECK (("sprint_folder_id" ~ '^sf_[a-f0-9]{8}$'::"text"))
);


ALTER TABLE "public"."sprint_folders" OWNER TO "postgres";


COMMENT ON TABLE "public"."sprint_folders" IS 'Sprint folders organize sprints within a space, defining sprint cadence and start day';



COMMENT ON COLUMN "public"."sprint_folders"."project_id" IS 'The project this sprint folder belongs to. Establishes hierarchy: Space → Project → Sprint Folder → Sprint';



CREATE TABLE IF NOT EXISTS "public"."sprint_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sprint_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "space_id" "uuid" NOT NULL,
    "planned_points" integer DEFAULT 0,
    "completed_points" integer DEFAULT 0,
    "velocity" integer DEFAULT 0,
    "total_stories" integer DEFAULT 0,
    "completed_stories" integer DEFAULT 0,
    "in_progress_stories" integer DEFAULT 0,
    "pending_stories" integer DEFAULT 0,
    "blocked_stories" integer DEFAULT 0,
    "avg_cycle_time_ms" bigint,
    "avg_lead_time_ms" bigint,
    "total_time_tracked_ms" bigint,
    "on_track" boolean,
    "variance_points" integer,
    "completion_rate" numeric(5,2),
    "burndown_data" "jsonb" DEFAULT '[]'::"jsonb",
    "team_size" integer,
    "team_member_ids" "uuid"[],
    "calculated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ai_sessions_count" integer DEFAULT 0,
    "ai_sessions_completed" integer DEFAULT 0,
    "ai_points_completed" integer DEFAULT 0,
    "ai_ac_met_rate" numeric,
    "ai_bugs_detected" integer DEFAULT 0,
    "ai_tech_debt_detected" integer DEFAULT 0,
    "ai_quality_score" numeric,
    "ai_avg_session_duration_ms" bigint
);


ALTER TABLE "public"."sprint_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."sprint_metrics" IS 'Cached sprint metrics for analytics dashboard performance';



CREATE TABLE IF NOT EXISTS "public"."sprints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sprint_id" "text" DEFAULT ('s_'::"text" || "substr"(("gen_random_uuid"())::"text", 1, 8)) NOT NULL,
    "name" "text" NOT NULL,
    "goal" "text",
    "task_id" "uuid",
    "start_date" "date",
    "end_date" "date",
    "sprint_folder_id" "uuid" NOT NULL,
    "space_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "duration" integer DEFAULT 0,
    "deleted_at" timestamp with time zone,
    "workspace_id" "uuid" NOT NULL,
    "status" character varying DEFAULT 'planned'::character varying,
    "project_id" "uuid",
    CONSTRAINT "sprints_sprint_id_format" CHECK (("sprint_id" ~ '^s_[a-f0-9]{8}$'::"text")),
    CONSTRAINT "sprints_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('planned'::character varying)::"text", ('active'::character varying)::"text", ('completed'::character varying)::"text"])))
);


ALTER TABLE "public"."sprints" OWNER TO "postgres";


COMMENT ON TABLE "public"."sprints" IS 'Sprints represent time-boxed iterations containing tasks from the backlog';



COMMENT ON COLUMN "public"."sprints"."duration" IS 'duration weeks';



COMMENT ON COLUMN "public"."sprints"."status" IS 'Sprint lifecycle: planned/active/completed';



CREATE TABLE IF NOT EXISTS "public"."status_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(50) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "description" "text"
);


ALTER TABLE "public"."status_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."status_types" IS 'Status categories (open, in_progress, closed) used to group similar statuses across different workflows.';



CREATE TABLE IF NOT EXISTS "public"."statuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status_id" character varying(20) DEFAULT ('st_'::"text" || "substr"(("gen_random_uuid"())::"text", 1, 8)) NOT NULL,
    "name" character varying(255) NOT NULL,
    "color" character varying(50) DEFAULT 'blue'::character varying,
    "position" integer DEFAULT 0,
    "workspace_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "type" character varying(20) DEFAULT 'workspace'::character varying,
    "project_id" "uuid",
    "space_id" "uuid",
    "sprint_id" "uuid",
    "status_type_id" "uuid",
    "deleted_at" timestamp with time zone,
    "is_default" boolean DEFAULT false,
    CONSTRAINT "statuses_scope_check" CHECK ((("workspace_id" IS NOT NULL) OR ("project_id" IS NOT NULL) OR ("space_id" IS NOT NULL) OR ("sprint_id" IS NOT NULL)))
);


ALTER TABLE "public"."statuses" OWNER TO "postgres";


COMMENT ON TABLE "public"."statuses" IS 'Custom workflow states (To Do, In Progress, Done, etc.) defined at workspace, space, project, or sprint level. Supports external integrations.';



COMMENT ON COLUMN "public"."statuses"."is_default" IS 'Indicates if this is the default status for new tasks (typically Backlog)';



CREATE TABLE IF NOT EXISTS "public"."story_generation_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" character varying(50) DEFAULT ('gen_'::"text" || "substr"(("gen_random_uuid"())::"text", 1, 8)) NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "feature_description" "text" NOT NULL,
    "user_role" "text",
    "user_want" "text",
    "user_benefit" "text",
    "number_of_stories" integer NOT NULL,
    "complexity" character varying NOT NULL,
    "team_members" "jsonb" DEFAULT '[]'::"jsonb",
    "selected_personas" "jsonb" DEFAULT '[]'::"jsonb",
    "anti_pattern_prevention" boolean DEFAULT true,
    "priority_weights" "jsonb" NOT NULL,
    "generated_story_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "generation_time_ms" integer,
    "status" character varying DEFAULT 'pending'::character varying,
    "error_message" "text",
    "ai_model" character varying(100) DEFAULT ''::character varying NOT NULL,
    "ai_tokens_used" integer DEFAULT 0 NOT NULL,
    "ai_cost_usd" numeric(10,6) DEFAULT 0 NOT NULL,
    "tawos_patterns_used" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "task_id" "uuid",
    "progress" integer DEFAULT 0 NOT NULL,
    "progress_message" "text",
    "generated_stories" "jsonb",
    "team_recommendation" "jsonb",
    CONSTRAINT "story_generation_sessions_complexity_check" CHECK ((("complexity")::"text" = ANY (ARRAY[('simple'::character varying)::"text", ('moderate'::character varying)::"text", ('complex'::character varying)::"text"]))),
    CONSTRAINT "story_generation_sessions_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('pending'::character varying)::"text", ('in_progress'::character varying)::"text", ('completed'::character varying)::"text", ('failed'::character varying)::"text"])))
);


ALTER TABLE "public"."story_generation_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."story_generation_sessions" IS 'Audit trail for AI story generation sessions';



CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tag_id" character varying(20) DEFAULT ('t'::"text" || "lpad"(("floor"(("random"() * ('1000000000000'::bigint)::double precision)))::"text", 12, '0'::"text")) NOT NULL,
    "name" character varying(255) NOT NULL,
    "color" character varying(50) DEFAULT 'blue'::character varying,
    "workspace_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "canonical_tag_id" "uuid",
    "aliases" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "tags_canonical_not_self" CHECK ((("canonical_tag_id" IS NULL) OR ("canonical_tag_id" <> "id")))
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


COMMENT ON TABLE "public"."tags" IS 'Workspace-scoped labels for categorizing tasks (bug, feature, urgent, etc.). Supports custom colors for visual organization.';



CREATE TABLE IF NOT EXISTS "public"."task_ai_metadata" (
    "task_id" "uuid" NOT NULL,
    "ai_generation_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "generation_session_id" "uuid",
    "ai_priority_applied" boolean DEFAULT false NOT NULL,
    "ai_priority_applied_at" timestamp with time zone,
    "ai_priority_confidence" numeric,
    "ai_priority_reasoning" "text",
    "ai_assigned" boolean DEFAULT false NOT NULL,
    "ai_assignment_confidence" integer,
    "ai_assignment_reasoning" "text",
    "ai_assignment_date" timestamp with time zone,
    "embedding" "extensions"."vector",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."task_ai_metadata" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "blocked_at" timestamp with time zone DEFAULT "now"(),
    "unblocked_at" timestamp with time zone,
    "duration_ms" bigint GENERATED ALWAYS AS (
CASE
    WHEN ("unblocked_at" IS NOT NULL) THEN (EXTRACT(epoch FROM ("unblocked_at" - "blocked_at")) * (1000)::numeric)
    ELSE NULL::numeric
END) STORED,
    "reason" "text" NOT NULL,
    "blocker_type" character varying,
    "blocker_details" "jsonb" DEFAULT '{}'::"jsonb",
    "impact_level" character varying,
    "affects_sprint" boolean DEFAULT false,
    "resolution" "text",
    "resolved_by" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "task_blocks_blocker_type_check" CHECK ((("blocker_type")::"text" = ANY (ARRAY[('dependency'::character varying)::"text", ('resource'::character varying)::"text", ('technical'::character varying)::"text", ('external'::character varying)::"text", ('approval'::character varying)::"text", ('information'::character varying)::"text", ('other'::character varying)::"text"]))),
    CONSTRAINT "task_blocks_impact_level_check" CHECK ((("impact_level")::"text" = ANY (ARRAY[('low'::character varying)::"text", ('medium'::character varying)::"text", ('high'::character varying)::"text", ('critical'::character varying)::"text"])))
);


ALTER TABLE "public"."task_blocks" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_blocks" IS 'Tracks blocked tasks for analytics and reporting';



CREATE TABLE IF NOT EXISTS "public"."task_dependencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_task_id" "uuid" NOT NULL,
    "target_task_id" "uuid" NOT NULL,
    "dependency_type" character varying(50) NOT NULL,
    "reason" "text",
    "confidence" integer,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "no_self_dependency" CHECK (("source_task_id" <> "target_task_id")),
    CONSTRAINT "task_dependencies_check" CHECK (("source_task_id" <> "target_task_id")),
    CONSTRAINT "task_dependencies_confidence_check" CHECK ((("confidence" IS NULL) OR (("confidence" >= 0) AND ("confidence" <= 100)))),
    CONSTRAINT "task_dependencies_dependency_type_check" CHECK ((("dependency_type")::"text" = ANY (ARRAY[('blocks'::character varying)::"text", ('is_blocked_by'::character varying)::"text", ('relates_to'::character varying)::"text"])))
);


ALTER TABLE "public"."task_dependencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_personas" (
    "task_id" "uuid" NOT NULL,
    "persona_id" "uuid" NOT NULL
);


ALTER TABLE "public"."task_personas" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_personas" IS 'Junction table mapping tasks to target personas (many-to-many).
When a task/user story targets specific user personas, entries are added here.
Used by story generation and persona-based prioritization.';



CREATE TABLE IF NOT EXISTS "public"."task_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "from_status_id" "uuid",
    "to_status_id" "uuid" NOT NULL,
    "from_status_name" character varying,
    "to_status_name" character varying,
    "from_status_type" character varying,
    "to_status_type" character varying,
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "time_in_status_ms" bigint,
    "workspace_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."task_status_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_status_history" IS 'Tracks all task status changes for cycle time and analytics';



CREATE TABLE IF NOT EXISTS "public"."task_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."task_tags" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_tags" IS 'Many-to-many relationship between tasks and tags. Enables flexible categorization and filtering of tasks.';



CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "text" DEFAULT ('t_'::"text" || "substr"(("gen_random_uuid"())::"text", 1, 8)) NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "priority" "text" DEFAULT 'medium'::"text",
    "assignee_id" "uuid",
    "project_id" "uuid",
    "space_id" "uuid",
    "workspace_id" "uuid",
    "due_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status_id" "uuid" NOT NULL,
    "start_date" timestamp with time zone,
    "parent_task_id" "uuid",
    "created_by" "uuid",
    "sprint_id" "uuid",
    "type" character varying(50) DEFAULT 'default'::character varying,
    "story_points" integer,
    "estimated_time" numeric(5,2),
    "business_value" integer,
    "velocity" numeric(5,2),
    "user_impact" integer,
    "complexity" integer,
    "risk" integer,
    "dependency_score" integer,
    "deleted_at" timestamp with time zone,
    "persona_id" "uuid",
    "generated_by_ai" boolean DEFAULT false,
    "updated_by" "uuid",
    "backlog_position" integer DEFAULT 0,
    "position" integer DEFAULT 0,
    "dependencies" integer,
    "acceptance_criteria" "text"[] DEFAULT '{}'::"text"[],
    "acceptance_criteria_met" boolean,
    "acceptance_criteria_met_at" timestamp with time zone,
    "executor_type" "text" DEFAULT 'human'::"text",
    "generation_session_id" "uuid",
    "ai_generation_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "tasks_executor_type_check" CHECK (("executor_type" = ANY (ARRAY['human'::"text", 'ai_agent'::"text", 'hybrid'::"text"]))),
    CONSTRAINT "tasks_priority_check" CHECK ((("priority" IS NULL) OR ("priority" = ANY (ARRAY['critical'::"text", 'high'::"text", 'medium'::"text", 'low'::"text", 'none'::"text"])))),
    CONSTRAINT "tasks_task_id_format" CHECK (("task_id" ~ '^t_[a-f0-9]{8}$'::"text"))
);

ALTER TABLE ONLY "public"."tasks" REPLICA IDENTITY FULL;


ALTER TABLE "public"."tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."tasks" IS 'Core task/story entity. Stores user stories, tasks, and issues with priority scoring, assignments, status tracking, and AI generation metadata.';



COMMENT ON COLUMN "public"."tasks"."dependency_score" IS 'Calculated dependency score for priority analysis (0-100)';



COMMENT ON COLUMN "public"."tasks"."generated_by_ai" IS 'True if task was generated by AI';



COMMENT ON COLUMN "public"."tasks"."updated_by" IS 'User who last updated the task';



COMMENT ON COLUMN "public"."tasks"."backlog_position" IS 'Position of task in the backlog for ordering';



COMMENT ON COLUMN "public"."tasks"."position" IS 'Position of task within its project/sprint for ordering';



COMMENT ON COLUMN "public"."tasks"."dependencies" IS 'Number of dependencies this task has (0-5 scale)';



COMMENT ON COLUMN "public"."tasks"."acceptance_criteria" IS 'Array of acceptance criteria strings for the task/story';



COMMENT ON COLUMN "public"."tasks"."acceptance_criteria_met" IS 'Whether all acceptance criteria were verified as met when task was completed (NULL=not evaluated, TRUE=met, FALSE=not met)';



COMMENT ON COLUMN "public"."tasks"."acceptance_criteria_met_at" IS 'Timestamp when acceptance criteria were verified';



COMMENT ON COLUMN "public"."tasks"."generation_session_id" IS 'Links task to AI generation session if AI-generated';



CREATE TABLE IF NOT EXISTS "public"."tawos_retrieval_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "query_text" "text" NOT NULL,
    "retrieval_tier" "text" NOT NULL,
    "threshold_used" real NOT NULL,
    "chunks_retrieved" integer DEFAULT 0 NOT NULL,
    "avg_similarity_score" real,
    "max_similarity_score" real,
    "min_similarity_score" real,
    "framework_categories" "jsonb" DEFAULT '{}'::"jsonb",
    "generation_success" boolean DEFAULT false,
    "latency_ms" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "uuid",
    CONSTRAINT "tawos_retrieval_logs_retrieval_tier_check" CHECK (("retrieval_tier" = ANY (ARRAY['success_patterns'::"text", 'story_templates'::"text", 'anti_patterns'::"text", 'combined'::"text"]))),
    CONSTRAINT "tawos_retrieval_logs_threshold_used_check" CHECK ((("threshold_used" >= (0)::double precision) AND ("threshold_used" <= (1)::double precision)))
);


ALTER TABLE "public"."tawos_retrieval_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."tawos_retrieval_logs" IS 'Stores individual TAWOS retrieval events for analytics and performance tracking';



COMMENT ON COLUMN "public"."tawos_retrieval_logs"."query_text" IS 'The original query text used for retrieval';



COMMENT ON COLUMN "public"."tawos_retrieval_logs"."retrieval_tier" IS 'The tier used for retrieval: success_patterns, story_templates, or anti_patterns';



COMMENT ON COLUMN "public"."tawos_retrieval_logs"."threshold_used" IS 'Similarity threshold used (0.60, 0.65, or 0.75)';



COMMENT ON COLUMN "public"."tawos_retrieval_logs"."chunks_retrieved" IS 'Number of chunks retrieved from the vector store';



COMMENT ON COLUMN "public"."tawos_retrieval_logs"."framework_categories" IS 'Distribution of categories returned (Auth, API, DB, UI, Security, etc.)';



COMMENT ON COLUMN "public"."tawos_retrieval_logs"."generation_success" IS 'Whether the subsequent story generation succeeded';



COMMENT ON COLUMN "public"."tawos_retrieval_logs"."latency_ms" IS 'Time taken for retrieval in milliseconds';



COMMENT ON COLUMN "public"."tawos_retrieval_logs"."session_id" IS 'Reference to the story generation session that triggered this retrieval';



CREATE TABLE IF NOT EXISTS "public"."tawos_training_failures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "training_run_id" "uuid" NOT NULL,
    "issue_key" "text" NOT NULL,
    "issue_title" "text",
    "error_message" "text" NOT NULL,
    "error_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tawos_training_failures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tawos_training_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "task_id" "uuid",
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "total_issues" integer DEFAULT 0 NOT NULL,
    "processed" integer DEFAULT 0 NOT NULL,
    "failed" integer DEFAULT 0 NOT NULL,
    "duplicate_in_file" integer DEFAULT 0 NOT NULL,
    "duplicate_in_db" integer DEFAULT 0 NOT NULL,
    "new_count" integer DEFAULT 0 NOT NULL,
    "progress_message" "text",
    "input_data" "jsonb",
    "result" "jsonb",
    "error_message" "text",
    "source" "text" DEFAULT 'upload'::"text" NOT NULL,
    "original_filename" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tawos_training_runs_source_check" CHECK (("source" = ANY (ARRAY['upload'::"text", 'retraining_cron'::"text"]))),
    CONSTRAINT "tawos_training_runs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."tawos_training_runs" OWNER TO "postgres";


-- Stores per-workspace TAWOS analysis output (patterns + insights jsonb).
-- Written by lib/tawos-training-service.ts and lib/tawos-training-worker.ts;
-- read by app/api/cron/tawos-retrain/route.ts to find workspaces with training data.
CREATE TABLE IF NOT EXISTS "public"."tawos_training_data" (
    "id" "uuid" PRIMARY KEY DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "patterns" "jsonb",
    "insights" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."tawos_training_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tawos_user_stories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "embedding" "extensions"."vector"(1536),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tawos_user_stories" OWNER TO "postgres";


COMMENT ON TABLE "public"."tawos_user_stories" IS 'OSS: shared training corpus, no per-user scoping. Single-user deploys only ΓÇö multi-tenant deploys would leak training data across owners.';



CREATE TABLE IF NOT EXISTS "public"."timezones" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "country" character varying(64) NOT NULL,
    "city" character varying(64) NOT NULL,
    "label" character varying(128) NOT NULL,
    "abbreviation" character varying(8) NOT NULL,
    "utc_offset" integer NOT NULL,
    "display_order" integer DEFAULT 0
);


ALTER TABLE "public"."timezones" OWNER TO "postgres";


COMMENT ON TABLE "public"."timezones" IS 'Global timezone reference data for user preferences and scheduling. Includes UTC offsets and display formatting.';



CREATE OR REPLACE VIEW "public"."user_activity" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "user_id",
    "p"."email",
    "p"."full_name" AS "name",
    "count"(DISTINCT "t"."id") AS "total_tasks",
    "count"(DISTINCT "sgs"."id") AS "total_story_sessions",
    "max"("t"."updated_at") AS "last_task_at",
    "max"("sgs"."created_at") AS "last_generation_at"
   FROM (("public"."profiles" "p"
     LEFT JOIN "public"."tasks" "t" ON (("t"."created_by" = "p"."id")))
     LEFT JOIN "public"."story_generation_sessions" "sgs" ON (("sgs"."user_id" = "p"."id")))
  GROUP BY "p"."id", "p"."email", "p"."full_name";


ALTER VIEW "public"."user_activity" OWNER TO "postgres";


COMMENT ON VIEW "public"."user_activity" IS 'Aggregated user activity metrics for engagement dashboards.';



CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "owner_id" "uuid" NOT NULL,
    "purpose" "text" NOT NULL,
    "type" "text" NOT NULL,
    "category" "text" NOT NULL,
    "workspace_id" "text" DEFAULT ('w_'::"text" || "substr"(("gen_random_uuid"())::"text", 1, 8)) NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "workspaces_workspace_id_format" CHECK (("workspace_id" ~ '^w_[a-f0-9]{8}$'::"text"))
);


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


COMMENT ON TABLE "public"."workspaces" IS 'Top-level organizational container. Each workspace represents a company or team using SprintIQ with isolated data, members, and billing.';



ALTER TABLE ONLY "public"."ai_task_events"
    ADD CONSTRAINT "ai_task_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_task_logs"
    ADD CONSTRAINT "ai_task_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_task_queue"
    ADD CONSTRAINT "ai_task_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_usage_log"
    ADD CONSTRAINT "ai_usage_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claude_code_issues"
    ADD CONSTRAINT "claude_code_issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claude_code_sessions"
    ADD CONSTRAINT "claude_code_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."claude_code_sessions"
    ADD CONSTRAINT "claude_code_sessions_session_token_key" UNIQUE ("session_token");



ALTER TABLE ONLY "public"."cli_api_keys"
    ADD CONSTRAINT "cli_api_keys_key_hash_key" UNIQUE ("key_hash");



ALTER TABLE ONLY "public"."cli_api_keys"
    ADD CONSTRAINT "cli_api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."days"
    ADD CONSTRAINT "days_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."days"
    ADD CONSTRAINT "days_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."insights"
    ADD CONSTRAINT "insights_insight_id_key" UNIQUE ("insight_id");



ALTER TABLE ONLY "public"."insights"
    ADD CONSTRAINT "insights_pkey" PRIMARY KEY ("id");









ALTER TABLE ONLY "public"."mcp_auth_tokens"
    ADD CONSTRAINT "mcp_auth_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mcp_auth_tokens"
    ADD CONSTRAINT "mcp_auth_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."personas"
    ADD CONSTRAINT "personas_persona_id_key" UNIQUE ("persona_id");



ALTER TABLE ONLY "public"."personas"
    ADD CONSTRAINT "personas_pkey" PRIMARY KEY ("id");









ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."project_personas"
    ADD CONSTRAINT "project_personas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_personas"
    ADD CONSTRAINT "project_personas_project_id_persona_id_key" UNIQUE ("project_id", "persona_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_project_id_key" UNIQUE ("project_id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id");






ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spaces"
    ADD CONSTRAINT "spaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spaces"
    ADD CONSTRAINT "spaces_space_id_key" UNIQUE ("space_id");



ALTER TABLE ONLY "public"."sprint_folders"
    ADD CONSTRAINT "sprint_folders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sprint_folders"
    ADD CONSTRAINT "sprint_folders_sprint_folder_id_key" UNIQUE ("sprint_folder_id");



ALTER TABLE ONLY "public"."sprint_metrics"
    ADD CONSTRAINT "sprint_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sprint_metrics"
    ADD CONSTRAINT "sprint_metrics_sprint_id_key" UNIQUE ("sprint_id");



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "sprints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "sprints_sprint_id_key" UNIQUE ("sprint_id");



ALTER TABLE ONLY "public"."status_types"
    ADD CONSTRAINT "status_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."status_types"
    ADD CONSTRAINT "status_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."statuses"
    ADD CONSTRAINT "statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."statuses"
    ADD CONSTRAINT "statuses_status_id_key" UNIQUE ("status_id");



ALTER TABLE ONLY "public"."story_generation_sessions"
    ADD CONSTRAINT "story_generation_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_generation_sessions"
    ADD CONSTRAINT "story_generation_sessions_session_id_key" UNIQUE ("session_id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_tag_id_key" UNIQUE ("tag_id");



ALTER TABLE ONLY "public"."task_ai_metadata"
    ADD CONSTRAINT "task_ai_metadata_pkey" PRIMARY KEY ("task_id");



ALTER TABLE ONLY "public"."task_blocks"
    ADD CONSTRAINT "task_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_source_task_id_target_task_id_dependency__key" UNIQUE ("source_task_id", "target_task_id", "dependency_type");



ALTER TABLE ONLY "public"."task_personas"
    ADD CONSTRAINT "task_personas_pkey" PRIMARY KEY ("task_id", "persona_id");



ALTER TABLE ONLY "public"."task_status_history"
    ADD CONSTRAINT "task_status_history_no_dup_transition" UNIQUE ("task_id", "from_status_id", "to_status_id", "changed_at");



ALTER TABLE ONLY "public"."task_status_history"
    ADD CONSTRAINT "task_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_tags"
    ADD CONSTRAINT "task_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_tags"
    ADD CONSTRAINT "task_tags_task_id_tag_id_key" UNIQUE ("task_id", "tag_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_task_id_key" UNIQUE ("task_id");



ALTER TABLE ONLY "public"."tawos_retrieval_logs"
    ADD CONSTRAINT "tawos_retrieval_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tawos_training_failures"
    ADD CONSTRAINT "tawos_training_failures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tawos_training_runs"
    ADD CONSTRAINT "tawos_training_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tawos_user_stories"
    ADD CONSTRAINT "tawos_user_stories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."timezones"
    ADD CONSTRAINT "timezones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_workspace_id_key" UNIQUE ("workspace_id");



CREATE INDEX "idx_ai_task_events_task_created" ON "public"."ai_task_events" USING "btree" ("task_id", "created_at" DESC);



CREATE INDEX "idx_ai_task_logs_provider_created" ON "public"."ai_task_logs" USING "btree" ("provider", "created_at" DESC);



CREATE INDEX "idx_ai_task_logs_task_id" ON "public"."ai_task_logs" USING "btree" ("task_id") WHERE ("task_id" IS NOT NULL);



CREATE INDEX "idx_ai_task_queue_qstash_message_id" ON "public"."ai_task_queue" USING "btree" ("qstash_message_id") WHERE ("qstash_message_id" IS NOT NULL);



CREATE INDEX "idx_ai_task_queue_status_active" ON "public"."ai_task_queue" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['queued'::"text", 'running'::"text"]));



CREATE INDEX "idx_ai_task_queue_workspace_created" ON "public"."ai_task_queue" USING "btree" ("workspace_id", "created_at" DESC);



CREATE INDEX "idx_ai_usage_log_created_at" ON "public"."ai_usage_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ai_usage_log_route" ON "public"."ai_usage_log" USING "btree" ("route");



CREATE INDEX "idx_ai_usage_log_workspace_id" ON "public"."ai_usage_log" USING "btree" ("workspace_id");



CREATE INDEX "idx_ccs_expires" ON "public"."claude_code_sessions" USING "btree" ("expires_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'active'::"text"]));



CREATE INDEX "idx_ccs_status" ON "public"."claude_code_sessions" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['pending'::"text", 'active'::"text"]));



CREATE INDEX "idx_ccs_task_id" ON "public"."claude_code_sessions" USING "btree" ("task_id");



CREATE INDEX "idx_ccs_user_id" ON "public"."claude_code_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_claude_code_issues_session" ON "public"."claude_code_issues" USING "btree" ("session_id");



CREATE INDEX "idx_claude_code_issues_task" ON "public"."claude_code_issues" USING "btree" ("task_id");



CREATE INDEX "idx_claude_code_issues_workspace" ON "public"."claude_code_issues" USING "btree" ("workspace_id");



CREATE INDEX "idx_claude_code_sessions_conflict" ON "public"."claude_code_sessions" USING "btree" ("conflict_detected") WHERE (("conflict_detected" = true) AND ("conflict_resolved_at" IS NULL));



CREATE INDEX "idx_claude_code_sessions_heartbeat" ON "public"."claude_code_sessions" USING "btree" ("status", "last_heartbeat_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'active'::"text"]));



CREATE INDEX "idx_claude_code_sessions_late_arrival" ON "public"."claude_code_sessions" USING "btree" ("is_late_arrival") WHERE ("is_late_arrival" = true);



CREATE INDEX "idx_claude_code_sessions_source_cursor" ON "public"."claude_code_sessions" USING "btree" ("source") WHERE ("source" = 'cursor'::"text");



CREATE INDEX "idx_claude_code_sessions_task_total_tokens" ON "public"."claude_code_sessions" USING "btree" ("task_id", "total_tokens") WHERE ("total_tokens" > 0);



CREATE INDEX "idx_cli_api_keys_email" ON "public"."cli_api_keys" USING "btree" ("email");



CREATE INDEX "idx_cli_api_keys_hash" ON "public"."cli_api_keys" USING "btree" ("key_hash") WHERE (NOT "revoked");



CREATE INDEX "idx_insights_category" ON "public"."insights" USING "btree" ("category");



CREATE INDEX "idx_insights_featured" ON "public"."insights" USING "btree" ("featured");



CREATE INDEX "idx_insights_post_date" ON "public"."insights" USING "btree" ("post_date");



CREATE INDEX "idx_insights_published" ON "public"."insights" USING "btree" ("published");



CREATE INDEX "idx_mcp_auth_tokens_email" ON "public"."mcp_auth_tokens" USING "btree" ("email");



CREATE INDEX "idx_mcp_auth_tokens_expires_at" ON "public"."mcp_auth_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_mcp_auth_tokens_session_data" ON "public"."mcp_auth_tokens" USING "gin" ("session_data");



CREATE INDEX "idx_mcp_auth_tokens_status" ON "public"."mcp_auth_tokens" USING "btree" ("status");



CREATE INDEX "idx_personas_created_by" ON "public"."personas" USING "btree" ("created_by");



CREATE INDEX "idx_personas_domain" ON "public"."personas" USING "btree" ("domain");



CREATE INDEX "idx_personas_persona_id" ON "public"."personas" USING "btree" ("persona_id");



CREATE INDEX "idx_personas_priority" ON "public"."personas" USING "btree" ("priority_level");



CREATE INDEX "idx_personas_role" ON "public"."personas" USING "btree" ("role");



CREATE INDEX "idx_personas_tech_savviness" ON "public"."personas" USING "btree" ("tech_savviness");



CREATE INDEX "idx_personas_workspace_created" ON "public"."personas" USING "btree" ("workspace_id", "created_at");



CREATE INDEX "idx_personas_workspace_id" ON "public"."personas" USING "btree" ("workspace_id");









CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_project_personas_persona_id" ON "public"."project_personas" USING "btree" ("persona_id");



CREATE INDEX "idx_project_personas_project_id" ON "public"."project_personas" USING "btree" ("project_id");



CREATE INDEX "idx_projects_external_id" ON "public"."projects" USING "btree" ("external_id");



CREATE INDEX "idx_projects_project_id" ON "public"."projects" USING "btree" ("project_id");



CREATE INDEX "idx_projects_space_id" ON "public"."projects" USING "btree" ("space_id");



CREATE INDEX "idx_projects_type" ON "public"."projects" USING "btree" ("type");



CREATE INDEX "idx_projects_workspace_created" ON "public"."projects" USING "btree" ("workspace_id", "created_at");



CREATE INDEX "idx_projects_workspace_id" ON "public"."projects" USING "btree" ("workspace_id");



CREATE INDEX "idx_rate_limits_identifier_action" ON "public"."rate_limits" USING "btree" ("identifier", "action_type");



CREATE INDEX "idx_rate_limits_window_end" ON "public"."rate_limits" USING "btree" ("window_end");
























CREATE INDEX "idx_security_audit_log_actor" ON "public"."security_audit_log" USING "btree" ("actor_id");



CREATE INDEX "idx_security_audit_log_created" ON "public"."security_audit_log" USING "btree" ("created_at");



CREATE INDEX "idx_security_audit_log_event" ON "public"."security_audit_log" USING "btree" ("event_type");



CREATE INDEX "idx_security_audit_log_workspace" ON "public"."security_audit_log" USING "btree" ("workspace_id");



CREATE INDEX "idx_sgs_task_id" ON "public"."story_generation_sessions" USING "btree" ("task_id") WHERE ("task_id" IS NOT NULL);



CREATE INDEX "idx_spaces_portfolio_status" ON "public"."spaces" USING "btree" ("portfolio_status") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_spaces_risk" ON "public"."spaces" USING "btree" ("risk_level") WHERE (("deleted_at" IS NULL) AND ("risk_level" IS NOT NULL));



CREATE INDEX "idx_spaces_space_id" ON "public"."spaces" USING "btree" ("space_id");



CREATE INDEX "idx_spaces_workspace_active" ON "public"."spaces" USING "btree" ("workspace_id", "portfolio_status") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_spaces_workspace_id" ON "public"."spaces" USING "btree" ("workspace_id");



CREATE INDEX "idx_spaces_workspace_private" ON "public"."spaces" USING "btree" ("workspace_id", "is_private") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_sprint_folders_deleted_at" ON "public"."sprint_folders" USING "btree" ("deleted_at");



CREATE INDEX "idx_sprint_folders_project_id" ON "public"."sprint_folders" USING "btree" ("project_id");



CREATE INDEX "idx_sprint_folders_space_id" ON "public"."sprint_folders" USING "btree" ("space_id");



CREATE INDEX "idx_sprint_folders_sprint_folder_id" ON "public"."sprint_folders" USING "btree" ("sprint_folder_id");



CREATE INDEX "idx_sprint_metrics_calculated" ON "public"."sprint_metrics" USING "btree" ("calculated_at" DESC);



CREATE INDEX "idx_sprint_metrics_space" ON "public"."sprint_metrics" USING "btree" ("space_id");



CREATE INDEX "idx_sprint_metrics_space_calculated" ON "public"."sprint_metrics" USING "btree" ("space_id", "calculated_at" DESC);



CREATE INDEX "idx_sprint_metrics_workspace" ON "public"."sprint_metrics" USING "btree" ("workspace_id", "calculated_at" DESC);



CREATE INDEX "idx_sprints_end_date" ON "public"."sprints" USING "btree" ("end_date");



CREATE INDEX "idx_sprints_project_id" ON "public"."sprints" USING "btree" ("project_id");



CREATE INDEX "idx_sprints_space_dates" ON "public"."sprints" USING "btree" ("space_id", "start_date", "end_date") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_sprints_sprint_folder_id" ON "public"."sprints" USING "btree" ("sprint_folder_id");



CREATE INDEX "idx_sprints_start_date" ON "public"."sprints" USING "btree" ("start_date" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_sprints_status" ON "public"."sprints" USING "btree" ("status") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_sprints_task_id" ON "public"."sprints" USING "btree" ("task_id");



CREATE INDEX "idx_sprints_workspace" ON "public"."sprints" USING "btree" ("workspace_id", "start_date" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_sprints_workspace_created" ON "public"."sprints" USING "btree" ("workspace_id", "created_at");



CREATE INDEX "idx_sprints_workspace_space" ON "public"."sprints" USING "btree" ("workspace_id", "space_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_sprints_workspace_status_dates" ON "public"."sprints" USING "btree" ("workspace_id", "status", "start_date", "end_date") WHERE ("deleted_at" IS NULL);



COMMENT ON INDEX "public"."idx_sprints_workspace_status_dates" IS 'Improves workspace sprint listing and filtering by status/date';



CREATE INDEX "idx_statuses_project_id" ON "public"."statuses" USING "btree" ("project_id");



CREATE INDEX "idx_statuses_space_id" ON "public"."statuses" USING "btree" ("space_id");



CREATE INDEX "idx_statuses_sprint_id" ON "public"."statuses" USING "btree" ("sprint_id");



CREATE INDEX "idx_statuses_status_type_id" ON "public"."statuses" USING "btree" ("status_type_id");



CREATE INDEX "idx_statuses_type" ON "public"."statuses" USING "btree" ("type");



CREATE INDEX "idx_statuses_workspace_project" ON "public"."statuses" USING "btree" ("workspace_id", "project_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_statuses_workspace_type" ON "public"."statuses" USING "btree" ("workspace_id", "type") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_story_gen_session_id" ON "public"."story_generation_sessions" USING "btree" ("session_id");



CREATE INDEX "idx_story_gen_status" ON "public"."story_generation_sessions" USING "btree" ("status") WHERE (("status")::"text" = ANY (ARRAY[('pending'::character varying)::"text", ('in_progress'::character varying)::"text"]));



CREATE INDEX "idx_story_gen_user" ON "public"."story_generation_sessions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_story_gen_workspace" ON "public"."story_generation_sessions" USING "btree" ("workspace_id", "created_at" DESC);



CREATE INDEX "idx_story_generation_workspace_status" ON "public"."story_generation_sessions" USING "btree" ("workspace_id", "status", "created_at" DESC);



CREATE INDEX "idx_tags_aliases" ON "public"."tags" USING "gin" ("aliases");



CREATE INDEX "idx_tags_canonical_tag_id" ON "public"."tags" USING "btree" ("canonical_tag_id") WHERE ("canonical_tag_id" IS NOT NULL);



CREATE INDEX "idx_tags_deleted_at" ON "public"."tags" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_task_ai_metadata_ai_assigned" ON "public"."task_ai_metadata" USING "btree" ("task_id") WHERE ("ai_assigned" = true);



CREATE INDEX "idx_task_ai_metadata_ai_priority" ON "public"."task_ai_metadata" USING "btree" ("task_id") WHERE ("ai_priority_applied" = true);



CREATE INDEX "idx_task_ai_metadata_generation_session" ON "public"."task_ai_metadata" USING "btree" ("generation_session_id") WHERE ("generation_session_id" IS NOT NULL);



CREATE INDEX "idx_task_blocks_active" ON "public"."task_blocks" USING "btree" ("task_id", "blocked_at" DESC) WHERE ("unblocked_at" IS NULL);



CREATE INDEX "idx_task_blocks_duration" ON "public"."task_blocks" USING "btree" ("duration_ms" DESC) WHERE ("duration_ms" IS NOT NULL);



CREATE INDEX "idx_task_blocks_type" ON "public"."task_blocks" USING "btree" ("blocker_type");



CREATE INDEX "idx_task_blocks_workspace" ON "public"."task_blocks" USING "btree" ("workspace_id", "blocked_at" DESC);



CREATE INDEX "idx_task_blocks_workspace_active" ON "public"."task_blocks" USING "btree" ("workspace_id", "blocked_at" DESC) WHERE ("unblocked_at" IS NULL);



CREATE INDEX "idx_task_dependencies_source" ON "public"."task_dependencies" USING "btree" ("source_task_id");



CREATE INDEX "idx_task_dependencies_target" ON "public"."task_dependencies" USING "btree" ("target_task_id");



CREATE INDEX "idx_task_personas_persona_id" ON "public"."task_personas" USING "btree" ("persona_id");



CREATE INDEX "idx_task_personas_task_id" ON "public"."task_personas" USING "btree" ("task_id");



CREATE INDEX "idx_task_status_history_changed_at" ON "public"."task_status_history" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_task_status_history_changed_by" ON "public"."task_status_history" USING "btree" ("changed_by") WHERE ("changed_by" IS NOT NULL);



CREATE INDEX "idx_task_status_history_status_type" ON "public"."task_status_history" USING "btree" ("to_status_type");



CREATE INDEX "idx_task_status_history_task" ON "public"."task_status_history" USING "btree" ("task_id", "changed_at" DESC);



CREATE INDEX "idx_task_status_history_to_status_type" ON "public"."task_status_history" USING "btree" ("to_status_type");



CREATE INDEX "idx_task_status_history_workspace" ON "public"."task_status_history" USING "btree" ("workspace_id", "changed_at" DESC);



CREATE INDEX "idx_task_tags_task" ON "public"."task_tags" USING "btree" ("task_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_tasks_assignee" ON "public"."tasks" USING "btree" ("assignee_id") WHERE (("deleted_at" IS NULL) AND ("assignee_id" IS NOT NULL));



CREATE INDEX "idx_tasks_backlog" ON "public"."tasks" USING "btree" ("workspace_id", "backlog_position") WHERE (("deleted_at" IS NULL) AND ("sprint_id" IS NULL) AND ("parent_task_id" IS NULL));



CREATE INDEX "idx_tasks_backlog_position" ON "public"."tasks" USING "btree" ("project_id", "backlog_position") WHERE (("deleted_at" IS NULL) AND ("sprint_id" IS NULL));



CREATE INDEX "idx_tasks_created_by_ai_generated" ON "public"."tasks" USING "btree" ("created_by", "created_at" DESC) WHERE (("generated_by_ai" = true) AND ("deleted_at" IS NULL));



CREATE INDEX "idx_tasks_dependency_score" ON "public"."tasks" USING "btree" ("workspace_id", "dependency_score") WHERE ("dependency_score" IS NOT NULL);



CREATE INDEX "idx_tasks_generation_session" ON "public"."tasks" USING "btree" ("generation_session_id") WHERE ("generation_session_id" IS NOT NULL);



CREATE INDEX "idx_tasks_parent_task_id" ON "public"."tasks" USING "btree" ("parent_task_id");



CREATE INDEX "idx_tasks_persona_id" ON "public"."tasks" USING "btree" ("persona_id") WHERE (("persona_id" IS NOT NULL) AND ("deleted_at" IS NULL));



CREATE INDEX "idx_tasks_position" ON "public"."tasks" USING "btree" ("project_id", "position") WHERE ("position" IS NOT NULL);



CREATE INDEX "idx_tasks_project_active" ON "public"."tasks" USING "btree" ("project_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_tasks_project_parent" ON "public"."tasks" USING "btree" ("project_id", "parent_task_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_tasks_project_status_active" ON "public"."tasks" USING "btree" ("project_id", "status_id") WHERE ("deleted_at" IS NULL);



COMMENT ON INDEX "public"."idx_tasks_project_status_active" IS 'Speeds up filtering tasks by project and status';



CREATE INDEX "idx_tasks_sprint_id" ON "public"."tasks" USING "btree" ("sprint_id");



CREATE INDEX "idx_tasks_sprint_status" ON "public"."tasks" USING "btree" ("sprint_id", "status_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_tasks_status" ON "public"."tasks" USING "btree" ("status_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_tasks_workspace_assignee" ON "public"."tasks" USING "btree" ("workspace_id", "assignee_id") WHERE (("deleted_at" IS NULL) AND ("assignee_id" IS NOT NULL));



CREATE INDEX "idx_tasks_workspace_created" ON "public"."tasks" USING "btree" ("workspace_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_tasks_workspace_created_ai_v2" ON "public"."tasks" USING "btree" ("workspace_id", "created_at") WHERE ("generated_by_ai" = true);



CREATE INDEX "idx_tasks_workspace_sprint" ON "public"."tasks" USING "btree" ("workspace_id", "sprint_id") WHERE (("deleted_at" IS NULL) AND ("sprint_id" IS NOT NULL));



COMMENT ON INDEX "public"."idx_tasks_workspace_sprint" IS 'Improves sprint view query performance';



CREATE INDEX "idx_tasks_workspace_status" ON "public"."tasks" USING "btree" ("workspace_id", "status_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_tawos_retrieval_logs_created_at" ON "public"."tawos_retrieval_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_tawos_retrieval_logs_retrieval_tier" ON "public"."tawos_retrieval_logs" USING "btree" ("retrieval_tier");



CREATE INDEX "idx_tawos_retrieval_logs_session_id" ON "public"."tawos_retrieval_logs" USING "btree" ("session_id");



CREATE INDEX "idx_tawos_retrieval_logs_workspace_created" ON "public"."tawos_retrieval_logs" USING "btree" ("workspace_id", "created_at" DESC);



CREATE INDEX "idx_tawos_training_failures_run" ON "public"."tawos_training_failures" USING "btree" ("training_run_id");



CREATE INDEX "idx_tawos_training_runs_status" ON "public"."tawos_training_runs" USING "btree" ("status");



CREATE INDEX "idx_tawos_training_runs_task" ON "public"."tawos_training_runs" USING "btree" ("task_id");



CREATE INDEX "idx_tawos_training_runs_workspace" ON "public"."tawos_training_runs" USING "btree" ("workspace_id", "created_at" DESC);



CREATE INDEX "idx_tawos_training_data_workspace_id" ON "public"."tawos_training_data" USING "btree" ("workspace_id");



CREATE INDEX "idx_tawos_training_data_workspace_created" ON "public"."tawos_training_data" USING "btree" ("workspace_id", "created_at" DESC);



CREATE INDEX "idx_workspaces_owner_id" ON "public"."workspaces" USING "btree" ("owner_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_workspaces_workspace_id" ON "public"."workspaces" USING "btree" ("workspace_id");



CREATE INDEX "task_personas_persona_id_idx" ON "public"."task_personas" USING "btree" ("persona_id");



CREATE INDEX "tasks_project_id_idx" ON "public"."tasks" USING "btree" ("project_id");



CREATE INDEX "tawos_user_stories_embedding_hnsw_idx" ON "public"."tawos_user_stories" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops") WITH ("m"='16', "ef_construction"='64');






CREATE OR REPLACE TRIGGER "set_tawos_training_runs_updated_at" BEFORE UPDATE ON "public"."tawos_training_runs" FOR EACH ROW EXECUTE FUNCTION "public"."set_ai_task_queue_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ai_task_queue_updated_at" BEFORE UPDATE ON "public"."ai_task_queue" FOR EACH ROW EXECUTE FUNCTION "public"."set_ai_task_queue_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sprint_soft_delete_cleanup" AFTER UPDATE ON "public"."sprints" FOR EACH ROW EXECUTE FUNCTION "public"."delete_sprint_metrics_on_soft_delete"();



CREATE OR REPLACE TRIGGER "trigger_auto_activate_sprint" AFTER UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."auto_activate_sprint"();



CREATE OR REPLACE TRIGGER "trigger_auto_activate_sprint_on_insert" AFTER INSERT ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."auto_activate_sprint"();



CREATE OR REPLACE TRIGGER "trigger_auto_mark_ac_met" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."auto_mark_acceptance_criteria_met"();



CREATE OR REPLACE TRIGGER "trigger_cascade_sprint_folder_project" AFTER UPDATE OF "project_id" ON "public"."sprint_folders" FOR EACH ROW EXECUTE FUNCTION "public"."cascade_sprint_folder_project_id"();



CREATE OR REPLACE TRIGGER "trigger_cascade_sprint_folder_space" AFTER UPDATE OF "space_id" ON "public"."sprint_folders" FOR EACH ROW EXECUTE FUNCTION "public"."cascade_sprint_folder_space_id"();



CREATE OR REPLACE TRIGGER "trigger_check_sprint_completion" AFTER UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."check_sprint_completion"();



CREATE OR REPLACE TRIGGER "trigger_check_sprint_revert" AFTER UPDATE OF "status_id" ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."check_sprint_revert"();



CREATE OR REPLACE TRIGGER "trigger_create_default_statuses" AFTER INSERT ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."create_default_project_statuses"();



CREATE OR REPLACE TRIGGER "trigger_ensure_single_default_status" BEFORE INSERT OR UPDATE OF "is_default" ON "public"."statuses" FOR EACH ROW WHEN (("new"."is_default" = true)) EXECUTE FUNCTION "public"."ensure_single_default_status"();



CREATE OR REPLACE TRIGGER "trigger_project_soft_delete" AFTER UPDATE OF "deleted_at" ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."cascade_project_soft_delete"();



CREATE OR REPLACE TRIGGER "trigger_record_status_change" AFTER UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."record_task_status_change"();



CREATE OR REPLACE TRIGGER "trigger_set_project_id" BEFORE INSERT ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."set_project_id"();



CREATE OR REPLACE TRIGGER "trigger_set_space_id" BEFORE INSERT ON "public"."spaces" FOR EACH ROW EXECUTE FUNCTION "public"."set_space_id"();



CREATE OR REPLACE TRIGGER "trigger_set_task_id" BEFORE INSERT ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_task_id"();



CREATE OR REPLACE TRIGGER "trigger_set_workspace_id" BEFORE INSERT ON "public"."workspaces" FOR EACH ROW EXECUTE FUNCTION "public"."set_workspace_id"();



CREATE OR REPLACE TRIGGER "trigger_space_soft_delete" AFTER UPDATE OF "deleted_at" ON "public"."spaces" FOR EACH ROW EXECUTE FUNCTION "public"."cascade_space_soft_delete"();



CREATE OR REPLACE TRIGGER "trigger_sprint_folder_soft_delete" AFTER UPDATE OF "deleted_at" ON "public"."sprint_folders" FOR EACH ROW EXECUTE FUNCTION "public"."cascade_sprint_folder_soft_delete"();



CREATE OR REPLACE TRIGGER "trigger_sprint_folders_updated_at" BEFORE UPDATE ON "public"."sprint_folders" FOR EACH ROW EXECUTE FUNCTION "public"."update_sprint_folders_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_sprint_soft_delete" AFTER UPDATE OF "deleted_at" ON "public"."sprints" FOR EACH ROW EXECUTE FUNCTION "public"."cascade_sprint_soft_delete"();



CREATE OR REPLACE TRIGGER "trigger_sprints_updated_at" BEFORE UPDATE ON "public"."sprints" FOR EACH ROW EXECUTE FUNCTION "public"."update_sprints_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_mcp_auth_tokens_updated_at" BEFORE UPDATE ON "public"."mcp_auth_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_mcp_auth_tokens_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_sprint_status" BEFORE UPDATE ON "public"."sprints" FOR EACH ROW EXECUTE FUNCTION "public"."update_sprint_status_from_dates"();



CREATE OR REPLACE TRIGGER "trigger_workspace_soft_delete" AFTER UPDATE OF "deleted_at" ON "public"."workspaces" FOR EACH ROW EXECUTE FUNCTION "public"."cascade_workspace_soft_delete"();






CREATE OR REPLACE TRIGGER "update_personas_updated_at" BEFORE UPDATE ON "public"."personas" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();






CREATE OR REPLACE TRIGGER "update_sprint_metrics_on_sprint_change" AFTER INSERT OR UPDATE OF "status", "end_date" ON "public"."sprints" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_sprint_metrics_on_sprint_change"();



COMMENT ON TRIGGER "update_sprint_metrics_on_sprint_change" ON "public"."sprints" IS 'Automatically updates sprint_metrics when sprint status or dates change';



CREATE OR REPLACE TRIGGER "update_sprint_metrics_on_task_change" AFTER INSERT OR DELETE OR UPDATE OF "sprint_id", "status_id", "story_points" ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_sprint_metrics_on_task_change"();



COMMENT ON TRIGGER "update_sprint_metrics_on_task_change" ON "public"."tasks" IS 'Automatically updates sprint_metrics when tasks are added, removed, or modified in a sprint';



CREATE OR REPLACE TRIGGER "update_status_types_updated_at" BEFORE UPDATE ON "public"."status_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tawos_user_stories_updated_at" BEFORE UPDATE ON "public"."tawos_user_stories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tawos_training_data_updated_at" BEFORE UPDATE ON "public"."tawos_training_data" FOR EACH ROW EXECUTE FUNCTION "public"."update_tawos_training_data_updated_at"();



ALTER TABLE ONLY "public"."ai_task_events"
    ADD CONSTRAINT "ai_task_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."ai_task_queue"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_task_logs"
    ADD CONSTRAINT "ai_task_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."ai_task_queue"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_task_queue"
    ADD CONSTRAINT "ai_task_queue_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_task_queue"
    ADD CONSTRAINT "ai_task_queue_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_usage_log"
    ADD CONSTRAINT "ai_usage_log_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tawos_training_data"
    ADD CONSTRAINT "tawos_training_data_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."claude_code_issues"
    ADD CONSTRAINT "claude_code_issues_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."claude_code_sessions"("id");



ALTER TABLE ONLY "public"."claude_code_issues"
    ADD CONSTRAINT "claude_code_issues_subtask_id_fkey" FOREIGN KEY ("subtask_id") REFERENCES "public"."tasks"("id");



ALTER TABLE ONLY "public"."claude_code_issues"
    ADD CONSTRAINT "claude_code_issues_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id");



ALTER TABLE ONLY "public"."claude_code_issues"
    ADD CONSTRAINT "claude_code_issues_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."claude_code_sessions"
    ADD CONSTRAINT "claude_code_sessions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."claude_code_sessions"
    ADD CONSTRAINT "claude_code_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."claude_code_sessions"
    ADD CONSTRAINT "claude_code_sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cli_api_keys"
    ADD CONSTRAINT "cli_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."personas"
    ADD CONSTRAINT "personas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."personas"
    ADD CONSTRAINT "personas_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_timezone_fkey" FOREIGN KEY ("timezone") REFERENCES "public"."timezones"("id");



ALTER TABLE ONLY "public"."project_personas"
    ADD CONSTRAINT "project_personas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_personas"
    ADD CONSTRAINT "project_personas_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_personas"
    ADD CONSTRAINT "project_personas_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;









ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spaces"
    ADD CONSTRAINT "spaces_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprint_folders"
    ADD CONSTRAINT "sprint_folders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."sprint_folders"
    ADD CONSTRAINT "sprint_folders_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprint_folders"
    ADD CONSTRAINT "sprint_folders_sprint_start_day_id_fkey" FOREIGN KEY ("sprint_start_day_id") REFERENCES "public"."days"("id");



ALTER TABLE ONLY "public"."sprint_metrics"
    ADD CONSTRAINT "sprint_metrics_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprint_metrics"
    ADD CONSTRAINT "sprint_metrics_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprint_metrics"
    ADD CONSTRAINT "sprint_metrics_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "sprints_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "sprints_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "sprints_sprint_folder_id_fkey" FOREIGN KEY ("sprint_folder_id") REFERENCES "public"."sprint_folders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "sprints_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id");



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "sprints_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."statuses"
    ADD CONSTRAINT "statuses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."statuses"
    ADD CONSTRAINT "statuses_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id");



ALTER TABLE ONLY "public"."statuses"
    ADD CONSTRAINT "statuses_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."statuses"
    ADD CONSTRAINT "statuses_status_type_id_fkey" FOREIGN KEY ("status_type_id") REFERENCES "public"."status_types"("id");



ALTER TABLE ONLY "public"."statuses"
    ADD CONSTRAINT "statuses_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_generation_sessions"
    ADD CONSTRAINT "story_generation_sessions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."ai_task_queue"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."story_generation_sessions"
    ADD CONSTRAINT "story_generation_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."story_generation_sessions"
    ADD CONSTRAINT "story_generation_sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_canonical_tag_id_fkey" FOREIGN KEY ("canonical_tag_id") REFERENCES "public"."tags"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_ai_metadata"
    ADD CONSTRAINT "task_ai_metadata_generation_session_id_fkey" FOREIGN KEY ("generation_session_id") REFERENCES "public"."story_generation_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_ai_metadata"
    ADD CONSTRAINT "task_ai_metadata_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_blocks"
    ADD CONSTRAINT "task_blocks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_blocks"
    ADD CONSTRAINT "task_blocks_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_blocks"
    ADD CONSTRAINT "task_blocks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_blocks"
    ADD CONSTRAINT "task_blocks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_source_task_id_fkey" FOREIGN KEY ("source_task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_target_task_id_fkey" FOREIGN KEY ("target_task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_personas"
    ADD CONSTRAINT "task_personas_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_personas"
    ADD CONSTRAINT "task_personas_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_status_history"
    ADD CONSTRAINT "task_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_status_history"
    ADD CONSTRAINT "task_status_history_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "public"."statuses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_status_history"
    ADD CONSTRAINT "task_status_history_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_status_history"
    ADD CONSTRAINT "task_status_history_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "public"."statuses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_status_history"
    ADD CONSTRAINT "task_status_history_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_tags"
    ADD CONSTRAINT "task_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_tags"
    ADD CONSTRAINT "task_tags_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_generation_session_id_fkey" FOREIGN KEY ("generation_session_id") REFERENCES "public"."story_generation_sessions"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."statuses"("id") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tawos_retrieval_logs"
    ADD CONSTRAINT "tawos_retrieval_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."story_generation_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tawos_retrieval_logs"
    ADD CONSTRAINT "tawos_retrieval_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tawos_training_failures"
    ADD CONSTRAINT "tawos_training_failures_training_run_id_fkey" FOREIGN KEY ("training_run_id") REFERENCES "public"."tawos_training_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tawos_training_runs"
    ADD CONSTRAINT "tawos_training_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tawos_training_runs"
    ADD CONSTRAINT "tawos_training_runs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."ai_task_queue"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tawos_training_runs"
    ADD CONSTRAINT "tawos_training_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."ai_task_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_task_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_task_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_usage_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated_read" ON "public"."tawos_user_stories" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."claude_code_issues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."claude_code_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cli_api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."days" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."insights" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."mcp_auth_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owner_full_access" ON "public"."ai_task_events" TO "authenticated" USING (("task_id" IN ( SELECT "ai_task_queue"."id"
   FROM "public"."ai_task_queue"
  WHERE ("ai_task_queue"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"())))))) WITH CHECK (("task_id" IN ( SELECT "ai_task_queue"."id"
   FROM "public"."ai_task_queue"
  WHERE ("ai_task_queue"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "owner_full_access" ON "public"."ai_task_logs" TO "authenticated" USING (("task_id" IN ( SELECT "ai_task_queue"."id"
   FROM "public"."ai_task_queue"
  WHERE ("ai_task_queue"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"())))))) WITH CHECK (("task_id" IN ( SELECT "ai_task_queue"."id"
   FROM "public"."ai_task_queue"
  WHERE ("ai_task_queue"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "owner_full_access" ON "public"."ai_task_queue" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."ai_usage_log" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."claude_code_issues" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."claude_code_sessions" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."personas" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."project_personas" TO "authenticated" USING (("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"())))))) WITH CHECK (("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "owner_full_access" ON "public"."projects" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));






CREATE POLICY "owner_full_access" ON "public"."security_audit_log" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."spaces" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."sprint_folders" TO "authenticated" USING (("space_id" IN ( SELECT "spaces"."id"
   FROM "public"."spaces"
  WHERE ("spaces"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"())))))) WITH CHECK (("space_id" IN ( SELECT "spaces"."id"
   FROM "public"."spaces"
  WHERE ("spaces"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "owner_full_access" ON "public"."sprint_metrics" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."sprints" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."statuses" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."story_generation_sessions" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."tags" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."task_ai_metadata" TO "authenticated" USING (("task_id" IN ( SELECT "tasks"."id"
   FROM "public"."tasks"
  WHERE ("tasks"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"())))))) WITH CHECK (("task_id" IN ( SELECT "tasks"."id"
   FROM "public"."tasks"
  WHERE ("tasks"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "owner_full_access" ON "public"."task_blocks" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."task_dependencies" TO "authenticated" USING (("source_task_id" IN ( SELECT "tasks"."id"
   FROM "public"."tasks"
  WHERE ("tasks"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"())))))) WITH CHECK (("source_task_id" IN ( SELECT "tasks"."id"
   FROM "public"."tasks"
  WHERE ("tasks"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "owner_full_access" ON "public"."task_personas" TO "authenticated" USING (("task_id" IN ( SELECT "tasks"."id"
   FROM "public"."tasks"
  WHERE ("tasks"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"())))))) WITH CHECK (("task_id" IN ( SELECT "tasks"."id"
   FROM "public"."tasks"
  WHERE ("tasks"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "owner_full_access" ON "public"."task_status_history" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."task_tags" TO "authenticated" USING (("task_id" IN ( SELECT "tasks"."id"
   FROM "public"."tasks"
  WHERE ("tasks"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"())))))) WITH CHECK (("task_id" IN ( SELECT "tasks"."id"
   FROM "public"."tasks"
  WHERE ("tasks"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "owner_full_access" ON "public"."tasks" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."tawos_retrieval_logs" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."tawos_training_data" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."tawos_training_failures" TO "authenticated" USING (("training_run_id" IN ( SELECT "tawos_training_runs"."id"
   FROM "public"."tawos_training_runs"
  WHERE ("tawos_training_runs"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"())))))) WITH CHECK (("training_run_id" IN ( SELECT "tawos_training_runs"."id"
   FROM "public"."tawos_training_runs"
  WHERE ("tawos_training_runs"."workspace_id" IN ( SELECT "workspaces"."id"
           FROM "public"."workspaces"
          WHERE ("workspaces"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "owner_full_access" ON "public"."tawos_training_runs" TO "authenticated" USING (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "owner_full_access" ON "public"."workspaces" TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."personas" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_personas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_read" ON "public"."days" FOR SELECT TO "authenticated", "anon" USING (true);









CREATE POLICY "public_read" ON "public"."status_types" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "public_read" ON "public"."timezones" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "public_read_published" ON "public"."insights" FOR SELECT TO "authenticated", "anon" USING ((("published" = true) AND ("deleted_at" IS NULL)));



ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."security_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "self_full_access" ON "public"."cli_api_keys" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "self_full_access" ON "public"."mcp_auth_tokens" TO "authenticated" USING (("email" = (( SELECT "u"."email"
   FROM "auth"."users" "u"
  WHERE ("u"."id" = "auth"."uid"())))::"text")) WITH CHECK (("email" = (( SELECT "u"."email"
   FROM "auth"."users" "u"
  WHERE ("u"."id" = "auth"."uid"())))::"text"));



CREATE POLICY "self_full_access" ON "public"."profiles" TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."spaces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sprint_folders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sprint_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sprints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."statuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_generation_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_ai_metadata" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_dependencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_personas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tawos_retrieval_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tawos_training_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tawos_training_failures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tawos_training_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tawos_user_stories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."timezones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;


REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT ALL ON SCHEMA "public" TO PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_uid_check"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_uid_check"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_uid_check"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_activate_sprint"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_activate_sprint"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_activate_sprint"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_mark_acceptance_criteria_met"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_mark_acceptance_criteria_met"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_mark_acceptance_criteria_met"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_sprint_metrics"("p_sprint_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_sprint_metrics"("p_sprint_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_sprint_metrics"("p_sprint_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cascade_project_soft_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."cascade_project_soft_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cascade_project_soft_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cascade_space_soft_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."cascade_space_soft_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cascade_space_soft_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cascade_sprint_folder_project_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."cascade_sprint_folder_project_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cascade_sprint_folder_project_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cascade_sprint_folder_soft_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."cascade_sprint_folder_soft_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cascade_sprint_folder_soft_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cascade_sprint_folder_space_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."cascade_sprint_folder_space_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cascade_sprint_folder_space_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cascade_sprint_soft_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."cascade_sprint_soft_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cascade_sprint_soft_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cascade_workspace_soft_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."cascade_workspace_soft_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cascade_workspace_soft_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_sprint_completion"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_sprint_completion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_sprint_completion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_sprint_revert"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_sprint_revert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_sprint_revert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_rate_limits"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_rate_limits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_rate_limits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_audit_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_audit_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_audit_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_project_statuses"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_project_statuses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_project_statuses"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_workspace_with_defaults"("p_name" "text", "p_purpose" "text", "p_type" "text", "p_category" "text", "p_owner_id" "uuid", "p_workspace_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_workspace_with_defaults"("p_name" "text", "p_purpose" "text", "p_type" "text", "p_category" "text", "p_owner_id" "uuid", "p_workspace_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_workspace_with_defaults"("p_name" "text", "p_purpose" "text", "p_type" "text", "p_category" "text", "p_owner_id" "uuid", "p_workspace_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_sprint_cascade"("sprint_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_sprint_cascade"("sprint_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_sprint_cascade"("sprint_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_sprint_metrics_on_soft_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_sprint_metrics_on_soft_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_sprint_metrics_on_soft_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_single_default_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_single_default_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_single_default_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_project_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_project_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_project_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_space_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_space_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_space_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_task_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_task_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_task_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_workspace_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_workspace_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_workspace_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_blocks_count"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_blocks_count"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_blocks_count"("p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_predefined_statuses"("p_workspace_id" "uuid", "p_space_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_predefined_statuses"("p_workspace_id" "uuid", "p_space_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_predefined_statuses"("p_workspace_id" "uuid", "p_space_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_project_view_data"("p_project_id" "uuid", "p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_project_view_data"("p_project_id" "uuid", "p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_project_view_data"("p_project_id" "uuid", "p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sprint_view_data"("p_sprint_id" "uuid", "p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_sprint_view_data"("p_sprint_id" "uuid", "p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sprint_view_data"("p_sprint_id" "uuid", "p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_workspace_analytics"("p_workspace_id" "uuid", "p_days_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_workspace_analytics"("p_workspace_id" "uuid", "p_days_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_workspace_analytics"("p_workspace_id" "uuid", "p_days_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "filter" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_sprint_metrics_for_sprint"("p_sprint_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."populate_sprint_metrics_for_sprint"("p_sprint_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_sprint_metrics_for_sprint"("p_sprint_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_task_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."record_task_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_task_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_ai_task_queue_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_ai_task_queue_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_ai_task_queue_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_project_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_project_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_project_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_space_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_space_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_space_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_task_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_task_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_task_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_workspace_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_workspace_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_workspace_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."setup_new_workspace"("owner_id_param" "uuid", "workspace_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."setup_new_workspace"("owner_id_param" "uuid", "workspace_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."setup_new_workspace"("owner_id_param" "uuid", "workspace_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."task_has_acceptance_criteria"("p_task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."task_has_acceptance_criteria"("p_task_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."task_has_acceptance_criteria"("p_task_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_sprint_metrics_on_sprint_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_sprint_metrics_on_sprint_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_sprint_metrics_on_sprint_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_sprint_metrics_on_task_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_sprint_metrics_on_task_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_sprint_metrics_on_task_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."try_requeue_task"("p_task_id" "uuid", "p_max_requeues" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."try_requeue_task"("p_task_id" "uuid", "p_max_requeues" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."try_requeue_task"("p_task_id" "uuid", "p_max_requeues" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ai_sprint_metrics"("p_sprint_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_ai_sprint_metrics"("p_sprint_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ai_sprint_metrics"("p_sprint_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_mcp_auth_tokens_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_mcp_auth_tokens_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_mcp_auth_tokens_updated_at"() TO "service_role";






GRANT ALL ON FUNCTION "public"."update_priorities_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_priorities_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_priorities_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_sprint_folders_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_sprint_folders_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_sprint_folders_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_sprint_status_from_dates"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_sprint_status_from_dates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_sprint_status_from_dates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_sprints_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_sprints_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_sprints_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tawos_training_data_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tawos_training_data_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tawos_training_data_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."ai_task_events" TO "anon";
GRANT ALL ON TABLE "public"."ai_task_events" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_task_events" TO "service_role";



GRANT ALL ON TABLE "public"."ai_task_logs" TO "anon";
GRANT ALL ON TABLE "public"."ai_task_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_task_logs" TO "service_role";



GRANT ALL ON TABLE "public"."ai_task_queue" TO "anon";
GRANT ALL ON TABLE "public"."ai_task_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_task_queue" TO "service_role";



GRANT ALL ON TABLE "public"."ai_usage_log" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage_log" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage_log" TO "service_role";



GRANT ALL ON TABLE "public"."claude_code_issues" TO "anon";
GRANT ALL ON TABLE "public"."claude_code_issues" TO "authenticated";
GRANT ALL ON TABLE "public"."claude_code_issues" TO "service_role";



GRANT ALL ON TABLE "public"."claude_code_sessions" TO "anon";
GRANT ALL ON TABLE "public"."claude_code_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."claude_code_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."cli_api_keys" TO "anon";
GRANT ALL ON TABLE "public"."cli_api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."cli_api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."days" TO "anon";
GRANT ALL ON TABLE "public"."days" TO "authenticated";
GRANT ALL ON TABLE "public"."days" TO "service_role";



GRANT ALL ON TABLE "public"."insights" TO "anon";
GRANT ALL ON TABLE "public"."insights" TO "authenticated";
GRANT ALL ON TABLE "public"."insights" TO "service_role";






GRANT ALL ON TABLE "public"."mcp_auth_tokens" TO "anon";
GRANT ALL ON TABLE "public"."mcp_auth_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."mcp_auth_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."personas" TO "anon";
GRANT ALL ON TABLE "public"."personas" TO "authenticated";
GRANT ALL ON TABLE "public"."personas" TO "service_role";






GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."project_personas" TO "anon";
GRANT ALL ON TABLE "public"."project_personas" TO "authenticated";
GRANT ALL ON TABLE "public"."project_personas" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";






GRANT ALL ON TABLE "public"."security_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."security_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."security_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."spaces" TO "anon";
GRANT ALL ON TABLE "public"."spaces" TO "authenticated";
GRANT ALL ON TABLE "public"."spaces" TO "service_role";



GRANT ALL ON TABLE "public"."sprint_folders" TO "anon";
GRANT ALL ON TABLE "public"."sprint_folders" TO "authenticated";
GRANT ALL ON TABLE "public"."sprint_folders" TO "service_role";



GRANT ALL ON TABLE "public"."sprint_metrics" TO "anon";
GRANT ALL ON TABLE "public"."sprint_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."sprint_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."sprints" TO "anon";
GRANT ALL ON TABLE "public"."sprints" TO "authenticated";
GRANT ALL ON TABLE "public"."sprints" TO "service_role";



GRANT ALL ON TABLE "public"."status_types" TO "anon";
GRANT ALL ON TABLE "public"."status_types" TO "authenticated";
GRANT ALL ON TABLE "public"."status_types" TO "service_role";



GRANT ALL ON TABLE "public"."statuses" TO "anon";
GRANT ALL ON TABLE "public"."statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."statuses" TO "service_role";



GRANT ALL ON TABLE "public"."story_generation_sessions" TO "anon";
GRANT ALL ON TABLE "public"."story_generation_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."story_generation_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."task_ai_metadata" TO "anon";
GRANT ALL ON TABLE "public"."task_ai_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."task_ai_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."task_blocks" TO "anon";
GRANT ALL ON TABLE "public"."task_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."task_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."task_dependencies" TO "anon";
GRANT ALL ON TABLE "public"."task_dependencies" TO "authenticated";
GRANT ALL ON TABLE "public"."task_dependencies" TO "service_role";



GRANT ALL ON TABLE "public"."task_personas" TO "anon";
GRANT ALL ON TABLE "public"."task_personas" TO "authenticated";
GRANT ALL ON TABLE "public"."task_personas" TO "service_role";



GRANT ALL ON TABLE "public"."task_status_history" TO "anon";
GRANT ALL ON TABLE "public"."task_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."task_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."task_tags" TO "anon";
GRANT ALL ON TABLE "public"."task_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."task_tags" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."tawos_retrieval_logs" TO "anon";
GRANT ALL ON TABLE "public"."tawos_retrieval_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."tawos_retrieval_logs" TO "service_role";



GRANT ALL ON TABLE "public"."tawos_training_data" TO "anon";
GRANT ALL ON TABLE "public"."tawos_training_data" TO "authenticated";
GRANT ALL ON TABLE "public"."tawos_training_data" TO "service_role";



GRANT ALL ON TABLE "public"."tawos_training_failures" TO "anon";
GRANT ALL ON TABLE "public"."tawos_training_failures" TO "authenticated";
GRANT ALL ON TABLE "public"."tawos_training_failures" TO "service_role";



GRANT ALL ON TABLE "public"."tawos_training_runs" TO "anon";
GRANT ALL ON TABLE "public"."tawos_training_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."tawos_training_runs" TO "service_role";



GRANT ALL ON TABLE "public"."tawos_user_stories" TO "anon";
GRANT ALL ON TABLE "public"."tawos_user_stories" TO "authenticated";
GRANT ALL ON TABLE "public"."tawos_user_stories" TO "service_role";



GRANT ALL ON TABLE "public"."timezones" TO "anon";
GRANT ALL ON TABLE "public"."timezones" TO "authenticated";
GRANT ALL ON TABLE "public"."timezones" TO "service_role";



GRANT ALL ON TABLE "public"."user_activity" TO "anon";
GRANT ALL ON TABLE "public"."user_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."user_activity" TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






-- ============================================================================
-- 3. Auth trigger — fires handle_new_user when a new auth.users row appears
-- ============================================================================
-- The trigger lives in the auth schema (cross-schema), so it isn't dumped by
-- `pg_dump --schema public`. Recreate it here so a fresh signup automatically
-- gets a profiles row.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 4. Seed data
-- ============================================================================

-- status_types: 4 categories every workspace's statuses map onto
INSERT INTO public.status_types (name, description)
SELECT * FROM (VALUES
    ('not-started', 'Work has not begun'),
    ('active',      'Work is in progress'),
    ('done',        'Work is complete'),
    ('closed',      'Item is archived or closed')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM public.status_types LIMIT 1);

-- days: reference data for sprint start-day configuration
INSERT INTO public.days (name)
SELECT unnest(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])
WHERE NOT EXISTS (SELECT 1 FROM public.days LIMIT 1);
