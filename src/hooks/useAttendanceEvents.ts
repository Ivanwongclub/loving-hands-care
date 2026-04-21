import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export interface AttendanceEventRow extends Tables<"attendance_events"> {
  dcu_enrollments: {
    id: string;
    residents: { id: string; name: string; name_zh: string } | null;
  } | null;
}

interface UseAttendanceEventsParams {
  enrollmentId?: string | null;
  branchId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

/**
 * Fetches attendance events scoped to an enrollment or to a branch+date range.
 * Joins enrollment and resident for display.
 */
export function useAttendanceEvents({
  enrollmentId,
  branchId,
  dateFrom,
  dateTo,
}: UseAttendanceEventsParams) {
  const enabled = !!(enrollmentId || branchId);

  const query = useQuery({
    queryKey: ["attendanceEvents", enrollmentId ?? null, branchId ?? null, dateFrom ?? null, dateTo ?? null],
    enabled,
    queryFn: async (): Promise<AttendanceEventRow[]> => {
      let q = supabase
        .from("attendance_events")
        .select("*, dcu_enrollments:enrollment_id(id, residents:resident_id(id, name, name_zh))")
        .order("event_time", { ascending: false });

      if (enrollmentId) q = q.eq("enrollment_id", enrollmentId);
      if (branchId) q = q.eq("branch_id", branchId);
      if (dateFrom) q = q.gte("event_time", `${dateFrom}T00:00:00`);
      if (dateTo) q = q.lte("event_time", `${dateTo}T23:59:59`);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AttendanceEventRow[];
    },
  });

  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
