import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, Lock, Upload, MoreHorizontal, Camera, RefreshCw, AlertTriangle, ShieldAlert, Heart, CheckCircle2, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { AdminDesktopShell } from "@/components/shells/AdminDesktopShell";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import {
  Avatar, Badge, Button, Card, Heading, Inline, Stack, Text, Divider, Surface,
  Tabs, Table, TableToolbar, EmptyState, Spinner, Alert, Switch, Modal,
  ConfirmDialog, FormField, TextField, Select, DropdownMenu, IconButton,
  ActivityItem, Timeline, Tooltip, type Column,
} from "@/components/hms";
import { TransferBedModal } from "@/components/residents/TransferBedModal";
import { DischargeModal } from "@/components/residents/DischargeModal";
import { ICPTab } from "@/components/icp/ICPTab";
import { TasksTab } from "@/components/tasks/TasksTab";
import { VitalsTab } from "@/components/vitals/VitalsTab";
import { WoundsTab } from "@/components/wounds/WoundsTab";
import { IncidentsTab } from "@/components/incidents/IncidentsTab";
import { AlertsTab } from "@/components/alerts/AlertsTab";
import { MedicationTab } from "@/components/emar/MedicationTab";
import { RestraintsTab } from "@/components/restraints/RestraintsTab";
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
type StaffRole = Enums<"staff_role">;
type LogActionFn = ReturnType<typeof useAuditLog>["logAction"];

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
const ALLERGY_SEVERITY_TONE: Record<string, "success" | "warning" | "error" | "neutral"> = {
  MILD: "neutral",
  MODERATE: "warning",
  SEVERE: "error",
  ANAPHYLAXIS: "error",
};
const ACTIVITY_TONE: Record<string, "success" | "neutral" | "info" | "warning"> = {
  RESIDENT_ADMITTED: "success",
  RESIDENT_DISCHARGED: "neutral",
  EMAR_ADMINISTERED: "info",
  INCIDENT_REPORTED: "warning",
};

const DOCUMENT_TYPES = ["CONSENT_FORM", "MEDICAL_REFERRAL", "ID_COPY", "ADVANCE_DIRECTIVE", "OTHER"] as const;

type ResusStatus = "FULL_RESUSCITATION" | "DNACPR" | "AD_LIMITED";
type AllergySeverity = "MILD" | "MODERATE" | "SEVERE" | "ANAPHYLAXIS";
type AllergySource = "RESIDENT_REPORTED" | "FAMILY_REPORTED" | "MEDICAL_RECORD" | "OBSERVED";

interface AllergyRecord {
  id: string;
  drug: string;
  reaction: string;
  severity: AllergySeverity;
  source: AllergySource;
  is_active: boolean;
  recorded_at: string;
}

interface ConsentFlags {
  family_info_sharing?: boolean;
  photography_publications?: boolean;
  telehealth?: boolean;
  religious_eol_preferences?: string;
}

const CLINICAL_TABS = ["profile", "vitals", "wounds", "emar", "icp", "tasks", "incidents", "restraints"] as const;
const ADMIN_TABS = ["alerts", "contacts", "documents", "bed", "activity"] as const;
type TabKey = (typeof CLINICAL_TABS)[number] | (typeof ADMIN_TABS)[number];
const ALL_TABS: readonly TabKey[] = [...CLINICAL_TABS, ...ADMIN_TABS];

