import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Card, Stack, Inline, Text, Heading, Button, Surface, Spinner, EmptyState, Badge,
  ConfirmDialog, Divider,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { useWounds, type WoundRow, type WoundEntryRow } from "@/hooks/useWounds";
import type { useAuditLog } from "@/hooks/useAuditLog";
import { NewWoundModal } from "./NewWoundModal";
import { AddWoundEntryModal } from "./AddWoundEntryModal";

interface WoundsTabProps {
  residentId: string;
  branchId: string;
  staffId: string | null;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

type WoundStatus = Enums<"wound_status">;

const STATUS_TONE: Record<WoundStatus, "neutral" | "warning" | "success" | "error"> = {
  OPEN: "error",
  HEALING: "warning",
  HEALED: "success",
  DETERIORATING: "error",
};

function formatDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

function sizeText(size: WoundEntryRow["size_cm"]): string {
  if (!size || typeof size !== "object") return "—";
  const s = size as { length?: number | null; width?: number | null; depth?: number | null };
  const parts = [s.length, s.width, s.depth].filter((n): n is number => typeof n === "number");
  if (parts.length === 0) return "—";
  return parts.join(" × ") + " cm";
}

function latestEntry(w: WoundRow): WoundEntryRow | null {
  if (!w.wound_entries || w.wound_entries.length === 0) return null;
  return [...w.wound_entries].sort(
    (a, b) => new Date(b.assessed_at).getTime() - new Date(a.assessed_at).getTime(),
  )[0];
}

export function WoundsTab({ residentId, branchId, staffId, logAction }: WoundsTabProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { activeWounds, healedWounds, isLoading } = useWounds(residentId);

  const [newOpen, setNewOpen] = useState(false);
  const [entryFor, setEntryFor] = useState<WoundRow | null>(null);
  const [healing, setHealing] = useState<WoundRow | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [healedOpen, setHealedOpen] = useState(false);

  const toggleExpand = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const handleMarkHealed = async () => {
    if (!healing || !staffId) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const before = { status: healing.status, healed_at: healing.healed_at };
      const after = { status: "HEALED" as WoundStatus, healed_at: today };
      const { error } = await supabase.from("wounds").update(after).eq("id", healing.id);
      if (error) throw error;
      await logAction({
        action: "WOUND_HEALED",
        entity_type: "wounds",
        entity_id: healing.id,
        branch_id: branchId,
        before_state: before,
        after_state: after,
      });
      void qc.invalidateQueries({ queryKey: ["wounds", residentId] });
      toast.success(t("wounds.healedSuccess"));
      setHealing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 200 }}>
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <Stack gap={4}>
      <Inline justify="between" align="center">
        <Heading level={3}>{t("wounds.title")}</Heading>
        <Button variant="primary" onClick={() => setNewOpen(true)} disabled={!staffId}>
          {t("wounds.new")}
        </Button>
      </Inline>

