import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronRight,
  Building2,
  Layers,
  DoorOpen,
  Bed,
  MapPin,
  User,
  MoreHorizontal,
} from "lucide-react";
import { Badge, EmptyState } from "@/components/hms";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import {
  useLocations,
  type LocationNode,
  type LocationType,
  type LocationStatus,
} from "@/hooks/useLocations";

const TYPE_ICON: Record<LocationType, React.ReactNode> = {
  BUILDING: <Building2 size={14} />,
  FLOOR: <Layers size={14} />,
  ROOM: <DoorOpen size={14} />,
  BED: <Bed size={14} />,
  ZONE: <MapPin size={14} />,
};

function bedTone(status: LocationStatus): "success" | "info" | "warning" | "neutral" {
  switch (status) {
    case "AVAILABLE": return "success";
    case "OCCUPIED": return "info";
    case "RESERVED": return "warning";
    case "OUT_OF_SERVICE": return "neutral";
    default: return "neutral";
  }
}

function bedStatusKey(s: LocationStatus): string {
  switch (s) {
    case "AVAILABLE": return "bedStatus.available";
    case "OCCUPIED": return "bedStatus.occupied";
    case "RESERVED": return "bedStatus.reserved";
    case "OUT_OF_SERVICE": return "bedStatus.outOfService";
    default: return "bedStatus.available";
  }
}

export interface FacilityTreeProps {
  branchId: string | null;
  selectable?: boolean;
  onSelectBed?: (bedId: string, bedCode: string) => void;
  selectedBedId?: string;
  showAvailableOnly?: boolean;
}

