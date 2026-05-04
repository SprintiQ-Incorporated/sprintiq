-- SQL Verification Script: Integration Display Types
-- Verifies that JIRA_INTEGRATION_COLUMNS.CORE and SLACK_INTEGRATION_COLUMNS.CORE
-- match the JiraIntegrationDisplay and SlackIntegrationDisplay types

-- ============================================================================
-- JIRA INTEGRATIONS
-- ============================================================================
-- JIRA_INTEGRATION_COLUMNS.CORE selects:
-- 'id, workspace_id, jira_domain, jira_email, is_active, detected_story_points_field, detected_sprint_field, created_at, updated_at'
--
-- JiraIntegrationDisplay omits: 'jira_api_token' | 'encrypted_api_token'

-- Run this to see all columns in jira_integrations:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'jira_integrations'
ORDER BY ordinal_position;

-- Expected columns in CORE query (should NOT include sensitive tokens):
-- ✓ id, workspace_id, jira_domain, jira_email, is_active,
-- ✓ detected_story_points_field, detected_sprint_field, created_at, updated_at
-- ✗ jira_api_token (EXCLUDED - sensitive)
-- ✗ encrypted_api_token (EXCLUDED - sensitive)

-- Verify CORE query returns expected columns:
SELECT
  id, workspace_id, jira_domain, jira_email, is_active,
  detected_story_points_field, detected_sprint_field, created_at, updated_at
FROM jira_integrations
LIMIT 0;

-- ============================================================================
-- SLACK INTEGRATIONS
-- ============================================================================
-- SLACK_INTEGRATION_COLUMNS.CORE selects:
-- 'id, workspace_id, slack_workspace_id, slack_workspace_name, slack_workspace_domain, is_active, bot_user_id, bot_username, created_at, updated_at'
--
-- SlackIntegrationDisplay omits: 'access_token' | 'encrypted_access_token' | 'refresh_token' | 'token_expires_at'

-- Run this to see all columns in slack_integrations:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'slack_integrations'
ORDER BY ordinal_position;

-- Expected columns in CORE query (should NOT include sensitive tokens):
-- ✓ id, workspace_id, slack_workspace_id, slack_workspace_name, slack_workspace_domain,
-- ✓ is_active, bot_user_id, bot_username, created_at, updated_at
-- ✗ access_token (EXCLUDED - sensitive)
-- ✗ encrypted_access_token (EXCLUDED - sensitive)
-- ✗ refresh_token (EXCLUDED - sensitive)
-- ✗ token_expires_at (EXCLUDED - not in CORE query)

-- Verify CORE query returns expected columns:
SELECT
  id, workspace_id, slack_workspace_id, slack_workspace_name, slack_workspace_domain,
  is_active, bot_user_id, bot_username, created_at, updated_at
FROM slack_integrations
LIMIT 0;

-- ============================================================================
-- VERIFICATION SUMMARY
-- ============================================================================
-- If the above queries run without error, the column selections are valid.
--
-- Type alignment:
-- | Table              | All Columns | CORE Excludes                                              | Display Type Omits                                         |
-- |--------------------|-------------|------------------------------------------------------------|------------------------------------------------------------|
-- | jira_integrations  | 11          | jira_api_token, encrypted_api_token                        | jira_api_token, encrypted_api_token                        |
-- | slack_integrations | 14          | access_token, encrypted_access_token, refresh_token, token_expires_at | access_token, encrypted_access_token, refresh_token, token_expires_at |
