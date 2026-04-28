import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type RestraintRecordRow = Tables<"restraint_records"> & {
  assessor: { id: string; name: string; name_zh: string | null } | null;
};
export type RestraintObservationRow = Tables<"restraint_observations">;

export function useRestraintRecords(residentId: string | null) {
  const query = useQuery({
    queryKey: ["restraintRecords", residentId],
    enabled: !!residentId,
    queryFn: async (): Promise<RestraintRecordRow[]> => {
      if (!residentId) return [];
      const { data, error } = await supabase
        .from("restraint_records")
        .select("*, assessor:assessment_by_staff_id(id, name, name_zh)")
        .eq("resident_id", residentId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RestraintRecordRow[];
    },
  });

  const all = query.data ?? [];
  return {
    records: all,
    activeRecords: all.filter((r) => r.status === "ACTIVE"),
    historyRecords: all.filter((r) => r.status !== "ACTIVE"),
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

export function useLatestObservation(restraintRecordId: string | null) {
  const query = useQuery({
    queryKey: ["restraintObservations", restraintRecordId],
    enabled: !!restraintRecordId,
    queryFn: async (): Promise<RestraintObservationRow | null> => {
      if (!restraintRecordId) return null;
      const { data, error } = await supabase
        .from("restraint_observations")
        .select("*")
        .eq("restraint_record_id", restraintRecordId)
        .order("observed_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as RestraintObservationRow | null;
    },
  });

  return {
    observation: query.data ?? null,
    isLoading: query.isLoading,
  };
}
