import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface NotifyPayload {
  attendance_event_id: string
  enrollment_id: string
  resident_name_zh: string
  event_type: 'CHECK_IN' | 'CHECK_OUT'
  event_time: string
  branch_id: string
}

serve(async (req: Request) => {
  try {
    const payload: NotifyPayload = await req.json()

    // Validate required fields
    if (!payload.attendance_event_id || !payload.enrollment_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // STUB: Log the payload — replace this block with WhatsApp/SMS call in S3-C1
    console.log('[attendance-notify STUB] Notification payload received:', {
      event_id: payload.attendance_event_id,
      resident: payload.resident_name_zh,
      event_type: payload.event_type,
      event_time: payload.event_time,
    })

    // STUB: Look up family contacts with consent_notifications = true
    // and log what would be sent
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: enrollment } = await supabaseClient
      .from('dcu_enrollments')
      .select('resident_id')
      .eq('id', payload.enrollment_id)
      .single()

    if (enrollment?.resident_id) {
      const { data: contacts } = await supabaseClient
        .from('resident_contacts')
        .select('name, phone_whatsapp, phone_sms')
        .eq('resident_id', enrollment.resident_id)
        .eq('consent_notifications', true)
        .is('deleted_at', null)

      console.log('[attendance-notify STUB] Would notify contacts:', contacts)

      // Write to family_notification_log with status QUEUED
      // This ensures the log table is populated even in stub mode
      if (contacts && contacts.length > 0) {
        const { data: contactFull } = await supabaseClient
          .from('resident_contacts')
          .select('id, phone_whatsapp, phone_sms')
          .eq('resident_id', enrollment.resident_id)
          .eq('consent_notifications', true)
          .is('deleted_at', null)

        if (contactFull) {
          for (const contact of contactFull) {
            const channel = contact.phone_whatsapp ? 'WHATSAPP' : 'SMS'
            const phone = contact.phone_whatsapp ?? contact.phone_sms
            if (!phone) continue

            await supabaseClient.from('family_notification_log').insert({
              attendance_event_id: payload.attendance_event_id,
              contact_id: contact.id,
              channel,
              recipient_phone: phone,
              message_template: 'STUB_TEMPLATE',
              message_body: `[STUB] ${payload.resident_name_zh} ${payload.event_type === 'CHECK_IN' ? '已簽到' : '已簽退'} at ${payload.event_time}`,
              status: 'QUEUED',
            })
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, stub: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[attendance-notify] Error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
