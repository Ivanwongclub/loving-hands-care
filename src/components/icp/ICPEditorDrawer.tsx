import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import {
  Drawer, Button, FormField, TextField, TextArea, Select, Stack, Inline,
  Surface, Text, IconButton, Alert, SectionHeader,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { useAuditLog } from "@/hooks/useAuditLog";
import type { ICPRow } from "@/hooks/useICPs";
import { type ICPContent, type CareGoal, type RiskAssessment, type TaskRule, EMPTY_CONTENT } from "./types";

interface ICPEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  residentId: string;
  branchId: string;
  staffId: string;
  existingICP?: ICPRow | null;
  existingMaxVersion: number;
  onSaved: () => void;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

const TASK_TYPES = ["ADL", "VITALS", "MEDICATION_PREP", "WOUND_CARE", "REPOSITIONING", "ASSESSMENT", "FOLLOW_UP", "OTHER"] as const;
const FREQUENCIES = ["DAILY", "TWICE_DAILY", "WEEKLY", "AS_NEEDED"] as const;
const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;

function defaultTimesFor(freq: TaskRule["frequency"]): string[] {
  if (freq === "DAILY") return ["08:00"];
  if (freq === "TWICE_DAILY") return ["08:00", "20:00"];
  return [];
}

export function ICPEditorDrawer({
  open, onClose, residentId, branchId, staffId, existingICP, existingMaxVersion, onSaved, logAction,
}: ICPEditorDrawerProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [content, setContent] = useState<ICPContent>(EMPTY_CONTENT);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    if (existingICP?.content) {
      const c = existingICP.content as unknown as Partial<ICPContent>;
      setContent({
        care_goals: Array.isArray(c.care_goals) ? c.care_goals : [],
        risk_assessments: Array.isArray(c.risk_assessments) ? c.risk_assessments : [],
        task_rules: Array.isArray(c.task_rules) ? c.task_rules : [],
        special_instructions: typeof c.special_instructions === "string" ? c.special_instructions : "",
      });
    } else {
      setContent({
        care_goals: [{ goal: "", target: "", review_date: "" }],
        risk_assessments: [],
        task_rules: [],
        special_instructions: "",
      });
    }
  }, [open, existingICP]);

  const updateGoal = (i: number, patch: Partial<CareGoal>) => {
    setContent((c) => ({ ...c, care_goals: c.care_goals.map((g, idx) => (idx === i ? { ...g, ...patch } : g)) }));
  };
  const addGoal = () => setContent((c) => ({ ...c, care_goals: [...c.care_goals, { goal: "", target: "", review_date: "" }] }));
  const removeGoal = (i: number) => setContent((c) => ({ ...c, care_goals: c.care_goals.filter((_, idx) => idx !== i) }));

  const updateRisk = (i: number, patch: Partial<RiskAssessment>) => {
    setContent((c) => ({ ...c, risk_assessments: c.risk_assessments.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }));
  };
  const addRisk = () => setContent((c) => ({ ...c, risk_assessments: [...c.risk_assessments, { area: "", level: "LOW", mitigation: "" }] }));
  const removeRisk = (i: number) => setContent((c) => ({ ...c, risk_assessments: c.risk_assessments.filter((_, idx) => idx !== i) }));

  const updateRule = (i: number, patch: Partial<TaskRule>) => {
    setContent((c) => ({
      ...c,
      task_rules: c.task_rules.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, ...patch };
        if (patch.frequency && patch.frequency !== r.frequency) {
          next.times = defaultTimesFor(patch.frequency);
        }
        return next;
      }),
    }));
  };
  const addRule = () =>
    setContent((c) => ({
      ...c,
      task_rules: [
        ...c.task_rules,
        { type: "ADL", title: "", frequency: "DAILY", times: defaultTimesFor("DAILY") },
      ],
    }));
  const removeRule = (i: number) => setContent((c) => ({ ...c, task_rules: c.task_rules.filter((_, idx) => idx !== i) }));

  const updateRuleTime = (ri: number, ti: number, value: string) => {
    setContent((c) => ({
      ...c,
      task_rules: c.task_rules.map((r, idx) => {
        if (idx !== ri) return r;
        const times = [...r.times];
        times[ti] = value;
        return { ...r, times };
      }),
    }));
  };

  const validate = (): string | null => {
    const goals = content.care_goals.filter((g) => g.goal.trim().length > 0);
    if (goals.length === 0) return t("icp.noGoals");
    for (const r of content.risk_assessments) {
      if (!r.area.trim() || !r.mitigation.trim()) return t("icp.riskMitigation");
    }
    for (const rule of content.task_rules) {
      if (!rule.title.trim()) return t("icp.taskRuleTitle");
    }
    return null;
  };

  const handleSave = async (submitForApproval: boolean) => {
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const cleaned: ICPContent = {
        care_goals: content.care_goals.filter((g) => g.goal.trim().length > 0),
        risk_assessments: content.risk_assessments,
        task_rules: content.task_rules,
        special_instructions: content.special_instructions,
      };
      const insertRow: TablesInsert<"icps"> = {
        resident_id: residentId,
        branch_id: branchId,
        version: existingMaxVersion + 1,
        status: submitForApproval ? "PENDING_APPROVAL" : "DRAFT",
        authored_by: staffId,
        content: cleaned as unknown as TablesInsert<"icps">["content"],
        submitted_at: submitForApproval ? new Date().toISOString() : null,
      };
      const { data, error } = await supabase.from("icps").insert(insertRow).select().single();
      if (error) throw error;
      await logAction({
        action: "ICP_CREATED",
        entity_type: "icps",
        entity_id: data.id,
        branch_id: branchId,
        after_state: data as unknown as Record<string, unknown>,
      });
      toast.success(t("icp.saveSuccess"));
      if (submitForApproval) toast.success(t("icp.submitSuccess"));
      void qc.invalidateQueries({ queryKey: ["icps", residentId] });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={720}
      title={existingICP ? t("icp.newVersion") : t("icp.new")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t("actions.cancel")}</Button>
          <Button variant="soft" loading={saving} onClick={() => handleSave(false)}>{t("icp.saveDraft")}</Button>
          <Button variant="primary" loading={saving} onClick={() => handleSave(true)}>{t("icp.saveAndSubmit")}</Button>
        </>
      }
    >
      <Stack gap={5}>
        {err && <Alert severity="error" description={err} />}

        {/* Care Goals */}
        <Stack gap={3}>
          <SectionHeader
            title={t("icp.sections.careGoals")}
            action={
              <Button variant="ghost" size="compact" leadingIcon={<Plus size={14} />} onClick={addGoal}>
                {t("icp.addCareGoal")}
              </Button>
            }
          />
          {content.care_goals.map((g, i) => (
            <Surface key={i} padding="sm">
              <Stack gap={2}>
                <Inline gap={2} justify="between" align="start">
                  <Text size="sm" color="tertiary">{t("icp.careGoal")} #{i + 1}</Text>
                  {content.care_goals.length > 1 && (
                    <IconButton
                      aria-label="Remove goal"
                      icon={<Trash2 size={14} />}
                      variant="ghost"
                      size="compact"
                      onClick={() => removeGoal(i)}
                    />
                  )}
                </Inline>
                <FormField label={t("icp.goalDescription")} required>
                  <TextField value={g.goal} onChange={(e) => updateGoal(i, { goal: e.target.value })} />
                </FormField>
                <Inline gap={2} className="w-full" align="start">
                  <div className="flex-1">
                    <FormField label={t("icp.goalTarget")}>
                      <TextField value={g.target} onChange={(e) => updateGoal(i, { target: e.target.value })} />
                    </FormField>
                  </div>
                  <div className="flex-1">
                    <FormField label={t("icp.goalReviewDate")}>
                      <TextField type="date" value={g.review_date} onChange={(e) => updateGoal(i, { review_date: e.target.value })} />
                    </FormField>
                  </div>
                </Inline>
              </Stack>
            </Surface>
          ))}
        </Stack>

        {/* Risks */}
        <Stack gap={3}>
          <SectionHeader
            title={t("icp.sections.riskAssessments")}
            action={
              <Button variant="ghost" size="compact" leadingIcon={<Plus size={14} />} onClick={addRisk}>
                {t("icp.addRisk")}
              </Button>
            }
          />
          {content.risk_assessments.length === 0 && (
            <Text size="sm" color="tertiary">{t("icp.noRisks")}</Text>
          )}
          {content.risk_assessments.map((r, i) => (
            <Surface key={i} padding="sm">
              <Stack gap={2}>
                <Inline justify="between" align="start">
                  <Text size="sm" color="tertiary">#{i + 1}</Text>
                  <IconButton aria-label="Remove risk" icon={<Trash2 size={14} />} variant="ghost" size="compact" onClick={() => removeRisk(i)} />
                </Inline>
                <Inline gap={2} className="w-full" align="start">
                  <div className="flex-1">
                    <FormField label={t("icp.riskArea")} required>
                      <TextField value={r.area} onChange={(e) => updateRisk(i, { area: e.target.value })} />
                    </FormField>
                  </div>
                  <div style={{ width: 160 }}>
                    <FormField label={t("icp.riskLevel")} required>
                      <Select
                        value={r.level}
                        onChange={(e) => updateRisk(i, { level: (e.target as HTMLSelectElement).value as RiskAssessment["level"] })}
                        options={RISK_LEVELS.map((l) => ({ value: l, label: t(`residents.riskLevel.${l}`) }))}
                      />
                    </FormField>
                  </div>
                </Inline>
                <FormField label={t("icp.riskMitigation")} required>
                  <TextArea rows={2} value={r.mitigation} onChange={(e) => updateRisk(i, { mitigation: e.target.value })} />
                </FormField>
              </Stack>
            </Surface>
          ))}
        </Stack>

        {/* Task rules */}
        <Stack gap={3}>
          <SectionHeader
            title={t("icp.sections.taskRules")}
            action={
              <Button variant="ghost" size="compact" leadingIcon={<Plus size={14} />} onClick={addRule}>
                {t("icp.addTaskRule")}
              </Button>
            }
          />
          {content.task_rules.map((rule, i) => (
            <Surface key={i} padding="sm">
              <Stack gap={2}>
                <Inline justify="between" align="start">
                  <Text size="sm" color="tertiary">#{i + 1}</Text>
                  <IconButton aria-label="Remove rule" icon={<Trash2 size={14} />} variant="ghost" size="compact" onClick={() => removeRule(i)} />
                </Inline>
                <Inline gap={2} className="w-full" align="start">
                  <div style={{ width: 200 }}>
                    <FormField label={t("icp.taskRuleType")} required>
                      <Select
                        value={rule.type}
                        onChange={(e) => updateRule(i, { type: (e.target as HTMLSelectElement).value as TaskRule["type"] })}
                        options={TASK_TYPES.map((tt) => ({ value: tt, label: t(`tasks.type.${tt}`) }))}
                      />
                    </FormField>
                  </div>
                  <div className="flex-1">
                    <FormField label={t("icp.taskRuleTitle")} required>
                      <TextField value={rule.title} onChange={(e) => updateRule(i, { title: e.target.value })} />
                    </FormField>
                  </div>
                </Inline>
                <Inline gap={2} className="w-full" align="start">
                  <div style={{ width: 200 }}>
                    <FormField label={t("icp.taskRuleFrequency")} required>
                      <Select
                        value={rule.frequency}
                        onChange={(e) => updateRule(i, { frequency: (e.target as HTMLSelectElement).value as TaskRule["frequency"] })}
                        options={FREQUENCIES.map((f) => ({ value: f, label: t(`icp.frequency.${f}`) }))}
                      />
                    </FormField>
                  </div>
                  {(rule.frequency === "DAILY" || rule.frequency === "TWICE_DAILY") && (
                    <div className="flex-1">
                      <FormField label={t("icp.taskRuleTimes")}>
                        <Inline gap={2} wrap>
                          {Array.from({ length: rule.frequency === "TWICE_DAILY" ? 2 : 1 }).map((_, ti) => (
                            <div key={ti} style={{ width: 110 }}>
                              <TextField
                                type="time"
                                value={rule.times[ti] ?? ""}
                                onChange={(e) => updateRuleTime(i, ti, e.target.value)}
                              />
                            </div>
                          ))}
                        </Inline>
                      </FormField>
                    </div>
                  )}
                </Inline>
              </Stack>
            </Surface>
          ))}
        </Stack>

        {/* Special instructions */}
        <Stack gap={3}>
          <SectionHeader title={t("icp.sections.specialInstructions")} />
          <FormField label={t("icp.specialInstructionsLabel")}>
            <TextArea
              rows={4}
              value={content.special_instructions}
              onChange={(e) => setContent((c) => ({ ...c, special_instructions: e.target.value }))}
            />
          </FormField>
        </Stack>
      </Stack>
    </Drawer>
  );
}
