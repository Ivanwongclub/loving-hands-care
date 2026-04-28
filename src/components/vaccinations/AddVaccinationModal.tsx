import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Modal, Button, Stack, Inline, Text, FormField, Select, TextField, TextArea,
  Switch, Radio, Alert,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/useStaff";
import {
  VACCINE_TYPES, INJECTION_SITES, type VaccineType, type InjectionSite,
} from "@/hooks/useVaccinations";
import type { useAuditLog } from "@/hooks/useAuditLog";

interface AddVaccinationModalProps {
  open: boolean;
  onClose: () => void;
  residentId: string;
  branchId: string;
  staffId: string | null;
  defaultType?: VaccineType | null;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
  onSaved: () => void | Promise<void>;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function AddVaccinationModal({
  open, onClose, residentId, branchId, staffId, defaultType, logAction, onSaved,
}: AddVaccinationModalProps) {
  const { t } = useTranslation();
  const [vaccineType, setVaccineType] = useState<VaccineType>(defaultType ?? "INFLUENZA");
  const [vaccineBrand, setVaccineBrand] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [administeredDate, setAdministeredDate] = useState(todayISO());
  const [adminRole, setAdminRole] = useState<"internal" | "external">("internal");
  const [internalStaffId, setInternalStaffId] = useState<string>("");
  const [doctorName, setDoctorName] = useState("");
  const [injectionSite, setInjectionSite] = useState<InjectionSite>("LEFT_DELTOID");
  const [consentObtained, setConsentObtained] = useState(true);
  const [consentBy, setConsentBy] = useState("");
  const [consentDate, setConsentDate] = useState(todayISO());
  const [adverseReaction, setAdverseReaction] = useState(false);
  const [adverseNotes, setAdverseNotes] = useState("");
  const [nextDoseDue, setNextDoseDue] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { staffList: allStaff } = (() => {
    const { data } = useStaff({ branchId, status: "ACTIVE" });
    return { staffList: data };
  })();
  const eligibleStaff = useMemo(
    () => (allStaff ?? []).filter((s) => s.role === "NURSE" || s.role === "SENIOR_NURSE"),
    [allStaff],
  );

  // Auto-suggest next dose for influenza/covid (annual)
  useEffect(() => {
    if (!administeredDate) return;
    if (vaccineType === "INFLUENZA" || vaccineType === "COVID19_BIVALENT" || vaccineType === "COVID19_OMICRON") {
      setNextDoseDue((prev) => prev || addDays(administeredDate, 365));
    }
  }, [vaccineType, administeredDate]);

  useEffect(() => {
    if (open) {
      setVaccineType(defaultType ?? "INFLUENZA");
      setVaccineBrand("");
      setBatchNumber("");
      setAdministeredDate(todayISO());
      setAdminRole("internal");
      setInternalStaffId("");
      setDoctorName("");
      setInjectionSite("LEFT_DELTOID");
      setConsentObtained(true);
      setConsentBy("");
      setConsentDate(todayISO());
      setAdverseReaction(false);
      setAdverseNotes("");
      setNextDoseDue("");
      setExpiryDate("");
      setNotes("");
      setError(null);
    }
  }, [open, defaultType]);

  const validate = (): string | null => {
    if (!batchNumber.trim()) return t("vaccinations.batchNumber") + " " + t("validation.required", { defaultValue: "required" });
    if (!administeredDate) return t("vaccinations.administeredDate") + " required";
    if (adminRole === "internal" && !internalStaffId) return t("vaccinations.selectStaff");
    if (adminRole === "external" && !doctorName.trim()) return t("vaccinations.doctorName") + " required";
    if (!consentObtained) return t("vaccinations.consentRequired");
    if (!consentBy.trim()) return t("vaccinations.consentBy") + " required";
    if (adverseReaction && !adverseNotes.trim()) return t("vaccinations.adverseReactionRequired");
    return null;
  };

  const handleSubmit = async () => {
    const v = validate();
    if (v) { setError(v); return; }
    setSubmitting(true);
    setError(null);
    try {
      const insertPayload = {
        resident_id: residentId,
        branch_id: branchId,
        vaccine_type: vaccineType,
        vaccine_brand: vaccineBrand.trim() || null,
        batch_number: batchNumber.trim(),
        administered_date: administeredDate,
        administered_by_staff_id: adminRole === "internal" ? internalStaffId : null,
        administered_by_doctor: adminRole === "external" ? doctorName.trim() : null,
        injection_site: injectionSite,
        consent_obtained: consentObtained,
        consent_by: consentBy.trim(),
        consent_date: consentDate,
        adverse_reaction: adverseReaction,
        adverse_reaction_notes: adverseReaction ? adverseNotes.trim() : null,
        next_dose_due_date: nextDoseDue || null,
        expiry_relevant_date: expiryDate || null,
        notes: notes.trim() || null,
        created_by_staff_id: staffId,
      };
      const { data: inserted, error: insErr } = await supabase
        .from("vaccination_records")
        .insert(insertPayload)
        .select("id")
        .single();
      if (insErr) throw insErr;
      await logAction({
        action: "VACCINATION_RECORDED",
        entity_type: "vaccination_records",
        entity_id: inserted.id,
        branch_id: branchId,
        before_state: null,
        after_state: {
          vaccine_type: vaccineType,
          administered_date: administeredDate,
          batch_number: batchNumber.trim(),
        },
      });
      toast.success(t("common.saved"));
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("vaccinations.addRecord")}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>{t("actions.cancel")}</Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>{t("actions.save")}</Button>
        </>
      }
    >
      <Stack gap={3}>
        {error && <Alert severity="error" description={error} />}
        {adverseReaction && (
          <Alert severity="warning" description={t("vaccinations.adverseReactionBanner")} />
        )}
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t("vaccinations.vaccineType")} required>
            <Select
              value={vaccineType}
              onChange={(e) => setVaccineType((e.target as HTMLSelectElement).value as VaccineType)}
              options={VACCINE_TYPES.map((v) => ({ value: v, label: t(`vaccinations.types.${v}`) }))}
            />
          </FormField>
          <FormField label={t("vaccinations.vaccineBrand")} helper={t("vaccinations.vaccineBrandHelper")}>
            <TextField value={vaccineBrand} onChange={(e) => setVaccineBrand(e.target.value)} />
          </FormField>
          <FormField label={t("vaccinations.batchNumber")} required helper={t("vaccinations.batchNumberHelper")}>
            <TextField value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
          </FormField>
          <FormField label={t("vaccinations.administeredDate")} required>
            <TextField type="date" value={administeredDate} onChange={(e) => setAdministeredDate(e.target.value)} />
          </FormField>
        </div>

