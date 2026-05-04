# Supabase pg_cron Jobs

## Prerequisites

1. Enable the pg_cron extension in your Supabase project:
   **Supabase Dashboard → Database → Extensions → search "pg_cron" → Enable**

2. pg_cron runs in the `postgres` database. All scheduled SQL executes as the `postgres` role.

## Registered Jobs

| Job Name | Schedule | Table | Action |
|----------|----------|-------|--------|
| `cleanup_old_ai_usage_logs` | `0 3 * * *` (daily 3am UTC) | `ai_usage_log` | Delete rows > 90 days old |
| `cleanup_old_security_audit_logs` | `0 3 * * *` (daily 3am UTC) | `security_audit_log` | Delete rows > 90 days old |

## How to Add a New Job

Create a SQL migration:

```sql
SELECT cron.schedule(
  'my_job_name',          -- unique job name
  '0 4 * * *',            -- cron expression (UTC)
  $$DELETE FROM my_table WHERE created_at < NOW() - INTERVAL '30 days'$$
);
```

Then document it in this README and in `docs/infrastructure.md`.

## How to Test

Run in Supabase SQL Editor:

```sql
-- List all scheduled jobs
SELECT * FROM cron.job;

-- Check recent job runs
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- Run a job manually (by jobid from cron.job)
SELECT cron.run_job(<jobid>);

-- Unschedule a job
SELECT cron.unschedule('my_job_name');
```

## How to Monitor

```sql
-- Jobs that failed in the last 24 hours
SELECT jobname, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE status = 'failed'
  AND start_time > NOW() - INTERVAL '24 hours'
ORDER BY start_time DESC;
```

## Vercel Cron vs pg_cron Decision Rule

- **Vercel Cron**: Job calls external APIs (Claude, Resend, QStash, webhooks)
- **pg_cron**: Job only touches the database (cleanup, aggregation, snapshots)

See `docs/infrastructure.md` for the full job inventory.
