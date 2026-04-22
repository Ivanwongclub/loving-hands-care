import type { TFunction } from "i18next";

export function timeAgo(iso: string | null | undefined, t: TFunction): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t("alerts.timeAgo.justNow");
  if (mins < 60) return t("alerts.timeAgo.minutes", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("alerts.timeAgo.hours", { count: hours });
  const days = Math.floor(hours / 24);
  return t("alerts.timeAgo.days", { count: days });
}

export function minutesSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export function formatDateTime(d?: string | null): string {
  if (!d) return "—";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

export interface SLAConfig {
  alert_escalation_l1_minutes: number;
  alert_escalation_l2_minutes: number;
  alert_escalation_l3_minutes: number;
}

export const DEFAULT_SLA: SLAConfig = {
  alert_escalation_l1_minutes: 60,
  alert_escalation_l2_minutes: 120,
  alert_escalation_l3_minutes: 240,
};

export function readSLA(slaConfig: unknown): SLAConfig {
  const cfg = (slaConfig ?? {}) as Partial<SLAConfig>;
  return {
    alert_escalation_l1_minutes:
      typeof cfg.alert_escalation_l1_minutes === "number" ? cfg.alert_escalation_l1_minutes : DEFAULT_SLA.alert_escalation_l1_minutes,
    alert_escalation_l2_minutes:
      typeof cfg.alert_escalation_l2_minutes === "number" ? cfg.alert_escalation_l2_minutes : DEFAULT_SLA.alert_escalation_l2_minutes,
    alert_escalation_l3_minutes:
      typeof cfg.alert_escalation_l3_minutes === "number" ? cfg.alert_escalation_l3_minutes : DEFAULT_SLA.alert_escalation_l3_minutes,
  };
}