        <FormField label={t("vaccinations.administeredBy")} required>
          <Inline gap={4}>
            <Radio
              name="adminRole"
              value="internal"
              checked={adminRole === "internal"}
              onChange={() => setAdminRole("internal")}
              label={t("vaccinations.administeredByInternal")}
            />
            <Radio
              name="adminRole"
              value="external"
              checked={adminRole === "external"}
              onChange={() => setAdminRole("external")}
              label={t("vaccinations.administeredByExternal")}
            />
          </Inline>
        </FormField>
        {adminRole === "internal" ? (
          <FormField label={t("vaccinations.selectStaff")} required>
            <Select
              value={internalStaffId}
              onChange={(e) => setInternalStaffId((e.target as HTMLSelectElement).value)}
              options={[
                { value: "", label: "—" },
                ...eligibleStaff.map((s) => ({
                  value: s.id,
                  label: s.name_zh ? `${s.name_zh} (${s.name})` : s.name,
                })),
              ]}
            />
          </FormField>
        ) : (
          <FormField label={t("vaccinations.doctorName")} required>
            <TextField value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
          </FormField>
        )}

        <FormField label={t("vaccinations.injectionSite")} required>
          <Inline gap={4} wrap>
            {INJECTION_SITES.map((site) => (
              <Radio
                key={site}
                name="injectionSite"
                value={site}
                checked={injectionSite === site}
                onChange={() => setInjectionSite(site)}
                label={t(`vaccinations.sites.${site}`)}
              />
            ))}
          </Inline>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t("vaccinations.consentObtained")} required>
            <Switch checked={consentObtained} onChange={setConsentObtained} />
          </FormField>
          <FormField label={t("vaccinations.consentDate")} required>
            <TextField type="date" value={consentDate} onChange={(e) => setConsentDate(e.target.value)} />
          </FormField>
          <FormField label={t("vaccinations.consentBy")} required>
            <TextField value={consentBy} onChange={(e) => setConsentBy(e.target.value)} />
          </FormField>
          <FormField label={t("vaccinations.adverseReaction")}>
            <Switch checked={adverseReaction} onChange={setAdverseReaction} />
          </FormField>
        </div>

        {adverseReaction && (
          <FormField label={t("vaccinations.adverseReactionNotes")} required>
            <TextArea rows={3} value={adverseNotes} onChange={(e) => setAdverseNotes(e.target.value)} />
          </FormField>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t("vaccinations.nextDoseDue")}>
            <TextField type="date" value={nextDoseDue} onChange={(e) => setNextDoseDue(e.target.value)} />
          </FormField>
          <FormField label={t("vaccinations.expiryRelevantDate")}>
            <TextField type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </FormField>
        </div>

        <FormField label={t("vaccinations.notes")}>
          <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>

        <Text size="caption" color="tertiary">
          {adminRole === "internal" && eligibleStaff.length === 0 ? "—" : ""}
        </Text>
      </Stack>
    </Modal>
  );
}
