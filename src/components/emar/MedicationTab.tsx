import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Shield } from "lucide-react";
import {
  Card, Surface, Stack, Inline, Text, Heading, Button, Spinner, EmptyState, Badge, Tabs, FormField, TextField,
} from "@/components/hms";
import type { Enums } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useMedicationOrders, type MedOrderRow } from "@/hooks/useMedicationOrders";
import { useEMARRecords, type EMARRow } from "@/hooks/useEMARRecords";
import type { useAuditLog } from "@/hooks/useAuditLog";
import { NewOrderModal } from "./NewOrderModal";
import { StopOrderModal } from "./StopOrderModal";
import { RefusalModal } from "./RefusalModal";
import { HoldModal } from "./HoldModal";
import { AdministerModal } from "./AdministerModal";

interface MedicationTabProps {
  residentId: string;
  branchId: string;
  staffId: string | null;
  staffRole: Enums<"staff_role"> | null;
  residentNameZh: string;
  residentName: string;
  logAction: ReturnType<typeof useAuditLog>["logAction"];
}

type OrderStatus = Enums<"med_order_status">;
type EMARStatus = Enums<"emar_status">;

const ORDER_STATUS_TONE: Record<OrderStatus, "success" | "neutral" | "warning"> = {
  ACTIVE: "success",
  STOPPED: "neutral",
  COMPLETED: "neutral",
  ON_HOLD: "warning",
};

const EMAR_STATUS_TONE: Record<EMARStatus, "warning" | "success" | "error" | "neutral"> = {
  DUE: "warning",
  ADMINISTERED: "success",
  REFUSED: "error",
  HELD: "neutral",
  LATE: "error",
  MISSED: "error",
};

