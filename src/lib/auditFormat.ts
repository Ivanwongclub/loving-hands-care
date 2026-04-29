import type { TFunction } from "i18next";

/**
 * Maps audit log action codes to human-readable labels.
 * Single source of truth — used by staff dashboard and family portal.
 */
export function formatAuditAction(action: string, t: TFunction): string {
  const known: Record<string, string> = {
    RESIDENT_ADMITTED: t("audit.actions.RESIDENT_ADMITTED", { defaultValue: "Resident admitted" }),
    RESIDENT_DISCHARGED: t("audit.actions.RESIDENT_DISCHARGED", { defaultValue: "Resident discharged" }),
    RESIDENT_UPDATED: t("audit.actions.RESIDENT_UPDATED", { defaultValue: "Resident updated" }),
    RESIDENT_TRANSFERRED: t("audit.actions.RESIDENT_TRANSFERRED", { defaultValue: "Bed transfer" }),
    RESIDENT_CONSENTS_UPDATED: t("audit.actions.RESIDENT_CONSENTS_UPDATED", { defaultValue: "Consents updated" }),
    RESIDENT_RESUSCITATION_STATUS_CHANGED: t("audit.actions.RESIDENT_RESUSCITATION_STATUS_CHANGED", { defaultValue: "Resuscitation status changed" }),
    EMAR_ADMINISTERED: t("audit.actions.EMAR_ADMINISTERED", { defaultValue: "Medication administered" }),
    EMAR_REFUSED: t("audit.actions.EMAR_REFUSED", { defaultValue: "Medication refused" }),
    EMAR_HELD: t("audit.actions.EMAR_HELD", { defaultValue: "Medication held" }),
    ALERT_TRIGGERED: t("audit.actions.ALERT_TRIGGERED", { defaultValue: "Alert triggered" }),
    ALERT_ACKNOWLEDGED: t("audit.actions.ALERT_ACKNOWLEDGED", { defaultValue: "Alert acknowledged" }),
    ALERT_RESOLVED: t("audit.actions.ALERT_RESOLVED", { defaultValue: "Alert resolved" }),
    ALERT_ESCALATED: t("audit.actions.ALERT_ESCALATED", { defaultValue: "Alert escalated" }),
    ALERT_AUTO_ESCALATED: t("audit.actions.ALERT_AUTO_ESCALATED", { defaultValue: "Alert auto-escalated" }),
    TASK_COMPLETED: t("audit.actions.TASK_COMPLETED", { defaultValue: "Task completed" }),
    TASK_CANCELLED: t("audit.actions.TASK_CANCELLED", { defaultValue: "Task cancelled" }),
    INCIDENT_REPORTED: t("audit.actions.INCIDENT_REPORTED", { defaultValue: "Incident reported" }),
    INCIDENT_RESOLVED: t("audit.actions.INCIDENT_RESOLVED", { defaultValue: "Incident resolved" }),
    INCIDENT_CLOSED: t("audit.actions.INCIDENT_CLOSED", { defaultValue: "Incident closed" }),
    VITALS_RECORDED: t("audit.actions.VITALS_RECORDED", { defaultValue: "Vitals recorded" }),
    WOUND_RECORDED: t("audit.actions.WOUND_RECORDED", { defaultValue: "Wound recorded" }),
    VACCINATION_RECORDED: t("audit.actions.VACCINATION_RECORDED", { defaultValue: "Vaccination recorded" }),
    WANDERING_RISK_ASSESSED: t("audit.actions.WANDERING_RISK_ASSESSED", { defaultValue: "Wandering risk assessed" }),
    STAFF_LOGIN: t("audit.actions.STAFF_LOGIN", { defaultValue: "Staff login" }),
    STAFF_INVITED: t("audit.actions.STAFF_INVITED", { defaultValue: "Staff invited" }),
    FAMILY_PORTAL_INVITED: t("audit.actions.FAMILY_PORTAL_INVITED", { defaultValue: "Family portal invited" }),
    FAMILY_PORTAL_REVOKED: t("audit.actions.FAMILY_PORTAL_REVOKED", { defaultValue: "Family portal revoked" }),
  };
  if (known[action]) return known[action];
  return action.replace(/_/g, " ").toLowerCase();
}
