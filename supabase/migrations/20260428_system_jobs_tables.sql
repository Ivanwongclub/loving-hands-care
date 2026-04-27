CREATE TABLE IF NOT EXISTS public.system_jobs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name              text NOT NULL UNIQUE,
  display_name          text NOT NULL,
  display_name_zh       text NOT NULL,
  description           text,
  schedule_utc          text NOT NULL,
  schedule_hkt_label    text NOT NULL,
  schedule_hkt_label_zh text NOT NULL,
  is_enabled            boolean NOT NULL DEFAULT true,
  is_schedule_editable  boolean NOT NULL DEFAULT true,
  min_interval_minutes  integer,
  cron_command          text NOT NULL DEFAULT '',
  last_run_at           timestamptz,
  last_run_status       text CHECK (last_run_status IN ('SUCCESS','FAILED','RUNNING')),
  last_run_message      text,
  last_run_ms           integer,
  run_count             integer NOT NULL DEFAULT 0,
  fail_count            integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_job_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name     text NOT NULL REFERENCES public.system_jobs(job_name) ON DELETE CASCADE,
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  status       text NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('SUCCESS','FAILED','RUNNING')),
  message      text,
  duration_ms  integer,
  triggered_by text NOT NULL DEFAULT 'CRON',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_runs_name_time
  ON public.system_job_runs(job_name, started_at DESC);

ALTER TABLE public.system_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_job_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_jobs_read"
  ON public.system_jobs FOR SELECT TO authenticated USING (true);

CREATE POLICY "system_jobs_write"
  ON public.system_jobs FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.staff
    WHERE supabase_auth_id = auth.uid()
      AND role = 'SYSTEM_ADMIN'
      AND status = 'ACTIVE' AND deleted_at IS NULL
  ));

CREATE POLICY "system_job_runs_read"
  ON public.system_job_runs FOR SELECT TO authenticated USING (true);

CREATE POLICY "system_job_runs_insert"
  ON public.system_job_runs FOR INSERT TO service_role WITH CHECK (true);

-- Helper: increment run/fail counters atomically from edge functions
CREATE OR REPLACE FUNCTION public.increment_system_job_counter(
  p_job_name text,
  p_success  boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.system_jobs
  SET run_count  = run_count + 1,
      fail_count = CASE WHEN NOT p_success THEN fail_count + 1 ELSE fail_count END,
      updated_at = now()
  WHERE job_name = p_job_name;
END;
$$;

-- Seed existing + new jobs
INSERT INTO public.system_jobs (
  job_name, display_name, display_name_zh,
  schedule_utc, schedule_hkt_label, schedule_hkt_label_zh,
  is_schedule_editable, min_interval_minutes, is_enabled,
  cron_command
) VALUES
  (
    'alert-escalation-worker',
    'Alert Escalation Worker', '警報升級工作',
    '*/15 * * * *', 'Every 15 minutes', '每 15 分鐘',
    true, 5, true,
    $$SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/alert-escalation-worker',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')),
      body := '{}'::jsonb
    )$$
  ),
  (
    'session-reconcile',
    'DCU Session Reconcile', '日護出席記錄核對',
    '0 15 * * *', 'Daily at 11:00pm HKT', '每晚 11 時（香港時間）',
    true, 60, true,
    $$SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/session-reconcile',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')),
      body := '{}'::jsonb
    )$$
  ),
  (
    'process-notification-queue',
    'Notification Queue Processor', '通知佇列處理',
    '*/2 * * * *', 'Every 2 minutes', '每 2 分鐘',
    true, 1, true,
    $$SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/process-notification-queue',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')),
      body := '{}'::jsonb
    )$$
  ),
  (
    'offsite-backup-daily',
    'Daily Offsite Backup', '每日異地備份',
    '0 18 * * *', 'Daily at 02:00 HKT', '每日凌晨 2 時（香港時間）',
    true, 60, false,
    $$SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/run-offsite-backup',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')),
      body := '{"type":"daily"}'::jsonb
    )$$
  ),
  (
    'offsite-backup-weekly',
    'Weekly Offsite Backup', '每週異地備份',
    '0 18 * * 0', 'Weekly Sunday at 02:00 HKT', '每週日凌晨 2 時（香港時間）',
    true, 60, false,
    $$SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/run-offsite-backup',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')),
      body := '{"type":"weekly"}'::jsonb
    )$$
  ),
  (
    'offsite-backup-monthly',
    'Monthly Archive Backup', '每月存檔備份',
    '0 18 1 * *', 'Monthly 1st at 02:00 HKT', '每月1日凌晨 2 時（香港時間）',
    true, 60, false,
    $$SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/run-offsite-backup',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')),
      body := '{"type":"monthly"}'::jsonb
    )$$
  ),
  (
    'nightly-task-gen',
    'Nightly Task Generation', '每晚任務生成',
    '0 15 * * *', 'Daily at 11:00pm HKT', '每晚 11 時（香港時間）',
    true, 60, false,
    $$SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/nightly-task-gen',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.service_role_key')),
      body := '{}'::jsonb
    )$$
  )
ON CONFLICT (job_name) DO UPDATE SET
  display_name          = EXCLUDED.display_name,
  display_name_zh       = EXCLUDED.display_name_zh,
  schedule_utc          = EXCLUDED.schedule_utc,
  schedule_hkt_label    = EXCLUDED.schedule_hkt_label,
  schedule_hkt_label_zh = EXCLUDED.schedule_hkt_label_zh,
  is_schedule_editable  = EXCLUDED.is_schedule_editable,
  min_interval_minutes  = EXCLUDED.min_interval_minutes,
  cron_command          = EXCLUDED.cron_command,
  updated_at            = now();
