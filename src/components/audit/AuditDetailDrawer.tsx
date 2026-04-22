import { useTranslation } from "react-i18next";
import { Drawer, Stack, Inline, Badge, Surface, Text, Divider } from "@/components/hms";
import type { Tables } from "@/integrations/supabase/types";

export type AuditLogRow = Tables<"audit_logs"> & {
  actor: { name: string; name_zh: string | null } | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
  log: AuditLogRow | null;
}

function redactPinHash(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactPinHash);
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
      k,
      k === "pin_hash" ? "[REDACTED]" : redactPinHash(v),
    ]),
  );
}

function formatDateTime(d?: string | null): string {
  if (!d) return "—";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`;
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <Surface padding="sm">
      <Stack gap={2}>
        <Text size="sm" color="tertiary" style={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
          {label}
        </Text>
        <pre
          style={{
            margin: 0,
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 12,
            lineHeight: "16px",
            color: "var(--text-primary)",
            backgroundColor: "var(--bg-subtle)",
            padding: 12,
            borderRadius: "var(--radius-sm)",
            maxHeight: 200,
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {JSON.stringify(redactPinHash(value), null, 2)}
        </pre>
      </Stack>
    </Surface>
  );
}

export function AuditDetailDrawer({ open, onClose, log }: Props) {
  const { t } = useTranslation();
  if (!log) return null;

  const actorName = log.actor?.name_zh || log.actor?.name || t("audit.systemActor");

  return (
    <Drawer open={open} onClose={onClose} title={t("audit.detail")} width={560}>
      <Stack gap={4}>
        <Inline gap={2}>
          <Badge tone="neutral" emphasis="strong" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 13 }}>
            {log.action}
          </Badge>
        </Inline>

        <div className="grid grid-cols-2 gap-4 w-full">
          <Stack gap={1}>
            <Text size="sm" color="tertiary">{t("audit.entity")}</Text>
            <Text size="md" color="primary">
              <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{log.entity_type}</span>
            </Text>
            <Text size="sm" color="secondary" style={{ fontFamily: "var(--font-mono, monospace)", wordBreak: "break-all" }}>
              {log.entity_id}
            </Text>
          </Stack>
          <Stack gap={1}>
            <Text size="sm" color="tertiary">{t("audit.actor")}</Text>
            <Text size="md" color="primary">{actorName}</Text>
            <Text size="sm" color="secondary" style={{ fontFamily: "var(--font-mono, monospace)" }}>
              {formatDateTime(log.created_at)}
            </Text>
          </Stack>
        </div>

        <Divider />

        {log.before_state ? <JsonBlock label={t("audit.before")} value={log.before_state} /> : null}
        {log.after_state ? <JsonBlock label={t("audit.after")} value={log.after_state} /> : null}
        {log.metadata ? <JsonBlock label={t("audit.metadata")} value={log.metadata} /> : null}
      </Stack>
    </Drawer>
  );
}
