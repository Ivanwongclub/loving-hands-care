import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, Enums } from "@/integrations/supabase/types";

export type ResidentStatus = Enums<"resident_status">;

export type ResidentRow = Tables<"residents"> & {
  locations: { code: string; name: string } | null;
};

interface UseResidentsParams {
  branchId: string | null;
  search?: string;
  status?: ResidentStatus | "ALL" | null;
  page?: number;
  pageSize?: number;
}

/**
 * Paginated residents for a branch with search and status filter.
 */
export function useResidents({
  branchId,
  search,
  status,
  page = 1,
  pageSize = 20,
}: UseResidentsParams) {
  const trimmed = (search ?? "").trim();
  const statusKey = status && status !== "ALL" ? status : null;

  const query = useQuery({
    queryKey: ["residents", branchId, trimmed, statusKey, page, pageSize],
    enabled: !!branchId,
    queryFn: async () => {
      if (!branchId) return { rows: [] as ResidentRow[], count: 0 };

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let q = supabase
        .from("residents")
        .select("*, locations:bed_id(code, name)", { count: "exact" })
        .eq("branch_id", branchId)
        .is("deleted_at", null);

      if (statusKey) q = q.eq("status", statusKey);

      if (trimmed.length > 0) {
        // Escape commas/parens in search input for the .or() expression
        const safe = trimmed.replace(/[,()]/g, " ");
        q = q.or(`name_zh.ilike.%${safe}%,name.ilike.%${safe}%,preferred_name.ilike.%${safe}%`);
      }

      q = q.order("name_zh", { ascending: true }).range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as ResidentRow[], count: count ?? 0 };
    },
  });

  return {
    residents: query.data?.rows ?? [],
    total: query.data?.count ?? 0,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