const DEFAULT_TAB_BY_ROLE: Record<string, TabKey> = {
  NURSE: "vitals",
  CAREGIVER: "tasks",
  SENIOR_NURSE: "icp",
  BRANCH_ADMIN: "profile",
  SYSTEM_ADMIN: "profile",
  FAMILY: "profile",
};

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
function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function parseAllergies(raw: unknown): AllergyRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a, i): AllergyRecord => {
    const o = (a ?? {}) as Record<string, unknown>;
    return {
      id: typeof o.id === "string" ? o.id : `legacy-${i}`,
      drug: typeof o.drug === "string" ? o.drug : "",
      reaction: typeof o.reaction === "string" ? o.reaction : "",
      severity: (typeof o.severity === "string" && ["MILD", "MODERATE", "SEVERE", "ANAPHYLAXIS"].includes(o.severity)
        ? o.severity
        : "MODERATE") as AllergySeverity,
      source: (typeof o.source === "string" && ["RESIDENT_REPORTED", "FAMILY_REPORTED", "MEDICAL_RECORD", "OBSERVED"].includes(o.source)
        ? o.source
        : "MEDICAL_RECORD") as AllergySource,
      is_active: typeof o.is_active === "boolean" ? o.is_active : true,
      recorded_at: typeof o.recorded_at === "string" ? o.recorded_at : new Date().toISOString().slice(0, 10),
    };
  });
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
  const { logAction } = useAuditLog();

  const [resident, setResident] = useState<Resident | null>(null);
  const [residentLoading, setResidentLoading] = useState(true);
  const [residentError, setResidentError] = useState<string | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [bedHistory, setBedHistory] = useState<BedAssignment[]>([]);
  const [activityLog, setActivityLog] = useState<AuditLogRow[]>([]);

  const tabStorageKey = `hms_resident_tab_${id}`;
  const [tab, setTab] = useState<TabKey>(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(tabStorageKey);
      if (saved && (ALL_TABS as readonly string[]).includes(saved)) return saved as TabKey;
    }
    return "profile";
  });

  // Apply role default once staff loads, only if no saved tab
  useEffect(() => {
    if (!staff) return;
    if (typeof localStorage === "undefined") return;
    const saved = localStorage.getItem(tabStorageKey);
    if (!saved) {
      const def = DEFAULT_TAB_BY_ROLE[staff.role] ?? "profile";
      setTab(def);
    }
  }, [staff, tabStorageKey]);

  const handleTabChange = useCallback((next: TabKey) => {
    setTab(next);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(tabStorageKey, next);
    }
  }, [tabStorageKey]);

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

  const role = staff?.role ?? null;
  const canEditProfile = role === "SYSTEM_ADMIN" || role === "BRANCH_ADMIN" || role === "SENIOR_NURSE";
  const canEditClinical = role === "SYSTEM_ADMIN" || role === "BRANCH_ADMIN" || role === "SENIOR_NURSE";
  const canEditAdmin = role === "SYSTEM_ADMIN" || role === "BRANCH_ADMIN";

  const lifecycle = {
    transfer: resident.status === "ADMITTED",
    discharge: resident.status === "ADMITTED" || resident.status === "LOA",
  };

  const branchUnused = branches[0]?.id ?? null;

  return (
    <ProtectedRoute>
      <AdminDesktopShell pageTitle={t("nav.residents")}>
        <Stack gap={4}>
          <ProfileHeader
            resident={resident}
            canEditProfile={canEditProfile}
            canEditAdmin={canEditAdmin}
            editMode={editMode}
            lifecycle={lifecycle}
            onEdit={() => { handleTabChange("profile"); setEditMode(true); }}
            onTransfer={() => setTransferOpen(true)}
            onDischarge={() => setDischargeOpen(true)}
            onPhotoChanged={fetchResident}
            onResusChanged={fetchResident}
            staffId={staff?.id ?? null}
            staffRole={role}
            logAction={logAction}
          />

          <CareSummaryPanel
            residentId={id}
            branchId={resident.branch_id}
            allergies={parseAllergies(resident.allergies)}
            onAlertClick={() => handleTabChange("alerts")}
          />

          <TabGroup
            label={t("residents.tabGroups.clinical")}
            value={(CLINICAL_TABS as readonly string[]).includes(tab) ? tab : null}
            onChange={(v) => handleTabChange(v as TabKey)}
            items={[
              { value: "profile", label: t("residents.profile") },
              { value: "vitals", label: t("vitals.title") },
              { value: "wounds", label: t("wounds.title") },
              { value: "emar", label: t("emar.tab") },
              { value: "icp", label: t("icp.title") },
              { value: "tasks", label: t("tasks.title") },
              { value: "incidents", label: t("incidents.title") },
            ]}
          />

          <TabGroup
            label={t("residents.tabGroups.admin")}
            value={(ADMIN_TABS as readonly string[]).includes(tab) ? tab : null}
            onChange={(v) => handleTabChange(v as TabKey)}
            items={[
              { value: "alerts", label: t("alerts.title") },
              { value: "contacts", label: t("residents.contacts") },
              { value: "documents", label: t("residents.documents") },
              { value: "bed", label: t("residents.bedHistory") },
              { value: "activity", label: t("residents.activity") },
            ]}
          />

          {tab === "profile" && (
            <ProfileTab
              resident={resident}
              canEdit={canEditProfile}
              canEditAdmin={canEditAdmin}
              editMode={editMode}
              setEditMode={setEditMode}
              onSaved={fetchResident}
              logAction={logAction}
            />
          )}
          {tab === "alerts" && (
            <AlertsTab
              residentId={id}
              branchId={resident.branch_id}
              staffId={staff?.id ?? null}
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
          {tab === "vitals" && (
            <VitalsTab
              residentId={id}
              branchId={resident.branch_id}
              staffId={staff?.id ?? null}
              logAction={logAction}
            />
          )}
          {tab === "wounds" && (
            <WoundsTab
              residentId={id}
              branchId={resident.branch_id}
              staffId={staff?.id ?? null}
              logAction={logAction}
            />
          )}
          {tab === "incidents" && (
            <IncidentsTab
              residentId={id}
              branchId={resident.branch_id}
              staffId={staff?.id ?? null}
              logAction={logAction}
            />
          )}
          {tab === "emar" && (
            <MedicationTab
              residentId={id}
              branchId={resident.branch_id}
              staffId={staff?.id ?? null}
              staffRole={staff?.role ?? null}
              residentNameZh={resident.name_zh}
              residentName={resident.name}
              residentPhotoPath={resident.photo_storage_path ?? null}
              residentPhotoDeclined={resident.photo_declined}
              logAction={logAction}
            />
          )}
          {tab === "icp" && (
            <ICPTab
              residentId={id}
              branchId={resident.branch_id}
              staffId={staff?.id ?? null}
              staffRole={staff?.role ?? null}
              logAction={logAction}
            />
          )}
          {tab === "tasks" && (
            <TasksTab
              residentId={id}
              branchId={resident.branch_id}
              staffId={staff?.id ?? null}
              logAction={logAction}
            />
          )}
        </Stack>
        <TransferBedModal
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          resident={{ id: resident.id, branch_id: resident.branch_id, bed_id: resident.bed_id, name_zh: resident.name_zh }}
          onTransferred={() => { void fetchResident(); void fetchContacts(); void fetchBedHistory(); }}
        />
        <DischargeModal
          open={dischargeOpen}
          onClose={() => setDischargeOpen(false)}
          resident={{ id: resident.id, branch_id: resident.branch_id, bed_id: resident.bed_id, name_zh: resident.name_zh }}
          onDischarged={() => { void fetchResident(); }}
        />
      </AdminDesktopShell>
      {branchUnused ? null : null}
    </ProtectedRoute>
  );
}

/* ──────────────────────────────────────────────────────────
 * TabGroup wrapper
 * ────────────────────────────────────────────────────────── */
function TabGroup({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  items: { value: string; label: React.ReactNode }[];
}) {
  return (
    <Stack gap={1}>
      <Text size="label" color="tertiary">{label}</Text>
      <Tabs
        style="line"
        value={value ?? items[0].value}
        onChange={onChange}
        items={items}
      />
    </Stack>
  );
}

/* ──────────────────────────────────────────────────────────
 * Profile header
 * ────────────────────────────────────────────────────────── */

function ProfileHeader({
  resident,
  canEditProfile,
  canEditAdmin,
  editMode,
  lifecycle,
  onEdit,
  onTransfer,
  onDischarge,
  onPhotoChanged,
  onResusChanged,
  staffId,
  staffRole,
  logAction,
}: {
  resident: Resident;
  canEditProfile: boolean;
  canEditAdmin: boolean;
  editMode: boolean;
  lifecycle: { transfer: boolean; discharge: boolean };
  onEdit: () => void;
  onTransfer: () => void;
  onDischarge: () => void;
  onPhotoChanged: () => Promise<void> | void;
  onResusChanged: () => Promise<void> | void;
  staffId: string | null;
  staffRole: StaffRole | null;
  logAction: LogActionFn;
}) {
  const { t } = useTranslation();
  const { flatList } = useLocations(resident.branch_id);
  const [resusOpen, setResusOpen] = useState(false);

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

  const resus = (resident.resuscitation_status as ResusStatus | null) ?? "FULL_RESUSCITATION";

  return (
    <Surface padding="none">
      <div style={{ padding: 24, width: "100%" }}>
        <Inline justify="between" align="start" className="w-full">
          <Inline gap={4} align="start">
            <ResidentPhoto
              resident={resident}
              canEdit={canEditProfile}
              staffId={staffId}
              onChanged={onPhotoChanged}
              logAction={logAction}
            />
            <Stack gap={1}>
              <Inline gap={2} wrap>
                <Heading level={2}>{resident.name_zh}</Heading>
                <Badge tone={STATUS_TONE[resident.status]}>{t(`residents.status.${resident.status}`)}</Badge>
                {resident.risk_level && (
                  <Badge tone={RISK_TONE[resident.risk_level]}>
                    {t(`residents.riskLevel.${resident.risk_level}`)}
                  </Badge>
                )}
                <ResuscitationBadge status={resus} onClick={() => setResusOpen(true)} />
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
              {resident.lpoa_holder_name && (
                <button
                  type="button"
                  onClick={() => setResusOpen(true)}
                  style={{
                    background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left",
                    color: "var(--text-tertiary)", fontSize: "var(--font-size-sm, 0.875rem)",
                    textDecoration: "underline", textDecorationStyle: "dotted",
                  }}
                >
                  {t("residents.resuscitation.guardian")}: {resident.lpoa_holder_name}
                  {resident.lpoa_holder_relationship ? ` (${resident.lpoa_holder_relationship})` : ""}
                </button>
              )}
            </Stack>
          </Inline>
          <Inline gap={2} align="start">
            {lifecycle.transfer && (
              <Button variant="soft" onClick={onTransfer}>
                {t("residents.transfer")}
              </Button>
            )}
            {lifecycle.discharge && (
              <Button variant="destructive" onClick={onDischarge}>
                {t("residents.startDischarge")}
              </Button>
            )}
            {canEditProfile && !editMode && (
              <Button variant="soft" onClick={onEdit}>
                {t("residents.editProfile")}
              </Button>
            )}
          </Inline>
        </Inline>
      </div>
      <ResuscitationEditModal
        open={resusOpen}
        onClose={() => setResusOpen(false)}
        resident={resident}
        canEdit={canEditAdmin}
        staffId={staffId}
        staffRole={staffRole}
        onSaved={async () => { await onResusChanged(); setResusOpen(false); }}
        logAction={logAction}
      />
    </Surface>
  );
}

/* ──────────────────────────────────────────────────────────
 * Resident photo with upload
 * ────────────────────────────────────────────────────────── */
function ResidentPhoto({
  resident, canEdit, staffId, onChanged, logAction,
}: {
  resident: Resident;
  canEdit: boolean;
  staffId: string | null;
  onChanged: () => Promise<void> | void;
  logAction: LogActionFn;
}) {
  const { t } = useTranslation();
  const [signed, setSigned] = useState<string | null>(null);
  const [signedExpiry, setSignedExpiry] = useState<number>(0);
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const path = resident.photo_storage_path;
    if (!path || resident.photo_declined) {
      setSigned(null);
      return;
    }
    if (signed && Date.now() < signedExpiry) return;
    void (async () => {
      const { data, error } = await supabase.storage.from("resident-photos").createSignedUrl(path, 3600);
      if (!active) return;
      if (!error && data?.signedUrl) {
        setSigned(data.signedUrl);
        setSignedExpiry(Date.now() + 50 * 60 * 1000);
      }
    })();
    return () => { active = false; };
  }, [resident.photo_storage_path, resident.photo_declined, signed, signedExpiry]);

  const photoOld = resident.photo_updated_at
    ? Date.now() - new Date(resident.photo_updated_at).getTime() > 365 * 24 * 3600 * 1000
    : false;

  const initials = (resident.name_zh || resident.name).slice(0, 2);

  let inner: React.ReactNode;
  if (resident.photo_declined) {
    inner = (
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: "var(--bg-muted, #f1f5f9)", display: "flex", alignItems: "center",
        justifyContent: "center", color: "var(--text-tertiary)",
      }}>
        <Lock size={20} />
      </div>
    );
  } else if (signed) {
    inner = (
      <img
        src={signed}
        alt={t("residents.photo.title")}
        style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", display: "block" }}
      />
    );
  } else {
    inner = <Avatar size="lg" name={initials} />;
  }

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {inner}
      {photoOld && !resident.photo_declined && signed && (
        <Tooltip label={t("residents.photo.needsUpdate")}>
          <span
            style={{
              position: "absolute", top: -2, right: -2, width: 12, height: 12,
              borderRadius: "50%", background: "var(--color-warning, #f59e0b)",
              border: "2px solid var(--bg-base, #fff)",
            }}
          />
        </Tooltip>
      )}
      {resident.photo_declined && (
        <Text size="caption" color="tertiary" as="div" style={{ marginTop: 4, textAlign: "center" }}>
          {t("residents.photo.declined")}
        </Text>
      )}
      {canEdit && (hover || open) && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("residents.photo.upload")}
          style={{
            position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderRadius: "50%",
            background: "var(--bg-elevated, #fff)", border: "1px solid var(--border-default, #e5e7eb)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <Camera size={12} />
        </button>
      )}
      <PhotoUploadModal
        open={open}
        onClose={() => setOpen(false)}
        resident={resident}
        staffId={staffId}
        onSaved={async () => { setSigned(null); setSignedExpiry(0); await onChanged(); }}
        logAction={logAction}
      />
    </div>
  );
}