export function FacilityTree({
  branchId,
  selectable = false,
  onSelectBed,
  selectedBedId,
  showAvailableOnly = false,
}: FacilityTreeProps) {
  const { tree, isLoading, error } = useLocations(branchId);
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="type-body-sm flex items-center justify-between gap-3 px-3 py-2 rounded"
        style={{
          color: "var(--text-destructive)",
          backgroundColor: "var(--bg-destructive-subtle)",
          border: "1px solid var(--border-destructive)",
        }}
        role="alert"
      >
        <span>{error.message}</span>
        <button
          type="button"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["locations", branchId] })}
          className="type-caption underline"
          style={{ color: "var(--text-destructive)" }}
        >
          {t("common.retry", { defaultValue: "Retry" })}
        </button>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <EmptyState
        title={t("locations.addLocation")}
      />
    );
  }

  const labelOf = (node: LocationNode) =>
    i18n.language === "en" ? node.name : node.name_zh || node.name;

  const handleStatusChange = async (bed: LocationNode, newStatus: LocationStatus) => {
    setPendingId(bed.id);
    try {
      const { error: updErr } = await supabase
        .from("locations")
        .update({ status: newStatus })
        .eq("id", bed.id);
      if (updErr) throw updErr;

      await logAction({
        action: "BED_STATUS_CHANGED",
        entity_type: "locations",
        entity_id: bed.id,
        branch_id: branchId,
        before_state: { status: bed.status },
        after_state: { status: newStatus },
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["locations", branchId] }),
        queryClient.invalidateQueries({ queryKey: ["bedBoard", branchId] }),
      ]);

      toast.success(t("common.saved", { defaultValue: "Saved" }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="w-full">
      {tree.map((n) => (
        <TreeNode
          key={n.id}
          node={n}
          depth={0}
          labelOf={labelOf}
          selectable={selectable}
          showAvailableOnly={showAvailableOnly}
          selectedBedId={selectedBedId}
          onSelectBed={onSelectBed}
          onStatusChange={handleStatusChange}
          pendingId={pendingId}
          bedStatusLabel={(s) => t(bedStatusKey(s)) as string}
          markOOSLabel={t("locations.markOOS") as string}
          markAvailableLabel={t("locations.markAvailable") as string}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: LocationNode;
  depth: number;
  labelOf: (n: LocationNode) => string;
  selectable: boolean;
  showAvailableOnly: boolean;
  selectedBedId?: string;
  onSelectBed?: (bedId: string, bedCode: string) => void;
  onStatusChange: (bed: LocationNode, newStatus: LocationStatus) => void;
  pendingId: string | null;
  bedStatusLabel: (s: LocationStatus) => string;
  markOOSLabel: string;
  markAvailableLabel: string;
}

function TreeNode(props: TreeNodeProps) {
  const {
    node, depth, labelOf, selectable, showAvailableOnly, selectedBedId,
    onSelectBed, onStatusChange, pendingId, bedStatusLabel,
    markOOSLabel, markAvailableLabel,
  } = props;
  const [open, setOpen] = useState(depth < 2);
  const [hovered, setHovered] = useState(false);

  const hasChildren = node.children.length > 0;
  const isBed = node.type === "BED";
  const isSelected = isBed && selectedBedId === node.id;

  const bedSelectable = isBed && selectable && (!showAvailableOnly || node.status === "AVAILABLE");
  const bedDimmed = isBed && selectable && showAvailableOnly && node.status !== "AVAILABLE";
  const isOOS = node.status === "OUT_OF_SERVICE";

  const handleClick = () => {
    if (isBed) {
      if (bedSelectable && onSelectBed) onSelectBed(node.id, node.code);
      return;
    }
    if (hasChildren) setOpen((o) => !o);
  };

  // Row visual state
  const rowBg = isSelected ? "var(--bg-selected)" : (hovered ? "var(--bg-hover-subtle)" : "transparent");
  const rowBorderLeft = isSelected ? "3px solid var(--color-iris-500)" : "3px solid transparent";
  const cursor = isBed ? (bedSelectable ? "pointer" : (selectable ? "not-allowed" : "default")) : (hasChildren ? "pointer" : "default");
  const opacity = bedDimmed ? 0.5 : 1;

  return (
    <div>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minHeight: 40,
          paddingLeft: 8 + depth * 16,
          paddingRight: 10,
          borderRadius: "var(--radius-sm)",
          backgroundColor: rowBg,
          borderLeft: rowBorderLeft,
          opacity,
          cursor,
          color: "var(--text-primary)",
        }}
        role={isBed && bedSelectable ? "button" : undefined}
        tabIndex={isBed && bedSelectable ? 0 : undefined}
        onClick={handleClick}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && isBed && bedSelectable) {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {/* Chevron — non-bed only */}
        <span style={{ width: 14, color: "var(--text-tertiary)", display: "inline-flex" }}>
          {!isBed && hasChildren ? (
            <ChevronRight
              size={14}
              style={{
                transform: open ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 120ms ease",
              }}
            />
          ) : null}
        </span>

        {/* Type icon */}
        <span style={{ color: "var(--text-tertiary)", display: "inline-flex" }}>
          {TYPE_ICON[node.type]}
        </span>

        {/* Code + name (bed: stacked when occupied) */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span
              className="type-body-sm font-medium"
              style={{
                fontFamily: isBed ? "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)" : undefined,
                color: "var(--text-secondary)",
                textDecoration: isBed && isOOS ? "line-through" : undefined,
              }}
            >
              {node.code}
            </span>
            <span
              className="type-body-sm truncate"
              style={{
                color: "var(--text-primary)",
                textDecoration: isBed && isOOS ? "line-through" : undefined,
              }}
            >
              {labelOf(node)}
            </span>
          </div>
          {isBed && node.status === "OCCUPIED" && node.resident_name && (
            <span
              className="type-caption italic"
              style={{ color: "var(--text-secondary)", marginTop: 2 }}
            >
              <User size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />
              {node.resident_name}
            </span>
          )}
        </div>

        {/* Right side: badge + actions */}
        {isBed && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Badge tone={bedTone(node.status)}>{bedStatusLabel(node.status)}</Badge>
            {!selectable && hovered && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Bed actions"
                    onClick={(e) => e.stopPropagation()}
                    disabled={pendingId === node.id}
                    className="p-1 rounded"
                    style={{
                      color: "var(--text-secondary)",
                      backgroundColor: "transparent",
                    }}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {node.status !== "OUT_OF_SERVICE" && (
                    <DropdownMenuItem
                      onSelect={() => onStatusChange(node, "OUT_OF_SERVICE")}
                    >
                      {markOOSLabel}
                    </DropdownMenuItem>
                  )}
                  {node.status !== "AVAILABLE" && (
                    <DropdownMenuItem
                      onSelect={() => onStatusChange(node, "AVAILABLE")}
                    >
                      {markAvailableLabel}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </span>
        )}
      </div>

      {hasChildren && open && !isBed && (
        <div>
          {node.children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              depth={depth + 1}
              labelOf={labelOf}
              selectable={selectable}
              showAvailableOnly={showAvailableOnly}
              selectedBedId={selectedBedId}
              onSelectBed={onSelectBed}
              onStatusChange={onStatusChange}
              pendingId={pendingId}
              bedStatusLabel={bedStatusLabel}
              markOOSLabel={markOOSLabel}
              markAvailableLabel={markAvailableLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
