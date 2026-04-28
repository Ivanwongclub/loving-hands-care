import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Modal, Button, FormField, TextField, TextArea, Select, NumberField, DateField,
  Switch, Stack, Inline, Alert, Stepper, Text,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/useStaff";
import type { useAuditLog } from "@/hooks/useAuditLog";

interface AddRestraintModalProps {
  open: boolean;
  onClose: () => void;
  residentId: string;
  branchId: string;
  staffId: string;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

const RESTRAINT_TYPES = [
  "WRIST_SOFT_PADDED", "VEST", "LAP_BELT", "BED_RAILS",
  "WHEELCHAIR_BELT", "CHEMICAL", "OTHER",
] as const;
const ASSESSOR_ROLES = [
  "NURSE", "SENIOR_NURSE", "OCCUPATIONAL_THERAPIST", "PHYSIOTHERAPIST", "DOCTOR",
] as const;
const CONSENT_BY = ["RESIDENT", "FAMILY", "LPOA", "GUARDIAN"] as const;

type Step = "assessment" | "type" | "application";

function todayISO(): string { return new Date().toISOString().slice(0, 10); }
function addDaysISO(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function AddRestraintModal({
  open, onClose, residentId, branchId, staffId, logAction,
}: AddRestraintModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { staff: branchStaff } = useStaff({ branchId });

  const [step, setStep] = useState<Step>("assessment");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Step 1
  const [contributingFactors, setContributingFactors] = useState("");
  const [alternativesTried, setAlternativesTried] = useState("");
  const [riskToSelf, setRiskToSelf] = useState(false);
  const [riskToOthers, setRiskToOthers] = useState(false);
  const [assessmentByRole, setAssessmentByRole] = useState<string>("NURSE");
  const [assessmentDate, setAssessmentDate] = useState(todayISO());
  const [assessmentByStaffId, setAssessmentByStaffId] = useState<string>("");

  // Step 2
  const [restraintType, setRestraintType] = useState<string>("WRIST_SOFT_PADDED");
  const [restraintSpecification, setRestraintSpecification] = useState("");
  const [leastRestraintPrinciple, setLeastRestraintPrinciple] = useState(true);
  const [consentObtained, setConsentObtained] = useState(true);
  const [consentBy, setConsentBy] = useState<string>("FAMILY");
  const [consentSignatoryName, setConsentSignatoryName] = useState("");
  const [consentDate, setConsentDate] = useState(todayISO());
  const [doctorOrderRequired, setDoctorOrderRequired] = useState(false);
  const [doctorName, setDoctorName] = useState("");
  const [doctorOrderDate, setDoctorOrderDate] = useState(todayISO());

  // Step 3
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [durationPerDayMinutes, setDurationPerDayMinutes] = useState<string>("");
  const [reviewDueDate, setReviewDueDate] = useState(addDaysISO(todayISO(), 30));
  const [notes, setNotes] = useState("");

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep("assessment");
      setSaving(false); setErr(null);
      setContributingFactors(""); setAlternativesTried("");
      setRiskToSelf(false); setRiskToOthers(false);
      setAssessmentByRole("NURSE"); setAssessmentDate(todayISO());
      setAssessmentByStaffId("");
      setRestraintType("WRIST_SOFT_PADDED"); setRestraintSpecification("");
      setLeastRestraintPrinciple(true);
      setConsentObtained(true); setConsentBy("FAMILY");
      setConsentSignatoryName(""); setConsentDate(todayISO());
      setDoctorOrderRequired(false); setDoctorName(""); setDoctorOrderDate(todayISO());
      setStartDate(todayISO()); setEndDate("");
      setDurationPerDayMinutes("");
      setReviewDueDate(addDaysISO(todayISO(), 30));
      setNotes("");
    }
  }, [open]);

  // CHEMICAL forces doctor order
  useEffect(() => {
    if (restraintType === "CHEMICAL") setDoctorOrderRequired(true);
  }, [restraintType]);

  // Recompute review date on start date change
  useEffect(() => {
    if (startDate) setReviewDueDate(addDaysISO(startDate, 30));
  }, [startDate]);

  const staffOptions = useMemo(() => {
    const allowed: string[] = ["NURSE", "SENIOR_NURSE", "BRANCH_ADMIN", "SYSTEM_ADMIN"];
    return [
      { value: "", label: t("residents.contactSelect") || "—" },
      ...branchStaff
        .filter((s) => allowed.includes(s.role))
        .map((s) => ({
          value: s.id,
          label: s.name_zh ? `${s.name_zh} (${s.name})` : s.name,
        })),
    ];
  }, [branchStaff, t]);

  const validateStep1 = (): string | null => {
    if (!contributingFactors.trim()) return t("restraints.contributingFactors");
    if (!alternativesTried.trim()) return t("restraints.alternativesTried");
    if (!riskToSelf && !riskToOthers) return t("restraints.riskToSelf");
    if (!assessmentByRole) return t("restraints.assessor");
    return null;
  };
  const validateStep2 = (): string | null => {
    if (!restraintType) return t("restraints.types.OTHER");
    if (!leastRestraintPrinciple) return t("restraints.leastRestraintPrinciple");
    if (!consentObtained) return t("restraints.consentObtained");
    if (!consentBy) return t("restraints.consenter");
    if (!consentSignatoryName.trim()) return t("restraints.consentSignatoryName");
    if (!consentDate) return t("restraints.consentDate");
    if (doctorOrderRequired) {
      if (!doctorName.trim()) return t("restraints.doctorName");
      if (!doctorOrderDate) return t("restraints.doctorOrderDate");
    }
    return null;
  };
  const validateStep3 = (): string | null => {
    if (!startDate) return t("restraints.startDate");
    if (!reviewDueDate) return t("restraints.reviewDueDate");
    return null;
  };

  const handleNext = () => {
    setErr(null);
    if (step === "assessment") {
      const e = validateStep1(); if (e) { setErr(e); return; }
      setStep("type");
    } else if (step === "type") {
      const e = validateStep2(); if (e) { setErr(e); return; }
      setStep("application");
    }
  };
  const handleBack = () => {
    setErr(null);
    if (step === "type") setStep("assessment");
    else if (step === "application") setStep("type");
  };

  const handleSubmit = async () => {
    const e = validateStep3();
    if (e) { setErr(e); return; }
    setSaving(true);
    try {
      const insertPayload = {
        resident_id: residentId,
        branch_id: branchId,
        assessment_date: assessmentDate,
        assessment_by_staff_id: assessmentByStaffId || null,
        assessment_by_role: assessmentByRole,
        contributing_factors: contributingFactors,
        alternatives_tried: alternativesTried,
        risk_to_self: riskToSelf,
        risk_to_others: riskToOthers,
        restraint_type: restraintType,
        restraint_specification: restraintSpecification || null,
        least_restraint_principle: leastRestraintPrinciple,
        consent_obtained: consentObtained,
        consent_by: consentBy,
        consent_signatory_name: consentSignatoryName,
        consent_date: consentDate,
        consent_document_path: null,
        doctor_order_required: doctorOrderRequired,
        doctor_name: doctorOrderRequired ? doctorName : null,
        doctor_order_date: doctorOrderRequired ? doctorOrderDate : null,
        start_date: startDate,
        end_date: endDate || null,
        duration_per_day_minutes: durationPerDayMinutes ? Number(durationPerDayMinutes) : null,
        status: "ACTIVE",
        review_due_date: reviewDueDate,
        notes: notes || null,
        created_by_staff_id: staffId,
      };
      const { data, error } = await supabase
        .from("restraint_records")
        .insert(insertPayload)
        .select("id")
        .single();
      if (error) throw error;
      const insertedId = data?.id as string;

      await logAction({
        action: "RESTRAINT_RECORD_CREATED",
        entity_type: "restraint_records",
        entity_id: insertedId,
        branch_id: branchId,
        before_state: null,
        after_state: { restraint_type: restraintType, start_date: startDate, review_due_date: reviewDueDate },
      });
      await qc.invalidateQueries({ queryKey: ["restraintRecords", residentId] });
      toast.success(t("restraints.addRecord"));
      onClose();
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : String(e2);
      setErr(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const stepperSteps = [
    {
      label: t("restraints.step1"),
      status: step === "assessment" ? "current" : "complete" as const,
    },
    {
      label: t("restraints.step2"),
      status: step === "type" ? "current" : step === "application" ? "complete" : "incomplete" as const,
    },
    {
      label: t("restraints.step3"),
      status: step === "application" ? "current" : "incomplete" as const,
    },
  ] as { label: string; status: "incomplete" | "current" | "complete" | "error" }[];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("restraints.addRecord")}
      size="lg"
      footer={
        <>
          {step !== "assessment" && (
            <Button variant="soft" onClick={handleBack} disabled={saving}>
              {t("actions.back") || "Back"}
            </Button>
          )}
          <Button variant="soft" onClick={onClose} disabled={saving}>
            {t("actions.cancel")}
          </Button>
          {step !== "application" ? (
            <Button variant="primary" onClick={handleNext}>
              {t("actions.next") || "Next"}
            </Button>
          ) : (
            <Button variant="primary" onClick={handleSubmit} disabled={saving}>
              {saving ? t("actions.saving") || "Saving…" : t("actions.save")}
            </Button>
          )}
        </>
      }
    >
      <Stack gap={4}>
        <Stepper steps={stepperSteps} />
        {err && <Alert severity="error" title={err} />}

        {step === "assessment" && (
          <Stack gap={3}>
            <FormField label={t("restraints.contributingFactors")} required helper={t("restraints.contributingFactorsHelper")}>
              <TextArea
                rows={3}
                value={contributingFactors}
                onChange={(e) => setContributingFactors(e.target.value)}
              />
            </FormField>
            <FormField label={t("restraints.alternativesTried")} required helper={t("restraints.alternativesTriedHelper")}>
              <TextArea
                rows={3}
                value={alternativesTried}
                onChange={(e) => setAlternativesTried(e.target.value)}
              />
            </FormField>
            <Inline gap={4}>
              <Switch checked={riskToSelf} onChange={setRiskToSelf} label={t("restraints.riskToSelf")} />
              <Switch checked={riskToOthers} onChange={setRiskToOthers} label={t("restraints.riskToOthers")} />
            </Inline>
            <FormField label={t("restraints.assessor")} required>
              <Select
                value={assessmentByRole}
                onChange={(e) => setAssessmentByRole(e.target.value)}
                options={ASSESSOR_ROLES.map((r) => ({ value: r, label: t(`restraints.assessorRoles.${r}`) }))}
              />
            </FormField>
            <Inline gap={3}>
              <FormField label={t("restraints.startDate")}>
                <DateField value={assessmentDate} onChange={(e) => setAssessmentDate(e.target.value)} />
              </FormField>
              <FormField label={t("restraints.assessor")}>
                <Select
                  value={assessmentByStaffId}
                  onChange={(e) => setAssessmentByStaffId(e.target.value)}
                  options={staffOptions}
                />
              </FormField>
            </Inline>
          </Stack>
        )}

        {step === "type" && (
          <Stack gap={3}>
            <FormField label={t("restraints.types.OTHER")} required helper={t("restraints.softPaddedRecommendation")}>
              <Select
                value={restraintType}
                onChange={(e) => setRestraintType(e.target.value)}
                options={RESTRAINT_TYPES.map((r) => ({ value: r, label: t(`restraints.types.${r}`) }))}
              />
            </FormField>
            {restraintType === "CHEMICAL" && (
              <Alert severity="warning" title={t("restraints.chemicalRestraintWarning")} />
            )}
            <FormField label={t("restraints.specification")}>
              <TextField
                placeholder={t("restraints.specificationPlaceholder")}
                value={restraintSpecification}
                onChange={(e) => setRestraintSpecification(e.target.value)}
              />
            </FormField>
            <Switch
              checked={leastRestraintPrinciple}
              onChange={setLeastRestraintPrinciple}
              label={t("restraints.leastRestraintPrinciple")}
            />
            <Switch
              checked={consentObtained}
              onChange={setConsentObtained}
              label={t("restraints.consentObtained")}
            />
            <Inline gap={3}>
              <FormField label={t("restraints.consenter")} required>
                <Select
                  value={consentBy}
                  onChange={(e) => setConsentBy(e.target.value)}
                  options={CONSENT_BY.map((c) => ({ value: c, label: t(`restraints.consentBy.${c}`) }))}
                />
              </FormField>
              <FormField label={t("restraints.consentSignatoryName")} required>
                <TextField value={consentSignatoryName} onChange={(e) => setConsentSignatoryName(e.target.value)} />
              </FormField>
              <FormField label={t("restraints.consentDate")} required>
                <DateField value={consentDate} onChange={(e) => setConsentDate(e.target.value)} />
              </FormField>
            </Inline>
            <Switch
              checked={doctorOrderRequired}
              onChange={(v) => { if (restraintType !== "CHEMICAL") setDoctorOrderRequired(v); }}
              disabled={restraintType === "CHEMICAL"}
              label={t("restraints.doctorOrderRequired")}
            />
            {doctorOrderRequired && (
              <Inline gap={3}>
                <FormField label={t("restraints.doctorName")} required>
                  <TextField value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
                </FormField>
                <FormField label={t("restraints.doctorOrderDate")} required>
                  <DateField value={doctorOrderDate} onChange={(e) => setDoctorOrderDate(e.target.value)} />
                </FormField>
              </Inline>
            )}
          </Stack>
        )}

        {step === "application" && (
          <Stack gap={3}>
            <Inline gap={3}>
              <FormField label={t("restraints.startDate")} required>
                <DateField value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </FormField>
              <FormField label={t("restraints.endDate")} helper={t("restraints.endDateHelper")}>
                <DateField value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </FormField>
            </Inline>
            <Inline gap={3}>
              <FormField label={t("restraints.durationPerDay")} helper={t("restraints.durationHelper")}>
                <NumberField
                  value={durationPerDayMinutes}
                  onChange={(e) => setDurationPerDayMinutes(e.target.value)}
                  min={0}
                />
              </FormField>
              <FormField label={t("restraints.reviewDueDate")} required>
                <DateField value={reviewDueDate} onChange={(e) => setReviewDueDate(e.target.value)} />
              </FormField>
            </Inline>
            <FormField label={t("residents.notes") || "Notes"}>
              <TextArea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </FormField>
            <Alert severity="info" title={t("restraints.complianceConfirm")} />
            <Text size="sm" color="tertiary">
              {t("restraints.types.OTHER")}: {t(`restraints.types.${restraintType}`)} · {t("restraints.startDate")}: {startDate} → {t("restraints.reviewDueDate")}: {reviewDueDate}
            </Text>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