      {/* Active wounds */}
      {activeWounds.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title={t("wounds.noWounds")}
            action={
              staffId ? (
                <Button variant="primary" onClick={() => setNewOpen(true)}>{t("wounds.new")}</Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Stack gap={3}>
          <Text size="label" color="tertiary">{t("wounds.active")} ({activeWounds.length})</Text>
          {activeWounds.map((w) => (
            <WoundCard
              key={w.id}
              wound={w}
              expanded={!!expanded[w.id]}
              onToggle={() => toggleExpand(w.id)}
              onAddEntry={() => setEntryFor(w)}
              onMarkHealed={() => setHealing(w)}
              canEdit={!!staffId}
            />
          ))}
        </Stack>
      )}

      {/* Healed wounds */}
      {healedWounds.length > 0 && (
        <Card padding="md">
          <Stack gap={3}>
            <button
              type="button"
              onClick={() => setHealedOpen((o) => !o)}
              className="flex items-center gap-2 text-left"
              style={{ color: "var(--text-primary)" }}
            >
              {healedOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Heading level={3}>{t("wounds.healed")}</Heading>
              <Badge tone="neutral">{healedWounds.length}</Badge>
            </button>
            {healedOpen && (
              <Stack gap={2}>
                {healedWounds.map((w) => (
                  <div key={w.id} style={{ opacity: 0.7 }}>
                    <WoundCard
                      wound={w}
                      expanded={!!expanded[w.id]}
                      onToggle={() => toggleExpand(w.id)}
                      onAddEntry={() => setEntryFor(w)}
                      onMarkHealed={() => undefined}
                      canEdit={false}
                    />
                  </div>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>
      )}

      {staffId && (
        <NewWoundModal
          open={newOpen}
          onClose={() => setNewOpen(false)}
          residentId={residentId}
          branchId={branchId}
          staffId={staffId}
          logAction={logAction}
        />
      )}
      {staffId && (
        <AddWoundEntryModal
          open={!!entryFor}
          onClose={() => setEntryFor(null)}
          wound={entryFor}
          residentId={residentId}
          branchId={branchId}
          staffId={staffId}
          logAction={logAction}
        />
      )}
      <ConfirmDialog
        open={!!healing}
        onClose={() => setHealing(null)}
        onConfirm={handleMarkHealed}
        title={t("wounds.markHealed")}
        summary={t("wounds.markHealedConfirm")}
        confirmLabel={t("wounds.markHealed")}
        cancelLabel={t("actions.cancel")}
        tone="approval"
      />
    </Stack>
  );
}

function WoundCard({
  wound, expanded, onToggle, onAddEntry, onMarkHealed, canEdit,
}: {
  wound: WoundRow;
  expanded: boolean;
  onToggle: () => void;
  onAddEntry: () => void;
  onMarkHealed: () => void;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const latest = latestEntry(wound);
  const sortedEntries = [...wound.wound_entries].sort(
    (a, b) => new Date(b.assessed_at).getTime() - new Date(a.assessed_at).getTime(),
  );

  return (
    <Card padding="md">
      <Stack gap={3}>
        <Inline justify="between" align="start" className="w-full">
          <Stack gap={1}>
            <Inline gap={2} wrap>
              <Badge tone="info">{t(`wounds.type.${wound.wound_type}`)}</Badge>
              <Text size="md" className="font-semibold">{wound.location_desc}</Text>
              <Badge tone={STATUS_TONE[wound.status]}>{t(`wounds.status.${wound.status}`)}</Badge>
              {wound.wound_type === "PRESSURE_INJURY" && wound.stage && (
                <Badge tone="neutral">{t(`wounds.stages.${wound.stage}`)}</Badge>
              )}
            </Inline>
            <Text size="sm" color="tertiary">
              {t("wounds.firstNoted")}: {formatDate(wound.first_noted_at)}
              {wound.healed_at && ` · ${t("wounds.healedAt")}: ${formatDate(wound.healed_at)}`}
            </Text>
          </Stack>
          <Inline gap={2}>
            {canEdit && (
              <>
                <Button variant="ghost" size="compact" onClick={onAddEntry}>
                  {t("wounds.addEntry")}
                </Button>
                {wound.status !== "HEALED" && (
                  <Button variant="soft" size="compact" onClick={onMarkHealed}>
                    {t("wounds.markHealed")}
                  </Button>
                )}
              </>
            )}
          </Inline>
        </Inline>

        {latest && (
          <Surface padding="sm">
            <Stack gap={1}>
              <Text size="label" color="tertiary">{t("wounds.latestEntry")}</Text>
              <Text size="sm">
                {formatDate(latest.assessed_at)} · {sizeText(latest.size_cm)}
              </Text>
              {latest.treatment && <Text size="sm" color="secondary">{latest.treatment}</Text>}
            </Stack>
          </Surface>
        )}

        <Divider />

        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 text-left"
          style={{ color: "var(--text-link)" }}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Text size="sm">
            {expanded ? t("wounds.hideEntries") : t("wounds.viewEntries")} ({wound.wound_entries.length})
          </Text>
        </button>

        {expanded && (
          <div className="w-full overflow-auto">
            {sortedEntries.length === 0 ? (
              <Text size="sm" color="tertiary">{t("wounds.noEntries")}</Text>
            ) : (
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <Th>{t("wounds.assessedAt")}</Th>
                    <Th>{t("wounds.size")}</Th>
                    <Th>{t("wounds.appearance")}</Th>
                    <Th>{t("wounds.exudate")}</Th>
                    <Th>{t("wounds.treatment")}</Th>
                    <Th>{t("residents.columns.status")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((e) => (
                    <tr key={e.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <Td>{formatDate(e.assessed_at)}</Td>
                      <Td>{sizeText(e.size_cm)}</Td>
                      <Td>{e.appearance ?? "—"}</Td>
                      <Td>{e.exudate ?? "—"}</Td>
                      <Td>{e.treatment ?? "—"}</Td>
                      <Td>
                        <Badge tone={STATUS_TONE[e.status]}>{t(`wounds.status.${e.status}`)}</Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Stack>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="text-left type-label"
      style={{ padding: "8px 10px", color: "var(--text-tertiary)", fontWeight: 500 }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="type-body-sm" style={{ padding: "8px 10px", color: "var(--text-primary)" }}>
      {children}
    </td>
  );
}
