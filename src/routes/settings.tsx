import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Eye, Inbox, AlertCircle, Bell, Pill, SlidersHorizontal, Building } from "lucide-react";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import {
  PageHeader, FilterBar, SearchField, Select, Table, Badge, Button, EmptyState,
  Stack, Inline, Skeleton, Tooltip, Card, Surface, type Column,
} from "@/components/hms";
import { useBranches, type Branch } from "@/hooks/useBranches";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { AddBranchModal } from "@/components/settings/AddBranchModal";
import { BranchEditDrawer } from "@/components/settings/BranchEditDrawer";
import type { Enums } from "@/integrations/supabase/types";

type BranchType = Enums<"branch_type">;

type SectionKey = "branches" | "alerts" | "notifications" | "emar" | "system";

const BRANCH_TYPE_TONE: Record<BranchType, "info" | "success" | "neutral" | "warning"> = {
  CARE_HOME: "info",
  DCU: "success",
  HOUSING: "neutral",
  REHABILITATION: "warning",
};

function SettingsPage() {
  const { t } = useTranslation();
  const { staff } = useCurrentStaff();
  const isSysAdmin = staff?.role === "SYSTEM_ADMIN";
  const [section, setSection] = useState<SectionKey>(isSysAdmin ? "branches" : "alerts");

  const sections: { key: SectionKey; label: string; icon: React.ReactNode; gated?: boolean }[] = ([
    { key: "branches" as SectionKey, label: t("settings.sections.branches"), icon: <Building size={16} />, gated: true },
    { key: "alerts" as SectionKey, label: t("settings.sections.alerts"), icon: <AlertCircle size={16} /> },
    { key: "notifications" as SectionKey, label: t("settings.sections.notifications"), icon: <Bell size={16} /> },
    { key: "emar" as SectionKey, label: t("settings.sections.emar"), icon: <Pill size={16} /> },
    { key: "system" as SectionKey, label: t("settings.sections.system"), icon: <SlidersHorizontal size={16} /> },
  ]).filter((s) => !s.gated || isSysAdmin);

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("nav.settings")}>
        <div className="flex gap-6 items-start w-full">
          <SideSectionNav
            items={sections}
            current={section}
            onChange={setSection}
          />
          <div className="flex-1 min-w-0">
            {section === "branches" && isSysAdmin && <BranchesSection />}
            {section !== "branches" && <ComingSoonSection labelKey={`settings.sections.${section}`} />}
          </div>
        </div>
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}

interface SideSectionNavProps {
  items: { key: SectionKey; label: string; icon: React.ReactNode }[];
  current: SectionKey;
  onChange: (k: SectionKey) => void;
}

