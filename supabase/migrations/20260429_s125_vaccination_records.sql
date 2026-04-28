-- S12.5: Vaccination records — Department of Health reporting

CREATE TABLE IF NOT EXISTS public.vaccination_records (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id              uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  branch_id                uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

  vaccine_type             text NOT NULL
                           CHECK (vaccine_type IN (
                             'INFLUENZA',
                             'PNEUMOCOCCAL_PCV13',
                             'PNEUMOCOCCAL_PPSV23',
                             'COVID19_BIVALENT',
                             'COVID19_OMICRON',
                             'SHINGLES_RECOMBINANT',
                             'OTHER'
                           )),
  vaccine_brand            text,
  batch_number             text NOT NULL,

  administered_date        date NOT NULL,
  administered_by_staff_id uuid REFERENCES public.staff(id),
  administered_by_doctor   text,
  injection_site           text CHECK (injection_site IN ('LEFT_DELTOID','RIGHT_DELTOID','OTHER')),

  consent_obtained         boolean NOT NULL DEFAULT false,
  consent_by               text,
  consent_date             date,

  adverse_reaction         boolean NOT NULL DEFAULT false,
  adverse_reaction_notes   text,

  next_dose_due_date       date,
  expiry_relevant_date     date,

  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  created_by_staff_id      uuid REFERENCES public.staff(id),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vaccination_resident
  ON public.vaccination_records(resident_id, administered_date DESC);
CREATE INDEX IF NOT EXISTS idx_vaccination_due
  ON public.vaccination_records(next_dose_due_date)
  WHERE next_dose_due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vaccination_branch_type
  ON public.vaccination_records(branch_id, vaccine_type, administered_date DESC);

ALTER TABLE public.vaccination_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vaccination_records_select"
  ON public.vaccination_records FOR SELECT TO authenticated
  USING (public.has_branch_access(branch_id));

CREATE POLICY "vaccination_records_insert"
  ON public.vaccination_records FOR INSERT TO authenticated
  WITH CHECK (
    public.has_branch_access(branch_id)
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE supabase_auth_id = auth.uid()
        AND role IN ('SYSTEM_ADMIN','BRANCH_ADMIN','SENIOR_NURSE','NURSE')
        AND status = 'ACTIVE' AND deleted_at IS NULL
    )
  );

CREATE POLICY "vaccination_records_update"
  ON public.vaccination_records FOR UPDATE TO authenticated
  USING (
    public.has_branch_access(branch_id)
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE supabase_auth_id = auth.uid()
        AND role IN ('SYSTEM_ADMIN','BRANCH_ADMIN','SENIOR_NURSE')
        AND status = 'ACTIVE' AND deleted_at IS NULL
    )
  );

COMMENT ON TABLE public.vaccination_records IS
  'Vaccination history. Department of Health reporting requirement. Batch number mandatory for traceability.';
