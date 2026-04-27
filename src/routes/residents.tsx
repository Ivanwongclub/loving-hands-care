import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Lock, MoreHorizontal, ExternalLink, Inbox } from "lucide-react";
import { toast } from "sonner";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import {
  PageHeader, FilterBar, SearchField, Select, Tabs, Table, Badge, Button, IconButton,
  Avatar, Stack, Inline, Skeleton, EmptyState, Pagination, DropdownMenu, Drawer,
  Spinner, Divider, Text, type Column,
} from "@/components/hms";
import { useResidents, type ResidentRow } from "@/hooks/useResidents";
import { useBedBoard, type BedBoardEntry, type BedStatus } from "@/hooks/useBedBoard";
import { useLocations, type LocationNode } from "@/hooks/useLocations";
import { useBranches } from "@/hooks/useBranches";
import { useAuditLog } from "@/hooks/useAuditLog";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

type ResidentStatus = Enums<"resident_status">;

const STATUS_TONE: Record<ResidentStatus, "info" | "neutral" | "warning" | "error"> = {
  ADMITTED: "info",
  DISCHARGED: "neutral",
  LOA: "warning",
  DECEASED: "error",
};

const RISK_TONE: Record<"LOW" | "MEDIUM" | "HIGH", "success" | "warning" | "error"> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "error",
};

const BED_BOTTOM_COLOR: Record<BedStatus, string> = {
  AVAILABLE: "var(--status-success-accent)",
  OCCUPIED: "var(--color-iris-500)",
  RESERVED: "var(--status-warning-accent)",
  OUT_OF_SERVICE: "var(--color-neutral-400)",
};

function formatDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

function ResidentsListPage() {
  const { t } = useTranslation();
  const { branches } = useBranches();
  const branchId = branches[0]?.id ?? null;
  const [tab, setTab] = useState<"list" | "board">("list");

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("nav.residents")}>
        <ResidentsHeader />
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Tabs
            style="line"
            value={tab}
            onChange={(v) => setTab(v as "list" | "board")}
            items={[
              { value: "list", label: t("residents.residentsList") },
              { value: "board", label: t("residents.bedBoard") },
            ]}
          />
        </div>
        {tab === "list" && <ResidentsListTab branchId={branchId} />}
        {tab === "board" && <BedBoardTab branchId={branchId} />}
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}

function ResidentsHeader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { branches } = useBranches();
  const branchName = branches[0]?.name_zh ?? "";
  return (
    <PageHeader
      title={t("residents.title")}
      description={branchName}
      actions={
        <Button
          variant="primary"
          leadingIcon={<Plus size={16} />}
          onClick={() => navigate({ to: "/residents/new" })}
        >
          {t("residents.newAdmission")}
        </Button>
      }
    />
  );
}

/* ──────────────────────────────────────────────────────────
 * Residents list tab
 * ────────────────────────────────────────────────────────── */

