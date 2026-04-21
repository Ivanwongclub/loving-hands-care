import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ICPRow = Tables<"icps"> & {
  author: { name: string; name_zh: string | null } | null;
  approver: { name: string; name_zh: string | null } | null;
  rejecter: { name: string; name_zh: string | null } | null;
};

export function useICPs(residentId: string | null) {
  const query = useQuery({
    queryKey: ["icps", residentId],
    enabled: !!residentId,
    queryFn: async (): Promise<ICPRow[]> => {
      if (!residentId) return [];
      const { data, error } = await supabase
        .from("icps")
        .select(
          "*, author:authored_by(name, name_zh), approver:approved_by(name, name_zh), rejecter:rejected_by(name, name_zh)",
        )
        .eq("resident_id", residentId)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ICPRow[];
    },
  });

  const icps = query.data ?? [];
  const activeICP = icps.find((i) => i.status === "ACTIVE") ?? null;

  return {
    icps,
    activeICP,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
