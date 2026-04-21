import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, Enums } from "@/integrations/supabase/types";

export type TaskStatus = Enums<"task_status">;
export type TaskType = Enums<"task_type">;

export type TaskRow = Tables<"tasks"> & {
  assignee: { name: string; name_zh: string | null } | null;
  completer: { name: string; name_zh: string | null } | null;
};

interface UseTasksParams {
  residentId?: string | null;
  branchId?: string | null;
  status?: TaskStatus | "ALL" | null;
  page?: number;
  pageSize?: number;
}

export function useTasks({
  residentId,
  branchId,
  status,
  page = 1,
  pageSize = 50,
}: UseTasksParams) {
  const statusKey = status && status !== "ALL" ? status : null;

  const query = useQuery({
    queryKey: ["tasks", residentId ?? null, branchId ?? null, statusKey, page, pageSize],
    enabled: !!(residentId || branchId),
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let q = supabase
        .from("tasks")
        .select(
          "*, assignee:assigned_to(name, name_zh), completer:completed_by(name, name_zh)",
          { count: "exact" },
        );

      if (residentId) q = q.eq("resident_id", residentId);
      else if (branchId) q = q.eq("branch_id", branchId);

      if (statusKey) q = q.eq("status", statusKey);

      q = q.order("due_at", { ascending: true }).range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as TaskRow[], count: count ?? 0 };
    },
  });

  return {
    tasks: query.data?.rows ?? [],
    total: query.data?.count ?? 0,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
