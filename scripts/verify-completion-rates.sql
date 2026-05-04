-- ============================================================================
-- Verify completion rate distribution for tiered retrieval
-- Success patterns: >= 0.8, Anti-patterns: < 0.6
-- ============================================================================

-- Quick count of each category
SELECT
    'Success Patterns (>=80%)' as category,
    COUNT(*) as count
FROM tawos_user_stories
WHERE (metadata->>'completionRate')::float >= 0.8

UNION ALL

SELECT
    'Medium (60-80%)' as category,
    COUNT(*) as count
FROM tawos_user_stories
WHERE (metadata->>'completionRate')::float >= 0.6
  AND (metadata->>'completionRate')::float < 0.8

UNION ALL

SELECT
    'Anti-Patterns (<60%)' as category,
    COUNT(*) as count
FROM tawos_user_stories
WHERE (metadata->>'completionRate')::float < 0.6;
