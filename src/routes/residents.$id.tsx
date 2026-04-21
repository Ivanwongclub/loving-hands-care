import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Lock, Upload, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import {
  Avatar, Badge, Button, Card, Heading, Inline, Stack, Text, Divider, Surface,
  Tabs, Table, TableToolbar, EmptyState, Spinner, Alert, Switch, Modal, Drawer,
  ConfirmDialog, FormField, TextField, Select, DropdownMenu, IconButton,
  ActivityItem, Timeline, type Column,
} from "@/components/hms";
import { TransferBedModal } from "@/components/residents/TransferBedModal";
import { DischargeModal } from "@/components/residents/DischargeModal";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { useBranches } from "@/hooks/useBranches";
import { useLocations } from "@/hooks/useLocations";
import { useAuditLog } from "@/hooks/useAuditLog";
import type { Tables, Enums } from "@/integrations/supabase/types";

type Resident = Tables<"residents"> & {
  locations: { id: string; code: string; name: string; name_zh: string | null; parent_id: string | null } | null;
};
type Contact = Tables<"resident_contacts">;
type DocumentRow = Tables<"resident_documents">;
type BedAssignment = Tables<"bed_assignments"> & {
  locations: { code: string; name: string } | null;
  assigner: { name: string; name_zh: string | null } | null;
};
type AuditLogRow = Tables<"audit_logs"> & {
  actor: { name: string; name_zh: string | null } | null;
};
type ResidentStatus = Enums<"resident_status">;
type Gender = Enums<"gender_type">;

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
const SEVERITY_TONE: Record<string, "success" | "warning" | "error" | "neutral"> = {
  MILD: "success",
  MODERATE: "warning",
  SEVERE: "error",
};
const ACTIVITY_TONE: Record<string, "success" | "neutral" | "info" | "warning"> = {
  RESIDENT_ADMITTED: "success",
  RESIDENT_DISCHARGED: "neutral",
  EMAR_ADMINISTERED: "info",
  INCIDENT_REPORTED: "warning",
};

const DOCUMENT_TYPES = ["CONSENT_FORM", "MEDICAL_REFERRAL", "ID_COPY", "ADVANCE_DIRECTIVE", "OTHER"] as const;

function formatDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}
function formatDateTime(d?: string | null): string {
  if (!d) return "—";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
function calcAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
}

/* ──────────────────────────────────────────────────────────
 * Page
 * ────────────────────────────────────────────────────────── */

