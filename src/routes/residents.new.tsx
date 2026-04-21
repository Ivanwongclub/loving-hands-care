import { useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import {
  Stack, Inline, Button, Card, Heading, Text, Surface, Alert, Badge, Stepper,
  PageHeader, FormField, TextField, TextArea, Select, Switch, Checkbox, Radio,
  IconButton, ValidationMessage, Divider,
} from "@/components/hms";
import { FacilityTree } from "@/components/hms/FacilityTree";
import { supabase } from "@/integrations/supabase/client";
import { useBranches } from "@/hooks/useBranches";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { useAuditLog } from "@/hooks/useAuditLog";
import type { Enums } from "@/integrations/supabase/types";

type Gender = Enums<"gender_type">;

interface Allergy { drug: string; reaction: string; severity: "MILD" | "MODERATE" | "SEVERE" }
interface Contact {
  name_zh: string; name: string; relationship: string;
  phone_whatsapp: string; phone_sms: string;
  is_primary: boolean; is_emergency: boolean; consent_notifications: boolean;
}
interface StagedDoc { file: File; document_type: string; notes: string }

interface AdmissionFormData {
  name_zh: string; name: string; preferred_name: string;
  dob: string; gender: Gender | "";
  hkid: string; language_preference: string;
  allergies: Allergy[];
  diagnoses: string; special_instructions: string;
  contacts: Contact[];
  documents: StagedDoc[];
  selected_bed_id: string | null; selected_bed_code: string | null;
  do_not_share_family: boolean; data_consent: boolean; photo_consent: boolean;
}

const EMPTY_CONTACT: Contact = {
  name_zh: "", name: "", relationship: "",
  phone_whatsapp: "", phone_sms: "",
  is_primary: false, is_emergency: false, consent_notifications: true,
};

const DOCUMENT_TYPES = ["CONSENT_FORM", "MEDICAL_REFERRAL", "ID_COPY", "ADVANCE_DIRECTIVE", "OTHER"] as const;

async function hashHKID(hkid: string): Promise<string> {
  const normalized = hkid.trim().toUpperCase();
  const encoded = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function todayISODate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function NewAdmissionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { staff } = useCurrentStaff();
  const { branches } = useBranches();
  const branchId = branches[0]?.id ?? null;
  const { logAction } = useAuditLog();

  const isAdmin = staff?.role === "SYSTEM_ADMIN" || staff?.role === "BRANCH_ADMIN";

  const [currentStep, setCurrentStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [data, setData] = useState<AdmissionFormData>({
    name_zh: "", name: "", preferred_name: "",
    dob: "", gender: "",
    hkid: "", language_preference: "zh-HK",
    allergies: [],
    diagnoses: "", special_instructions: "",
    contacts: [{ ...EMPTY_CONTACT, is_primary: true }],
    documents: [],
    selected_bed_id: null, selected_bed_code: null,
    do_not_share_family: false, data_consent: false, photo_consent: false,
  });

  const update = <K extends keyof AdmissionFormData>(key: K, value: AdmissionFormData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const stepLabels = [
    t("admission.step1"), t("admission.step2"), t("admission.step3"),
    t("admission.step4"), t("admission.step5"), t("admission.step6"), t("admission.step7"),
  ];

  const stepperItems = stepLabels.map((label, i) => {
    const stepNum = i + 1;
    const status: "incomplete" | "current" | "complete" =
      stepNum < currentStep ? "complete" : stepNum === currentStep ? "current" : "incomplete";
    return { label, status };
  });

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!data.name_zh.trim() || !data.name.trim()) return "Name required";
      if (!data.dob) return "DOB required";
      if (!data.gender) return "Gender required";
      if (!data.hkid.trim()) return "HKID required";
      if (!data.language_preference) return "Language required";
      return null;
    }
    if (s === 3) {
      const valid = data.contacts.filter((c) => c.name.trim() && c.relationship.trim());
      if (valid.length === 0) return t("admission.minOneContact");
      return null;
    }
    if (s === 5) {
      if (!data.selected_bed_id && !isAdmin) return t("admission.bedRequired");
      return null;
    }
    if (s === 6) {
      if (!data.data_consent) return t("admission.dataConsentLabel");
      return null;
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep(currentStep);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setCurrentStep((s) => Math.min(7, s + 1));
  };

  const handleBack = () => {
    setStepError(null);
    setCurrentStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    if (!staff?.id || !branchId) {
      setSubmitError("Missing staff or branch context");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Hash HKID
      const hkid_hash = await hashHKID(data.hkid);

      // 2. Insert resident
      const residentInsert = {
        branch_id: branchId,
        name_zh: data.name_zh,
        name: data.name,
        preferred_name: data.preferred_name || null,
        dob: data.dob,
        gender: data.gender as Gender,
        hkid_hash,
        admission_date: todayISODate(),
        status: "ADMITTED" as const,
        bed_id: data.selected_bed_id,
        language_preference: data.language_preference || null,
        do_not_share_family: data.do_not_share_family,
        medical_history: data.diagnoses ? { diagnoses: data.diagnoses } : null,
        allergies: data.allergies.length > 0 ? data.allergies : null,
        notes: data.special_instructions || null,
      };
      const { data: resRow, error: rErr } = await supabase
        .from("residents")
        .insert(residentInsert)
        .select()
        .single();
      if (rErr) throw rErr;
      const newResidentId = resRow.id;

      // 3 + 4. Bed assignment
      if (data.selected_bed_id) {
        const { error: lErr } = await supabase
          .from("locations")
          .update({ status: "OCCUPIED" })
          .eq("id", data.selected_bed_id);
        if (lErr) throw lErr;

        const { error: bErr } = await supabase.from("bed_assignments").insert({
          resident_id: newResidentId,
          bed_id: data.selected_bed_id,
          branch_id: branchId,
          assigned_by: staff.id,
          reason: "ADMISSION",
        });
        if (bErr) throw bErr;
      }

      // 5. Insert contacts
      const validContacts = data.contacts.filter((c) => c.name.trim() && c.relationship.trim());
      if (validContacts.length > 0) {
        const { error: cErr } = await supabase.from("resident_contacts").insert(
          validContacts.map((c) => ({
            resident_id: newResidentId,
            name: c.name,
            name_zh: c.name_zh || null,
            relationship: c.relationship,
            phone_whatsapp: c.phone_whatsapp || null,
            phone_sms: c.phone_sms || null,
            is_primary: c.is_primary,
            is_emergency: c.is_emergency,
            consent_notifications: c.consent_notifications,
          }))
        );
        if (cErr) throw cErr;
      }

      // 6. Upload documents
      for (const doc of data.documents) {
        const path = `residents/${newResidentId}/${doc.document_type}/${doc.file.name}`;
        const { error: upErr } = await supabase.storage
          .from("resident-documents")
          .upload(path, doc.file, { upsert: false });
        if (upErr) throw upErr;
        const { error: dErr } = await supabase.from("resident_documents").insert({
          resident_id: newResidentId,
          branch_id: branchId,
          document_type: doc.document_type,
          file_name: doc.file.name,
          storage_path: path,
          uploaded_by: staff.id,
          notes: doc.notes || null,
        });
        if (dErr) throw dErr;
      }

      // 7. Audit
      void logAction({
        action: "RESIDENT_ADMITTED",
        entity_type: "residents",
        entity_id: newResidentId,
        branch_id: branchId,
        after_state: residentInsert as unknown as Record<string, unknown>,
      });

      toast.success(t("admission.admissionSuccess"));
      navigate({ to: "/residents/$id", params: { id: newResidentId } });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Admission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("admission.title")}>
        <Stack gap={4}>
          <PageHeader
            title={t("admission.title")}
            actions={
              <Button
                variant="ghost"
                leadingIcon={<ArrowLeft size={16} />}
                onClick={() => navigate({ to: "/residents" })}
                disabled={submitting}
              >
                {t("actions.back")}
              </Button>
            }
          />

          <Surface padding="md">
            <Stepper steps={stepperItems} />
          </Surface>

          {submitError && <Alert severity="error" description={submitError} />}

          <div style={{ width: "100%" }}>
            {currentStep === 1 && <Step1 data={data} update={update} />}
            {currentStep === 2 && <Step2 data={data} update={update} />}
            {currentStep === 3 && <Step3 data={data} update={update} />}
            {currentStep === 4 && <Step4 data={data} update={update} />}
            {currentStep === 5 && (
              <Step5
                data={data}
                update={update}
                branchId={branchId}
                isAdmin={isAdmin}
              />
            )}
            {currentStep === 6 && <Step6 data={data} update={update} />}
            {currentStep === 7 && <Step7 data={data} goTo={(s) => setCurrentStep(s)} />}
          </div>

          {stepError && <ValidationMessage tone="error">{stepError}</ValidationMessage>}

          <Inline justify="between" className="w-full">
            <Button variant="ghost" onClick={handleBack} disabled={currentStep === 1 || submitting}>
              {t("actions.back")}
            </Button>
            {currentStep < 7 ? (
              <Button variant="primary" onClick={handleNext} disabled={submitting}>
                {t("actions.next")}
              </Button>
            ) : (
              <Button variant="primary" loading={submitting} onClick={handleSubmit}>
                {t("admission.completeAdmission")}
              </Button>
            )}
          </Inline>
        </Stack>
      </AdminDesktopShell>
    </ProtectedRoute>
  );
}

/* ── Step 1 ── */
function Step1({
  data, update,
}: {
  data: AdmissionFormData;
  update: <K extends keyof AdmissionFormData>(k: K, v: AdmissionFormData[K]) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card padding="md">
      <Stack gap={3}>
        <Heading level={3}>{t("admission.step1")}</Heading>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t("contacts.fields.nameZh")} required>
            <TextField value={data.name_zh} onChange={(e) => update("name_zh", e.target.value)} />
          </FormField>
          <FormField label={t("contacts.fields.name")} required>
            <TextField value={data.name} onChange={(e) => update("name", e.target.value)} />
          </FormField>
          <FormField label={t("residents.demographics.preferredName")}>
            <TextField value={data.preferred_name} onChange={(e) => update("preferred_name", e.target.value)} />
          </FormField>
          <FormField label={t("residents.demographics.dob")} required>
            <TextField type="date" value={data.dob} onChange={(e) => update("dob", e.target.value)} />
          </FormField>
        </div>

        <FormField label={t("residents.demographics.gender")} required>
          <Inline gap={4}>
            {(["M", "F", "OTHER"] as const).map((g) => (
              <Radio
                key={g}
                name="gender"
                value={g}
                checked={data.gender === g}
                onChange={() => update("gender", g)}
                label={t(`residents.gender.${g}`)}
              />
            ))}
          </Inline>
        </FormField>

        <FormField label={t("admission.hkidLabel")} required helper={t("admission.hkidHint")}>
          <TextField
            value={data.hkid}
            placeholder={t("admission.hkidPlaceholder")}
            onChange={(e) => update("hkid", e.target.value)}
          />
        </FormField>

        <FormField label={t("residents.demographics.language")} required>
          <Select
            value={data.language_preference}
            onChange={(e) => update("language_preference", (e.target as HTMLSelectElement).value)}
            options={[
              { value: "zh-HK", label: "廣東話 / Cantonese" },
              { value: "zh-CN", label: "普通話 / Mandarin" },
              { value: "en", label: "English" },
            ]}
          />
        </FormField>
      </Stack>
    </Card>
  );
}

