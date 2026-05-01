import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList, ChevronDown, ChevronRight } from "lucide-react";
import {
  Card, Badge, Button, Stack, Inline, Heading, Text, EmptyState, Spinner,
  Surface, Drawer, Divider, Table, type Column,
} from "@/components/hms";
import { useICPs, type ICPRow } from "@/hooks/useICPs";
import type { useAuditLog } from "@/hooks/useAuditLog";
import { ICPEditorDrawer } from "./ICPEditorDrawer";
import { ICPApprovalActions } from "./ICPApprovalActions";
import { ICP_STATUS_TONE, type ICPContent } from "./types";

interface ICPTabProps {
  residentId: string;
  branchId: string;
  staffId: string | null;
  staffRole: string | null;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

function formatDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

function readContent(icp: ICPRow): ICPContent {
  const c = icp.content as unknown as Partial<ICPContent>;
  return {
    care_goals: Array.isArray(c.care_goals) ? c.care_goals : [],
    risk_assessments: Array.isArray(c.risk_assessments) ? c.risk_assessments : [],
    task_rules: Array.isArray(c.task_rules) ? c.task_rules : [],
    special_instructions: typeof c.special_instructions === "string" ? c.special_instructions : "",
  };
}

export function ICPTab({ residentId, branchId, staffId, staffRole, logAction }: ICPTabProps) {
  const { t } = useTranslation();
  const { icps, activeICP, isLoading } = useICPs(residentId);

  const [editorOpen, setEditorOpen] = useState(false);
  const [seedFromActive, setSeedFromActive] = useState(false);
  const [viewICP, setViewICP] = useState<ICPRow | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const canEdit =
    staffRole === "SENIOR_NURSE" ||
    staffRole === "BRANCH_ADMIN" ||
    staffRole === "SYSTEM_ADMIN";

  const maxVersion = icps.reduce((m, i) => Math.max(m, i.version), 0);
  const history = icps.filter((i) => i.id !== activeICP?.id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 200 }}>
        <Spinner size="md" />
      </div>
    );
  }

  if (!activeICP) {
    return (
      <>
        <Card padding="lg">
          <EmptyState
            icon={<ClipboardList size={36} />}
            title={t("icp.noICP")}
            description={t("icp.noICPHint")}
            action={
              canEdit && staffId ? (
                <Button variant="primary" onClick={() => { setSeedFromActive(false); setEditorOpen(true); }}>
                  {t("icp.new")}
                </Button>
              ) : undefined
            }
          />
        </Card>
        {history.length > 0 && (
          <HistorySection
            history={history}
            open={historyOpen}
            onToggle={() => setHistoryOpen((o) => !o)}
            onView={(i) => setViewICP(i)}
          />
        )}
        {canEdit && staffId && (
          <ICPEditorDrawer
            open={editorOpen}
            onClose={() => setEditorOpen(false)}
            residentId={residentId}
            branchId={branchId}
            staffId={staffId}
            existingICP={null}
            existingMaxVersion={maxVersion}
            onSaved={() => undefined}
            logAction={logAction}
          />
        )}
        {viewICP && <ICPViewDrawer icp={viewICP} onClose={() => setViewICP(null)} />}
      </>
    );
  }

  const activeContent = readContent(activeICP);

  return (
    <Stack gap={4} data-feedback-id="resident-tab-care-plan">
      <Card padding="md">
        <Stack gap={3}>
          <Inline justify="between" align="start">
            <Inline gap={2}>
              <Heading level={3}>{t("icp.activeICP")}</Heading>
              <Badge tone="neutral">{t("icp.version")} {activeICP.version}</Badge>
              <Badge tone={ICP_STATUS_TONE[activeICP.status]}>
                {t(`icp.status.${activeICP.status}`)}
              </Badge>
            </Inline>
          </Inline>

          <Divider />

          {/* Care Goals summary */}
          <Stack gap={2}>
            <Text size="label" color="tertiary">{t("icp.sections.careGoals")}</Text>
            {activeContent.care_goals.length === 0 ? (
              <Text size="sm" color="secondary">{t("icp.noGoals")}</Text>
            ) : (
              <Stack gap={1}>
                {activeContent.care_goals.map((g, i) => (
                  <Text key={i} size="sm">• {g.goal}{g.target ? ` — ${g.target}` : ""}</Text>
                ))}
              </Stack>
            )}
          </Stack>

          {/* Risks summary */}
          <Stack gap={2}>
            <Text size="label" color="tertiary">{t("icp.sections.riskAssessments")}</Text>
            {activeContent.risk_assessments.length === 0 ? (
              <Text size="sm" color="secondary">{t("icp.noRisks")}</Text>
            ) : (
              <Inline gap={2} wrap>
                {activeContent.risk_assessments.map((r, i) => (
                  <Badge
                    key={i}
                    tone={r.level === "HIGH" ? "error" : r.level === "MEDIUM" ? "warning" : "success"}
                  >
                    {r.area} · {t(`residents.riskLevel.${r.level}`)}
                  </Badge>
                ))}
              </Inline>
            )}
          </Stack>

          {/* Task rules count */}
          <Stack gap={2}>
            <Text size="label" color="tertiary">{t("icp.sections.taskRules")}</Text>
            <Text size="sm">{t("icp.ruleCount", { count: activeContent.task_rules.length })}</Text>
          </Stack>

          {/* Special instructions snippet */}
          {activeContent.special_instructions && (
            <Stack gap={2}>
              <Text size="label" color="tertiary">{t("icp.sections.specialInstructions")}</Text>
              <Text size="sm" color="secondary">{activeContent.special_instructions.slice(0, 200)}</Text>
            </Stack>
          )}

          <Divider />

          <Inline gap={2} wrap>
            <Button variant="ghost" onClick={() => setViewICP(activeICP)}>
              {t("icp.viewFull")}
            </Button>
            {canEdit && staffId && (
              <Button variant="ghost" onClick={() => { setSeedFromActive(true); setEditorOpen(true); }}>
                {t("icp.newVersion")}
              </Button>
            )}
            {staffId && (
              <ICPApprovalActions
                icp={activeICP}
                staffId={staffId}
                staffRole={staffRole}
                residentId={residentId}
                branchId={branchId}
                logAction={logAction}
              />
            )}
          </Inline>
        </Stack>
      </Card>

      {history.length > 0 && (
        <HistorySection
          history={history}
          open={historyOpen}
          onToggle={() => setHistoryOpen((o) => !o)}
          onView={(i) => setViewICP(i)}
        />
      )}

      {canEdit && staffId && (
        <ICPEditorDrawer
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          residentId={residentId}
          branchId={branchId}
          staffId={staffId}
          existingICP={seedFromActive ? activeICP : null}
          existingMaxVersion={maxVersion}
          onSaved={() => undefined}
          logAction={logAction}
        />
      )}

      {viewICP && <ICPViewDrawer icp={viewICP} onClose={() => setViewICP(null)} />}
    </Stack>
  );
}

