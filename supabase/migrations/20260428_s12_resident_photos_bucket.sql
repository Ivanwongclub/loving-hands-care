-- Create private bucket for resident facial photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resident-photos',
  'resident-photos',
  false,
  5242880, -- 5 MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Authenticated staff with branch access can read photos
-- Path format: {branch_id}/{resident_id}/photo.{ext}
CREATE POLICY "resident_photos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resident-photos'
    AND public.has_branch_access(
      (string_to_array(name, '/'))[1]::uuid
    )
  );

-- Only BRANCH_ADMIN+ can upload/replace photos (PDPO sensitive data)
CREATE POLICY "resident_photos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resident-photos'
    AND public.has_branch_access(
      (string_to_array(name, '/'))[1]::uuid
    )
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE supabase_auth_id = auth.uid()
        AND role IN ('SYSTEM_ADMIN', 'BRANCH_ADMIN', 'SENIOR_NURSE')
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "resident_photos_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'resident-photos'
    AND public.has_branch_access(
      (string_to_array(name, '/'))[1]::uuid
    )
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE supabase_auth_id = auth.uid()
        AND role IN ('SYSTEM_ADMIN', 'BRANCH_ADMIN', 'SENIOR_NURSE')
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "resident_photos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resident-photos'
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE supabase_auth_id = auth.uid()
        AND role IN ('SYSTEM_ADMIN', 'BRANCH_ADMIN')
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
    )
  );
