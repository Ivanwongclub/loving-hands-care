import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Modal, Button, FormField, TextField, Select, Alert, Stack, Inline,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import { useResidents } from "@/hooks/useResidents";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { useAuditLog } from "@/hooks/useAuditLog";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InvitePortalUserModalProps {
  open: boolean;
  onClose: () => void;
  branchId: string | null;
  onInvited: () => void | Promise<void>;
}

interface ContactRow {
  id: string;
  name: string;
  name_zh: string | null;
  relationship: string;
  portal_email: string | null;
  is_portal_user: boolean;
}

export function InvitePortalUserModal({ open, onClose, branchId, onInvited }: InvitePortalUserModalProps) {
  const { t } = useTranslation();
  const { staff } = useCurrentStaff();
  const { logAction } = useAuditLog();

  const { residents } = useResidents({ branchId, status: "ADMITTED", pageSize: 200 });
  const eligibleResidents = useMemo(
    () => residents.filter((r) => r.status === "ADMITTED"),
    [residents],
  );

  const [residentId, setResidentId] = useState<string>("");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [existingContactId, setExistingContactId] = useState<string>("");
  const [name, setName] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setResidentId("");
      setMode("existing");
      setExistingContactId("");
      setName(""); setNameZh(""); setRelationship(""); setPhone(""); setEmail("");
      setSubmitting(false);
    }
  }, [open]);

  // Load contacts for selected resident
  const { data: contacts = [] } = useQuery({
    queryKey: ["resident_contacts_invite", residentId],
    enabled: !!residentId,
    queryFn: async (): Promise<ContactRow[]> => {
      const { data, error } = await supabase
        .from("resident_contacts")
        .select("id, name, name_zh, relationship, portal_email, is_portal_user")
        .eq("resident_id", residentId)
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  // When picking an existing contact, prefill email
  useEffect(() => {
    if (mode !== "existing" || !existingContactId) return;
    const c = contacts.find((x) => x.id === existingContactId);
    if (c?.portal_email) setEmail(c.portal_email);
  }, [existingContactId, mode, contacts]);

  const emailValid = EMAIL_RE.test(email.trim());
  const canSubmit = !!residentId && emailValid && !submitting && (
    mode === "existing"
      ? !!existingContactId
      : !!(nameZh || name) && !!relationship
  );

  const handleSubmit = async () => {
    if (!canSubmit || !branchId || !staff) return;
    setSubmitting(true);
    try {
      let contactId = existingContactId;

      if (mode === "new") {
        const { data: newContact, error: insErr } = await supabase
          .from("resident_contacts")
          .insert({
            resident_id: residentId,
            name: name || nameZh,
            name_zh: nameZh || null,
            relationship,
            phone_sms: phone || null,
            portal_email: email,
            is_portal_user: false,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        contactId = newContact.id;
      }

      const { error: updErr } = await supabase
        .from("resident_contacts")
        .update({
          is_portal_user: true,
          portal_email: email,
          portal_invited_at: new Date().toISOString(),
          portal_invited_by_staff_id: staff.id,
        })
        .eq("id", contactId);
      if (updErr) throw updErr;

      const { error: fnErr } = await supabase.functions.invoke(
        "invite-family-portal-user",
        { body: { contactId, portalEmail: email, residentId } },
      );
      if (fnErr) throw fnErr;

      await logAction({
        action: "FAMILY_PORTAL_INVITED",
        entity_type: "resident_contacts",
        entity_id: contactId,
        branch_id: branchId,
        after_state: {
          resident_id: residentId,
          portal_email: email,
          invited_by_staff_id: staff.id,
        },
      });

      toast.success(t("familyPortal.settings.invite.success"));
      await onInvited();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t("familyPortal.settings.invite.title")}
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={submitting}>
            {t("actions.cancel")}
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
            {t("familyPortal.settings.invite.send")}
          </Button>
        </>
      }
    >
      <Stack gap={4}>
        <FormField label={t("familyPortal.settings.invite.step1")} required>
          <Select
            value={residentId}
            onChange={(e) => {
              setResidentId((e.target as HTMLSelectElement).value);
              setExistingContactId("");
            }}
            options={[
              { value: "", label: t("familyPortal.settings.invite.selectResidentPlaceholder") },
              ...eligibleResidents.map((r) => ({
                value: r.id,
                label: `${r.name_zh ?? r.name}${r.locations?.code ? ` · ${r.locations.code}` : ""}`,
              })),
            ]}
          />
        </FormField>

        {residentId && (
          <FormField label={t("familyPortal.settings.invite.step2")} required>
            <Stack gap={2}>
              <Inline gap={2}>
                <Button
                  variant={mode === "existing" ? "primary" : "soft"}
                  size="compact"
                  onClick={() => setMode("existing")}
                >
                  {t("familyPortal.settings.invite.selectContactExisting")}
                </Button>
                <Button
                  variant={mode === "new" ? "primary" : "soft"}
                  size="compact"
                  onClick={() => setMode("new")}
                >
                  {t("familyPortal.settings.invite.selectContactNew")}
                </Button>
              </Inline>

              {mode === "existing" ? (
                <Select
                  value={existingContactId}
                  onChange={(e) => setExistingContactId((e.target as HTMLSelectElement).value)}
                  options={[
                    { value: "", label: t("familyPortal.settings.invite.selectContact") },
                    ...contacts.map((c) => ({
                      value: c.id,
                      label: `${c.name_zh ?? c.name} · ${c.relationship}${c.is_portal_user ? " ✓" : ""}`,
                    })),
                  ]}
                />
              ) : (
                <Stack gap={3}>
                  <FormField label={t("familyPortal.settings.invite.contactName")} required>
                    <TextField value={nameZh} onChange={(e) => setNameZh(e.target.value)} />
                  </FormField>
                  <FormField label={t("familyPortal.settings.invite.contactNameEn")}>
                    <TextField value={name} onChange={(e) => setName(e.target.value)} />
                  </FormField>
                  <FormField label={t("familyPortal.settings.invite.relationship")} required>
                    <TextField value={relationship} onChange={(e) => setRelationship(e.target.value)} />
                  </FormField>
                  <FormField label={t("familyPortal.settings.invite.phone")}>
                    <TextField value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </FormField>
                </Stack>
              )}
            </Stack>
          </FormField>
        )}

        {residentId && (
          <FormField
            label={t("familyPortal.settings.invite.portalEmail")}
            required
            helper={t("familyPortal.settings.invite.portalEmailHelper")}
            validation={
              email && !emailValid
                ? { tone: "error", message: t("familyPortal.settings.invite.portalEmailHelper") }
                : undefined
            }
          >
            <TextField type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
        )}

        <Alert severity="info" description={t("familyPortal.settings.invite.warning")} />
      </Stack>
    </Modal>
  );
}