/* ── Step 2 ── */
function Step2({
  data, update,
}: {
  data: AdmissionFormData;
  update: <K extends keyof AdmissionFormData>(k: K, v: AdmissionFormData[K]) => void;
}) {
  const { t } = useTranslation();

  const addAllergy = () =>
    update("allergies", [...data.allergies, { drug: "", reaction: "", severity: "MILD" }]);
  const removeAllergy = (i: number) =>
    update("allergies", data.allergies.filter((_, idx) => idx !== i));
  const setAllergy = (i: number, patch: Partial<Allergy>) =>
    update(
      "allergies",
      data.allergies.map((a, idx) => (idx === i ? { ...a, ...patch } : a))
    );

  return (
    <Card padding="md">
      <Stack gap={4}>
        <Heading level={3}>{t("admission.step2")}</Heading>

        <Stack gap={2}>
          <Inline justify="between">
            <Text size="label" color="tertiary">{t("residents.allergies")}</Text>
            <Button variant="ghost" size="compact" leadingIcon={<Plus size={14} />} onClick={addAllergy}>
              {t("admission.addAllergy")}
            </Button>
          </Inline>
          {data.allergies.length === 0 ? (
            <Text size="sm" color="tertiary">{t("residents.noneRecorded")}</Text>
          ) : (
            <Stack gap={2}>
              {data.allergies.map((a, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <FormField label={t("admission.allergyDrug")}>
                      <TextField value={a.drug} onChange={(e) => setAllergy(i, { drug: e.target.value })} />
                    </FormField>
                  </div>
                  <div className="col-span-4">
                    <FormField label={t("admission.allergyReaction")}>
                      <TextField value={a.reaction} onChange={(e) => setAllergy(i, { reaction: e.target.value })} />
                    </FormField>
                  </div>
                  <div className="col-span-3">
                    <FormField label={t("admission.allergySeverity")}>
                      <Select
                        value={a.severity}
                        onChange={(e) =>
                          setAllergy(i, { severity: (e.target as HTMLSelectElement).value as Allergy["severity"] })
                        }
                        options={[
                          { value: "MILD", label: t("admission.severity.MILD") },
                          { value: "MODERATE", label: t("admission.severity.MODERATE") },
                          { value: "SEVERE", label: t("admission.severity.SEVERE") },
                        ]}
                      />
                    </FormField>
                  </div>
                  <div className="col-span-1">
                    <IconButton
                      aria-label="Remove allergy"
                      variant="ghost"
                      size="compact"
                      icon={<Trash2 size={14} />}
                      onClick={() => removeAllergy(i)}
                    />
                  </div>
                </div>
              ))}
            </Stack>
          )}
        </Stack>

        <Divider />

        <FormField label={t("residents.allergiesSection.diagnoses")}>
          <TextArea value={data.diagnoses} onChange={(e) => update("diagnoses", e.target.value)} />
        </FormField>

        <FormField label={t("residents.allergiesSection.specialInstructions")}>
          <TextArea
            value={data.special_instructions}
            onChange={(e) => update("special_instructions", e.target.value)}
          />
        </FormField>
      </Stack>
    </Card>
  );
}

