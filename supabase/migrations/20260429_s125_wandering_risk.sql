-- S12.5: Wandering/elopement risk flag on residents

ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS wandering_risk_level text NOT NULL DEFAULT 'NONE'
    CHECK (wandering_risk_level IN ('NONE','LOW','MEDIUM','HIGH')),
  ADD COLUMN IF NOT EXISTS wandering_risk_assessed_at timestamptz,
  ADD COLUMN IF NOT EXISTS wandering_risk_assessed_by uuid REFERENCES public.staff(id),
  ADD COLUMN IF NOT EXISTS wandering_risk_notes text;

CREATE INDEX IF NOT EXISTS idx_residents_wandering_high
  ON public.residents(branch_id, wandering_risk_level)
  WHERE wandering_risk_level IN ('MEDIUM','HIGH');

COMMENT ON COLUMN public.residents.wandering_risk_level IS
  'Wandering/elopement risk assessment. MEDIUM/HIGH residents must be flagged in all care views.';
