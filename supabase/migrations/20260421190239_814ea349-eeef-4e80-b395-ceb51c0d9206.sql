-- Private storage bucket for resident documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('resident-documents', 'resident-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Helper: check if a storage object's resident belongs to a branch the
-- current user has access to. The path layout is:
--   residents/{residentId}/{document_type}/{filename}
-- So the resident_id is the second path segment (index 2 in storage.foldername).
CREATE OR REPLACE FUNCTION public.can_access_resident_document(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM residents r
    WHERE r.id::text = (storage.foldername(object_name))[2]
      AND public.has_branch_access(r.branch_id)
  );
$$;

-- RLS policies on storage.objects, scoped to this bucket
DROP POLICY IF EXISTS "resident_docs_select" ON storage.objects;
CREATE POLICY "resident_docs_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resident-documents'
  AND public.can_access_resident_document(name)
);

DROP POLICY IF EXISTS "resident_docs_insert" ON storage.objects;
CREATE POLICY "resident_docs_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resident-documents'
  AND public.can_access_resident_document(name)
);

-- No UPDATE/DELETE policies — documents are immutable once uploaded.

-- Make sure the resident_documents and resident_contacts tables have RLS
-- + branch-scoped policies aligned with residents access.
ALTER TABLE public.resident_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resident_documents_select" ON public.resident_documents;
CREATE POLICY "resident_documents_select"
ON public.resident_documents FOR SELECT
TO authenticated
USING (public.has_branch_access(branch_id));

DROP POLICY IF EXISTS "resident_documents_insert" ON public.resident_documents;
CREATE POLICY "resident_documents_insert"
ON public.resident_documents FOR INSERT
TO authenticated
WITH CHECK (public.has_branch_access(branch_id));

ALTER TABLE public.resident_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resident_contacts_select" ON public.resident_contacts;
CREATE POLICY "resident_contacts_select"
ON public.resident_contacts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM residents r
    WHERE r.id = resident_contacts.resident_id
      AND public.has_branch_access(r.branch_id)
  )
);

DROP POLICY IF EXISTS "resident_contacts_insert" ON public.resident_contacts;
CREATE POLICY "resident_contacts_insert"
ON public.resident_contacts FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM residents r
    WHERE r.id = resident_contacts.resident_id
      AND public.has_branch_access(r.branch_id)
  )
);

DROP POLICY IF EXISTS "resident_contacts_update" ON public.resident_contacts;
CREATE POLICY "resident_contacts_update"
ON public.resident_contacts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM residents r
    WHERE r.id = resident_contacts.resident_id
      AND public.has_branch_access(r.branch_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM residents r
    WHERE r.id = resident_contacts.resident_id
      AND public.has_branch_access(r.branch_id)
  )
);

-- Soft-delete column for contacts (immutable history; we never hard delete)
ALTER TABLE public.resident_contacts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Bed assignments: ensure read access is branch-scoped
ALTER TABLE public.bed_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bed_assignments_select" ON public.bed_assignments;
CREATE POLICY "bed_assignments_select"
ON public.bed_assignments FOR SELECT
TO authenticated
USING (public.has_branch_access(branch_id));

-- Locations table needs read + status update for bed status changes
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "locations_select" ON public.locations;
CREATE POLICY "locations_select"
ON public.locations FOR SELECT
TO authenticated
USING (public.has_branch_access(branch_id));

DROP POLICY IF EXISTS "locations_update" ON public.locations;
CREATE POLICY "locations_update"
ON public.locations FOR UPDATE
TO authenticated
USING (public.has_branch_access(branch_id))
WITH CHECK (public.has_branch_access(branch_id));