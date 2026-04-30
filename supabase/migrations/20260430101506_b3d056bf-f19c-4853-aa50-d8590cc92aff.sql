-- ============================================
-- FEEDBACK LAYER — PHASE 1 SCHEMA + RLS
-- ============================================

-- TABLES
CREATE TABLE IF NOT EXISTS public.feedback_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_route text NOT NULL,
  page_title text,
  feedback_id text,
  selector_fallback text,
  x_percent numeric(5,2),
  y_percent numeric(5,2),
  viewport_width integer,
  element_html text,
  comment_text text NOT NULL CHECK (char_length(comment_text) BETWEEN 1 AND 1000),
  pin_number integer NOT NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  author_name text NOT NULL,
  author_role text NOT NULL,
  author_branch_id uuid,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'triaged', 'in_progress', 'resolved', 'closed')),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  resolution_note text,
  reopened_count integer NOT NULL DEFAULT 0,
  ai_category text,
  ai_severity text CHECK (ai_severity IS NULL OR ai_severity IN ('low', 'medium', 'high', 'critical')),
  hotspot_group_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_pins_route ON public.feedback_pins(page_route);
CREATE INDEX IF NOT EXISTS idx_feedback_pins_status ON public.feedback_pins(status);
CREATE INDEX IF NOT EXISTS idx_feedback_pins_author ON public.feedback_pins(author_id);
CREATE INDEX IF NOT EXISTS idx_feedback_pins_role ON public.feedback_pins(author_role);
CREATE INDEX IF NOT EXISTS idx_feedback_pins_feedback_id
  ON public.feedback_pins(feedback_id) WHERE feedback_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_pins_created_at
  ON public.feedback_pins(created_at DESC);

CREATE TABLE IF NOT EXISTS public.feedback_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id uuid NOT NULL REFERENCES public.feedback_pins(id) ON DELETE CASCADE,
  comment_type text NOT NULL DEFAULT 'reply'
    CHECK (comment_type IN ('reply', 'status_update', 'resolution_note')),
  comment_text text NOT NULL CHECK (char_length(comment_text) BETWEEN 1 AND 1000),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  author_name text NOT NULL,
  author_role text NOT NULL,
  author_branch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_comments_pin
  ON public.feedback_comments(pin_id, created_at);

CREATE TABLE IF NOT EXISTS public.feedback_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id uuid NOT NULL REFERENCES public.feedback_pins(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type text NOT NULL DEFAULT 'upvote' CHECK (reaction_type IN ('upvote')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pin_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_feedback_reactions_pin ON public.feedback_reactions(pin_id);

-- TRIGGERS
CREATE OR REPLACE FUNCTION public.set_feedback_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feedback_pins_set_updated_at ON public.feedback_pins;
CREATE TRIGGER feedback_pins_set_updated_at
  BEFORE UPDATE ON public.feedback_pins
  FOR EACH ROW EXECUTE FUNCTION public.set_feedback_updated_at();

CREATE OR REPLACE FUNCTION public.assign_feedback_pin_number()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(pin_number), 0) + 1
    INTO next_num
    FROM public.feedback_pins
    WHERE page_route = NEW.page_route;
  NEW.pin_number = next_num;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feedback_pins_assign_number ON public.feedback_pins;
CREATE TRIGGER feedback_pins_assign_number
  BEFORE INSERT ON public.feedback_pins
  FOR EACH ROW EXECUTE FUNCTION public.assign_feedback_pin_number();

-- RLS HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.feedback_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.staff
  WHERE supabase_auth_id = auth.uid()
    AND status = 'ACTIVE'
    AND deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.feedback_user_is_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.feedback_user_role() IN ('SYSTEM_ADMIN', 'BRANCH_ADMIN', 'SENIOR_NURSE');
$$;

CREATE OR REPLACE FUNCTION public.feedback_user_is_dev()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.feedback_user_role() = 'SYSTEM_ADMIN';
$$;

GRANT EXECUTE ON FUNCTION public.feedback_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.feedback_user_is_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.feedback_user_is_dev() TO authenticated;

-- ENABLE RLS
ALTER TABLE public.feedback_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_reactions ENABLE ROW LEVEL SECURITY;

-- RLS — feedback_pins
DROP POLICY IF EXISTS "feedback_pins_select" ON public.feedback_pins;
CREATE POLICY "feedback_pins_select"
  ON public.feedback_pins FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE supabase_auth_id = auth.uid()
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "feedback_pins_insert" ON public.feedback_pins;
CREATE POLICY "feedback_pins_insert"
  ON public.feedback_pins FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE supabase_auth_id = auth.uid()
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "feedback_pins_update_manager" ON public.feedback_pins;
CREATE POLICY "feedback_pins_update_manager"
  ON public.feedback_pins FOR UPDATE
  TO authenticated
  USING (public.feedback_user_is_manager())
  WITH CHECK (public.feedback_user_is_manager());

DROP POLICY IF EXISTS "feedback_pins_update_author" ON public.feedback_pins;
CREATE POLICY "feedback_pins_update_author"
  ON public.feedback_pins FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    AND created_at > now() - interval '5 minutes'
  )
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "feedback_pins_delete" ON public.feedback_pins;
CREATE POLICY "feedback_pins_delete"
  ON public.feedback_pins FOR DELETE
  TO authenticated
  USING (public.feedback_user_is_dev());