function PhotoUploadModal({
  open, onClose, resident, staffId, onSaved, logAction,
}: {
  open: boolean;
  onClose: () => void;
  resident: Resident;
  staffId: string | null;
  onSaved: () => Promise<void> | void;
  logAction: LogActionFn;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const compress = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const max = 800;
        const ratio = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error("Compression failed"));
          resolve(blob);
        }, "image/jpeg", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
      img.src = url;
    });
  };

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const blob = await compress(file);
      const path = `${resident.branch_id}/${resident.id}/photo.jpg`;
      const { error: upErr } = await supabase.storage
        .from("resident-photos")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const before = { photo_storage_path: resident.photo_storage_path, photo_declined: resident.photo_declined };
      const after = { photo_storage_path: path, photo_declined: false, photo_updated_at: new Date().toISOString() };
      const { error: updErr } = await supabase.from("residents").update(after).eq("id", resident.id);
      if (updErr) throw updErr;
      void logAction({
        action: "RESIDENT_PHOTO_UPDATED",
        entity_type: "residents",
        entity_id: resident.id,
        branch_id: resident.branch_id,
        before_state: before,
        after_state: after,
      });
      toast.success(t("common.saved"));
      await onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const markDeclined = async () => {
    setBusy(true);
    setErr(null);
    try {
      const before = { photo_storage_path: resident.photo_storage_path, photo_declined: resident.photo_declined };
      const after = { photo_storage_path: null, photo_declined: true };
      const { error } = await supabase.from("residents").update(after).eq("id", resident.id);
      if (error) throw error;
      void logAction({
        action: "RESIDENT_PHOTO_DECLINED",
        entity_type: "residents",
        entity_id: resident.id,
        branch_id: resident.branch_id,
        before_state: before,
        after_state: after,
      });
      toast.success(t("common.saved"));
      await onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  void staffId; // not directly needed for upload but kept for future audit metadata

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("residents.photo.upload")}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>{t("actions.cancel")}</Button>
        </>
      }
    >
      <Stack gap={3}>
        {err && <Alert severity="error" description={err} />}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }}
        />
        <input
          ref={camRef}
          type="file"
          accept="image/*"
          {...({ capture: "environment" } as Record<string, string>)}
          hidden
          onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }}
        />
        <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={busy}>
          {t("residents.photo.choose")}
        </Button>
        <Button variant="soft" onClick={() => camRef.current?.click()} disabled={busy}>
          <Camera size={14} /> {t("residents.photo.take")}
        </Button>
        <Divider />
        <Button variant="ghost" onClick={() => void markDeclined()} disabled={busy}>
          {t("residents.photo.markDeclined")}
        </Button>
        {busy && <Text size="sm" color="tertiary">{t("residents.photo.uploading")}</Text>}
      </Stack>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────
 * Resuscitation badge + edit modal
 * ────────────────────────────────────────────────────────── */