function ResidentDetailPage() {
  const { id } = useParams({ from: "/residents/$id" });
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { staff } = useCurrentStaff();
  const { branches } = useBranches();
  const branchId = branches[0]?.id ?? null;
  const { logAction } = useAuditLog();

  const [resident, setResident] = useState<Resident | null>(null);
  const [residentLoading, setResidentLoading] = useState(true);
  const [residentError, setResidentError] = useState<string | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [bedHistory, setBedHistory] = useState<BedAssignment[]>([]);
  const [activityLog, setActivityLog] = useState<AuditLogRow[]>([]);

  const [tab, setTab] = useState<"profile" | "contacts" | "documents" | "bed" | "activity">("profile");
  const [editMode, setEditMode] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [dischargeOpen, setDischargeOpen] = useState(false);

  const fetchResident = async () => {
    setResidentLoading(true);
    setResidentError(null);
    const { data, error } = await supabase
      .from("residents")
      .select("*, locations:bed_id(id, code, name, name_zh, parent_id)")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      setResidentError(error.message);
      setResident(null);
    } else if (!data) {
      setResidentError("not_found");
      setResident(null);
    } else {
      setResident(data as Resident);
    }
    setResidentLoading(false);
  };

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from("resident_contacts")
      .select("*")
      .eq("resident_id", id)
      .is("deleted_at", null)
      .order("is_primary", { ascending: false });
    if (!error) setContacts((data ?? []) as Contact[]);
  };

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from("resident_documents")
      .select("*")
      .eq("resident_id", id)
      .order("uploaded_at", { ascending: false });
    if (!error) setDocuments((data ?? []) as DocumentRow[]);
  };

  const fetchBedHistory = async () => {
    const { data, error } = await supabase
      .from("bed_assignments")
      .select("*, locations:bed_id(code, name), assigner:assigned_by(name, name_zh)")
      .eq("resident_id", id)
      .order("assigned_at", { ascending: false });
    if (!error) setBedHistory((data ?? []) as unknown as BedAssignment[]);
  };

  const fetchActivity = async () => {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*, actor:actor_id(name, name_zh)")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) setActivityLog((data ?? []) as unknown as AuditLogRow[]);
  };

  useEffect(() => {
    void fetchResident();
    void fetchContacts();
    void fetchDocuments();
    void fetchBedHistory();
    void fetchActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (residentLoading) {
    return (
      <ProtectedRoute>
        <AdminDesktopShell pageTitle={t("nav.residents")}>
          <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
            <Spinner size="lg" />
          </div>
        </AdminDesktopShell>
      </ProtectedRoute>
    );
  }

  if (residentError || !resident) {
    return (
      <ProtectedRoute>
        <AdminDesktopShell pageTitle={t("nav.residents")}>
          <Stack gap={4}>
            <Alert
              severity="error"
              title={t("residents.notFound")}
              description={residentError !== "not_found" ? residentError ?? undefined : undefined}
            />
            <div>
              <Button
                variant="soft"
                leadingIcon={<ArrowLeft size={16} />}
                onClick={() => navigate({ to: "/residents" })}
              >
                {t("actions.back")}
              </Button>
            </div>
          </Stack>
        </AdminDesktopShell>
      </ProtectedRoute>
    );
  }

  const canEdit =
    staff?.role === "SYSTEM_ADMIN" ||
    staff?.role === "BRANCH_ADMIN" ||
    staff?.role === "SENIOR_NURSE";

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("nav.residents")}>
        <Stack gap={4}>
          <ProfileHeader
            resident={resident}
            canEdit={canEdit}
            editMode={editMode}
            onEdit={() => { setTab("profile"); setEditMode(true); }}
          />

          <div>
            <Tabs
              style="line"
              value={tab}
              onChange={(v) => setTab(v as typeof tab)}
              items={[
                { value: "profile", label: t("residents.profile") },
                { value: "contacts", label: t("residents.contacts") },
                { value: "documents", label: t("residents.documents") },
                { value: "bed", label: t("residents.bedHistory") },
                { value: "activity", label: t("residents.activity") },
              ]}
            />
          </div>

          {tab === "profile" && (
            <ProfileTab
              resident={resident}
              canEdit={canEdit}
              editMode={editMode}
              setEditMode={setEditMode}
              onSaved={fetchResident}
              logAction={logAction}
            />
          )}
          {tab === "contacts" && (
            <ContactsTab
              residentId={resident.id}
              doNotShareFamily={resident.do_not_share_family}
              contacts={contacts}
              refetch={fetchContacts}
              logAction={logAction}
              branchId={resident.branch_id}
            />
          )}
          {tab === "documents" && (
            <DocumentsTab
              residentId={resident.id}
              branchId={resident.branch_id}
              staffId={staff?.id ?? null}
              documents={documents}
              refetch={fetchDocuments}
              logAction={logAction}
            />
          )}
          {tab === "bed" && <BedHistoryTab rows={bedHistory} />}
          {tab === "activity" && <ActivityTab rows={activityLog} />}
        </Stack>
      </AdminDesktopShell>
      {/* unused branchId reference suppression */}
      {branchId ? null : null}
    </ProtectedRoute>
  );
}

/* ──────────────────────────────────────────────────────────
 * Profile header
 * ────────────────────────────────────────────────────────── */