-- RLS — feedback_comments
DROP POLICY IF EXISTS "feedback_comments_select" ON public.feedback_comments;
CREATE POLICY "feedback_comments_select"
  ON public.feedback_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE supabase_auth_id = auth.uid()
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "feedback_comments_insert" ON public.feedback_comments;
CREATE POLICY "feedback_comments_insert"
  ON public.feedback_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      comment_type = 'reply'
      OR (
        comment_type IN ('status_update', 'resolution_note')
        AND public.feedback_user_is_manager()
      )
    )
  );

DROP POLICY IF EXISTS "feedback_comments_delete" ON public.feedback_comments;
CREATE POLICY "feedback_comments_delete"
  ON public.feedback_comments FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- RLS — feedback_reactions
DROP POLICY IF EXISTS "feedback_reactions_select" ON public.feedback_reactions;
CREATE POLICY "feedback_reactions_select"
  ON public.feedback_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE supabase_auth_id = auth.uid()
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "feedback_reactions_insert" ON public.feedback_reactions;
CREATE POLICY "feedback_reactions_insert"
  ON public.feedback_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "feedback_reactions_delete" ON public.feedback_reactions;
CREATE POLICY "feedback_reactions_delete"
  ON public.feedback_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- DOCUMENTATION
COMMENT ON TABLE public.feedback_pins IS
  'Phase 1 feedback layer — pinned comments on UI elements. Removable: when env flag VITE_ENABLE_FEEDBACK=false the application stops querying this table but the schema persists.';
COMMENT ON COLUMN public.feedback_pins.feedback_id IS
  'data-feedback-id attribute value. Preferred targeting method. Survives layout changes.';
COMMENT ON COLUMN public.feedback_pins.x_percent IS
  'Fallback coordinate (0-100% of document width) when feedback_id is unavailable.';
COMMENT ON COLUMN public.feedback_pins.element_html IS
  'Truncated outerHTML at pin time, with text content stripped to prevent PII leak. 2KB cap.';
COMMENT ON COLUMN public.feedback_pins.author_role IS
  'HMS role snapshotted at pin time. Possible values: SYSTEM_ADMIN, BRANCH_ADMIN, SENIOR_NURSE, NURSE, CAREGIVER.';
COMMENT ON COLUMN public.feedback_pins.ai_category IS
  'Phase 2 hook. Populated by categorize-pin Edge Function (not yet built).';
COMMENT ON FUNCTION public.feedback_user_is_manager IS
  'Returns true for SYSTEM_ADMIN, BRANCH_ADMIN, SENIOR_NURSE. These are the manager+ tier in feedback context.';