function HistorySection({
  history, open, onToggle, onView,
}: {
  history: ICPRow[];
  open: boolean;
  onToggle: () => void;
  onView: (i: ICPRow) => void;
}) {
  const { t } = useTranslation();
  const columns: Column<ICPRow>[] = [
    { key: "v", header: t("icp.version"), width: 90, cell: (r) => `v${r.version}` },
    {
      key: "status",
      header: t("residents.columns.status"),
      width: 140,
      cell: (r) => <Badge tone={ICP_STATUS_TONE[r.status]}>{t(`icp.status.${r.status}`)}</Badge>,
    },
    { key: "author", header: t("icp.authoredBy"), cell: (r) => r.author?.name_zh ?? r.author?.name ?? "—" },
    { key: "approver", header: t("icp.approvedBy"), cell: (r) => r.approver?.name_zh ?? r.approver?.name ?? "—" },
    { key: "date", header: t("audit.at"), width: 140, cell: (r) => formatDate(r.created_at) },
  ];
  return (
    <Card padding="md">
      <Stack gap={3}>
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 text-left"
          style={{ color: "var(--text-primary)" }}
        >
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Heading level={3}>{t("icp.history")}</Heading>
          <Badge tone="neutral">{history.length}</Badge>
        </button>
        {open && (
          <Table<ICPRow>
            columns={columns}
            rows={history}
            rowKey={(r) => r.id}
            onRowClick={(r) => onView(r)}
          />
        )}
      </Stack>
    </Card>
  );
}

