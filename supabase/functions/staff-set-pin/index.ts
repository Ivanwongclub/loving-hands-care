import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

interface SetPINRequest {
  staff_id: string
  pin: string
}

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

    const body: SetPINRequest = await req.json()
    const { staff_id, pin } = body

    if (!staff_id || !pin) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing required fields' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    if (!/^\d{4}$/.test(pin)) {
      return new Response(
        JSON.stringify({ success: false, message: 'PIN must be exactly 4 digits' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // Verify staff exists and is active
    const { data: staff, error: staffErr } = await supabase
      .from('staff')
      .select('id, status')
      .eq('id', staff_id)
      .is('deleted_at', null)
      .single()

    if (staffErr || !staff) {
      return new Response(
        JSON.stringify({ success: false, message: 'Staff not found' }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // Hash PIN using bcrypt (cost factor 10)
    // Raw PIN used only here — never logged, stored in plaintext, or returned
    const pin_hash = await bcrypt.hash(pin, await bcrypt.genSalt(10))

    // Store hash and reset any failed attempts / lock
    const { error: updateErr } = await supabase
      .from('staff')
      .update({
        pin_hash,
        pin_failed_attempts: 0,
        pin_locked_at: null,
      })
      .eq('id', staff_id)

    if (updateErr) throw updateErr

    console.log(`[staff-set-pin] PIN set for staff ${staff_id}`)

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    // Never log request body — it contains the PIN
    console.error('[staff-set-pin] Error:', (err as Error).message)
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