function ResidentsListTab({ branchId }: { branchId: string | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ResidentStatus>("ALL");
  const [riskFilter, setRiskFilter] = useState<"ALL" | "LOW" | "MEDIUM" | "HIGH">("ALL");
  const [page, setPage] = useState(1);

  // 300ms debounce on search
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(searchInput), 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const { residents, total, isLoading } = useResidents({
    branchId,
    search: debounced,
    status: statusFilter,
    riskLevel: riskFilter !== "ALL" ? riskFilter : null,
    page,
    pageSize: 20,
  });

  const totalPages = Math.max(1, Math.ceil(total / 20));

  const statusOptions = [
    { value: "ALL", label: t("residents.filters.allStatus") },
    { value: "ADMITTED", label: t("residents.status.ADMITTED") },
    { value: "DISCHARGED", label: t("residents.status.DISCHARGED") },
    { value: "LOA", label: t("residents.status.LOA") },
  ];

  const riskOptions = [
    { value: "ALL", label: t("residents.filters.allRisk") },
    { value: "LOW", label: t("residents.riskLevel.LOW") },
    { value: "MEDIUM", label: t("residents.riskLevel.MEDIUM") },
    { value: "HIGH", label: t("residents.riskLevel.HIGH") },
  ];

  const columns: Column<ResidentRow>[] = [
    {
      key: "photo",
      header: t("residents.columns.photo"),
      width: 56,
      cell: (r) => <Avatar size="sm" name={r.name_zh || r.name} />,
    },
    {
      key: "name",
      header: t("residents.columns.name"),
      cell: (r) => (
        <Stack gap={1}>
          <span className="type-body-md font-semibold" style={{ color: "var(--text-primary)" }}>
            {r.name_zh}
          </span>
          <span className="type-body-sm" style={{ color: "var(--text-secondary)" }}>
            {r.name}
          </span>
        </Stack>
      ),
    },
    {
      key: "bed",
      header: t("residents.columns.bed"),
      width: 100,
      cell: (r) => (
        <span className="font-mono type-body-sm" style={{ color: "var(--text-primary)" }}>
          {r.locations?.code ?? t("residents.noBed")}
        </span>
      ),
    },
    {
      key: "admission",
      header: t("residents.columns.admission"),
      width: 130,
      cell: (r) => (
        <span className="type-body-sm" style={{ color: "var(--text-secondary)" }}>
          {formatDate(r.admission_date)}
        </span>
      ),
    },
    {
      key: "risk",
      header: t("residents.columns.risk"),
      width: 110,
      cell: (r) =>
        r.risk_level ? (
          <Badge tone={RISK_TONE[r.risk_level]}>{t(`residents.riskLevel.${r.risk_level}`)}</Badge>
        ) : null,
    },
    {
      key: "status",
      header: t("residents.columns.status"),
      width: 110,
      cell: (r) => (
        <Badge tone={STATUS_TONE[r.status]}>{t(`residents.status.${r.status}`)}</Badge>
      ),
    },
    {
      key: "private",
      header: t("residents.columns.private"),
      width: 70,
      cell: (r) =>
        r.do_not_share_family ? (
          <Lock size={16} style={{ color: "var(--status-warning-accent)" }} aria-label="Do not share" />
        ) : null,
    },
    {
      key: "actions",
      header: "",
      width: 60,
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu
            trigger={<IconButton aria-label="Row actions" icon={<MoreHorizontal size={16} />} variant="ghost" size="compact" />}
            items={[
              {
                label: t("residents.viewProfile"),
                onSelect: () => navigate({ to: "/residents/$id", params: { id: r.id } }),
              },
              {
                label: t("residents.transfer"),
                onSelect: () => toast(t("residents.comingSoon")),
              },
              {
                label: t("residents.discharge"),
                onSelect: () => toast(t("residents.comingSoon")),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <Stack gap={4}>
      <FilterBar>
        <div style={{ width: 320 }}>
          <SearchField
            placeholder={t("residents.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onClear={() => setSearchInput("")}
          />
        </div>
        <div style={{ width: 200 }}>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter((e.target as HTMLSelectElement).value as typeof statusFilter);
              setPage(1);
            }}
            options={statusOptions}
          />
        </div>
        <div style={{ width: 200 }}>
          <Select
            value={riskFilter}
            onChange={(e) => {
              setRiskFilter((e.target as HTMLSelectElement).value as typeof riskFilter);
              setPage(1);
            }}
            options={riskOptions}
          />
        </div>
      </FilterBar>

      {isLoading ? (
        <Stack gap={2}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="row" height={44} />
          ))}
        </Stack>
      ) : (
        <Table<ResidentRow>
          columns={columns}
          rows={residents}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate({ to: "/residents/$id", params: { id: r.id } })}
          empty={
            <EmptyState
              title={t("residents.emptyList")}
              description={t("residents.searchPlaceholder")}
            />
          }
        />
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </Stack>
  );
}

/* ──────────────────────────────────────────────────────────
 * Bed Board tab
 * ────────────────────────────────────────────────────────── */

interface FloorGroup {
  floorId: string;
  floorName: string;
  beds: BedBoardEntry[];
}

function findFloorAncestor(
  bedId: string,
  flatList: LocationNode[],
): LocationNode | null {
  const map = new Map(flatList.map((n) => [n.id, n]));
  let current = map.get(bedId);
  // walk up parent_id chain until we find FLOOR or run out
  while (current) {
    if (current.type === "FLOOR") return current;
    if (!current.parent_id) return null;
    current = map.get(current.parent_id);
  }
  return null;
}

function buildLocationPath(bedId: string, flatList: LocationNode[]): string {
  const map = new Map(flatList.map((n) => [n.id, n]));
  const parts: string[] = [];
  let current = map.get(bedId);
  while (current) {
    parts.unshift(current.name_zh || current.name);
    if (!current.parent_id) break;
    current = map.get(current.parent_id);
  }
  return parts.join(" › ");
}

function BedBoardTab({ branchId }: { branchId: string | null }) {
  const { t } = useTranslation();
  const { beds, isLoading } = useBedBoard(branchId);
  const { tree: _tree, flatList } = useLocations(branchId);
  const [selectedBed, setSelectedBed] = useState<BedBoardEntry | null>(null);

  const floors = useMemo<FloorGroup[]>(() => {
    if (beds.length === 0 || flatList.length === 0) return [];
    const groups = new Map<string, FloorGroup>();
    const orphans: BedBoardEntry[] = [];
    for (const bed of beds) {
      const floor = findFloorAncestor(bed.id, flatList);
      if (!floor) {
        orphans.push(bed);
        continue;
      }
      let g = groups.get(floor.id);
      if (!g) {
        g = { floorId: floor.id, floorName: floor.name_zh || floor.name, beds: [] };
        groups.set(floor.id, g);
      }
      g.beds.push(bed);
    }
    const out = Array.from(groups.values()).sort((a, b) =>
      a.floorName.localeCompare(b.floorName),
    );
    if (orphans.length > 0) {
      out.push({ floorId: "_orphan", floorName: "—", beds: orphans });
    }
    return out;
  }, [beds, flatList]);

  if (isLoading) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
          gap: 8,
        }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} variant="block" height={72} />
        ))}
      </div>
    );
  }

  if (floors.length === 0) {
    return (
      <EmptyState
        title={t("residents.bedBoard")}
        description={t("residents.emptyList")}
      />
    );
  }

  return (
    <>
      <Stack gap={4}>
        {floors.map((g) => (
          <div key={g.floorId}>
            <div className="type-h3" style={{ color: "var(--text-primary)", marginBottom: "var(--space-3)" }}>
              {g.floorName}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                gap: 8,
                marginBottom: "var(--space-6)",
              }}
            >
              {g.beds.map((bed) => (
                <BedCard key={bed.id} bed={bed} onClick={() => setSelectedBed(bed)} />
              ))}
            </div>
          </div>
        ))}
      </Stack>
      <BedDetailDrawer
        bed={selectedBed}
        flatList={flatList}
        branchId={branchId}
        onClose={() => setSelectedBed(null)}
      />
    </>
  );
}

