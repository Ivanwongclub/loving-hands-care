import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, Enums } from "@/integrations/supabase/types";

export type Location = Tables<"locations">;
export type LocationType = Enums<"location_type">;
export type LocationStatus = Enums<"location_status">;

export interface LocationNode {
  id: string;
  code: string;
  name: string;
  name_zh: string | null;
  type: LocationType;
  status: LocationStatus;
  parent_id: string | null;
  capacity: number | null;
  /** Resident name shown for occupied beds (preferred zh, fallback en). */
  resident_name?: string | null;
  resident_id?: string | null;
  children: LocationNode[];
}

const TYPE_ORDER: Record<LocationType, number> = {
  BUILDING: 0,
  FLOOR: 1,
  ZONE: 2,
  ROOM: 3,
  BED: 4,
};

interface ResidentLite {
  id: string;
  name: string;
  name_zh: string;
  bed_id: string | null;
}

/**
 * Fetches the full location hierarchy for a branch and assembles a tree.
 * For BED nodes, joins the currently-admitted resident's name.
 */
export function useLocations(branchId: string | null) {
  const query = useQuery({
    queryKey: ["locations", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      if (!branchId) return { tree: [] as LocationNode[], flatList: [] as LocationNode[] };

      // 1. All locations for the branch
      const { data: locs, error: locErr } = await supabase
        .from("locations")
        .select("*")
        .eq("branch_id", branchId)
        .order("type", { ascending: true })
        .order("name", { ascending: true });
      if (locErr) throw locErr;

      // 2. Admitted residents for bed-name enrichment
      const { data: residents, error: resErr } = await supabase
        .from("residents")
        .select("id, name, name_zh, bed_id")
        .eq("branch_id", branchId)
        .eq("status", "ADMITTED")
        .is("deleted_at", null);
      if (resErr) throw resErr;

      const residentByBed = new Map<string, ResidentLite>();
      for (const r of (residents ?? []) as ResidentLite[]) {
        if (r.bed_id) residentByBed.set(r.bed_id, r);
      }

      // 3. Build nodes
      const nodeById = new Map<string, LocationNode>();
      const flatList: LocationNode[] = [];
      for (const l of (locs ?? []) as Location[]) {
        const node: LocationNode = {
          id: l.id,
          code: l.code,
          name: l.name,
          name_zh: l.name_zh,
          type: l.type,
          status: l.status,
          parent_id: l.parent_id,
          capacity: l.capacity,
          children: [],
        };
        if (l.type === "BED") {
          const res = residentByBed.get(l.id);
          if (res) {
            node.resident_id = res.id;
            node.resident_name = res.name_zh || res.name;
          }
        }
        nodeById.set(l.id, node);
        flatList.push(node);
      }

      // 4. Wire parent/child
      const roots: LocationNode[] = [];
      for (const node of nodeById.values()) {
        if (node.parent_id && nodeById.has(node.parent_id)) {
          nodeById.get(node.parent_id)!.children.push(node);
        } else {
          roots.push(node);
        }
      }

      // 5. Sort siblings: by type then name
      const sortRec = (nodes: LocationNode[]) => {
        nodes.sort((a, b) => {
          const t = TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
          if (t !== 0) return t;
          return a.name.localeCompare(b.name);
        });
        for (const n of nodes) sortRec(n.children);
      };
      sortRec(roots);

      return { tree: roots, flatList };
    },
  });

  return {
    tree: query.data?.tree ?? [],
    flatList: query.data?.flatList ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