/* ── Step 3 ── */
function Step3({
  data, update,
}: {
  data: AdmissionFormData;
  update: <K extends keyof AdmissionFormData>(k: K, v: AdmissionFormData[K]) => void;
}) {
  const { t } = useTranslation();

  const addContact = () => update("contacts", [...data.contacts, { ...EMPTY_CONTACT }]);
  const removeContact = (i: number) =>
    update("contacts", data.contacts.filter((_, idx) => idx !== i));
  const setContact = (i: number, patch: Partial<Contact>) =>
    update(
      "contacts",
      data.contacts.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
    );

  const hasValidContact = data.contacts.some((c) => c.name.trim() && c.relationship.trim());

  return (
    <Card padding="md">
      <Stack gap={3}>
        <Inline justify="between">
          <Heading level={3}>{t("admission.step3")}</Heading>
          <Button variant="ghost" size="compact" leadingIcon={<Plus size={14} />} onClick={addContact}>
            {t("admission.addContact")}
          </Button>
        </Inline>

        {!hasValidContact && (
          <ValidationMessage tone="warning">{t("admission.minOneContact")}</ValidationMessage>
        )}

        <Stack gap={3}>
          {data.contacts.map((c, i) => (
            <Surface key={i} padding="sm">
              <Stack gap={3}>
                <Inline justify="between">
                  <Text size="sm" color="secondary">#{i + 1}</Text>
                  {data.contacts.length > 1 && (
                    <IconButton
                      aria-label="Remove contact"
                      variant="ghost"
                      size="compact"
                      icon={<Trash2 size={14} />}
                      onClick={() => removeContact(i)}
                    />
                  )}
                </Inline>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label={t("contacts.fields.nameZh")}>
                    <TextField value={c.name_zh} onChange={(e) => setContact(i, { name_zh: e.target.value })} />
                  </FormField>
                  <FormField label={t("contacts.fields.name")} required>
                    <TextField value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} />
                  </FormField>
                </div>
                <FormField label={t("contacts.fields.relationship")} required>
                  <TextField value={c.relationship} onChange={(e) => setContact(i, { relationship: e.target.value })} />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label={t("contacts.fields.whatsapp")}>
                    <TextField
                      value={c.phone_whatsapp}
                      onChange={(e) => setContact(i, { phone_whatsapp: e.target.value })}
                    />
                  </FormField>
                  <FormField label={t("contacts.fields.sms")}>
                    <TextField value={c.phone_sms} onChange={(e) => setContact(i, { phone_sms: e.target.value })} />
                  </FormField>
                </div>
                <Inline gap={4} wrap>
                  <Switch
                    checked={c.is_primary}
                    onChange={(v) => setContact(i, { is_primary: v })}
                    label={t("contacts.fields.isPrimary")}
                  />
                  <Switch
                    checked={c.is_emergency}
                    onChange={(v) => setContact(i, { is_emergency: v })}
                    label={t("contacts.fields.isEmergency")}
                  />
                  <Switch
                    checked={c.consent_notifications}
                    onChange={(v) => setContact(i, { consent_notifications: v })}
                    label={t("contacts.fields.consentNotifications")}
                  />
                </Inline>
              </Stack>
            </Surface>
          ))}
        </Stack>
      </Stack>
    </Card>
  );
}