function ICPViewDrawer({ icp, onClose }: { icp: ICPRow; onClose: () => void }) {
  const { t } = useTranslation();
  const c = readContent(icp);
  return (
    <Drawer
      open
      onClose={onClose}
      width={600}
      title={`${t("icp.title")} — v${icp.version}`}
    >
      <Stack gap={4}>
        <Inline gap={2} wrap>
          <Badge tone={ICP_STATUS_TONE[icp.status]}>{t(`icp.status.${icp.status}`)}</Badge>
          <Text size="sm" color="secondary">
            {t("icp.authoredBy")}: {icp.author?.name_zh ?? icp.author?.name ?? "—"}
          </Text>
        </Inline>

        {icp.status === "REJECTED" && icp.rejection_reason && (
          <Surface padding="sm">
            <Stack gap={1}>
              <Text size="label" color="tertiary">{t("icp.rejectionReason")}</Text>
              <Text size="sm">{icp.rejection_reason}</Text>
            </Stack>
          </Surface>
        )}

        <Stack gap={2}>
          <Text size="label" color="tertiary">{t("icp.sections.careGoals")}</Text>
          {c.care_goals.length === 0 ? <Text size="sm" color="secondary">—</Text> : (
            <Stack gap={2}>
              {c.care_goals.map((g, i) => (
                <Surface key={i} padding="sm">
                  <Stack gap={1}>
                    <Text size="md" className="font-semibold">{g.goal}</Text>
                    {g.target && <Text size="sm" color="secondary">{g.target}</Text>}
                    {g.review_date && <Text size="sm" color="tertiary">{g.review_date}</Text>}
                  </Stack>
                </Surface>
              ))}
            </Stack>
          )}
        </Stack>

        <Stack gap={2}>
          <Text size="label" color="tertiary">{t("icp.sections.riskAssessments")}</Text>
          {c.risk_assessments.length === 0 ? <Text size="sm" color="secondary">—</Text> : (
            <Stack gap={2}>
              {c.risk_assessments.map((r, i) => (
                <Surface key={i} padding="sm">
                  <Stack gap={1}>
                    <Inline gap={2}>
                      <Text size="md" className="font-semibold">{r.area}</Text>
                      <Badge tone={r.level === "HIGH" ? "error" : r.level === "MEDIUM" ? "warning" : "success"}>
                        {t(`residents.riskLevel.${r.level}`)}
                      </Badge>
                    </Inline>
                    <Text size="sm" color="secondary">{r.mitigation}</Text>
                  </Stack>
                </Surface>
              ))}
            </Stack>
          )}
        </Stack>

        <Stack gap={2}>
          <Text size="label" color="tertiary">{t("icp.sections.taskRules")}</Text>
          {c.task_rules.length === 0 ? <Text size="sm" color="secondary">—</Text> : (
            <Stack gap={2}>
              {c.task_rules.map((r, i) => (
                <Surface key={i} padding="sm">
                  <Stack gap={1}>
                    <Inline gap={2}>
                      <Badge tone="info">{t(`tasks.type.${r.type}`)}</Badge>
                      <Text size="md" className="font-semibold">{r.title}</Text>
                    </Inline>
                    <Text size="sm" color="secondary">
                      {t(`icp.frequency.${r.frequency}`)}{r.times.length > 0 ? ` · ${r.times.join(", ")}` : ""}
                    </Text>
                  </Stack>
                </Surface>
              ))}
            </Stack>
          )}
        </Stack>

        {c.special_instructions && (
          <Stack gap={2}>
            <Text size="label" color="tertiary">{t("icp.sections.specialInstructions")}</Text>
            <Text size="sm">{c.special_instructions}</Text>
          </Stack>
        )}
      </Stack>
    </Drawer>
  );
}
