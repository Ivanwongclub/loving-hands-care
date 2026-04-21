-- Schedule session-reconcile Edge Function to run nightly at 23:30 HK time (15:30 UTC)
-- Requires pg_cron extension enabled in Supabase dashboard

SELECT cron.schedule(
  'session-reconcile-nightly',
  '30 15 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/session-reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )
  $$
);
