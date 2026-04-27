-- Helper: reschedule a pg_cron job from an edge function via RPC
-- Used by update-job-schedule edge function
CREATE OR REPLACE FUNCTION public.reschedule_job(
  p_job_name text,
  p_schedule text,
  p_command  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM cron.unschedule(p_job_name);
  PERFORM cron.schedule(p_job_name, p_schedule, p_command);
END;
$$;

-- Restrict to service_role (edge functions use service role key)
REVOKE ALL ON FUNCTION public.reschedule_job(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_job(text, text, text) TO service_role;

-- Register all enabled system_jobs in pg_cron (idempotent)
DO $$
DECLARE
  job record;
BEGIN
  FOR job IN
    SELECT job_name, schedule_utc, cron_command
    FROM public.system_jobs
    WHERE is_enabled = true
      AND cron_command != ''
  LOOP
    -- Unschedule if exists (safe even if not registered)
    BEGIN
      PERFORM cron.unschedule(job.job_name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    -- Re-schedule with current settings
    PERFORM cron.schedule(job.job_name, job.schedule_utc, job.cron_command);
  END LOOP;
END;
$$;