function BedCard({ bed, onClick }: { bed: BedBoardEntry; onClick: () => void }) {
  const { t } = useTranslation();
  const middle =
    bed.status === "OCCUPIED" && bed.resident_name
      ? bed.resident_name
      : t(`bedStatus.${bed.status === "OUT_OF_SERVICE" ? "outOfService" : bed.status.toLowerCase()}`);
  const middleClass =
    bed.status === "OCCUPIED" ? "type-body-sm" : "type-caption";
  const middleColor =
    bed.status === "OCCUPIED" ? "var(--text-primary)" : "var(--text-secondary)";

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left transition-shadow"
      style={{
        minHeight: 72,
        backgroundColor: "var(--bg-surface)",
        boxShadow: "var(--shadow-surface)",
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        cursor: "pointer",
        transitionDuration: "var(--duration-normal)",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card-hover, var(--shadow-elevated))";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-surface)";
      }}
    >
      <div style={{ padding: 10, flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <span
          className="type-label font-mono"
          style={{ color: "var(--text-tertiary)" }}
        >
          {bed.code}
        </span>
        <span
          className={middleClass + " truncate"}
          style={{ color: middleColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {middle}
        </span>
      </div>
      <div style={{ height: 4, width: "100%", backgroundColor: BED_BOTTOM_COLOR[bed.status] }} />
    </button>
  );
}

function BedDetailDrawer({
  bed,
  flatList,
  branchId,
  onClose,
}: {
  bed: BedBoardEntry | null;
  flatList: LocationNode[];
  branchId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();
  const [pending, setPending] = useState<"OUT_OF_SERVICE" | "AVAILABLE" | null>(null);

  if (!bed) {
    return <Drawer open={false} onClose={onClose}>{null}</Drawer>;
  }

  const path = buildLocationPath(bed.id, flatList);
  const statusKey =
    bed.status === "OUT_OF_SERVICE" ? "outOfService" : bed.status.toLowerCase();

  const statusTone =
    bed.status === "AVAILABLE" ? "success"
    : bed.status === "OCCUPIED" ? "info"
    : bed.status === "RESERVED" ? "warning"
    : "neutral";

  const handleStatusChange = async (newStatus: "OUT_OF_SERVICE" | "AVAILABLE") => {
    setPending(newStatus);
    try {
      const before = { status: bed.status };
      const { error } = await supabase
        .from("locations")
        .update({ status: newStatus })
        .eq("id", bed.id);
      if (error) throw error;
      void logAction({
        action: "BED_STATUS_CHANGED",
        entity_type: "locations",
        entity_id: bed.id,
        branch_id: branchId,
        before_state: before,
        after_state: { status: newStatus },
      });
      await queryClient.invalidateQueries({ queryKey: ["bedBoard", branchId] });
      await queryClient.invalidateQueries({ queryKey: ["locations", branchId] });
      toast.success(t("common.saved"));
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      toast.error(msg);
    } finally {
      setPending(null);
    }
  };

  return (
    <Drawer open={!!bed} onClose={onClose} title={bed.code} width={400}>
      <Stack gap={4}>
        <Text size="sm" color="secondary">{path}</Text>
        <div>
          <Badge tone={statusTone}>{t(`bedStatus.${statusKey}`)}</Badge>
        </div>
        <Divider />

        {bed.status === "OCCUPIED" && bed.resident_id ? (
          <Stack gap={3}>
            <Stack gap={1}>
              <Text size="label" color="tertiary">{t("contacts.columns.name")}</Text>
              <Text size="md" className="font-semibold">{bed.resident_name}</Text>
            </Stack>
            <Stack gap={1}>
              <Text size="label" color="tertiary">{t("residents.admissionDate")}</Text>
              <Text size="md">{formatDate(bed.admission_date)}</Text>
            </Stack>
            <Button
              variant="ghost"
              leadingIcon={<ExternalLink size={14} />}
              onClick={() => {
                if (bed.resident_id) {
                  navigate({ to: "/residents/$id", params: { id: bed.resident_id } });
                }
              }}
            >
              {t("residents.bedDrawer.viewResident")}
            </Button>
          </Stack>
        ) : bed.status === "AVAILABLE" ? (
          <Text size="sm" color="secondary">{t("residents.bedDrawer.availableInfo")}</Text>
        ) : null}

        <Divider />

        <Stack gap={2}>
          {bed.status !== "OUT_OF_SERVICE" && (
            <Button
              variant="soft"
              fullWidth
              loading={pending === "OUT_OF_SERVICE"}
              onClick={() => handleStatusChange("OUT_OF_SERVICE")}
            >
              {pending === "OUT_OF_SERVICE" ? <Spinner size="sm" /> : t("locations.markOOS")}
            </Button>
          )}
          {bed.status !== "AVAILABLE" && (
            <Button
              variant="soft"
              fullWidth
              loading={pending === "AVAILABLE"}
              onClick={() => handleStatusChange("AVAILABLE")}
            >
              {pending === "AVAILABLE" ? <Spinner size="sm" /> : t("locations.markAvailable")}
            </Button>
          )}
        </Stack>
      </Stack>
    </Drawer>
  );
}

// suppress unused-import warnings cleanly
void Inbox;

export const Route = createFileRoute("/residents")({
  component: ResidentsListPage,
});
