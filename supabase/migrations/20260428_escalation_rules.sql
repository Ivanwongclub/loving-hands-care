CREATE TABLE IF NOT EXISTS public.escalation_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  alert_severity public.alert_severity NOT NULL,
  level          integer NOT NULL CHECK (level IN (1, 2, 3)),
  delay_minutes  integer NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
  notify_roles   text[] NOT NULL,
  channels       text[] NOT NULL,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, alert_severity, level)
);

CREATE INDEX IF NOT EXISTS idx_escalation_rules_branch
  ON public.escalation_rules(branch_id, alert_severity, level)
  WHERE is_active = true;

ALTER TABLE public.escalation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escalation_rules_select"
  ON public.escalation_rules FOR SELECT TO authenticated
  USING (public.has_branch_access(branch_id));

CREATE POLICY "escalation_rules_write"
  ON public.escalation_rules FOR ALL TO authenticated
  USING (
    public.has_branch_access(branch_id)
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE supabase_auth_id = auth.uid()
        AND role = 'SYSTEM_ADMIN'
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
    )
  );

-- Seed defaults for existing branches
INSERT INTO public.escalation_rules
  (branch_id, alert_severity, level, delay_minutes, notify_roles, channels)
SELECT
  b.id,
  s.severity,
  s.level,
  s.delay_minutes,
  s.notify_roles,
  s.channels
FROM public.branches b
CROSS JOIN (VALUES
  ('CRITICAL'::public.alert_severity, 1, 0,  ARRAY['SENIOR_NURSE'],  ARRAY['PUSH']),
  ('CRITICAL'::public.alert_severity, 2, 2,  ARRAY['BRANCH_ADMIN'],  ARRAY['PUSH','SMS']),
  ('CRITICAL'::public.alert_severity, 3, 30, ARRAY['SYSTEM_ADMIN'],  ARRAY['SMS']),
  ('HIGH'::public.alert_severity,     1, 0,  ARRAY['SENIOR_NURSE'],  ARRAY['PUSH']),
  ('HIGH'::public.alert_severity,     2, 15, ARRAY['BRANCH_ADMIN'],  ARRAY['PUSH']),
  ('MEDIUM'::public.alert_severity,   1, 15, ARRAY['SENIOR_NURSE'],  ARRAY['PUSH']),
  ('LOW'::public.alert_severity,      1, 60, ARRAY['NURSE'],         ARRAY['PUSH'])
) AS s(severity, level, delay_minutes, notify_roles, channels)
ON CONFLICT (branch_id, alert_severity, level) DO NOTHING;

-- Function + trigger to seed defaults on new branch creation
CREATE OR REPLACE FUNCTION public.seed_branch_escalation_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.escalation_rules
    (branch_id, alert_severity, level, delay_minutes, notify_roles, channels)
  VALUES
    (NEW.id, 'CRITICAL', 1, 0,  ARRAY['SENIOR_NURSE'],  ARRAY['PUSH']),
    (NEW.id, 'CRITICAL', 2, 2,  ARRAY['BRANCH_ADMIN'],  ARRAY['PUSH','SMS']),
    (NEW.id, 'CRITICAL', 3, 30, ARRAY['SYSTEM_ADMIN'],  ARRAY['SMS']),
    (NEW.id, 'HIGH',     1, 0,  ARRAY['SENIOR_NURSE'],  ARRAY['PUSH']),
    (NEW.id, 'HIGH',     2, 15, ARRAY['BRANCH_ADMIN'],  ARRAY['PUSH']),
    (NEW.id, 'MEDIUM',   1, 15, ARRAY['SENIOR_NURSE'],  ARRAY['PUSH']),
    (NEW.id, 'LOW',      1, 60, ARRAY['NURSE'],         ARRAY['PUSH'])
  ON CONFLICT (branch_id, alert_severity, level) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_escalation_defaults ON public.branches;
CREATE TRIGGER trg_seed_escalation_defaults
  AFTER INSERT ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.seed_branch_escalation_defaults();
