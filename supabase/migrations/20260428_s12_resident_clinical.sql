-- S12: Resident clinical extensions — DNR, advance directive, LPOA, consents

-- Resuscitation status (DNR / DNACPR / AD)
-- This is surfaced as an unmissable badge in the resident header
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'resuscitation_status'
  ) THEN
    CREATE TYPE public.resuscitation_status AS ENUM (
      'FULL_RESUSCITATION',
      'DNACPR',
      'AD_LIMITED'
    );
  END IF;
END $$;

ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS resuscitation_status public.resuscitation_status
    NOT NULL DEFAULT 'FULL_RESUSCITATION',
  ADD COLUMN IF NOT EXISTS resuscitation_status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS resuscitation_status_updated_by uuid REFERENCES public.staff(id),
  ADD COLUMN IF NOT EXISTS advance_directive_on_file boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS advance_directive_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS lpoa_holder_name text,
  ADD COLUMN IF NOT EXISTS lpoa_holder_relationship text,
  ADD COLUMN IF NOT EXISTS lpoa_holder_phone text,
  ADD COLUMN IF NOT EXISTS consents jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS photo_declined boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS photo_updated_at timestamptz;

-- Index for finding residents with DNACPR (used in eMAR + alerts to surface badge)
CREATE INDEX IF NOT EXISTS idx_residents_resuscitation
  ON public.residents(resuscitation_status)
  WHERE resuscitation_status != 'FULL_RESUSCITATION';

-- Set canonical default consents shape for existing residents
UPDATE public.residents
SET consents = jsonb_build_object(
  'family_info_sharing', NOT do_not_share_family,
  'photography_publications', false,
  'telehealth', false,
  'religious_eol_preferences', null,
  'post_mortem_contact_order', '[]'::jsonb
)
WHERE consents = '{}'::jsonb;

COMMENT ON COLUMN public.residents.resuscitation_status IS
  'FULL_RESUSCITATION (default) | DNACPR | AD_LIMITED — surfaced as unmissable badge in resident header';

COMMENT ON COLUMN public.residents.consents IS
  'Granular consent flags: { family_info_sharing, photography_publications, telehealth, religious_eol_preferences, post_mortem_contact_order: [contact_id...] }';

COMMENT ON COLUMN public.residents.photo_declined IS
  'TRUE if resident or family has declined photography. Distinct from absence of photo.';
