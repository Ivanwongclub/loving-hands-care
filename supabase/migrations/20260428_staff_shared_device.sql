-- Add shared device account support to staff table
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS is_shared_device boolean NOT NULL DEFAULT false;

-- Index for filtering shared vs personal accounts
CREATE INDEX IF NOT EXISTS idx_staff_shared_device
  ON public.staff(is_shared_device)
  WHERE is_shared_device = true;

-- Audit: add category column to audit_logs
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'USER_ACTIVITY';

CREATE INDEX IF NOT EXISTS idx_audit_logs_category
  ON public.audit_logs(category, branch_id, created_at DESC);

-- Backfill existing auth-related rows
UPDATE public.audit_logs
SET category = 'AUTH'
WHERE action IN (
  'STAFF_LOGIN','STAFF_LOGOUT','LOGIN_FAILED',
  'PIN_FAILED','PIN_LOCKED','PIN_UNLOCKED','PIN_RESET'
)
AND category = 'USER_ACTIVITY';

UPDATE public.audit_logs
SET category = 'SYSTEM_JOB'
WHERE actor_id IS NULL
AND action IN ('ALERT_ESCALATED','SESSION_RECONCILED','MED_OVERDUE')
AND category = 'USER_ACTIVITY';
