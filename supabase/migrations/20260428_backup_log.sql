CREATE TABLE IF NOT EXISTS public.backup_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type     text NOT NULL CHECK (backup_type IN ('FULL','INCREMENTAL','DAILY','WEEKLY','MONTHLY','MANUAL')),
  status          text NOT NULL CHECK (status IN ('RUNNING','SUCCESS','FAILED')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  file_size_bytes bigint,
  file_path       text,
  checksum        text,
  provider        text CHECK (provider IN ('B2','S3','GCS')),
  error_message   text,
  triggered_by    text NOT NULL DEFAULT 'SCHEDULED',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backup_log_time
  ON public.backup_log(started_at DESC);

ALTER TABLE public.backup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup_log_insert"
  ON public.backup_log FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "backup_log_select"
  ON public.backup_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.staff
    WHERE supabase_auth_id = auth.uid()
      AND role = 'SYSTEM_ADMIN'
      AND status = 'ACTIVE' AND deleted_at IS NULL
  ));
