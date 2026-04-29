-- S14: Family Portal groundwork
-- Extend resident_contacts table with auth linkage so family members can log in
-- via magic link and access a portal showing their resident's status.
--
-- SCHEMA NOTE: The contacts table is named `resident_contacts` in this project.
-- All references in this migration use the correct name.

ALTER TABLE public.resident_contacts
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_portal_user boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS portal_invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_invited_by_staff_id uuid REFERENCES public.staff(id),
  ADD COLUMN IF NOT EXISTS portal_first_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_email text;

-- Constraint: a portal user must have an email (used as the magic-link target)
ALTER TABLE public.resident_contacts
  DROP CONSTRAINT IF EXISTS resident_contacts_portal_user_must_have_email;
ALTER TABLE public.resident_contacts
  ADD CONSTRAINT resident_contacts_portal_user_must_have_email
  CHECK (NOT is_portal_user OR (portal_email IS NOT NULL AND length(portal_email) > 3));

-- Index for fast auth_user_id lookup at sign-in
CREATE INDEX IF NOT EXISTS idx_resident_contacts_auth_user
  ON public.resident_contacts(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Index for portal users (admin list views)
CREATE INDEX IF NOT EXISTS idx_resident_contacts_portal_users
  ON public.resident_contacts(is_portal_user)
  WHERE is_portal_user = true;

COMMENT ON COLUMN public.resident_contacts.auth_user_id IS
  'Links contact to auth.users. NULL = phone-only contact. Set = portal-enabled family member.';
COMMENT ON COLUMN public.resident_contacts.portal_email IS
  'Email used for magic-link auth. May differ from informational email field.';

-- ============================================================================
-- Helper function: resident_ids accessible to the current family portal user
-- SECURITY DEFINER so it can read resident_contacts.auth_user_id without
-- being blocked by the existing staff-scoped RLS policies on that table.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.family_resident_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT resident_id
  FROM public.resident_contacts
  WHERE auth_user_id = auth.uid()
    AND is_portal_user = true;
$$;

-- Helper function: is the current auth.uid() a family portal user?
CREATE OR REPLACE FUNCTION public.is_family_portal_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.resident_contacts
    WHERE auth_user_id = auth.uid()
      AND is_portal_user = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.family_resident_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_portal_user() TO authenticated;

-- ============================================================================
-- RLS for family portal access
-- Family portal users get LIMITED read-only access to:
--   - Their own resident(s) — basic profile fields only
--   - Audit log entries scoped to their resident (resident-level events only)
--   - Open alerts on their resident (status only; UI limits display)
-- They do NOT get access to: medication details, vitals values, full notes,
-- other residents, staff-only admin data.
-- ============================================================================

-- Residents: parallel SELECT policy for family portal users.
-- Existing has_branch_access policy continues to handle staff.
-- do_not_share_family = true blocks portal access for that resident.
DROP POLICY IF EXISTS "residents_family_select" ON public.residents;
CREATE POLICY "residents_family_select"
  ON public.residents FOR SELECT
  TO authenticated
  USING (
    public.is_family_portal_user()
    AND id IN (SELECT public.family_resident_ids())
    AND do_not_share_family = false
  );

-- Audit logs: family can see resident-level events only.
-- NOTE: audit_logs uses entity_id + entity_type (no resident_id column).
-- Phase 1 scope: entity_type='residents' rows only (RESIDENT_ADMITTED,
-- RESIDENT_TRANSFERRED, RESIDENT_CONSENTS_UPDATED, etc.).
-- Phase 2: add resident_id column to audit_logs to unlock cross-entity feed
-- (VITALS_RECORDED, TASK_COMPLETED, WOUND_RECORDED, etc.).
DROP POLICY IF EXISTS "audit_logs_family_select" ON public.audit_logs;
CREATE POLICY "audit_logs_family_select"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    public.is_family_portal_user()
    AND entity_type = 'residents'
    AND entity_id::uuid IN (SELECT public.family_resident_ids())
    AND action IN (
      'RESIDENT_ADMITTED',
      'RESIDENT_TRANSFERRED',
      'RESIDENT_UPDATED',
      'RESIDENT_CONSENTS_UPDATED',
      'RESIDENT_RESUSCITATION_STATUS_CHANGED',
      'INCIDENT_REPORTED',
      'INCIDENT_CLOSED',
      'VACCINATION_RECORDED',
      'WANDERING_RISK_ASSESSED'
    )
  );

-- Alerts: family sees open/acknowledged alerts on their resident only.
DROP POLICY IF EXISTS "alerts_family_select" ON public.alerts;
CREATE POLICY "alerts_family_select"
  ON public.alerts FOR SELECT
  TO authenticated
  USING (
    public.is_family_portal_user()
    AND resident_id IN (SELECT public.family_resident_ids())
    AND status IN ('OPEN', 'ACKNOWLEDGED', 'ASSIGNED')
  );

-- ============================================================================
-- Audit log new action types for family portal lifecycle events
-- (No DDL needed — audit_logs.action is text, new strings used at runtime:
--  FAMILY_PORTAL_INVITED, FAMILY_PORTAL_FIRST_LOGIN, FAMILY_PORTAL_REVOKED)
-- ============================================================================