function ResuscitationBadge({ status, onClick }: { status: ResusStatus; onClick: () => void }) {
  const { t } = useTranslation();
  if (status === "FULL_RESUSCITATION") {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
        aria-label={t("residents.resuscitation.title")}
      >
        <Badge tone="success" emphasis="subtle">
          <Heart size={12} /> {t("residents.resuscitation.FULL_RESUSCITATION")}
        </Badge>
      </button>
    );
  }
  const tone: "error" | "warning" = status === "DNACPR" ? "error" : "warning";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
      aria-label={t("residents.resuscitation.title")}
    >
      <Badge tone={tone} emphasis="strong">
        <ShieldAlert size={12} /> {t(`residents.resuscitation.${status}`)}
      </Badge>
    </button>
  );
}

function ResuscitationEditModal({
  open, onClose, resident, canEdit, staffId, staffRole, onSaved, logAction,
}: {
  open: boolean;
  onClose: () => void;
  resident: Resident;
  canEdit: boolean;
  staffId: string | null;
  staffRole: StaffRole | null;
  onSaved: () => Promise<void> | void;
  logAction: LogActionFn;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ResusStatus>(
    (resident.resuscitation_status as ResusStatus | null) ?? "FULL_RESUSCITATION"
  );
  const [adOnFile, setAdOnFile] = useState<boolean>(!!resident.advance_directive_on_file);
  const [adDate, setAdDate] = useState<string>(
    resident.advance_directive_uploaded_at ? formatDate(resident.advance_directive_uploaded_at) : ""
  );
  const [lpoaName, setLpoaName] = useState(resident.lpoa_holder_name ?? "");
  const [lpoaRel, setLpoaRel] = useState(resident.lpoa_holder_relationship ?? "");
  const [lpoaPhone, setLpoaPhone] = useState(resident.lpoa_holder_phone ?? "");
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStatus((resident.resuscitation_status as ResusStatus | null) ?? "FULL_RESUSCITATION");
      setAdOnFile(!!resident.advance_directive_on_file);
      setAdDate(resident.advance_directive_uploaded_at ? formatDate(resident.advance_directive_uploaded_at) : "");
      setLpoaName(resident.lpoa_holder_name ?? "");
      setLpoaRel(resident.lpoa_holder_relationship ?? "");
      setLpoaPhone(resident.lpoa_holder_phone ?? "");
      setErr(null);
    }
  }, [open, resident]);

  void staffRole;
  const showLpoa = status === "DNACPR" || status === "AD_LIMITED";

  const doSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      const before = {
        resuscitation_status: resident.resuscitation_status,
        advance_directive_on_file: resident.advance_directive_on_file,
        advance_directive_uploaded_at: resident.advance_directive_uploaded_at,
        lpoa_holder_name: resident.lpoa_holder_name,
        lpoa_holder_relationship: resident.lpoa_holder_relationship,
        lpoa_holder_phone: resident.lpoa_holder_phone,
      };
      const after = {
        resuscitation_status: status,
        resuscitation_status_updated_at: new Date().toISOString(),
        resuscitation_status_updated_by: staffId,
        advance_directive_on_file: adOnFile,
        advance_directive_uploaded_at: adOnFile && adDate ? new Date(adDate).toISOString() : null,
        lpoa_holder_name: lpoaName || null,
        lpoa_holder_relationship: lpoaRel || null,
        lpoa_holder_phone: lpoaPhone || null,
      };
      const { error } = await supabase.from("residents").update(after).eq("id", resident.id);
      if (error) throw error;
      void logAction({
        action: "RESIDENT_RESUSCITATION_STATUS_CHANGED",
        entity_type: "residents",
        entity_id: resident.id,
        branch_id: resident.branch_id,
        before_state: before,
        after_state: after,
      });
      toast.success(t("common.saved"));
      setConfirm(false);
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={t("residents.resuscitation.editTitle")}
        size="md"
        footer={
          canEdit ? (
            <>
              <Button variant="ghost" onClick={onClose} disabled={saving}>{t("actions.cancel")}</Button>
              <Button variant="primary" onClick={() => setConfirm(true)} disabled={saving}>
                {t("actions.save")}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={onClose}>{t("actions.close")}</Button>
          )
        }
      >
        <Stack gap={3}>
          {err && <Alert severity="error" description={err} />}
          <FormField label={t("residents.resuscitation.title")} required>
            <Select
              value={status}
              disabled={!canEdit}
              onChange={(e) => setStatus((e.target as HTMLSelectElement).value as ResusStatus)}
              options={[
                { value: "FULL_RESUSCITATION", label: t("residents.resuscitation.FULL_RESUSCITATION") },
                { value: "DNACPR", label: t("residents.resuscitation.DNACPR") },
                { value: "AD_LIMITED", label: t("residents.resuscitation.AD_LIMITED") },
              ]}
            />
          </FormField>
          <Switch
            checked={adOnFile}
            onChange={(v) => setAdOnFile(v)}
            label={t("residents.resuscitation.adOnFile")}
            disabled={!canEdit}
          />
          {adOnFile && (
            <FormField label={t("residents.resuscitation.adUploadedAt")}>
              <TextField type="date" value={adDate} disabled={!canEdit}
                onChange={(e) => setAdDate(e.target.value)} />
            </FormField>
          )}
          {showLpoa && (
            <>
              <Divider />
              <Heading level={3}>{t("residents.resuscitation.lpoa")}</Heading>
              <FormField label={t("residents.resuscitation.lpoaName")}>
                <TextField value={lpoaName} disabled={!canEdit}
                  onChange={(e) => setLpoaName(e.target.value)} />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label={t("residents.resuscitation.lpoaRelationship")}>
                  <TextField value={lpoaRel} disabled={!canEdit}
                    onChange={(e) => setLpoaRel(e.target.value)} />
                </FormField>
                <FormField label={t("residents.resuscitation.lpoaPhone")}>
                  <TextField value={lpoaPhone} disabled={!canEdit}
                    onChange={(e) => setLpoaPhone(e.target.value)} />
                </FormField>
              </div>
            </>
          )}
        </Stack>
      </Modal>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={doSave}
        title={t("residents.resuscitation.editTitle")}
        summary={t("residents.resuscitation.changeWarning")}
        confirmLabel={t("actions.confirm")}
        cancelLabel={t("actions.cancel")}
      />
    </>
  );
}

