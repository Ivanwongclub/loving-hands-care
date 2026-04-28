-- S12.5: Restraint records — Cap. 459 + Code of Practice Ch. 12.7 compliance

-- Main restraint record (one per restraint application)
CREATE TABLE IF NOT EXISTS public.restraint_records (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id                 uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  branch_id                   uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

  -- Assessment (Code of Practice 12.7.4)
  assessment_date             date NOT NULL,
  assessment_by_staff_id      uuid REFERENCES public.staff(id),
  assessment_by_role          text NOT NULL
                              CHECK (assessment_by_role IN ('NURSE','SENIOR_NURSE','OCCUPATIONAL_THERAPIST','PHYSIOTHERAPIST','DOCTOR')),
  contributing_factors        text NOT NULL,
  alternatives_tried          text NOT NULL,
  risk_to_self                boolean NOT NULL DEFAULT false,
  risk_to_others              boolean NOT NULL DEFAULT false,

  -- Type & specifications (12.7.6)
  restraint_type              text NOT NULL
                              CHECK (restraint_type IN ('WRIST_SOFT_PADDED','VEST','LAP_BELT','BED_RAILS','WHEELCHAIR_BELT','CHEMICAL','OTHER')),
  restraint_specification     text,
  least_restraint_principle   boolean NOT NULL DEFAULT true,

  -- Consent (12.7.6 — written consent required)
  consent_obtained            boolean NOT NULL DEFAULT false,
  consent_by                  text CHECK (consent_by IN ('RESIDENT','FAMILY','LPOA','GUARDIAN')),
  consent_signatory_name      text,
  consent_date                date,
  consent_document_path       text,

  -- Doctor's order (required for chemical restraint)
  doctor_order_required       boolean NOT NULL DEFAULT false,
  doctor_name                 text,
  doctor_order_date           date,

  -- Application
  start_date                  date NOT NULL,
  end_date                    date,
  duration_per_day_minutes    integer CHECK (duration_per_day_minutes IS NULL OR duration_per_day_minutes > 0),

  -- Status
  status                      text NOT NULL DEFAULT 'ACTIVE'
                              CHECK (status IN ('ACTIVE','DISCONTINUED','EXPIRED')),
  discontinued_date           date,
  discontinued_reason         text,
  discontinued_by_staff_id    uuid REFERENCES public.staff(id),

  -- Review
  review_due_date             date NOT NULL,
  last_reviewed_at            timestamptz,
  last_reviewed_by_staff_id   uuid REFERENCES public.staff(id),

  -- Standard
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  created_by_staff_id         uuid REFERENCES public.staff(id),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restraint_resident ON public.restraint_records(resident_id);
CREATE INDEX IF NOT EXISTS idx_restraint_active ON public.restraint_records(branch_id, status)
  WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_restraint_review_due ON public.restraint_records(review_due_date)
  WHERE status = 'ACTIVE';

ALTER TABLE public.restraint_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restraint_records_select"
  ON public.restraint_records FOR SELECT TO authenticated
  USING (public.has_branch_access(branch_id));

CREATE POLICY "restraint_records_insert"
  ON public.restraint_records FOR INSERT TO authenticated
  WITH CHECK (
    public.has_branch_access(branch_id)
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE supabase_auth_id = auth.uid()
        AND role IN ('SYSTEM_ADMIN','BRANCH_ADMIN','SENIOR_NURSE')
        AND status = 'ACTIVE' AND deleted_at IS NULL
    )
  );

CREATE POLICY "restraint_records_update"
  ON public.restraint_records FOR UPDATE TO authenticated
  USING (
    public.has_branch_access(branch_id)
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE supabase_auth_id = auth.uid()
        AND role IN ('SYSTEM_ADMIN','BRANCH_ADMIN','SENIOR_NURSE')
        AND status = 'ACTIVE' AND deleted_at IS NULL
    )
  );

-- Observations sub-table (per-shift observation log)
CREATE TABLE IF NOT EXISTS public.restraint_observations (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restraint_record_id         uuid NOT NULL REFERENCES public.restraint_records(id) ON DELETE CASCADE,
  observed_at                 timestamptz NOT NULL,
  observed_by_staff_id        uuid REFERENCES public.staff(id),

  in_use                      boolean NOT NULL,
  skin_condition              text NOT NULL DEFAULT 'NORMAL'
                              CHECK (skin_condition IN ('NORMAL','REDNESS','BREAKDOWN','BRUISING')),
  circulation_normal          boolean NOT NULL DEFAULT true,
  resident_response           text,
  released_for_minutes        integer CHECK (released_for_minutes IS NULL OR released_for_minutes >= 0),
  notes                       text,

  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restraint_obs_record
  ON public.restraint_observations(restraint_record_id, observed_at DESC);

ALTER TABLE public.restraint_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restraint_obs_select"
  ON public.restraint_observations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restraint_records r
      WHERE r.id = restraint_record_id
        AND public.has_branch_access(r.branch_id)
    )
  );

CREATE POLICY "restraint_obs_insert"
  ON public.restraint_observations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restraint_records r
      JOIN public.staff s ON s.supabase_auth_id = auth.uid()
      WHERE r.id = restraint_record_id
        AND public.has_branch_access(r.branch_id)
        AND s.status = 'ACTIVE'
        AND s.deleted_at IS NULL
    )
  );

COMMENT ON TABLE public.restraint_records IS
  'Cap. 459 RCHE Ordinance + Code of Practice Ch. 12.7 compliance. Restraint use must be assessed, consented, and reviewed.';
COMMENT ON TABLE public.restraint_observations IS
  'Per-shift observation log for active restraint records. Skin condition, circulation, response.';
