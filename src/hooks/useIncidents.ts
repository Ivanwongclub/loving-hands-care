import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type IncidentRow = Tables<"incidents"> & {
  reporter: { name: string; name_zh: string | null } | null;
  closer: { name: string; name_zh: string | null } | null;
  residents: { name: string; name_zh: string } | null;
  locations: { code: string; name: string } | null;
};

interface UseIncidentsParams {
  branchId: string | null;
  residentId?: string | null;
  status?: string | null;
  page?: number;
  pageSize?: number;
}

export function useIncidents({
  branchId,
  residentId,
  status,
  page = 1,
  pageSize = 50,
}: UseIncidentsParams) {
  const statusKey = status && status !== "ALL" ? status : null;

  const query = useQuery({
    queryKey: ["incidents", branchId, residentId ?? null, statusKey, page, pageSize],
    enabled: !!branchId,
    queryFn: async () => {
      if (!branchId) return { rows: [] as IncidentRow[], total: 0 };
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let q = supabase
        .from("incidents")
        .select(
          "*, reporter:reporter_id(name, name_zh), closer:closed_by(name, name_zh), residents:resident_id(name, name_zh), locations:location_id(code, name)",
          { count: "exact" },
        )
        .eq("branch_id", branchId)
        .order("occurred_at", { ascending: false })
        .range(from, to);
      if (residentId) q = q.eq("resident_id", residentId);
      if (statusKey) {
        // status is a postgres enum — cast safe via string
        q = q.eq("status", statusKey as Tables<"incidents">["status"]);
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return {
        rows: (data ?? []) as unknown as IncidentRow[],
        total: count ?? 0,
      };
    },
  });

  return {
    incidents: query.data?.rows ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
