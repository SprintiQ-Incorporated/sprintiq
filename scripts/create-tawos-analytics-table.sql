-- =============================================================================
-- TAWOS Retrieval Analytics Tables Migration
-- =============================================================================
-- This migration creates tables for tracking TAWOS retrieval analytics,
-- including detailed logs and aggregated daily statistics.
-- =============================================================================

-- =============================================================================
-- 1. Create tawos_retrieval_logs table
-- =============================================================================
-- Stores individual retrieval events for detailed analysis

CREATE TABLE IF NOT EXISTS public.tawos_retrieval_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  query_text text NOT NULL,
  retrieval_tier text NOT NULL CHECK (retrieval_tier IN ('success_patterns', 'story_templates', 'anti_patterns')),
  threshold_used real NOT NULL CHECK (threshold_used >= 0 AND threshold_used <= 1),
  chunks_retrieved integer NOT NULL DEFAULT 0,
  avg_similarity_score real,
  max_similarity_score real,
  min_similarity_score real,
  framework_categories jsonb DEFAULT '{}'::jsonb,
  generation_success boolean DEFAULT false,
  latency_ms integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT tawos_retrieval_logs_pkey PRIMARY KEY (id),
  CONSTRAINT tawos_retrieval_logs_workspace_id_fkey FOREIGN KEY (workspace_id)
    REFERENCES public.workspaces(id) ON DELETE CASCADE
);

-- Add comment for documentation
COMMENT ON TABLE public.tawos_retrieval_logs IS 'Stores individual TAWOS retrieval events for analytics and performance tracking';
COMMENT ON COLUMN public.tawos_retrieval_logs.query_text IS 'The original query text used for retrieval';
COMMENT ON COLUMN public.tawos_retrieval_logs.retrieval_tier IS 'The tier used for retrieval: success_patterns, story_templates, or anti_patterns';
COMMENT ON COLUMN public.tawos_retrieval_logs.threshold_used IS 'Similarity threshold used (0.60, 0.65, or 0.75)';
COMMENT ON COLUMN public.tawos_retrieval_logs.chunks_retrieved IS 'Number of chunks retrieved from the vector store';
COMMENT ON COLUMN public.tawos_retrieval_logs.framework_categories IS 'Distribution of categories returned (Auth, API, DB, UI, Security, etc.)';
COMMENT ON COLUMN public.tawos_retrieval_logs.generation_success IS 'Whether the subsequent story generation succeeded';
COMMENT ON COLUMN public.tawos_retrieval_logs.latency_ms IS 'Time taken for retrieval in milliseconds';

-- =============================================================================
-- 2. Create tawos_retrieval_daily_stats table
-- =============================================================================
-- Stores aggregated daily statistics for dashboard and reporting

CREATE TABLE IF NOT EXISTS public.tawos_retrieval_daily_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  date date NOT NULL,
  total_retrievals integer NOT NULL DEFAULT 0,
  avg_similarity_by_tier jsonb DEFAULT '{}'::jsonb,
  framework_distribution jsonb DEFAULT '{}'::jsonb,
  generation_success_rate real DEFAULT 0,
  avg_latency_ms integer DEFAULT 0,
  p95_latency_ms integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT tawos_retrieval_daily_stats_pkey PRIMARY KEY (id),
  CONSTRAINT tawos_retrieval_daily_stats_date_key UNIQUE (date)
);

-- Add comment for documentation
COMMENT ON TABLE public.tawos_retrieval_daily_stats IS 'Aggregated daily statistics for TAWOS retrieval analytics';
COMMENT ON COLUMN public.tawos_retrieval_daily_stats.avg_similarity_by_tier IS 'Average similarity scores by tier: {"success_patterns": 0.82, "story_templates": 0.71, ...}';
COMMENT ON COLUMN public.tawos_retrieval_daily_stats.framework_distribution IS 'Category distribution: {"Auth": 45, "API": 32, "DB": 28, ...}';
COMMENT ON COLUMN public.tawos_retrieval_daily_stats.generation_success_rate IS 'Percentage of successful story generations (0-1)';
COMMENT ON COLUMN public.tawos_retrieval_daily_stats.p95_latency_ms IS '95th percentile latency in milliseconds';

-- =============================================================================
-- 3. Create indexes for performance optimization
-- =============================================================================

-- Indexes for tawos_retrieval_logs
CREATE INDEX IF NOT EXISTS idx_tawos_retrieval_logs_workspace_id
  ON public.tawos_retrieval_logs(workspace_id);

CREATE INDEX IF NOT EXISTS idx_tawos_retrieval_logs_created_at
  ON public.tawos_retrieval_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tawos_retrieval_logs_retrieval_tier
  ON public.tawos_retrieval_logs(retrieval_tier);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_tawos_retrieval_logs_workspace_created
  ON public.tawos_retrieval_logs(workspace_id, created_at DESC);

-- Index for daily stats
CREATE INDEX IF NOT EXISTS idx_tawos_retrieval_daily_stats_date
  ON public.tawos_retrieval_daily_stats(date DESC);

-- =============================================================================
-- 4. Create aggregate_tawos_daily_stats() function
-- =============================================================================
-- This function aggregates data from tawos_retrieval_logs into daily stats
-- Can be called by a cron job or trigger

