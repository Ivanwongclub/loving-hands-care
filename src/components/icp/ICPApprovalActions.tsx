import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Button, Modal, ConfirmDialog, FormField, TextArea, Stack, Alert,
} from "@/components/hms";
import { supabase } from "@/integrations/supabase/client";
import type { useAuditLog } from "@/hooks/useAuditLog";
import type { ICPRow } from "@/hooks/useICPs";
import type { ICPContent } from "./types";
import { generateTasksFromICP } from "./generateTasks";

interface ICPApprovalActionsProps {
  icp: ICPRow;
  staffId: string;
  staffRole: string | null;
  residentId: string;
  branchId: string;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

export function ICPApprovalActions({
  icp,
  staffId,
  staffRole,
  residentId,
  branchId,
  logAction,
}: ICPApprovalActionsProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [submitOpen, setSubmitOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isAuthor = icp.authored_by === staffId;
  const isApprover =
    staffRole === "BRANCH_ADMIN" || staffRole === "SYSTEM_ADMIN";

  const canSubmit = icp.status === "DRAFT" && isAuthor;
  const canApprove =
    icp.status === "PENDING_APPROVAL" && isApprover && icp.authored_by !== staffId;
  const canReject = icp.status === "PENDING_APPROVAL" && isApprover;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["icps", residentId] });
    void qc.invalidateQueries({ queryKey: ["tasks", residentId] });
  };

  const doSubmit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const before = { status: icp.status, submitted_at: icp.submitted_at };
      const after = { status: "PENDING_APPROVAL" as const, submitted_at: new Date().toISOString() };
      const { error } = await supabase.from("icps").update(after).eq("id", icp.id);
      if (error) throw error;
      await logAction({
        action: "ICP_SUBMITTED",
        entity_type: "icps",
        entity_id: icp.id,
        branch_id: branchId,
        before_state: before,
        after_state: after,
      });
      toast.success(t("icp.submitSuccess"));
      invalidate();
      setSubmitOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const doApprove = async () => {
    setBusy(true);
    setErr(null);
    try {
      const before = { status: icp.status, approved_by: icp.approved_by, approved_at: icp.approved_at };
      const after = {
        status: "ACTIVE" as const,
        approved_by: staffId,
        approved_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("icps").update(after).eq("id", icp.id);
      if (error) throw error;
      await logAction({
        action: "ICP_APPROVED",
        entity_type: "icps",
        entity_id: icp.id,
        branch_id: branchId,
        before_state: before,
        after_state: after,
      });

      // Auto-generate tasks
      try {
        const count = await generateTasksFromICP(
          icp.id,
          icp.content as unknown as ICPContent,
          residentId,
          branchId,
        );
        if (count > 0) toast.success(t("tasks.autoGenerateSuccess", { count }));
      } catch (genErr) {
        // eslint-disable-next-line no-console
        console.error("[ICP] task generation failed:", genErr);
      }

      toast.success(t("icp.approveSuccess"));
      invalidate();
      setApproveOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const doReject = async () => {
    if (!reason.trim()) {
      setErr(t("icp.rejectionReasonPlaceholder"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const before = { status: icp.status, rejected_by: icp.rejected_by, rejection_reason: icp.rejection_reason };
      const after = {
        status: "REJECTED" as const,
        rejected_by: staffId,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason.trim(),
      };
      const { error } = await supabase.from("icps").update(after).eq("id", icp.id);
      if (error) throw error;
      await logAction({
        action: "ICP_REJECTED",
        entity_type: "icps",
        entity_id: icp.id,
        branch_id: branchId,
        before_state: before,
        after_state: after,
      });
      toast.success(t("icp.rejectSuccess"));
      invalidate();
      setRejectOpen(false);
      setReason("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {canSubmit && (
        <Button variant="primary" onClick={() => setSubmitOpen(true)}>
          {t("icp.submitForApproval")}
        </Button>
      )}
      {canApprove && (
        <Button variant="success" onClick={() => setApproveOpen(true)}>
          {t("icp.approve")}
        </Button>
      )}
      {canReject && (
        <Button variant="destructive" onClick={() => setRejectOpen(true)}>
          {t("icp.reject")}
        </Button>
      )}

      <ConfirmDialog
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onConfirm={doSubmit}
        title={t("icp.submitForApproval")}
        summary={t("icp.submitConfirm")}
        confirmLabel={t("actions.confirm")}
        cancelLabel={t("actions.cancel")}
        tone="approval"
      />

      <ConfirmDialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        onConfirm={doApprove}
        title={t("icp.approve")}
        summary={t("icp.approveConfirm")}
        confirmLabel={t("icp.approve")}
        cancelLabel={t("actions.cancel")}
        tone="approval"
      />

      <Modal
        open={rejectOpen}
        onClose={() => { setRejectOpen(false); setReason(""); setErr(null); }}
        title={t("icp.reject")}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setRejectOpen(false); setReason(""); }} disabled={busy}>
              {t("actions.cancel")}
            </Button>
            <Button variant="destructive" loading={busy} onClick={doReject}>
              {t("icp.reject")}
            </Button>
          </>
        }
      >
        <Stack gap={3}>
          {err && <Alert severity="error" description={err} />}
          <FormField label={t("icp.rejectionReason")} required>
            <TextArea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("icp.rejectionReasonPlaceholder")}
            />
          </FormField>
        </Stack>
      </Modal>
    </>
  );
}
