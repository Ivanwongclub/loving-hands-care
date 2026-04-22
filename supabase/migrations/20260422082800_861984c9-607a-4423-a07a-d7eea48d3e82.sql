CREATE POLICY "branches_select"
  ON public.branches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.supabase_auth_id = auth.uid()
        AND s.status = 'ACTIVE'
        AND s.deleted_at IS NULL
        AND (s.role = 'SYSTEM_ADMIN' OR public.branches.id = ANY(s.branch_ids))
    )
  );