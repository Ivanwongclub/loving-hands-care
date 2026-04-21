import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type VitalsRow = Tables<"vitals"> & {
  recorder: { name: string; name_zh: string | null } | null;
};

interface UseVitalsParams {
  residentId: string | null;
  days?: number | null;
  page?: number;
  pageSize?: number;
}

export function useVitals({ residentId, days = null, page = 1, pageSize = 50 }: UseVitalsParams) {
  const cutoff = days ? new Date(Date.now() - days * 86400000).toISOString() : null;

  const query = useQuery({
    queryKey: ["vitals", residentId, days, page, pageSize],
    enabled: !!residentId,
    queryFn: async () => {
      if (!residentId) return { rows: [] as VitalsRow[], count: 0 };
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let q = supabase
        .from("vitals")
        .select("*, recorder:recorded_by(name, name_zh)", { count: "exact" })
        .eq("resident_id", residentId);
      if (cutoff) q = q.gte("recorded_at", cutoff);
      q = q.order("recorded_at", { ascending: false }).range(from, to);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as VitalsRow[], count: count ?? 0 };
    },
  });

  return {
    vitals: query.data?.rows ?? [],
    total: query.data?.count ?? 0,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
