import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

interface ReportRequest {
  branch_id: string
  date_from: string  // YYYY-MM-DD
  date_to: string    // YYYY-MM-DD
}

serve(async (req: Request) => {
  try {
    const { branch_id, date_from, date_to }: ReportRequest = await req.json()

    if (!branch_id || !date_from || !date_to) {
      return new Response(
        JSON.stringify({ error: 'branch_id, date_from, date_to are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch branch info
    const { data: branch } = await supabase
      .from('branches')
      .select('name, name_zh, swd_code')
      .eq('id', branch_id)
      .single()

    // Fetch sessions with resident and enrollment info
    const { data: sessions, error: sessErr } = await supabase
      .from('attendance_sessions')
      .select(`
        session_date,
        check_in_at,
        check_out_at,
        duration_minutes,
        status,
        swd_flagged,
        dcu_enrollments:enrollment_id (
          resident_id,
          residents:resident_id (
            name,
            name_zh
          )
        )
      `)
      .eq('branch_id', branch_id)
      .gte('session_date', date_from)
      .lte('session_date', date_to)
      .order('session_date', { ascending: true })

    if (sessErr) throw sessErr

    // Build Excel rows
    const rows = (sessions ?? []).map((s) => {
      const enrollment = s.dcu_enrollments as { resident_id: string; residents: { name: string; name_zh: string } | null } | null
      const resident = enrollment?.residents
      const checkIn = s.check_in_at ? new Date(s.check_in_at).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''
      const checkOut = s.check_out_at ? new Date(s.check_out_at).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''
      const hours = s.duration_minutes ? `${Math.floor(s.duration_minutes / 60)}h ${s.duration_minutes % 60}m` : ''

      return {
        '日期 Date': s.session_date,
        '院友姓名 Name': resident?.name_zh ?? '',
        'English Name': resident?.name ?? '',
        '簽到 Check-In': checkIn,
        '簽退 Check-Out': checkOut,
        '時數 Hours': hours,
        '狀態 Status': s.status,
        '手動登記 Manual': s.swd_flagged ? 'Y' : '',
      }
    })

    // Create workbook
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)

    // Column widths
    ws['!cols'] = [
      { wch: 14 }, // Date
      { wch: 16 }, // Name ZH
      { wch: 20 }, // Name EN
      { wch: 12 }, // Check-in
      { wch: 12 }, // Check-out
      { wch: 12 }, // Hours
      { wch: 12 }, // Status
      { wch: 10 }, // Manual
    ]

    const sheetName = `${date_from} to ${date_to}`
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const filename = `SWD_Attendance_${branch?.swd_code ?? branch_id}_${date_from}_${date_to}.xlsx`

    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (err) {
    console.error('[swd-report-generate] Error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