function ProfileHeader({
  resident,
  canEdit,
  editMode,
  onEdit,
}: {
  resident: Resident;
  canEdit: boolean;
  editMode: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { flatList } = useLocations(resident.branch_id);

  const bedPath = useMemo(() => {
    if (!resident.bed_id) return t("residents.noBed");
    if (flatList.length === 0) return resident.locations?.code ?? "";
    const map = new Map(flatList.map((n) => [n.id, n]));
    const parts: string[] = [];
    let cur = map.get(resident.bed_id);
    while (cur) {
      parts.unshift(cur.name_zh || cur.name);
      if (!cur.parent_id) break;
      cur = map.get(cur.parent_id);
    }
    return parts.length > 0 ? parts.join(" › ") : t("residents.noBed");
  }, [resident.bed_id, resident.locations, flatList, t]);

  return (
    <Surface padding="none">
      <div style={{ padding: 24, width: "100%" }}>
        <Inline justify="between" align="start" className="w-full">
          <Inline gap={4} align="start">
            <Avatar size="lg" name={resident.name_zh || resident.name} />
            <Stack gap={1}>
              <Inline gap={2} wrap>
                <Heading level={2}>{resident.name_zh}</Heading>
                <Badge tone={STATUS_TONE[resident.status]}>{t(`residents.status.${resident.status}`)}</Badge>
                {resident.risk_level && (
                  <Badge tone={RISK_TONE[resident.risk_level]}>
                    {t(`residents.riskLevel.${resident.risk_level}`)}
                  </Badge>
                )}
                {resident.do_not_share_family && (
                  <Badge tone="error" emphasis="strong">
                    <Lock size={12} />
                    {t("residents.doNotShareFamily")}
                  </Badge>
                )}
              </Inline>
              <Text size="md" color="secondary">{resident.name}</Text>
              <Text size="sm" color="secondary">{bedPath}</Text>
              <Inline gap={4} className="mt-1">
                <Text size="sm" color="tertiary">
                  {t("residents.admissionDate")}: {formatDate(resident.admission_date)}
                </Text>
                <Text size="sm" color="tertiary">
                  {calcAge(resident.dob)} {t("residents.ageYears")}
                </Text>
              </Inline>
            </Stack>
          </Inline>
          <Inline gap={2} align="start">
            <Button variant="soft" onClick={() => toast(t("residents.comingSoon"))}>
              {t("residents.transfer")}
            </Button>
            <Button variant="destructive" onClick={() => toast(t("residents.comingSoon"))}>
              {t("residents.startDischarge")}
            </Button>
            {canEdit && !editMode && (
              <Button variant="soft" onClick={onEdit}>
                {t("residents.editProfile")}
              </Button>
            )}
          </Inline>
        </Inline>
      </div>
    </Surface>
  );
}

/* ──────────────────────────────────────────────────────────
 * Tab 1 — Profile
 * ────────────────────────────────────────────────────────── */

interface ProfileTabProps {
  resident: Resident;
  canEdit: boolean;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  onSaved: () => Promise<void> | void;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

interface EditForm {
  name_zh: string;
  name: string;
  preferred_name: string;
  dob: string;
  gender: Gender;
  language_preference: string;
}

function ProfileTab({ resident, canEdit, editMode, setEditMode, onSaved, logAction }: ProfileTabProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<EditForm>({
    name_zh: resident.name_zh,
    name: resident.name,
    preferred_name: resident.preferred_name ?? "",
    dob: resident.dob,
    gender: resident.gender,
    language_preference: resident.language_preference ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when entering edit mode
  useEffect(() => {
    if (editMode) {
      setForm({
        name_zh: resident.name_zh,
        name: resident.name,
        preferred_name: resident.preferred_name ?? "",
        dob: resident.dob,
        gender: resident.gender,
        language_preference: resident.language_preference ?? "",
      });
      setError(null);
    }
  }, [editMode, resident]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const before = {
        name_zh: resident.name_zh,
        name: resident.name,
        preferred_name: resident.preferred_name,
        dob: resident.dob,
        gender: resident.gender,
        language_preference: resident.language_preference,
      };
      const update = {
        name_zh: form.name_zh,
        name: form.name,
        preferred_name: form.preferred_name || null,
        dob: form.dob,
        gender: form.gender,
        language_preference: form.language_preference || null,
      };
      const { error: upErr } = await supabase
        .from("residents")
        .update(update)
        .eq("id", resident.id);
      if (upErr) throw upErr;
      void logAction({
        action: "RESIDENT_UPDATED",
        entity_type: "residents",
        entity_id: resident.id,
        branch_id: resident.branch_id,
        before_state: before,
        after_state: update,
      });
      await onSaved();
      toast.success(t("common.saved"));
      setEditMode(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const allergies = Array.isArray(resident.allergies) ? (resident.allergies as Array<{ drug?: string; reaction?: string; severity?: string }>) : [];
  const medical = (resident.medical_history as Record<string, unknown> | null) ?? null;
  const diagnoses = medical && typeof medical === "object" && "diagnoses" in medical ? String(medical.diagnoses) : null;

  return (
    <Stack gap={4}>
      {/* Card 1 — Demographics */}
      <Card padding="md">
        <Inline justify="between" className="mb-3">
          <Heading level={3}>{t("residents.demographics.title")}</Heading>
          {canEdit && !editMode && (
            <Button variant="ghost" size="compact" onClick={() => setEditMode(true)}>
              {t("actions.edit")}
            </Button>
          )}
        </Inline>

        {error && <Alert severity="error" description={error} className="mb-3" />}

        {!editMode ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("residents.demographics.dob")} value={formatDate(resident.dob)} />
            <Field label={t("residents.demographics.gender")} value={t(`residents.gender.${resident.gender}`)} />
            <Field label={t("residents.demographics.language")} value={resident.language_preference || "—"} />
            <Field label={t("residents.demographics.preferredName")} value={resident.preferred_name || "—"} />
          </div>
        ) : (
          <Stack gap={3}>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t("contacts.fields.nameZh")} required>
                <TextField value={form.name_zh} onChange={(e) => setForm((f) => ({ ...f, name_zh: e.target.value }))} />
              </FormField>
              <FormField label={t("contacts.fields.name")} required>
                <TextField value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </FormField>
              <FormField label={t("residents.demographics.dob")} required>
                <TextField type="date" value={form.dob} onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))} />
              </FormField>
              <FormField label={t("residents.demographics.gender")} required>
                <Select
                  value={form.gender}
                  onChange={(e) => setForm((f) => ({ ...f, gender: (e.target as HTMLSelectElement).value as Gender }))}
                  options={[
                    { value: "M", label: t("residents.gender.M") },
                    { value: "F", label: t("residents.gender.F") },
                    { value: "OTHER", label: t("residents.gender.OTHER") },
                  ]}
                />
              </FormField>
              <FormField label={t("residents.demographics.language")}>
                <TextField value={form.language_preference} onChange={(e) => setForm((f) => ({ ...f, language_preference: e.target.value }))} />
              </FormField>
              <FormField label={t("residents.demographics.preferredName")}>
                <TextField value={form.preferred_name} onChange={(e) => setForm((f) => ({ ...f, preferred_name: e.target.value }))} />
              </FormField>
            </div>
            <Inline justify="end" gap={2}>
              <Button variant="ghost" onClick={() => setEditMode(false)} disabled={saving}>{t("actions.cancel")}</Button>
              <Button variant="primary" loading={saving} onClick={handleSave}>{t("actions.save")}</Button>
            </Inline>
          </Stack>
        )}
      </Card>

      {/* Card 2 — Allergies & Medical */}
      <Card padding="md">
        <Heading level={3} className="mb-3">{t("residents.allergiesSection.title")}</Heading>
        <Stack gap={3}>
          <Stack gap={2}>
            <Text size="label" color="tertiary">{t("residents.allergies")}</Text>
            {allergies.length === 0 ? (
              <Text size="sm" color="secondary">{t("residents.noneRecorded")}</Text>
            ) : (
              <Stack gap={1}>
                {allergies.map((a, i) => (
                  <Inline key={i} gap={2}>
                    <Text size="md" className="font-semibold">{a.drug ?? "—"}</Text>
                    <Text size="sm" color="secondary">{a.reaction ?? ""}</Text>
                    {a.severity && (
                      <Badge tone={SEVERITY_TONE[a.severity] ?? "neutral"}>
                        {t(`residents.allergiesSection.severity.${a.severity}`, { defaultValue: a.severity })}
                      </Badge>
                    )}
                  </Inline>
                ))}
              </Stack>
            )}
          </Stack>
          <Divider />
          <Stack gap={2}>
            <Text size="label" color="tertiary">{t("residents.allergiesSection.diagnoses")}</Text>
            <Text size="sm">{diagnoses ?? t("residents.noneRecorded")}</Text>
          </Stack>
          <Divider />
          <Stack gap={2}>
            <Text size="label" color="tertiary">{t("residents.allergiesSection.specialInstructions")}</Text>
            <Text size="sm">{resident.notes ?? t("residents.noneRecorded")}</Text>
          </Stack>
        </Stack>
      </Card>

      {/* Card 3 — Dietary */}
      <Card padding="md">
        <Heading level={3} className="mb-3">{t("residents.diet.title")}</Heading>
        <Text size="sm" as="div">
          {resident.dietary_requirements
            ? <pre className="font-mono text-xs whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{JSON.stringify(resident.dietary_requirements, null, 2)}</pre>
            : t("residents.noneRecorded")}
        </Text>
      </Card>
    </Stack>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={1}>
      <Text size="label" color="tertiary">{label}</Text>
      <Text size="md">{value}</Text>
    </Stack>
  );
}