const FREQ_TONE: Record<string, "info" | "warning" | "neutral"> = {
  ONCE_DAILY: "info",
  TWICE_DAILY: "info",
  THREE_DAILY: "info",
  FOUR_DAILY: "info",
  PRN: "warning",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function formatTime(d?: string | null): string {
  if (!d) return "—";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
function formatDateTime(d?: string | null): string {
  if (!d) return "—";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
function scheduleTimes(o: MedOrderRow): string[] {
  if (!o.schedule || typeof o.schedule !== "object") return [];
  const s = o.schedule as { times?: unknown };
  if (!Array.isArray(s.times)) return [];
  return s.times.filter((x): x is string => typeof x === "string");
}

export function MedicationTab({
  residentId, branchId, staffId, staffRole, residentNameZh, residentName, logAction,
}: MedicationTabProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"orders" | "schedule">("orders");
  const [date, setDate] = useState(todayISO());

  const { orders, isLoading: ordersLoading } = useMedicationOrders(residentId, "ALL");
  const { records, isLoading: recordsLoading } = useEMARRecords({ residentId, date });

  const [newOpen, setNewOpen] = useState(false);
  const [stopping, setStopping] = useState<string | null>(null);
  const [refusing, setRefusing] = useState<string | null>(null);
  const [holding, setHolding] = useState<string | null>(null);
  const [adminRecord, setAdminRecord] = useState<EMARRow | null>(null);

  const canCreateOrder =
    staffRole === "SENIOR_NURSE" ||
    staffRole === "BRANCH_ADMIN" ||
    staffRole === "SYSTEM_ADMIN";

  // Flag stale DUE records (older than 1 day) as MISSED — silent
  useEffect(() => {
    if (!residentId) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    void supabase
      .from("emar_records")
      .update({ status: "MISSED" })
      .eq("resident_id", residentId)
      .eq("status", "DUE")
      .lt("due_at", `${cutoffStr}T00:00:00`)
      .then(({ error }) => {
        if (!error) void qc.invalidateQueries({ queryKey: ["emarRecords", residentId] });
      });
  }, [residentId, qc]);

  // Flag today's overdue DUE records as LATE — silent
  useEffect(() => {
    if (!residentId) return;
    const now = new Date().toISOString();
    const todayStart = `${now.slice(0, 10)}T00:00:00`;
    void supabase
      .from("emar_records")
      .update({ status: "LATE" })
      .eq("resident_id", residentId)
      .eq("status", "DUE")
      .lt("due_at", now)
      .gte("due_at", todayStart)
      .then(({ error }) => {
        if (!error) void qc.invalidateQueries({ queryKey: ["emarRecords", residentId, date] });
      });
  }, [residentId, date, qc]);

  const handlePRNAdmin = async (order: MedOrderRow) => {
    const { data, error } = await supabase
      .from("emar_records")
      .insert({
        order_id: order.id,
        resident_id: residentId,
        branch_id: branchId,
        due_at: new Date().toISOString(),
        status: "DUE",
        prn_indication: order.prn_indication,
      })
      .select(
        "*, order:order_id(drug_name, drug_name_zh, dose, route, is_prn, barcode), administrator:administered_by(name, name_zh)",
      )
      .single();
    if (!error && data) {
      void qc.invalidateQueries({ queryKey: ["emarRecords", residentId, date] });
      setAdminRecord(data as unknown as EMARRow);
    }
  };

  return (
    <Stack gap={4}>
      <Tabs
        style="line"
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
        items={[
          { value: "orders", label: t("emar.orders") },
          { value: "schedule", label: t("emar.schedule") },
        ]}
      />

      {tab === "orders" && (
        <OrdersPanel
          orders={orders}
          isLoading={ordersLoading}
          canCreate={canCreateOrder && !!staffId}
          onNew={() => setNewOpen(true)}
          onStop={(id) => setStopping(id)}
        />
      )}

      {tab === "schedule" && (
        <SchedulePanel
          records={records}
          isLoading={recordsLoading}
          date={date}
          onDateChange={setDate}
          onAdminister={(r) => setAdminRecord(r)}
          onPRNAdmin={handlePRNAdmin}
          onRefuse={(id) => setRefusing(id)}
          onHold={(id) => setHolding(id)}
          orders={orders}
        />
      )}

      {staffId && (
        <NewOrderModal
          open={newOpen}
          onClose={() => setNewOpen(false)}
          residentId={residentId}
          branchId={branchId}
          staffId={staffId}
          logAction={logAction}
        />
      )}
      {staffId && (
        <StopOrderModal
          open={!!stopping}
          onClose={() => setStopping(null)}
          orderId={stopping}
          residentId={residentId}
          branchId={branchId}
          staffId={staffId}
          logAction={logAction}
        />
      )}
      <RefusalModal
        open={!!refusing}
        onClose={() => setRefusing(null)}
        recordId={refusing}
        residentId={residentId}
        branchId={branchId}
        date={date}
        logAction={logAction}
      />
      <HoldModal
        open={!!holding}
        onClose={() => setHolding(null)}
        recordId={holding}
        residentId={residentId}
        branchId={branchId}
        date={date}
        logAction={logAction}
      />
      <AdministerModal
        open={!!adminRecord}
        onClose={() => setAdminRecord(null)}
        record={adminRecord}
        residentNameZh={residentNameZh}
        residentName={residentName}
        branchId={branchId}
        staffId={staffId ?? ""}
        date={date}
        residentId={residentId}
        logAction={logAction}
      />
    </Stack>
  );

  function OrdersPanel({
    orders, isLoading, canCreate, onNew, onStop,
  }: {
    orders: MedOrderRow[];
    isLoading: boolean;
    canCreate: boolean;
    onNew: () => void;
    onStop: (id: string) => void;
  }) {
    const active = orders.filter((o) => o.status === "ACTIVE");
    const inactive = orders.filter((o) => o.status !== "ACTIVE");

    if (isLoading) {
      return (
        <Stack gap={3}>
          {[0, 1, 2].map((i) => (
            <Card key={i} padding="md">
              <Inline gap={3}><Spinner size="sm" /><Text size="sm" color="tertiary">{t("common.loading")}</Text></Inline>
            </Card>
          ))}
        </Stack>
      );
    }

    if (orders.length === 0) {
      return (
        <Card padding="lg">
          <EmptyState
            title={t("emar.noOrders")}
            action={canCreate ? <Button variant="primary" onClick={onNew}>{t("emar.newOrder")}</Button> : undefined}
          />
        </Card>
      );
    }

    return (
      <Stack gap={4}>
        <Inline justify="between" align="center">
          <Heading level={3}>{t("emar.orders")}</Heading>
          {canCreate && (
            <Button variant="primary" onClick={onNew}>{t("emar.newOrder")}</Button>
          )}
        </Inline>

        {active.length > 0 && (
          <Stack gap={3}>
            <Text size="label" color="tertiary">{t("emar.active")} ({active.length})</Text>
            {active.map((o) => (
              <OrderCard key={o.id} order={o} onStop={onStop} canStop={canCreate} />
            ))}
          </Stack>
        )}
        {inactive.length > 0 && (
          <Stack gap={3}>
            <Text size="label" color="tertiary">{t("emar.history")} ({inactive.length})</Text>
            {inactive.map((o) => (
              <div key={o.id} style={{ opacity: 0.7 }}>
                <OrderCard order={o} onStop={onStop} canStop={false} />
              </div>
            ))}
          </Stack>
        )}
      </Stack>
    );
  }

  function OrderCard({
    order, onStop, canStop,
  }: { order: MedOrderRow; onStop: (id: string) => void; canStop: boolean }) {
    const times = scheduleTimes(order);
    return (
      <Card padding="md">
        <Stack gap={2}>
          <Inline justify="between" align="start" className="w-full" wrap>
            <Stack gap={1}>
              <Inline gap={2} wrap align="center">
                <Text size="md" className="font-semibold">{order.drug_name_zh ?? order.drug_name}</Text>
                {order.drug_name_zh && <Text size="sm" color="secondary">{order.drug_name}</Text>}
              </Inline>
              <Inline gap={2} wrap>
                <Badge tone="neutral">{order.dose}</Badge>
                <Badge tone="neutral">{t(`emar.routes.${order.route}`)}</Badge>
                <Badge tone={FREQ_TONE[order.frequency] ?? "neutral"}>
                  {t(`emar.frequencies.${order.frequency}`, order.frequency)}
                </Badge>
                <Badge tone={ORDER_STATUS_TONE[order.status]}>
                  {t(`emar.orderStatus.${order.status}`)}
                </Badge>
                {order.is_prn && <Badge tone="warning" emphasis="strong">PRN</Badge>}
              </Inline>
            </Stack>
            {canStop && order.status === "ACTIVE" && (
              <Button variant="soft" size="compact" onClick={() => onStop(order.id)}>
                {t("emar.stopOrder")}
              </Button>
            )}
          </Inline>

          <Stack gap={1}>
            <Text size="sm" color="secondary">
              {order.start_date} → {order.end_date ?? t("emar.ongoing")}
            </Text>
            {order.is_prn && order.prn_indication && (
              <Text size="sm">{t("emar.prnIndication")}: {order.prn_indication}</Text>
            )}
            {order.barcode && (
              <Text size="sm" color="tertiary" style={{ fontFamily: "monospace" }}>
                {t("emar.barcode")}: {order.barcode}
              </Text>
            )}
            {times.length > 0 && (
              <Text size="sm" color="tertiary">{t("emar.schedule_times")}: {times.join(", ")}</Text>
            )}
            {order.orderer && (
              <Text size="sm" color="tertiary">
                {t("emar.orderedBy")}: {order.orderer.name_zh ?? order.orderer.name}
              </Text>
            )}
            {order.status === "STOPPED" && order.stop_reason && (
              <Text size="sm" color="tertiary">{t("emar.stopReason")}: {order.stop_reason}</Text>
            )}
          </Stack>
        </Stack>
      </Card>
    );
  }

  function SchedulePanel({
    records, isLoading, date, onDateChange, onAdminister, onPRNAdmin, onRefuse, onHold, orders,
  }: {
    records: EMARRow[];
    isLoading: boolean;
    date: string;
    onDateChange: (d: string) => void;
    onAdminister: (r: EMARRow) => void;
    onPRNAdmin: (o: MedOrderRow) => void;
    onRefuse: (id: string) => void;
    onHold: (id: string) => void;
    orders: MedOrderRow[];
  }) {
    // Group records by order_id
    const groups = new Map<string, EMARRow[]>();
    for (const r of records) {
      const existing = groups.get(r.order_id) ?? [];
      existing.push(r);
      groups.set(r.order_id, existing);
    }
    const prnOrders = orders.filter((o) => o.status === "ACTIVE" && o.is_prn);

    return (
      <Stack gap={4}>
        <Inline justify="between" align="end" wrap>
          <Heading level={3}>{t("emar.schedule")}</Heading>
          <div style={{ width: 200 }}>
            <FormField label={t("emar.selectDate")}>
              <TextField type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
            </FormField>
          </div>
        </Inline>

        {isLoading ? (
          <Stack gap={3}>
            {[0, 1, 2].map((i) => (
              <Card key={i} padding="md">
                <Inline gap={3}><Spinner size="sm" /><Text size="sm" color="tertiary">{t("common.loading")}</Text></Inline>
              </Card>
            ))}
          </Stack>
        ) : groups.size === 0 ? (
          <Card padding="lg">
            <EmptyState title={t("emar.noSchedule")} />
          </Card>
        ) : (
          <Stack gap={4}>
            {Array.from(groups.entries()).map(([orderId, slots]) => {
              const first = slots[0];
              return (
                <Card key={orderId} padding="md">
                  <Stack gap={3}>
                    <Inline gap={2} wrap>
                      <Text size="md" className="font-semibold">
                        {first.order?.drug_name_zh ?? first.order?.drug_name ?? "—"}
                      </Text>
                      {first.order && (
                        <>
                          <Badge tone="neutral">{first.order.dose}</Badge>
                          <Badge tone="neutral">{t(`emar.routes.${first.order.route}`)}</Badge>
                        </>
                      )}
                    </Inline>
                    <Stack gap={2}>
                      {slots.map((s) => (
                        <Surface key={s.id} padding="sm">
                          <Inline justify="between" align="center" className="w-full" wrap>
                            <Inline gap={3} wrap align="center">
                              <Text size="md" className="font-semibold" style={{ minWidth: 56 }}>
                                {formatTime(s.due_at)}
                              </Text>
                              <Badge tone={EMAR_STATUS_TONE[s.status]}>
                                {t(`emar.emarStatus.${s.status}`)}
                              </Badge>
                              {s.barcode_verified && (
                                <Inline gap={1} align="center">
                                  <CheckCircle2 size={14} style={{ color: "var(--accent-success)" }} />
                                  <Text size="sm" color="tertiary">{t("emar.barcodeVerified")}</Text>
                                </Inline>
                              )}
                              {s.shift_pin_verified && (
                                <Inline gap={1} align="center">
                                  <Shield size={14} style={{ color: "var(--accent-success)" }} />
                                  <Text size="sm" color="tertiary">{t("emar.pinVerified")}</Text>
                                </Inline>
                              )}
                            </Inline>
                            {(s.status === "DUE" || s.status === "LATE") && (
                              <Inline gap={2}>
                                <Button variant="primary" size="compact" onClick={() => onAdminister(s)}>
                                  {t("emar.administer")}
                                </Button>
                                <Button variant="ghost" size="compact" onClick={() => onRefuse(s.id)}>
                                  {t("emar.markRefused")}
                                </Button>
                                <Button variant="ghost" size="compact" onClick={() => onHold(s.id)}>
                                  {t("emar.markHeld")}
                                </Button>
                              </Inline>
                            )}
                          </Inline>
                          {s.status === "ADMINISTERED" && (
                            <Text size="sm" color="tertiary" style={{ marginTop: 6 }}>
                              {t("emar.administeredBy")}: {s.administrator?.name_zh ?? s.administrator?.name ?? "—"}
                              {" · "}
                              {t("emar.administeredAt")}: {formatDateTime(s.administered_at)}
                            </Text>
                          )}
                          {s.status === "REFUSED" && s.refusal_reason && (
                            <Text size="sm" color="tertiary" style={{ marginTop: 6 }}>
                              {t("emar.refusalReason")}: {s.refusal_reason}
                            </Text>
                          )}
                          {s.status === "HELD" && s.hold_reason && (
                            <Text size="sm" color="tertiary" style={{ marginTop: 6 }}>
                              {t("emar.holdReason")}: {s.hold_reason}
                            </Text>
                          )}
                        </Surface>
                      ))}
                    </Stack>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        )}

        {prnOrders.length > 0 && (
          <Stack gap={2}>
            <Heading level={3}>{t("emar.prnSection")}</Heading>
            {prnOrders.map((o) => (
              <Card key={o.id} padding="md">
                <Inline justify="between" align="center" className="w-full" wrap>
                  <Stack gap={1}>
                    <Text size="md" className="font-semibold">
                      {o.drug_name_zh ?? o.drug_name}
                    </Text>
                    <Inline gap={2} wrap>
                      <Badge tone="neutral">{o.dose}</Badge>
                      <Badge tone="warning">PRN</Badge>
                    </Inline>
                    {o.prn_indication && (
                      <Text size="sm" color="secondary">{o.prn_indication}</Text>
                    )}
                  </Stack>
                  <Button variant="primary" size="compact" onClick={() => onPRNAdmin(o)}>
                    {t("emar.prnAdmin")}
                  </Button>
                </Inline>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    );
  }
}
