-- Schedule alert-escalation-worker to run every 15 minutes
-- Requires pg_cron extension enabled in Supabase dashboard

SELECT cron.schedule(
  'alert-escalation-worker',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/alert-escalation-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )
  $$
);
