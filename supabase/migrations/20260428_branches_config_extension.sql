-- Add system_config column to branches
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS system_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Set canonical defaults for all existing branches
UPDATE public.branches
SET system_config = jsonb_build_object(
  'storage_warn_pct', 75,
  'system_log_retention_days', 30,
  'backup', jsonb_build_object(
    'retention_months', 84,
    'rto_hours', 4,
    'rto_contact', 'support@adaptiveconsultants.hk',
    'alert_email', '',
    'provider', 'B2',
    'bucket', '',
    'region', '',
    'endpoint', ''
  )
)
WHERE system_config = '{}'::jsonb;

-- Ensure notification_config has all required fields with defaults
UPDATE public.branches
SET notification_config = notification_config
  || jsonb_build_object(
    'retry_window_hours', 2,
    'max_attempts', 3,
    'log_retention_days', 90,
    'fallback_delay_seconds', COALESCE((notification_config->>'fallback_delay_seconds')::int, 60),
    'quiet_hours', COALESCE(notification_config->'quiet_hours',
      jsonb_build_object('enabled', false, 'start', '23:00', 'end', '07:00',
        'channels', jsonb_build_array('SMS', 'PUSH')))
  )
WHERE notification_config IS NOT NULL;

-- Ensure sla_config has all required fields with defaults
UPDATE public.branches
SET sla_config = sla_config
  || jsonb_build_object(
    'alert_ack', jsonb_build_object(
      'CRITICAL', 1, 'HIGH', 5, 'MEDIUM', 15, 'LOW', 60),
    'alert_resolve', jsonb_build_object(
      'CRITICAL', 30, 'HIGH', 120, 'MEDIUM', 480, 'LOW', 1440),
    'task_overdue', jsonb_build_object(
      'VITALS', 30, 'MEDICATION_PREP', 15, 'WOUND_CARE', 60,
      'ADL', 120, 'ASSESSMENT', 240, 'OTHER', 60),
    'emar_pass_window_before', 60,
    'emar_pass_window_after', 60,
    'emar_pin_lockout_attempts', 3,
    'incident_followup', jsonb_build_object(
      'CRITICAL', 2, 'HIGH', 24, 'MEDIUM', 72, 'LOW', 168),
    'icp_approval_roles', jsonb_build_array('BRANCH_ADMIN', 'SENIOR_NURSE')
  )
WHERE sla_config IS NOT NULL;
