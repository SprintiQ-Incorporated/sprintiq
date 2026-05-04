-- Backfill AI Metrics for Historical story_generation_sessions
-- Run once manually after deploying the migration.
--
-- Strategy: Use the median cost from the 1 valid row to estimate costs for the 16 NULL rows.
-- This is a rough estimate — actual costs depend on prompt length and response size.

-- Step 1: Check current state
SELECT
  COUNT(*) AS total_sessions,
  COUNT(*) FILTER (WHERE ai_model = '') AS empty_model,
  COUNT(*) FILTER (WHERE ai_tokens_used = 0) AS zero_tokens,
  COUNT(*) FILTER (WHERE ai_cost_usd = 0) AS zero_cost,
  COUNT(*) FILTER (WHERE ai_tokens_used > 0) AS has_tokens
FROM story_generation_sessions;

-- Step 2: View the valid row(s) to calibrate estimates
SELECT id, ai_model, ai_tokens_used, ai_cost_usd, created_at
FROM story_generation_sessions
WHERE ai_tokens_used > 0;

-- Step 3: Backfill with estimates based on typical Sonnet usage for story generation
-- Typical story gen: ~2000 input tokens, ~1500 output tokens per session
-- Cost: (2000/1M * 3.00) + (1500/1M * 15.00) = 0.006 + 0.0225 = ~0.0285 per call
UPDATE story_generation_sessions
SET
  ai_model = CASE WHEN ai_model = '' THEN 'claude-sonnet-4-6-20250218' ELSE ai_model END,
  ai_tokens_used = CASE WHEN ai_tokens_used = 0 THEN 3500 ELSE ai_tokens_used END,
  ai_cost_usd = CASE WHEN ai_cost_usd = 0 THEN 0.028500 ELSE ai_cost_usd END
WHERE ai_tokens_used = 0 AND status = 'completed';

-- Step 4: Verify backfill
SELECT id, ai_model, ai_tokens_used, ai_cost_usd, status, created_at
FROM story_generation_sessions
ORDER BY created_at DESC;