/* ──────────────────────────────────────────────────────────
 * Tab 2 — Contacts
 * ────────────────────────────────────────────────────────── */

interface ContactsTabProps {
  residentId: string;
  branchId: string;
  doNotShareFamily: boolean;
  contacts: Contact[];
  refetch: () => Promise<void> | void;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

function ContactsTab({ residentId, branchId, doNotShareFamily, contacts, refetch, logAction }: ContactsTabProps) {
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Contact | null>(null);

  const conflict = doNotShareFamily && contacts.some((c) => c.consent_notifications);

  const toggleNotifications = async (c: Contact) => {
    const before = { consent_notifications: c.consent_notifications };
    const after = { consent_notifications: !c.consent_notifications };
    const { error } = await supabase
      .from("resident_contacts")
      .update(after)
      .eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void logAction({
      action: "CONTACT_UPDATED",
      entity_type: "resident_contacts",
      entity_id: c.id,
      branch_id: branchId,
      before_state: before,
      after_state: after,
    });
    await refetch();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const before = { deleted_at: confirmDelete.deleted_at };
    const after = { deleted_at: new Date().toISOString() };
    const { error } = await supabase
      .from("resident_contacts")
      .update(after)
      .eq("id", confirmDelete.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void logAction({
      action: "CONTACT_UPDATED",
      entity_type: "resident_contacts",
      entity_id: confirmDelete.id,
      branch_id: branchId,
      before_state: before,
      after_state: after,
      metadata: { soft_delete: true },
    });
    toast.success(t("common.saved"));
    setConfirmDelete(null);
    await refetch();
  };

  const columns: Column<Contact>[] = [
    {
      key: "name",
      header: t("contacts.columns.name"),
      cell: (c) => (
        <Stack gap={1}>
          <span className="type-body-md font-semibold" style={{ color: "var(--text-primary)" }}>{c.name_zh ?? c.name}</span>
          {c.name_zh && <span className="type-body-sm" style={{ color: "var(--text-secondary)" }}>{c.name}</span>}
        </Stack>
      ),
    },
    { key: "rel", header: t("contacts.columns.relationship"), cell: (c) => c.relationship },
    { key: "wa", header: t("contacts.columns.whatsapp"), cell: (c) => c.phone_whatsapp ?? "—" },
    { key: "sms", header: t("contacts.columns.sms"), cell: (c) => c.phone_sms ?? "—" },
    {
      key: "primary",
      header: t("contacts.columns.primary"),
      width: 100,
      cell: (c) => (c.is_primary ? <Badge tone="success">{t("contacts.primary")}</Badge> : null),
    },
    {
      key: "emergency",
      header: t("contacts.columns.emergency"),
      width: 110,
      cell: (c) => (c.is_emergency ? <Badge tone="error">{t("contacts.emergency")}</Badge> : null),
    },
    {
      key: "notif",
      header: t("contacts.columns.notifications"),
      width: 130,
      cell: (c) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Switch checked={c.consent_notifications} onChange={() => void toggleNotifications(c)} />
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      width: 60,
      cell: (c) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu
            trigger={<IconButton aria-label="Row actions" icon={<MoreHorizontal size={16} />} variant="ghost" size="compact" />}
            items={[
              { label: t("actions.delete"), tone: "destructive", onSelect: () => setConfirmDelete(c) },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <Stack gap={3}>
      {conflict && (
        <Alert severity="warning" description={t("residents.doNotShareConflictWarning")} />
      )}
      <TableToolbar
        left={<Heading level={3}>{t("contacts.title")}</Heading>}
        right={<Button variant="primary" onClick={() => setAddOpen(true)}>{t("contacts.add")}</Button>}
      />
      <Table<Contact>
        columns={columns}
        rows={contacts}
        rowKey={(c) => c.id}
        empty={<EmptyState title={t("contacts.empty")} />}
      />
      <AddContactModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        residentId={residentId}
        branchId={branchId}
        onCreated={refetch}
        logAction={logAction}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title={t("contacts.delete")}
        summary={t("contacts.deleteConfirm")}
        confirmLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
      />
    </Stack>
  );
}

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
  residentId: string;
  branchId: string;
  onCreated: () => Promise<void> | void;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

function AddContactModal({ open, onClose, residentId, branchId, onCreated, logAction }: AddContactModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name_zh: "",
    name: "",
    relationship: "",
    phone_whatsapp: "",
    phone_sms: "",
    email: "",
    is_primary: false,
    is_emergency: false,
    consent_notifications: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ name_zh: "", name: "", relationship: "", phone_whatsapp: "", phone_sms: "", email: "", is_primary: false, is_emergency: false, consent_notifications: true });
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    if (!form.name || !form.relationship) {
      setError(t("contacts.fields.name") + " + " + t("contacts.fields.relationship"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const insertRow = {
        resident_id: residentId,
        name: form.name,
        name_zh: form.name_zh || null,
        relationship: form.relationship,
        phone_whatsapp: form.phone_whatsapp || null,
        phone_sms: form.phone_sms || null,
        email: form.email || null,
        is_primary: form.is_primary,
        is_emergency: form.is_emergency,
        consent_notifications: form.consent_notifications,
      };
      const { data, error: insErr } = await supabase
        .from("resident_contacts")
        .insert(insertRow)
        .select()
        .single();
      if (insErr) throw insErr;
      void logAction({
        action: "CONTACT_ADDED",
        entity_type: "resident_contacts",
        entity_id: (data as Contact).id,
        branch_id: branchId,
        after_state: insertRow as unknown as Record<string, unknown>,
      });
      toast.success(t("common.saved"));
      await onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t("contacts.add")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t("actions.cancel")}</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>{t("actions.save")}</Button>
        </>
      }
    >
      <Stack gap={3}>
        {error && <Alert severity="error" description={error} />}
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("contacts.fields.nameZh")}>
            <TextField value={form.name_zh} onChange={(e) => setForm((f) => ({ ...f, name_zh: e.target.value }))} />
          </FormField>
          <FormField label={t("contacts.fields.name")} required>
            <TextField value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </FormField>
        </div>
        <FormField label={t("contacts.fields.relationship")} required>
          <TextField value={form.relationship} onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("contacts.fields.whatsapp")}>
            <TextField value={form.phone_whatsapp} onChange={(e) => setForm((f) => ({ ...f, phone_whatsapp: e.target.value }))} />
          </FormField>
          <FormField label={t("contacts.fields.sms")}>
            <TextField value={form.phone_sms} onChange={(e) => setForm((f) => ({ ...f, phone_sms: e.target.value }))} />
          </FormField>
        </div>
        <FormField label={t("contacts.fields.email")}>
          <TextField type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </FormField>
        <Inline gap={4} wrap>
          <Switch checked={form.is_primary} onChange={(v) => setForm((f) => ({ ...f, is_primary: v }))} label={t("contacts.fields.isPrimary")} />
          <Switch checked={form.is_emergency} onChange={(v) => setForm((f) => ({ ...f, is_emergency: v }))} label={t("contacts.fields.isEmergency")} />
          <Switch checked={form.consent_notifications} onChange={(v) => setForm((f) => ({ ...f, consent_notifications: v }))} label={t("contacts.fields.consentNotifications")} />
        </Inline>
      </Stack>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────
 * Tab 3 — Documents
 * ────────────────────────────────────────────────────────── */

interface DocumentsTabProps {
  residentId: string;
  branchId: string;
  staffId: string | null;
  documents: DocumentRow[];
  refetch: () => Promise<void> | void;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

function DocumentsTab({ residentId, branchId, staffId, documents, refetch, logAction }: DocumentsTabProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<string>("CONSENT_FORM");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerFile = () => fileRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setUploadFile(f);
    e.target.value = "";
  };

  const cancelUpload = () => {
    setUploadFile(null);
    setUploadType("CONSENT_FORM");
    setError(null);
  };

  const confirmUpload = async () => {
    if (!uploadFile || !staffId) return;
    setUploading(true);
    setError(null);
    try {
      const path = `residents/${residentId}/${uploadType}/${uploadFile.name}`;
      const { error: upErr } = await supabase.storage
        .from("resident-documents")
        .upload(path, uploadFile, { upsert: false });
      if (upErr) throw upErr;
      const insertRow = {
        resident_id: residentId,
        branch_id: branchId,
        document_type: uploadType,
        file_name: uploadFile.name,
        storage_path: path,
        uploaded_by: staffId,
      };
      const { data, error: insErr } = await supabase
        .from("resident_documents")
        .insert(insertRow)
        .select()
        .single();
      if (insErr) throw insErr;
      void logAction({
        action: "DOCUMENT_UPLOADED",
        entity_type: "resident_documents",
        entity_id: (data as DocumentRow).id,
        branch_id: branchId,
        after_state: insertRow as unknown as Record<string, unknown>,
      });
      toast.success(t("documents.uploadSuccess"));
      cancelUpload();
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("documents.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: DocumentRow) => {
    const { data, error: dlErr } = await supabase.storage
      .from("resident-documents")
      .createSignedUrl(doc.storage_path, 900);
    if (dlErr || !data?.signedUrl) {
      toast.error(dlErr?.message ?? "Download failed");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const columns: Column<DocumentRow>[] = [
    {
      key: "type",
      header: t("documents.type"),
      width: 160,
      cell: (d) => t(`documents.types.${d.document_type}`, { defaultValue: d.document_type }),
    },
    {
      key: "file",
      header: t("documents.fileName"),
      cell: (d) => (
        <Stack gap={1}>
          <span className="type-body-md" style={{ color: "var(--text-primary)" }}>{d.file_name}</span>
          <span className="type-caption" style={{ color: "var(--text-tertiary)" }}>{t("documents.protected")}</span>
        </Stack>
      ),
    },
    {
      key: "uploaded",
      header: t("documents.uploaded"),
      width: 170,
      cell: (d) => formatDateTime(d.uploaded_at),
    },
    {
      key: "by",
      header: t("documents.uploadedBy"),
      width: 120,
      cell: () => "—",
    },
    {
      key: "dl",
      header: "",
      width: 100,
      cell: (d) => (
        <Button variant="ghost" size="compact" onClick={() => void handleDownload(d)}>
          {t("documents.download")}
        </Button>
      ),
    },
  ];

  const typeOptions = DOCUMENT_TYPES.map((v) => ({ value: v, label: t(`documents.types.${v}`) }));

  return (
    <Stack gap={3}>
      <TableToolbar
        left={<Heading level={3}>{t("documents.title")}</Heading>}
        right={
          <Button variant="primary" leadingIcon={<Upload size={14} />} onClick={triggerFile}>
            {t("documents.upload")}
          </Button>
        }
      />
      <input ref={fileRef} type="file" hidden onChange={onFileChange} />

      {uploadFile && (
        <Card padding="md">
          <Stack gap={3}>
            {error && <Alert severity="error" description={error} />}
            <Inline gap={3} wrap>
              <Text size="md" className="font-semibold">{uploadFile.name}</Text>
              <Text size="sm" color="tertiary">{(uploadFile.size / 1024).toFixed(1)} KB</Text>
            </Inline>
            <FormField label={t("documents.type")} required>
              <Select
                value={uploadType}
                onChange={(e) => setUploadType((e.target as HTMLSelectElement).value)}
                options={typeOptions}
              />
            </FormField>
            <Inline gap={2} justify="end">
              <Button variant="ghost" onClick={cancelUpload} disabled={uploading}>{t("actions.cancel")}</Button>
              <Button variant="primary" loading={uploading} onClick={confirmUpload}>{t("actions.confirm")}</Button>
            </Inline>
          </Stack>
        </Card>
      )}

      <Table<DocumentRow>
        columns={columns}
        rows={documents}
        rowKey={(d) => d.id}
        empty={<EmptyState title={t("documents.empty")} />}
      />
    </Stack>
  );
}

/* ──────────────────────────────────────────────────────────
 * Tab 4 — Bed History
 * ────────────────────────────────────────────────────────── */

function BedHistoryTab({ rows }: { rows: BedAssignment[] }) {
  const { t } = useTranslation();

  const columns: Column<BedAssignment>[] = [
    {
      key: "bed",
      header: t("bedHistory.columns.bed"),
      cell: (r) => r.locations ? `${r.locations.code} ${r.locations.name}` : "—",
    },
    {
      key: "from",
      header: t("bedHistory.columns.from"),
      width: 170,
      cell: (r) => formatDateTime(r.assigned_at),
    },
    {
      key: "to",
      header: t("bedHistory.columns.to"),
      width: 170,
      cell: (r) =>
        r.vacated_at ? formatDateTime(r.vacated_at) : <Badge tone="success">{t("bedHistory.current")}</Badge>,
    },
    { key: "reason", header: t("bedHistory.columns.reason"), cell: (r) => r.reason ?? "—" },
    {
      key: "by",
      header: t("bedHistory.columns.by"),
      width: 140,
      cell: (r) => r.assigner?.name_zh || r.assigner?.name || "—",
    },
  ];

  return (
    <Table<BedAssignment>
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      empty={<EmptyState title={t("bedHistory.empty")} />}
    />
  );
}

/* ──────────────────────────────────────────────────────────
 * Tab 5 — Activity
 * ────────────────────────────────────────────────────────── */

function ActivityTab({ rows }: { rows: AuditLogRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) return <EmptyState title={t("activity.empty")} />;
  return (
    <Card padding="md">
      <Timeline>
        {rows.map((r) => (
          <ActivityItem
            key={r.id}
            actor={r.actor?.name_zh || r.actor?.name || t("activity.system")}
            action={r.action}
            timestamp={formatDateTime(r.created_at)}
            tone={ACTIVITY_TONE[r.action] ?? "neutral"}
          />
        ))}
      </Timeline>
    </Card>
  );
}

export const Route = createFileRoute("/residents/$id")({
  component: ResidentDetailPage,
});
