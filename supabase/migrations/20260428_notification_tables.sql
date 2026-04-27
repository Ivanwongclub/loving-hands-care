-- Notification templates
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  event_type       text NOT NULL,
  channel          text NOT NULL CHECK (channel IN ('WHATSAPP','SMS','EMAIL')),
  language         text NOT NULL DEFAULT 'zh-HK',
  subject          text,
  body             text NOT NULL,
  variables        text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active        boolean NOT NULL DEFAULT true,
  is_system_default boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Partial unique indexes to handle nullable branch_id correctly
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_templates_branch
  ON public.notification_templates(branch_id, event_type, channel, language)
  WHERE branch_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_templates_system
  ON public.notification_templates(event_type, channel, language)
  WHERE branch_id IS NULL;

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_templates_select"
  ON public.notification_templates FOR SELECT TO authenticated
  USING (branch_id IS NULL OR public.has_branch_access(branch_id));

CREATE POLICY "notif_templates_write"
  ON public.notification_templates FOR ALL TO authenticated
  USING (
    branch_id IS NOT NULL
    AND public.has_branch_access(branch_id)
    AND EXISTS (
      SELECT 1 FROM public.staff
      WHERE supabase_auth_id = auth.uid()
        AND role IN ('SYSTEM_ADMIN','BRANCH_ADMIN')
        AND status = 'ACTIVE' AND deleted_at IS NULL
    )
  );

-- Seed system default templates (use NOT EXISTS to handle NULL branch_id correctly)
WITH to_insert (event_type, channel, language, body, variables) AS (
  VALUES
    ('DCU_CHECKIN',  'WHATSAPP', 'zh-HK',
     '您好！{resident_name} 已於 {time} 到達 {branch_name}。如有查詢請致電 {branch_phone}。',
     ARRAY['resident_name','time','branch_name','branch_phone']),
    ('DCU_CHECKIN',  'WHATSAPP', 'en',
     'Hello! {resident_name} has arrived at {branch_name} at {time}. Enquiries: {branch_phone}',
     ARRAY['resident_name','time','branch_name','branch_phone']),
    ('DCU_CHECKOUT', 'WHATSAPP', 'zh-HK',
     '您好！{resident_name} 已於 {time} 離開 {branch_name}。',
     ARRAY['resident_name','time','branch_name']),
    ('DCU_CHECKOUT', 'WHATSAPP', 'en',
     'Hello! {resident_name} has left {branch_name} at {time}.',
     ARRAY['resident_name','time','branch_name']),
    ('DCU_CHECKIN',  'SMS', 'zh-HK',
     '{resident_name} 已於 {time} 到達 {branch_name}。',
     ARRAY['resident_name','time','branch_name']),
    ('DCU_CHECKOUT', 'SMS', 'zh-HK',
     '{resident_name} 已於 {time} 離開 {branch_name}。',
     ARRAY['resident_name','time','branch_name'])
)
INSERT INTO public.notification_templates
  (branch_id, event_type, channel, language, body, variables, is_system_default)
SELECT NULL, t.event_type, t.channel, t.language, t.body, t.variables, true
FROM to_insert t
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_templates
  WHERE branch_id IS NULL
    AND event_type = t.event_type
    AND channel = t.channel
    AND language = t.language
);

-- Notification queue
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       uuid NOT NULL REFERENCES public.branches(id),
  resident_id     uuid REFERENCES public.residents(id),
  event_type      text NOT NULL,
  channel         text NOT NULL DEFAULT 'WHATSAPP',
  recipient_phone text,
  recipient_email text,
  message         text NOT NULL,
  template_id     uuid REFERENCES public.notification_templates(id),
  status          text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','SENDING','DELIVERED','FAILED','FALLBACK_PENDING','EXPIRED')),
  attempt_count   integer NOT NULL DEFAULT 0,
  max_attempts    integer NOT NULL DEFAULT 3,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '2 hours'
);

CREATE INDEX IF NOT EXISTS idx_notif_queue_pending
  ON public.notification_queue(status, next_attempt_at)
  WHERE status IN ('PENDING','FALLBACK_PENDING');

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_queue_branch"
  ON public.notification_queue FOR ALL TO authenticated
  USING (public.has_branch_access(branch_id));

-- Notification log (append-only permanent record)
CREATE TABLE IF NOT EXISTS public.notification_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        uuid NOT NULL,
  resident_id      uuid,
  event_type       text NOT NULL,
  channel          text NOT NULL,
  recipient_masked text NOT NULL,
  message_preview  text,
  status           text NOT NULL
    CHECK (status IN ('DELIVERED','DELIVERED_FALLBACK','FAILED','EXPIRED')),
  failure_reason   text,
  provider_ref     text,
  attempt_count    integer NOT NULL DEFAULT 1,
  sent_at          timestamptz,
  delivered_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_log_branch_time
  ON public.notification_log(branch_id, created_at DESC);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- INSERT-only: no update/delete allowed
CREATE POLICY "notif_log_insert"
  ON public.notification_log FOR INSERT TO authenticated
  WITH CHECK (public.has_branch_access(branch_id));

CREATE POLICY "notif_log_select"
  ON public.notification_log FOR SELECT TO authenticated
  USING (public.has_branch_access(branch_id));
