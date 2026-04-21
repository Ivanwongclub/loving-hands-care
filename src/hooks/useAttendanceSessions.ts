import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export interface AttendanceSessionRow extends Tables<"attendance_sessions"> {
  dcu_enrollments: {
    id: string;
    residents: { id: string; name: string; name_zh: string } | null;
  } | null;
}

export interface AttendanceSummary {
  totalPresent: number;
  totalAbsent: number;
  totalPartial: number;
}

/**
 * Attendance sessions for a branch within a date range, joined with enrollment+resident.
 */
export function useAttendanceSessions(
  branchId: string | null,
  dateFrom: string,
  dateTo: string,
) {
  const query = useQuery({
    queryKey: ["attendanceSessions", branchId, dateFrom, dateTo],
    enabled: !!branchId && !!dateFrom && !!dateTo,
    queryFn: async (): Promise<AttendanceSessionRow[]> => {
      if (!branchId) return [];
      const { data, error } = await supabase
        .from("attendance_sessions")
        .select("*, dcu_enrollments:enrollment_id(id, residents:resident_id(id, name, name_zh))")
        .eq("branch_id", branchId)
        .gte("session_date", dateFrom)
        .lte("session_date", dateTo)
        .order("session_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AttendanceSessionRow[];
    },
  });

  const sessions = query.data ?? [];
  const summary: AttendanceSummary = sessions.reduce(
    (acc, s) => {
      if (s.status === "PRESENT") acc.totalPresent += 1;
      else if (s.status === "ABSENT") acc.totalAbsent += 1;
      else if (s.status === "PARTIAL") acc.totalPartial += 1;
      return acc;
    },
    { totalPresent: 0, totalAbsent: 0, totalPartial: 0 } as AttendanceSummary,
  );

  return {
    sessions,
    summary,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
