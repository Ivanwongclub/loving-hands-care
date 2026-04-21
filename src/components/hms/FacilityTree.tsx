import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, Building2, Layers, DoorOpen, BedDouble, MapPin, User } from "lucide-react";
import { Badge, Spinner, EmptyState } from "@/components/hms";
import { useLocations, type LocationNode, type LocationType, type LocationStatus } from "@/hooks/useLocations";

const TYPE_ICON: Record<LocationType, React.ReactNode> = {
  BUILDING: <Building2 size={14} />,
  FLOOR: <Layers size={14} />,
  ROOM: <DoorOpen size={14} />,
  BED: <BedDouble size={14} />,
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

interface FacilityTreeProps {
  branchId: string | null;
  onSelectBed?: (bed: LocationNode) => void;
  selectable?: boolean;
  /** When selectable, only show BEDs whose status matches one of these (default: all). */
  bedFilter?: (bed: LocationNode) => boolean;
}

export function FacilityTree({ branchId, onSelectBed, selectable, bedFilter }: FacilityTreeProps) {
  const { tree, isLoading, error } = useLocations(branchId);
  const { t, i18n } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }
  if (error) {
    return (
      <div className="type-body-sm" style={{ color: "var(--text-destructive)" }}>
        {error.message}
      </div>
    );
  }
  if (tree.length === 0) {
    return <EmptyState title={t("locations.addLocation")} />;
  }

  const labelOf = (node: LocationNode) =>
    i18n.language === "en" ? node.name : node.name_zh || node.name;

  return (
    <div className="w-full">
      {tree.map((n) => (
        <TreeNode
          key={n.id}
          node={n}
          depth={0}
          labelOf={labelOf}
          selectable={!!selectable}
          onSelectBed={onSelectBed}
          bedFilter={bedFilter}
          bedStatusLabel={(s) => t(`bedStatus.${s.toLowerCase().replace(/_(.)/g, (_, c) => c.toUpperCase())}` as never) as string}
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
  onSelectBed?: (bed: LocationNode) => void;
  bedFilter?: (bed: LocationNode) => boolean;
  bedStatusLabel: (s: LocationStatus) => string;
}

function TreeNode({ node, depth, labelOf, selectable, onSelectBed, bedFilter, bedStatusLabel }: TreeNodeProps) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isBed = node.type === "BED";
  const filteredOut = isBed && bedFilter ? !bedFilter(node) : false;

  if (filteredOut) return null;

  const handleClick = () => {
    if (isBed && selectable && onSelectBed) {
      onSelectBed(node);
      return;
    }
    if (hasChildren) setOpen((o) => !o);
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className="w-full flex items-center gap-2 transition-colors text-left"
        style={{
          paddingLeft: 8 + depth * 18,
          paddingRight: 10,
          paddingBlock: 6,
          borderRadius: "var(--radius-sm)",
          color: "var(--text-primary)",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-hover-subtle)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
      >
        <span style={{ width: 14, color: "var(--text-tertiary)" }}>
          {hasChildren ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </span>
        <span style={{ color: "var(--text-tertiary)" }}>{TYPE_ICON[node.type]}</span>
        <span className="type-body-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {node.code}
        </span>
        <span className="type-body-sm" style={{ color: "var(--text-secondary)" }}>
          {labelOf(node)}
        </span>
        {isBed && (
          <span className="ml-auto flex items-center gap-2">
            {node.resident_name && (
              <span className="type-caption inline-flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                <User size={12} />
                {node.resident_name}
              </span>
            )}
            <Badge tone={bedTone(node.status)}>{bedStatusLabel(node.status)}</Badge>
          </span>
        )}
      </button>
      {hasChildren && open && (
        <div>
          {node.children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              depth={depth + 1}
              labelOf={labelOf}
              selectable={selectable}
              onSelectBed={onSelectBed}
              bedFilter={bedFilter}
              bedStatusLabel={bedStatusLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
