import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

interface VerifyPINRequest {
  staff_id: string
  pin: string
  emar_record_id: string
}

const MAX_ATTEMPTS = 3
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body: VerifyPINRequest = await req.json()
    const { staff_id, pin, emar_record_id } = body

    if (!staff_id || !pin || !emar_record_id) {
      return new Response(
        JSON.stringify({ success: false, locked: false, message: 'Missing required fields' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    if (!/^\d{4}$/.test(pin)) {
      return new Response(
        JSON.stringify({ success: false, locked: false, message: 'Invalid PIN format' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const { data: staff, error: staffErr } = await supabase
      .from('staff')
      .select('id, pin_hash, pin_failed_attempts, pin_locked_at, status, role')
      .eq('id', staff_id)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .single()

    if (staffErr || !staff) {
      return new Response(
        JSON.stringify({ success: false, locked: false, message: 'Staff not found' }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    if (staff.pin_locked_at) {
      return new Response(
        JSON.stringify({ success: false, locked: true, message: 'PIN locked — contact supervisor' }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const clinicalRoles = ['SENIOR_NURSE', 'NURSE', 'BRANCH_ADMIN', 'SYSTEM_ADMIN']
    if (!clinicalRoles.includes(staff.role)) {
      return new Response(
        JSON.stringify({ success: false, locked: false, message: 'Insufficient role' }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    if (!staff.pin_hash) {
      return new Response(
        JSON.stringify({ success: false, locked: false, message: 'PIN not configured' }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const pinValid = await bcrypt.compare(pin, staff.pin_hash)

    if (pinValid) {
      await supabase
        .from('staff')
        .update({ pin_failed_attempts: 0, pin_locked_at: null })
        .eq('id', staff_id)

      await supabase
        .from('emar_records')
        .update({ shift_pin_verified: true })
        .eq('id', emar_record_id)

      return new Response(
        JSON.stringify({ success: true, locked: false }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    } else {
      const newAttempts = (staff.pin_failed_attempts ?? 0) + 1
      const shouldLock = newAttempts >= MAX_ATTEMPTS

      await supabase
        .from('staff')
        .update({
          pin_failed_attempts: newAttempts,
          pin_locked_at: shouldLock ? new Date().toISOString() : null,
        })
        .eq('id', staff_id)

      return new Response(
        JSON.stringify({
          success: false,
          locked: shouldLock,
          message: shouldLock
            ? 'PIN locked after 3 failed attempts — contact supervisor'
            : `Incorrect PIN (${newAttempts}/${MAX_ATTEMPTS} attempts)`,
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }
  } catch (err) {
    console.error('[emar-verify-pin] Error:', (err as Error).message)
    return new Response(
      JSON.stringify({ success: false, locked: false, message: 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