/* ──────────────────────────────────────────────────────────
 * Care summary panel
 * ────────────────────────────────────────────────────────── */
interface CareSummaryData {
  alerts: { count: number; topSeverity: string | null; topType: string | null; topAt: string | null };
  overdueTasks: number;
  todayMeds: number;
  latestVitals: {
    bp_systolic?: number; bp_diastolic?: number; spo2?: number; pulse?: number;
    recorded_at?: string;
  } | null;
  prevVitals: { bp_systolic?: number; spo2?: number } | null;
  icp: { status: string; version: number; review_due_date?: string | null } | null;
}

function CareSummaryPanel({
  residentId, branchId, allergies, onAlertClick,
}: {
  residentId: string;
  branchId: string;
  allergies: AllergyRecord[];
  onAlertClick: () => void;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<CareSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  void branchId;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [alertsRes, tasksRes, medsRes, vitalsRes, icpsRes] = await Promise.all([
        supabase.from("alerts").select("severity,type,triggered_at").eq("resident_id", residentId).eq("status", "OPEN").order("triggered_at", { ascending: false }),
        supabase.from("tasks").select("id").eq("resident_id", residentId).lt("due_at", new Date().toISOString()).in("status", ["PENDING", "IN_PROGRESS"]),
        supabase.from("medication_orders").select("id").eq("resident_id", residentId).eq("status", "ACTIVE").lte("start_date", today),
        supabase.from("vitals").select("readings,recorded_at").eq("resident_id", residentId).order("recorded_at", { ascending: false }).limit(2),
        supabase.from("icps").select("status,version,content").eq("resident_id", residentId).in("status", ["ACTIVE", "PENDING_APPROVAL"]).order("created_at", { ascending: false }).limit(1),
      ]);

      const alerts = (alertsRes.data ?? []) as Array<{ severity: string; type: string; triggered_at: string }>;
      const sevRank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      const top = alerts.slice().sort((a, b) => (sevRank[b.severity] ?? 0) - (sevRank[a.severity] ?? 0))[0];

      const vitals = (vitalsRes.data ?? []) as Array<{ readings: Record<string, number>; recorded_at: string }>;
      const latest = vitals[0]
        ? { ...vitals[0].readings, recorded_at: vitals[0].recorded_at } as CareSummaryData["latestVitals"]
        : null;
      const prev = vitals[1] ? { bp_systolic: vitals[1].readings?.bp_systolic, spo2: vitals[1].readings?.spo2 } : null;

      const icpRow = (icpsRes.data ?? [])[0] as { status: string; version: number; content?: Record<string, unknown> } | undefined;
      const reviewDue = icpRow && icpRow.content && typeof icpRow.content === "object"
        ? (icpRow.content["review_due_date"] as string | undefined) ?? null
        : null;

      setData({
        alerts: {
          count: alerts.length,
          topSeverity: top?.severity ?? null,
          topType: top?.type ?? null,
          topAt: top?.triggered_at ?? null,
        },
        overdueTasks: (tasksRes.data ?? []).length,
        todayMeds: (medsRes.data ?? []).length,
        latestVitals: latest,
        prevVitals: prev,
        icp: icpRow ? { status: icpRow.status, version: icpRow.version, review_due_date: reviewDue } : null,
      });
    } finally {
      setLoading(false);
    }
  }, [residentId]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const empty = data && data.alerts.count === 0 && data.overdueTasks === 0 && data.todayMeds === 0 && !data.latestVitals;

  const trend = (() => {
    const a = data?.latestVitals?.bp_systolic;
    const b = data?.prevVitals?.bp_systolic;
    if (a == null || b == null) return "→";
    if (a - b > 10) return "↑";
    if (b - a > 10) return "↓";
    return "→";
  })();
  const bpTone: "neutral" | "warning" | "error" = (() => {
    const s = data?.latestVitals?.bp_systolic;
    if (s == null) return "neutral";
    if (s > 160 || s < 90) return "error";
    if (s > 140) return "warning";
    return "neutral";
  })();
  const spo2Tone: "neutral" | "warning" | "error" = (() => {
    const v = data?.latestVitals?.spo2;
    if (v == null) return "neutral";
    if (v < 90) return "error";
    if (v < 94) return "warning";
    return "neutral";
  })();

  const lastVitalsAge = (() => {
    if (!data?.latestVitals?.recorded_at) return null;
    const ms = Date.now() - new Date(data.latestVitals.recorded_at).getTime();
    const hr = ms / 3600000;
    return hr;
  })();
  const vitalsTone: "neutral" | "warning" | "error" = (() => {
    if (lastVitalsAge == null) return "neutral";
    if (lastVitalsAge > 8) return "error";
    if (lastVitalsAge > 4) return "warning";
    return "neutral";
  })();

  const activeAnaphylaxis = allergies.filter((a) => a.is_active && a.severity === "ANAPHYLAXIS");
  const activeSevere = allergies.filter((a) => a.is_active && (a.severity === "SEVERE" || a.severity === "ANAPHYLAXIS"));
  const allergyTone: "neutral" | "warning" | "error" = activeAnaphylaxis.length > 0
    ? "error"
    : activeSevere.length > 0
      ? "error"
      : allergies.some((a) => a.is_active && a.severity === "MODERATE") ? "warning" : "neutral";

  const reviewDays = (() => {
    if (!data?.icp?.review_due_date) return null;
    const d = (new Date(data.icp.review_due_date).getTime() - Date.now()) / 86400000;
    return Math.round(d);
  })();

  return (
    <Card padding="md">
      <Inline justify="between" align="center" className="mb-3">
        <Heading level={3}>{t("residents.careSummary.title")}</Heading>
        <IconButton aria-label={t("residents.careSummary.refresh")} icon={<RefreshCw size={14} />} variant="ghost" size="compact" onClick={() => void refresh()} />
      </Inline>
      {loading && !data ? (
        <Spinner size="sm" />
      ) : empty ? (
        <Text size="sm" color="tertiary">{t("residents.careSummary.noPendingItems")}</Text>
      ) : (
        <Stack gap={3}>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
            <SummaryTile
              label={t("residents.careSummary.openAlerts")}
              value={String(data?.alerts.count ?? 0)}
              tone={data && data.alerts.count > 0 ? "warning" : "neutral"}
              icon={<AlertTriangle size={14} />}
            />
            <SummaryTile
              label={t("residents.careSummary.overdueTasks")}
              value={String(data?.overdueTasks ?? 0)}
              tone={data && data.overdueTasks > 0 ? "warning" : "neutral"}
            />
            <SummaryTile
              label={t("residents.careSummary.todayMeds")}
              value={String(data?.todayMeds ?? 0)}
            />
            <SummaryTile
              label={t("residents.careSummary.latestBp")}
              value={data?.latestVitals?.bp_systolic && data?.latestVitals?.bp_diastolic
                ? `${data.latestVitals.bp_systolic}/${data.latestVitals.bp_diastolic} ${trend}`
                : "—"}
              tone={bpTone}
            />
            <SummaryTile
              label={t("residents.careSummary.spo2")}
              value={data?.latestVitals?.spo2 != null ? `${data.latestVitals.spo2}%` : "—"}
              tone={spo2Tone}
              icon={spo2Tone === "neutral" && data?.latestVitals?.spo2 != null ? <CheckCircle2 size={14} /> : undefined}
            />
          </div>

          <Inline gap={3} wrap>
            {data?.icp ? (
              <Inline gap={1} align="center">
                <Activity size={14} style={{ color: "var(--text-tertiary)" }} />
                <Text size="sm">
                  {t("residents.careSummary.icpStatus")}: {data.icp.status === "ACTIVE" ? t("residents.careSummary.activeIcp") : t("residents.careSummary.pendingIcp")} v{data.icp.version}
                </Text>
                {reviewDays != null && reviewDays <= 30 && (
                  <Badge tone="warning" emphasis="subtle">
                    {t("residents.careSummary.icpReviewDue")}: {reviewDays} {t("residents.careSummary.daysAway")}
                  </Badge>
                )}
              </Inline>
            ) : null}
            {allergies.filter((a) => a.is_active).length > 0 && (
              <Inline gap={1} align="center">
                <Badge tone={allergyTone} emphasis={allergyTone === "error" ? "strong" : "subtle"}>
                  {t("residents.allergies")}: {allergies.filter((a) => a.is_active).map((a) => a.drug).join(", ")}
                </Badge>
              </Inline>
            )}
            {lastVitalsAge != null && (
              <Inline gap={1} align="center">
                <Badge tone={vitalsTone} emphasis="subtle">
                  {t("residents.careSummary.lastVitals")}: {lastVitalsAge < 1
                    ? `${Math.round(lastVitalsAge * 60)} ${t("residents.careSummary.minutesAgo")}`
                    : `${lastVitalsAge.toFixed(1)} ${t("residents.careSummary.hoursAgo")}`}
                </Badge>
              </Inline>
            )}
          </Inline>

          {data && data.alerts.count > 0 && data.alerts.topSeverity && (
            <button
              type="button"
              onClick={onAlertClick}
              style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", width: "100%" }}
            >
              <Alert
                severity={data.alerts.topSeverity === "CRITICAL" || data.alerts.topSeverity === "HIGH" ? "error" : "warning"}
                title={`${t("residents.careSummary.alertBanner")}: ${data.alerts.topSeverity} — ${data.alerts.topType ?? ""}`}
                description={data.alerts.topAt ? formatDateTime(data.alerts.topAt) : undefined}
              />
            </button>
          )}
        </Stack>
      )}
    </Card>
  );
}

