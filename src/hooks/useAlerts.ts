import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AlertRow = Tables<"alerts"> & {
  acknowledger: { name: string; name_zh: string | null } | null;
  resolver: { name: string; name_zh: string | null } | null;
  residents: { name: string; name_zh: string } | null;
};

interface UseAlertsParams {
  branchId: string | null;
  status?: string;
  page?: number;
  pageSize?: number;
}

export function useAlerts({
  branchId,
  status = "ALL",
  page = 1,
  pageSize = 100,
}: UseAlertsParams) {
  const statusKey = status && status !== "ALL" ? status : null;

  const query = useQuery({
    queryKey: ["alerts", branchId, statusKey, page, pageSize],
    enabled: !!branchId,
    queryFn: async () => {
      if (!branchId) return { rows: [] as AlertRow[], total: 0 };
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let q = supabase
        .from("alerts")
        .select(
          "*, acknowledger:acknowledged_by(name, name_zh), resolver:resolved_by(name, name_zh), residents:resident_id(name, name_zh)",
          { count: "exact" },
        )
        .eq("branch_id", branchId)
        .order("triggered_at", { ascending: false })
        .range(from, to);
      if (statusKey) {
        q = q.eq("status", statusKey as Tables<"alerts">["status"]);
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return {
        rows: (data ?? []) as unknown as AlertRow[],
        total: count ?? 0,
      };
    },
  });

  return {
    alerts: query.data?.rows ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
