import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type StaffLite = { name: string; name_zh: string | null } | null;

type MedOrderJoin = {
  drug_name: string;
  drug_name_zh: string | null;
  dose: string;
  route: string;
  is_prn: boolean;
  barcode: string | null;
} | null;

export type EMARRow = Tables<"emar_records"> & {
  order: MedOrderJoin;
  administrator: StaffLite;
};

interface UseEMARRecordsParams {
  residentId: string | null;
  date: string; // YYYY-MM-DD
}

export function useEMARRecords({ residentId, date }: UseEMARRecordsParams) {
  const query = useQuery({
    queryKey: ["emarRecords", residentId, date],
    enabled: !!residentId && !!date,
    queryFn: async (): Promise<EMARRow[]> => {
      if (!residentId) return [];
      const { data, error } = await supabase
        .from("emar_records")
        .select(
          "*, order:order_id(drug_name, drug_name_zh, dose, route, is_prn, barcode), administrator:administered_by(name, name_zh)",
        )
        .eq("resident_id", residentId)
        .gte("due_at", `${date}T00:00:00`)
        .lte("due_at", `${date}T23:59:59`)
        .order("due_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EMARRow[];
    },
  });

  return {
    records: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