function SummaryTile({
  label, value, tone = "neutral", icon,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "error";
  icon?: React.ReactNode;
}) {
  const color = tone === "error" ? "var(--color-error, #dc2626)" : tone === "warning" ? "var(--color-warning, #f59e0b)" : "var(--text-primary)";
  return (
    <Surface padding="sm">
      <Stack gap={1}>
        <Text size="caption" color="tertiary">{label}</Text>
        <Inline gap={1} align="center">
          <span style={{ fontSize: 20, fontWeight: 600, color }}>{value}</span>
          {icon}
        </Inline>
      </Stack>
    </Surface>
  );
}

/* ──────────────────────────────────────────────────────────
 * Tab 1 — Profile
 * ────────────────────────────────────────────────────────── */

interface ProfileTabProps {
  resident: Resident;
  canEdit: boolean;
  canEditAdmin: boolean;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  onSaved: () => Promise<void> | void;
  logAction: LogActionFn;
}

interface EditForm {
  name_zh: string;
  name: string;
  preferred_name: string;
  dob: string;
  gender: Gender;
  language_preference: string;
}

function ProfileTab({ resident, canEdit, canEditAdmin, editMode, setEditMode, onSaved, logAction }: ProfileTabProps) {
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
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const allergies = parseAllergies(resident.allergies);
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

      {/* Card 2 — Allergies (structured) */}
      <AllergyCard
        resident={resident}
        canEdit={canEdit}
        onSaved={onSaved}
        logAction={logAction}
      />

      {/* Card 3 — Diagnoses & notes */}
      <Card padding="md">
        <Heading level={3} className="mb-3">{t("residents.allergiesSection.diagnoses")}</Heading>
        <Stack gap={2}>
          <Text size="sm">{diagnoses ?? t("residents.noneRecorded")}</Text>
          <Divider />
          <Text size="label" color="tertiary">{t("residents.allergiesSection.specialInstructions")}</Text>
          <Text size="sm">{resident.notes ?? t("residents.noneRecorded")}</Text>
        </Stack>
      </Card>

      {/* Card 4 — Consents & Legal */}
      <ConsentsCard
        resident={resident}
        canEdit={canEditAdmin}
        onSaved={onSaved}
        logAction={logAction}
      />

      {/* Card 5 — Dietary */}
      <Card padding="md">
        <Heading level={3} className="mb-3">{t("residents.diet.title")}</Heading>
        <Text size="sm" as="div">
          {resident.dietary_requirements
            ? <pre className="font-mono text-xs whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{JSON.stringify(resident.dietary_requirements, null, 2)}</pre>
            : t("residents.noneRecorded")}
        </Text>
      </Card>

      {/* unused suppression */}
      {allergies.length >= 0 ? null : null}
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
 * Allergy card (structured)
 * ────────────────────────────────────────────────────────── */
function AllergyCard({
  resident, canEdit, onSaved, logAction,
}: {
  resident: Resident;
  canEdit: boolean;
  onSaved: () => Promise<void> | void;
  logAction: LogActionFn;
}) {
  const { t } = useTranslation();
  const allergies = parseAllergies(resident.allergies);
  const [showHist, setShowHist] = useState(false);
  const [editing, setEditing] = useState<AllergyRecord | null>(null);
  const [adding, setAdding] = useState(false);

  const visible = showHist ? allergies : allergies.filter((a) => a.is_active);
  const anaphylaxis = allergies.filter((a) => a.is_active && a.severity === "ANAPHYLAXIS");

  const persist = async (next: AllergyRecord[], action: string) => {
    const before = { allergies: resident.allergies };
    const after = { allergies: next as unknown as Tables<"residents">["allergies"] };
    const { error } = await supabase.from("residents").update(after).eq("id", resident.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void logAction({
      action,
      entity_type: "residents",
      entity_id: resident.id,
      branch_id: resident.branch_id,
      before_state: before as unknown as Record<string, unknown>,
      after_state: after as unknown as Record<string, unknown>,
    });
    toast.success(t("common.saved"));
    await onSaved();
  };

  const onSaveAllergy = async (rec: AllergyRecord) => {
    const exists = allergies.find((a) => a.id === rec.id);
    const next = exists
      ? allergies.map((a) => (a.id === rec.id ? rec : a))
      : [...allergies, rec];
    await persist(next, "RESIDENT_ALLERGY_UPDATED");
    setEditing(null);
    setAdding(false);
  };

  const onRemove = async (rec: AllergyRecord) => {
    const next = allergies.map((a) => (a.id === rec.id ? { ...a, is_active: false } : a));
    await persist(next, "RESIDENT_ALLERGY_UPDATED");
  };

  const cols: Column<AllergyRecord>[] = [
    { key: "drug", header: t("residents.allergiesSection.drug"), cell: (r) => <Text size="sm" className="font-semibold">{r.drug || "—"}</Text> },
    { key: "reaction", header: t("residents.allergiesSection.reaction"), cell: (r) => r.reaction || "—" },
    {
      key: "severity",
      header: t("residents.allergiesSection.severity"),
      width: 130,
      cell: (r) => (
        <Badge
          tone={ALLERGY_SEVERITY_TONE[r.severity] ?? "neutral"}
          emphasis={r.severity === "ANAPHYLAXIS" ? "strong" : "subtle"}
        >
          {r.severity === "ANAPHYLAXIS" && <AlertTriangle size={12} />}
          {t(`residents.allergiesSection.severities.${r.severity}`)}
        </Badge>
      ),
    },
    {
      key: "source",
      header: t("residents.allergiesSection.source"),
      width: 130,
      cell: (r) => t(`residents.allergiesSection.sources.${r.source}`),
    },
    {
      key: "active",
      header: t("residents.allergiesSection.isActive"),
      width: 80,
      cell: (r) => (r.is_active ? <Badge tone="success">●</Badge> : <Badge tone="neutral">—</Badge>),
    },
    {
      key: "actions",
      header: "",
      width: 80,
      cell: (r) => canEdit ? (
        <DropdownMenu
          trigger={<IconButton aria-label="row" icon={<MoreHorizontal size={16} />} variant="ghost" size="compact" />}
          items={[
            { label: t("actions.edit"), onSelect: () => setEditing(r) },
            ...(r.is_active ? [{ label: t("actions.remove"), tone: "destructive" as const, onSelect: () => void onRemove(r) }] : []),
          ]}
        />
      ) : null,
    },
  ];

  return (
    <Card padding="md">
      <Stack gap={3}>
        {anaphylaxis.length > 0 && (
          <Alert
            severity="error"
            title={`⚠ ${t("residents.allergiesSection.anaphylaxisBanner")}: ${anaphylaxis.map((a) => a.drug).join(", ")}`}
            description={t("residents.allergiesSection.anaphylaxisDetail")}
          />
        )}
        <Inline justify="between" align="center">
          <Heading level={3}>{t("residents.allergiesSection.title")}</Heading>
          {canEdit && (
            <Button variant="primary" size="compact" onClick={() => setAdding(true)}>
              {t("residents.allergiesSection.add")}
            </Button>
          )}
        </Inline>
        {visible.length === 0 ? (
          <Text size="sm" color="tertiary">{t("residents.allergiesSection.empty")}</Text>
        ) : (
          <Table<AllergyRecord> columns={cols} rows={visible} rowKey={(r) => r.id} />
        )}
        {allergies.some((a) => !a.is_active) && (
          <Switch
            checked={showHist}
            onChange={setShowHist}
            label={t("residents.allergiesSection.showHistorical")}
          />
        )}
      </Stack>
      <AllergyEditModal
        open={adding || !!editing}
        initial={editing}
        onClose={() => { setAdding(false); setEditing(null); }}
        onSave={onSaveAllergy}
      />
    </Card>
  );
}

function AllergyEditModal({
  open, initial, onClose, onSave,
}: {
  open: boolean;
  initial: AllergyRecord | null;
  onClose: () => void;
  onSave: (rec: AllergyRecord) => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [drug, setDrug] = useState("");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState<AllergySeverity>("MODERATE");
  const [source, setSource] = useState<AllergySource>("MEDICAL_RECORD");
  const [active, setActive] = useState(true);
  const [recordedAt, setRecordedAt] = useState(today);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDrug(initial?.drug ?? "");
      setReaction(initial?.reaction ?? "");
      setSeverity(initial?.severity ?? "MODERATE");
      setSource(initial?.source ?? "MEDICAL_RECORD");
      setActive(initial?.is_active ?? true);
      setRecordedAt(initial?.recorded_at ?? today);
    }
  }, [open, initial, today]);

  const submit = async () => {
    if (!drug || !reaction) return;
    setBusy(true);
    try {
      await onSave({
        id: initial?.id ?? uuid(),
        drug, reaction, severity, source,
        is_active: active,
        recorded_at: recordedAt,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? t("residents.allergiesSection.edit") : t("residents.allergiesSection.add")}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>{t("actions.cancel")}</Button>
          <Button variant="primary" loading={busy} onClick={submit}>{t("actions.save")}</Button>
        </>
      }
    >
      <Stack gap={3}>
        <FormField label={t("residents.allergiesSection.drug")} required>
          <TextField value={drug} onChange={(e) => setDrug(e.target.value)} />
        </FormField>
        <FormField label={t("residents.allergiesSection.reaction")} required>
          <TextField value={reaction} onChange={(e) => setReaction(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("residents.allergiesSection.severity")} required>
            <Select
              value={severity}
              onChange={(e) => setSeverity((e.target as HTMLSelectElement).value as AllergySeverity)}
              options={(["MILD", "MODERATE", "SEVERE", "ANAPHYLAXIS"] as AllergySeverity[]).map((v) => ({
                value: v, label: t(`residents.allergiesSection.severities.${v}`),
              }))}
            />
          </FormField>
          <FormField label={t("residents.allergiesSection.source")} required>
            <Select
              value={source}
              onChange={(e) => setSource((e.target as HTMLSelectElement).value as AllergySource)}
              options={(["RESIDENT_REPORTED", "FAMILY_REPORTED", "MEDICAL_RECORD", "OBSERVED"] as AllergySource[]).map((v) => ({
                value: v, label: t(`residents.allergiesSection.sources.${v}`),
              }))}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("residents.allergiesSection.recordedAt")}>
            <TextField type="date" value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)} />
          </FormField>
          <FormField label={t("residents.allergiesSection.isActive")}>
            <Switch checked={active} onChange={setActive} />
          </FormField>
        </div>
      </Stack>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────
 * Consents & Legal card
 * ────────────────────────────────────────────────────────── */
function ConsentsCard({
  resident, canEdit, onSaved, logAction,
}: {
  resident: Resident;
  canEdit: boolean;
  onSaved: () => Promise<void> | void;
  logAction: LogActionFn;
}) {
  const { t } = useTranslation();
  const consents = (resident.consents as ConsentFlags | null) ?? {};
  const resus = (resident.resuscitation_status as ResusStatus | null) ?? "FULL_RESUSCITATION";

  const [editing, setEditing] = useState(false);
  const [familyShare, setFamilyShare] = useState(!!consents.family_info_sharing);
  const [photoPub, setPhotoPub] = useState(!!consents.photography_publications);
  const [tele, setTele] = useState(!!consents.telehealth);
  const [eol, setEol] = useState(consents.religious_eol_preferences ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing) {
      setFamilyShare(!!consents.family_info_sharing);
      setPhotoPub(!!consents.photography_publications);
      setTele(!!consents.telehealth);
      setEol(consents.religious_eol_preferences ?? "");
    }
  }, [editing, consents.family_info_sharing, consents.photography_publications, consents.telehealth, consents.religious_eol_preferences]);

  const save = async () => {
    setBusy(true);
    try {
      const before = { consents: resident.consents, do_not_share_family: resident.do_not_share_family };
      const newConsents: ConsentFlags = {
        family_info_sharing: familyShare,
        photography_publications: photoPub,
        telehealth: tele,
        religious_eol_preferences: eol || undefined,
      };
      const after = {
        consents: newConsents as unknown as Tables<"residents">["consents"],
        do_not_share_family: !familyShare,
      };
      const { error } = await supabase.from("residents").update(after).eq("id", resident.id);
      if (error) throw error;
      void logAction({
        action: "RESIDENT_CONSENTS_UPDATED",
        entity_type: "residents",
        entity_id: resident.id,
        branch_id: resident.branch_id,
        before_state: before as unknown as Record<string, unknown>,
        after_state: after as unknown as Record<string, unknown>,
      });
      toast.success(t("common.saved"));
      setEditing(false);
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="md">
      <Inline justify="between" className="mb-3">
        <Heading level={3}>{t("residents.consents.title")}</Heading>
        {canEdit && !editing && (
          <Button variant="ghost" size="compact" onClick={() => setEditing(true)}>{t("actions.edit")}</Button>
        )}
      </Inline>
      <Stack gap={3}>
        {/* Resuscitation read-only */}
        <Stack gap={2}>
          <Text size="label" color="tertiary">{t("residents.resuscitation.title")}</Text>
          <Inline gap={2} align="center" wrap>
            <Badge tone={resus === "FULL_RESUSCITATION" ? "success" : resus === "DNACPR" ? "error" : "warning"} emphasis={resus === "FULL_RESUSCITATION" ? "subtle" : "strong"}>
              {t(`residents.resuscitation.${resus}`)}
            </Badge>
            {resident.advance_directive_on_file ? (
              <Badge tone="success" emphasis="subtle">
                <CheckCircle2 size={12} /> {t("residents.resuscitation.adOnFile")}
                {resident.advance_directive_uploaded_at ? ` (${formatDate(resident.advance_directive_uploaded_at)})` : ""}
              </Badge>
            ) : (
              <Badge tone="warning" emphasis="subtle">{t("residents.resuscitation.adNotOnFile")}</Badge>
            )}
            <Text size="caption" color="tertiary">{t("residents.consents.changeFromHeader")}</Text>
          </Inline>
        </Stack>

        <Divider />
        {/* LPOA */}
        <Stack gap={2}>
          <Text size="label" color="tertiary">{t("residents.resuscitation.lpoa")}</Text>
          {resident.lpoa_holder_name ? (
            <Text size="sm">
              {resident.lpoa_holder_name}
              {resident.lpoa_holder_relationship ? ` — ${resident.lpoa_holder_relationship}` : ""}
              {resident.lpoa_holder_phone ? ` · ${resident.lpoa_holder_phone}` : ""}
            </Text>
          ) : (
            <Text size="sm" color="tertiary">{t("residents.consents.noGuardian")}</Text>
          )}
        </Stack>

        <Divider />
        {/* Consent toggles */}
        {!editing ? (
          <Stack gap={2}>
            <Inline justify="between"><Text size="sm">{t("residents.consents.familyInfoSharing")}</Text><Badge tone={familyShare ? "success" : "neutral"}>{familyShare ? "ON" : "OFF"}</Badge></Inline>
            <Inline justify="between"><Text size="sm">{t("residents.consents.photographyPublications")}</Text><Badge tone={photoPub ? "success" : "neutral"}>{photoPub ? "ON" : "OFF"}</Badge></Inline>
            <Inline justify="between"><Text size="sm">{t("residents.consents.telehealth")}</Text><Badge tone={tele ? "success" : "neutral"}>{tele ? "ON" : "OFF"}</Badge></Inline>
            <Stack gap={1}>
              <Text size="label" color="tertiary">{t("residents.consents.religiousEol")}</Text>
              <Text size="sm">{eol || t("residents.noneRecorded")}</Text>
            </Stack>
          </Stack>
        ) : (
          <Stack gap={3}>
            <Switch checked={familyShare} onChange={setFamilyShare} label={t("residents.consents.familyInfoSharing")} />
            <Switch checked={photoPub} onChange={setPhotoPub} label={t("residents.consents.photographyPublications")} />
            <Switch checked={tele} onChange={setTele} label={t("residents.consents.telehealth")} />
            <FormField label={t("residents.consents.religiousEol")}>
              <TextField value={eol} onChange={(e) => setEol(e.target.value)} />
            </FormField>
            <Inline justify="end" gap={2}>
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>{t("actions.cancel")}</Button>
              <Button variant="primary" loading={busy} onClick={save}>{t("actions.save")}</Button>
            </Inline>
          </Stack>
        )}

        <Text size="caption" color="tertiary">
          {t("residents.consents.lastUpdated")}: {formatDateTime(resident.updated_at)}
        </Text>
      </Stack>
    </Card>
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
  logAction: LogActionFn;
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
      {doNotShareFamily && (
        <Alert
          severity="error"
          title={t("residents.doNotShareFamily")}
          description={t("residents.doNotShareWarning")}
        />
      )}
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
  logAction: LogActionFn;
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
  logAction: LogActionFn;
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