function SideSectionNav({ items, current, onChange }: SideSectionNavProps) {
  return (
    <aside style={{ width: 200, flexShrink: 0 }}>
      <Surface padding="none">
        <ul className="flex flex-col py-2">
          {items.map((it) => {
            const active = it.key === current;
            return (
              <li key={it.key}>
                <button
                  type="button"
                  onClick={() => onChange(it.key)}
                  className="w-full flex items-center gap-2.5 px-3 transition-colors text-left"
                  style={{
                    height: 38,
                    backgroundColor: active ? "var(--bg-selected)" : "transparent",
                    color: "var(--text-primary)",
                    borderLeft: `3px solid ${active ? "var(--color-iris-500)" : "transparent"}`,
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-hover-subtle)"; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                >
                  <span style={{ color: active ? "var(--color-iris-500)" : "var(--text-secondary)" }}>{it.icon}</span>
                  <span className="type-body-md font-medium">{it.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Surface>
    </aside>
  );
}

function ComingSoonSection({ labelKey }: { labelKey: string }) {
  const { t } = useTranslation();
  return (
    <Card padding="none">
      <EmptyState icon={<Inbox size={48} />} title={t("settings.comingSoon")} description={t(labelKey)} />
    </Card>
  );
}

function BranchesSection() {
  const { t } = useTranslation();
  const { staff } = useCurrentStaff();
  const isSysAdmin = staff?.role === "SYSTEM_ADMIN";
  const { branches, isLoading } = useBranches();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | BranchType>("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return branches.filter((b) => {
      if (typeFilter !== "ALL" && b.type !== typeFilter) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        (b.name_zh ?? "").toLowerCase().includes(q)
      );
    });
  }, [branches, search, typeFilter]);

  const typeOptions: { value: "ALL" | BranchType; label: string }[] = [
    { value: "ALL", label: t("branches.allTypes") },
    { value: "CARE_HOME", label: t("branches.branchType.CARE_HOME") },
    { value: "DCU", label: t("branches.branchType.DCU") },
    { value: "HOUSING", label: t("branches.branchType.HOUSING") },
    { value: "REHABILITATION", label: t("branches.branchType.REHABILITATION") },
  ];

  const columns: Column<Branch>[] = [
    {
      key: "name",
      header: t("branches.columns.name"),
      cell: (row) => (
        <Stack gap={1}>
          <span className="type-body-md font-semibold" style={{ color: "var(--text-primary)" }}>{row.name_zh}</span>
          <span className="type-caption" style={{ color: "var(--text-tertiary)" }}>{row.name}</span>
        </Stack>
      ),
    },
    {
      key: "type",
      header: t("branches.columns.type"),
      width: 140,
      cell: (row) => <Badge tone={BRANCH_TYPE_TONE[row.type]}>{t(`branches.branchType.${row.type}`)}</Badge>,
    },
    {
      key: "swd_code",
      header: t("branches.columns.swdCode"),
      width: 140,
      cell: (row) => (
        <span className="font-mono type-body-sm" style={{ color: "var(--text-primary)" }}>{row.swd_code}</span>
      ),
    },
    {
      key: "address",
      header: t("branches.columns.address"),
      cell: (row) => (
        <Tooltip label={row.address}>
          <span
            className="type-body-sm inline-block max-w-[260px] truncate align-bottom"
            style={{ color: "var(--text-secondary)" }}
            title={row.address}
          >
            {row.address}
          </span>
        </Tooltip>
      ),
    },
    {
      key: "status",
      header: t("branches.columns.status"),
      width: 110,
      cell: (row) =>
        row.is_active ? (
          <Badge tone="success">{t("branches.statusActive")}</Badge>
        ) : (
          <Badge tone="neutral">{t("branches.statusInactive")}</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      width: 80,
      cell: (row) => (
        <Button
          variant="ghost"
          size="compact"
          leadingIcon={<Eye size={14} />}
          onClick={(e) => { e.stopPropagation(); setEditing(row); }}
        >
          {t("actions.view")}
        </Button>
      ),
    },
  ];

  return (
    <Stack gap={4}>
      <PageHeader
        title={t("branches.title")}
        actions={
          isSysAdmin ? (
            <Button variant="primary" leadingIcon={<Plus size={16} />} onClick={() => setAddOpen(true)}>
              {t("branches.addBranch")}
            </Button>
          ) : undefined
        }
      />

      <FilterBar>
        <div style={{ width: 280 }}>
          <SearchField
            placeholder={t("branches.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
          />
        </div>
        <div style={{ width: 200 }}>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter((e.target as HTMLSelectElement).value as typeof typeFilter)}
            options={typeOptions}
          />
        </div>
      </FilterBar>

      {isLoading ? (
        <Stack gap={2}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="row" height={56} />)}
        </Stack>
      ) : (
        <Table<Branch>
          columns={columns}
          rows={filtered}
          rowKey={(b) => b.id}
          onRowClick={(b) => setEditing(b)}
          empty={
            <EmptyState
              icon={<Building size={40} />}
              title={t("branches.emptyTitle")}
              description={t("branches.emptyDescription")}
            />
          }
        />
      )}

      <AddBranchModal open={addOpen} onClose={() => setAddOpen(false)} />
      <BranchEditDrawer open={!!editing} branch={editing} onClose={() => setEditing(null)} />
    </Stack>
  );
}

import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});
