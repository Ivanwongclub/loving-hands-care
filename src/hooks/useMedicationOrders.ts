import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type StaffLite = { name: string; name_zh: string | null } | null;

export type MedOrderRow = Tables<"medication_orders"> & {
  orderer: StaffLite;
  stopper: StaffLite;
};

export function useMedicationOrders(
  residentId: string | null,
  status: "ACTIVE" | "ALL" = "ALL",
) {
  const query = useQuery({
    queryKey: ["medicationOrders", residentId, status],
    enabled: !!residentId,
    queryFn: async (): Promise<MedOrderRow[]> => {
      if (!residentId) return [];
      let q = supabase
        .from("medication_orders")
        .select(
          "*, orderer:ordered_by(name, name_zh), stopper:stopped_by(name, name_zh)",
        )
        .eq("resident_id", residentId)
        .order("created_at", { ascending: false });
      if (status === "ACTIVE") {
        q = q.eq("status", "ACTIVE");
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as MedOrderRow[];
    },
  });

  const orders = query.data ?? [];
  const activeOrders = orders.filter((o) => o.status === "ACTIVE");

  return {
    orders,
    activeOrders,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