/* ── Step 4 ── */
function Step4({
  data, update,
}: {
  data: AdmissionFormData;
  update: <K extends keyof AdmissionFormData>(k: K, v: AdmissionFormData[K]) => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      update("documents", [...data.documents, { file: f, document_type: "CONSENT_FORM", notes: "" }]);
    }
    e.target.value = "";
  };

  const removeDoc = (i: number) =>
    update("documents", data.documents.filter((_, idx) => idx !== i));
  const setDoc = (i: number, patch: Partial<StagedDoc>) =>
    update(
      "documents",
      data.documents.map((d, idx) => (idx === i ? { ...d, ...patch } : d))
    );

  const typeOptions = DOCUMENT_TYPES.map((v) => ({ value: v, label: t(`documents.types.${v}`) }));

  return (
    <Card padding="md">
      <Stack gap={3}>
        <Heading level={3}>{t("admission.step4")}</Heading>
        <Alert severity="info" description={t("admission.documentOptional")} />

        <Inline>
          <input ref={fileRef} type="file" hidden onChange={onFile} />
          <Button variant="soft" leadingIcon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>
            {t("admission.selectFile")}
          </Button>
        </Inline>

        {data.documents.length > 0 && (
          <Stack gap={2}>
            <Text size="label" color="tertiary">{t("admission.stagedFiles")}</Text>
            {data.documents.map((d, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <Text size="sm">{d.file.name}</Text>
                  <Text size="caption" color="tertiary">{(d.file.size / 1024).toFixed(1)} KB</Text>
                </div>
                <div className="col-span-3">
                  <FormField label={t("documents.type")}>
                    <Select
                      value={d.document_type}
                      onChange={(e) => setDoc(i, { document_type: (e.target as HTMLSelectElement).value })}
                      options={typeOptions}
                    />
                  </FormField>
                </div>
                <div className="col-span-4">
                  <FormField label={t("admission.notes")}>
                    <TextField value={d.notes} onChange={(e) => setDoc(i, { notes: e.target.value })} />
                  </FormField>
                </div>
                <div className="col-span-1">
                  <IconButton
                    aria-label="Remove file"
                    variant="ghost"
                    size="compact"
                    icon={<Trash2 size={14} />}
                    onClick={() => removeDoc(i)}
                  />
                </div>
              </div>
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

/* ── Step 5 ── */
function Step5({
  data, update, branchId, isAdmin,
}: {
  data: AdmissionFormData;
  update: <K extends keyof AdmissionFormData>(k: K, v: AdmissionFormData[K]) => void;
  branchId: string | null;
  isAdmin: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Card padding="md">
      <Stack gap={3}>
        <Heading level={3}>{t("admission.step5")}</Heading>
        <Text size="sm" color="secondary">{t("transfer.selectBed")}</Text>

        {!data.selected_bed_id && isAdmin && (
          <Alert severity="warning" description={t("admission.noBedWarning")} />
        )}

        <div style={{ maxHeight: 420, overflow: "auto", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)" }}>
          <FacilityTree
            branchId={branchId}
            selectable
            showAvailableOnly
            selectedBedId={data.selected_bed_id ?? undefined}
            onSelectBed={(id, code) => {
              update("selected_bed_id", id);
              update("selected_bed_code", code);
            }}
          />
        </div>

        {data.selected_bed_code ? (
          <Inline>
            <Badge tone="info">
              {t("admission.selectedBed")}: {data.selected_bed_code}
            </Badge>
          </Inline>
        ) : (
          <Text size="sm" color="tertiary">{t("admission.noBedSelected")}</Text>
        )}
      </Stack>
    </Card>
  );
}

/* ── Step 6 ── */
function Step6({
  data, update,
}: {
  data: AdmissionFormData;
  update: <K extends keyof AdmissionFormData>(k: K, v: AdmissionFormData[K]) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card padding="md">
      <Stack gap={4}>
        <Heading level={3}>{t("admission.consentLabel")}</Heading>

        <Stack gap={2}>
          <Switch
            checked={data.do_not_share_family}
            onChange={(v) => update("do_not_share_family", v)}
            label={t("admission.doNotShareLabel")}
          />
          {data.do_not_share_family && (
            <Alert severity="warning" description={t("admission.doNotShareWarning")} />
          )}
        </Stack>

        <Divider />

        <Checkbox
          checked={data.data_consent}
          onChange={(e) => update("data_consent", e.target.checked)}
          label={t("admission.dataConsentLabel")}
        />
        <Checkbox
          checked={data.photo_consent}
          onChange={(e) => update("photo_consent", e.target.checked)}
          label={t("admission.photoConsentLabel")}
        />
      </Stack>
    </Card>
  );
}

/* ── Step 7 ── */
function Step7({
  data, goTo,
}: {
  data: AdmissionFormData;
  goTo: (step: number) => void;
}) {
  const { t } = useTranslation();
  const primaryContact = useMemo(
    () => data.contacts.find((c) => c.is_primary) ?? data.contacts[0],
    [data.contacts]
  );

  const Section = ({ step, title, children }: { step: number; title: string; children: React.ReactNode }) => (
    <Card padding="md">
      <Inline justify="between" className="mb-3">
        <Heading level={3}>{title}</Heading>
        <Button variant="ghost" size="compact" onClick={() => goTo(step)}>
          {t("admission.edit")}
        </Button>
      </Inline>
      {children}
    </Card>
  );

  return (
    <Stack gap={3}>
      <Heading level={2}>{t("admission.reviewTitle")}</Heading>

      <Section step={1} title={t("admission.step1")}>
        <Stack gap={2}>
          <Row label={t("contacts.fields.nameZh")} value={data.name_zh} />
          <Row label={t("contacts.fields.name")} value={data.name} />
          <Row label={t("residents.demographics.preferredName")} value={data.preferred_name || "—"} />
          <Row label={t("residents.demographics.dob")} value={data.dob} />
          <Row label={t("residents.demographics.gender")} value={data.gender ? t(`residents.gender.${data.gender}`) : "—"} />
          <Row label={t("residents.demographics.language")} value={data.language_preference} />
        </Stack>
      </Section>

      <Section step={2} title={t("admission.step2")}>
        <Stack gap={2}>
          <Row label={t("residents.allergies")} value={`${data.allergies.length}`} />
          <Row label={t("residents.allergiesSection.diagnoses")} value={data.diagnoses.slice(0, 80) || "—"} />
        </Stack>
      </Section>

      <Section step={3} title={t("admission.step3")}>
        <Stack gap={2}>
          <Row label={t("residents.contacts")} value={`${data.contacts.length}`} />
          <Row
            label={t("contacts.primary")}
            value={primaryContact ? (primaryContact.name_zh || primaryContact.name || "—") : "—"}
          />
        </Stack>
      </Section>

      <Section step={4} title={t("admission.step4")}>
        <Row label={t("admission.stagedFiles")} value={`${data.documents.length}`} />
      </Section>

      <Section step={5} title={t("admission.step5")}>
        <Row label={t("residents.currentBed")} value={data.selected_bed_code ?? t("admission.noBedSelected")} />
      </Section>

      <Section step={6} title={t("admission.consentLabel")}>
        <Stack gap={2}>
          <Row
            label={t("admission.doNotShareLabel")}
            value={data.do_not_share_family ? "✓" : "—"}
          />
          <Row label={t("admission.dataConsentLabel")} value={data.data_consent ? "✓" : "—"} />
          <Row label={t("admission.photoConsentLabel")} value={data.photo_consent ? "✓" : "—"} />
        </Stack>
      </Section>
    </Stack>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Inline gap={3}>
      <Text size="label" color="tertiary" style={{ minWidth: 160 }}>{label}</Text>
      <Text size="sm">{value}</Text>
    </Inline>
  );
}

export const Route = createFileRoute("/residents/new")({
  component: NewAdmissionPage,
});