CREATE OR REPLACE FUNCTION public.aggregate_tawos_daily_stats(
  target_date date DEFAULT CURRENT_DATE - INTERVAL '1 day'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_retrievals integer;
  v_avg_similarity_by_tier jsonb;
  v_framework_distribution jsonb;
  v_generation_success_rate real;
  v_avg_latency_ms integer;
  v_p95_latency_ms integer;
BEGIN
  -- Calculate total retrievals for the day
  SELECT COUNT(*)
  INTO v_total_retrievals
  FROM public.tawos_retrieval_logs
  WHERE created_at >= target_date
    AND created_at < target_date + INTERVAL '1 day';

  -- If no data for this day, exit early
  IF v_total_retrievals = 0 THEN
    RETURN;
  END IF;

  -- Calculate average similarity by tier
  SELECT jsonb_object_agg(tier, avg_score)
  INTO v_avg_similarity_by_tier
  FROM (
    SELECT
      retrieval_tier AS tier,
      ROUND(AVG(avg_similarity_score)::numeric, 4) AS avg_score
    FROM public.tawos_retrieval_logs
    WHERE created_at >= target_date
      AND created_at < target_date + INTERVAL '1 day'
      AND avg_similarity_score IS NOT NULL
    GROUP BY retrieval_tier
  ) tier_stats;

  -- Calculate framework category distribution
  SELECT COALESCE(
    jsonb_object_agg(category, total_count),
    '{}'::jsonb
  )
  INTO v_framework_distribution
  FROM (
    SELECT
      key AS category,
      SUM((value::text)::integer) AS total_count
    FROM public.tawos_retrieval_logs,
      jsonb_each(framework_categories)
    WHERE created_at >= target_date
      AND created_at < target_date + INTERVAL '1 day'
    GROUP BY key
    ORDER BY total_count DESC
  ) category_stats;

  -- Calculate generation success rate
  SELECT
    ROUND((COUNT(*) FILTER (WHERE generation_success = true)::real /
           NULLIF(COUNT(*), 0))::numeric, 4)
  INTO v_generation_success_rate
  FROM public.tawos_retrieval_logs
  WHERE created_at >= target_date
    AND created_at < target_date + INTERVAL '1 day';

  -- Calculate average latency
  SELECT ROUND(AVG(latency_ms))
  INTO v_avg_latency_ms
  FROM public.tawos_retrieval_logs
  WHERE created_at >= target_date
    AND created_at < target_date + INTERVAL '1 day';

  -- Calculate p95 latency using percentile_cont
  SELECT ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms))
  INTO v_p95_latency_ms
  FROM public.tawos_retrieval_logs
  WHERE created_at >= target_date
    AND created_at < target_date + INTERVAL '1 day';

  -- Upsert the daily stats
  INSERT INTO public.tawos_retrieval_daily_stats (
    date,
    total_retrievals,
    avg_similarity_by_tier,
    framework_distribution,
    generation_success_rate,
    avg_latency_ms,
    p95_latency_ms,
    updated_at
  )
  VALUES (
    target_date,
    v_total_retrievals,
    COALESCE(v_avg_similarity_by_tier, '{}'::jsonb),
    COALESCE(v_framework_distribution, '{}'::jsonb),
    COALESCE(v_generation_success_rate, 0),
    COALESCE(v_avg_latency_ms, 0),
    COALESCE(v_p95_latency_ms, 0),
    now()
  )
  ON CONFLICT (date) DO UPDATE SET
    total_retrievals = EXCLUDED.total_retrievals,
    avg_similarity_by_tier = EXCLUDED.avg_similarity_by_tier,
    framework_distribution = EXCLUDED.framework_distribution,
    generation_success_rate = EXCLUDED.generation_success_rate,
    avg_latency_ms = EXCLUDED.avg_latency_ms,
    p95_latency_ms = EXCLUDED.p95_latency_ms,
    updated_at = now();

END;
$$;

COMMENT ON FUNCTION public.aggregate_tawos_daily_stats(date) IS
'Aggregates TAWOS retrieval logs into daily statistics. Can be called by a cron job daily.';

-- =============================================================================
-- 5. Enable Row Level Security (RLS)
-- =============================================================================

ALTER TABLE public.tawos_retrieval_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tawos_retrieval_daily_stats ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. Create RLS Policies for tawos_retrieval_logs
-- =============================================================================

-- Admin users can read all retrieval logs
CREATE POLICY tawos_retrieval_logs_select_admin
  ON public.tawos_retrieval_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Workspace members can read their workspace's retrieval logs
CREATE POLICY tawos_retrieval_logs_select_workspace
  ON public.tawos_retrieval_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = tawos_retrieval_logs.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'active'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = tawos_retrieval_logs.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

-- Service role can insert retrieval logs (for backend services)
CREATE POLICY tawos_retrieval_logs_insert_service
  ON public.tawos_retrieval_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Authenticated users can insert retrieval logs for their workspaces
CREATE POLICY tawos_retrieval_logs_insert_authenticated
  ON public.tawos_retrieval_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = tawos_retrieval_logs.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'active'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = tawos_retrieval_logs.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

-- =============================================================================
-- 7. Create RLS Policies for tawos_retrieval_daily_stats
-- =============================================================================

-- Admin users can read all daily stats
CREATE POLICY tawos_retrieval_daily_stats_select_admin
  ON public.tawos_retrieval_daily_stats
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Service role has full access (for aggregation function)
CREATE POLICY tawos_retrieval_daily_stats_all_service
  ON public.tawos_retrieval_daily_stats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- 8. Grant necessary permissions
-- =============================================================================

GRANT SELECT ON public.tawos_retrieval_logs TO authenticated;
GRANT INSERT ON public.tawos_retrieval_logs TO authenticated;
GRANT ALL ON public.tawos_retrieval_logs TO service_role;

GRANT SELECT ON public.tawos_retrieval_daily_stats TO authenticated;
GRANT ALL ON public.tawos_retrieval_daily_stats TO service_role;

GRANT EXECUTE ON FUNCTION public.aggregate_tawos_daily_stats(date) TO service_role;

-- =============================================================================
-- End of Migration
-- =============================================================================
