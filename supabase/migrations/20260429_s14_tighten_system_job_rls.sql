-- Pre-UAT fix: restrict system_jobs and system_job_runs reads to active staff only.
-- Previously USING (true) — exposed job schedule data to all authenticated users
-- including family portal users. Non-sensitive but violates least-privilege.

DROP POLICY IF EXISTS "system_jobs_read" ON public.system_jobs;
CREATE POLICY "system_jobs_read"
  ON public.system_jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE supabase_auth_id = auth.uid()
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "system_job_runs_read" ON public.system_job_runs;
CREATE POLICY "system_job_runs_read"
  ON public.system_job_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE supabase_auth_id = auth.uid()
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
    )
  );
