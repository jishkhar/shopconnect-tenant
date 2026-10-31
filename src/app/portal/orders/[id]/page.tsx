"use client";

import {
  ArrowLeft,
  Ban,
  CreditCard,
  FileText,
  ImageIcon,
  PackageCheck,
  Undo2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  ChannelBadge,
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/erp/StatusBadges";
import { RecordActivity } from "@/components/portal/RecordActivity";
import { ShipmentPanel } from "@/components/portal/ShipmentPanel";
import { PortalShell } from "@/components/portal/PortalShell";
import { ReturnStatusBadge } from "@/components/portal/returns/ReturnDetailPanel";
import { ReturnModal } from "@/components/portal/returns/ReturnModal";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { AnchoredSelect } from "@/components/ui/AnchoredSelect";
import {
  useAdvanceOrder,
  useBindSerials,
  useCancelOrder,
  useCapturePayment,
  useOrder,
  useRecordPayment,
} from "@/hooks/useOrders";
import { useOrderReturns } from "@/hooks/useReturns";
import {
  erpBlob,
  formatDateTime,
  formatMoney,
  humanize,
  methodLabel,
  toMinor,
} from "@/lib/erp";
import { hasGrant, hasPermission, useStaffSession } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";
import { SkeletonLines } from "@/components/ui/Skeleton";

// The schema's single order status runs from payment to delivery; only `completed` takes the stock out and books the sale.
const NEXT_STEP: Record<string, { to: string; label: string }[]> = {
  confirmed: [{ to: "preparing", label: "Start preparing" }],
  preparing: [{ to: "ready", label: "Mark ready" }],
  ready: [
    { to: "shipped", label: "Mark shipped" },
    { to: "completed", label: "Mark delivered" },
  ],
  shipped: [
    { to: "out_for_delivery", label: "Out for delivery" },
    { to: "completed", label: "Mark delivered" },
  ],
  out_for_delivery: [{ to: "completed", label: "Mark delivered" }],
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 justify-between gap-space-3 py-1.5 text-[14px]">
      <span className="min-w-0 text-ink-600 [overflow-wrap:anywhere]">
        {label}
      </span>
      <span className="min-w-0 text-right font-medium text-ink-900 [overflow-wrap:anywhere]">
        {value}
      </span>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { tenant, ready } = usePortalGuard();
  const session = useStaffSession();
  const order = useOrder(id);
  const advance = useAdvanceOrder(id);
  const bindSerials = useBindSerials(id);
  const recordPayment = useRecordPayment(id);
  const capture = useCapturePayment();
  const cancel = useCancelOrder(id);
  const busy = [advance, bindSerials, recordPayment, capture, cancel].some(
    (m) => m.isPending,
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState("");
  const [serialDraft, setSerialDraft] = useState<Record<string, string>>({});
  const [returning, setReturning] = useState(false);
  const returns = useOrderReturns(id);

  if (!ready) return null;
  const o = order.data;
  const canUpdate = hasPermission(session, "orders", "write");
  const canCancel = hasPermission(session, "orders", "delete");

  /** The toasts (and what to do next) of one order action. */
  const done = (okMessage: string, after?: () => void) => ({
    onSuccess: () => {
      toast.success(okMessage);
      after?.();
    },
    onError: (e: Error) => toast.error("Couldn't complete that", e.message),
  });

  const outstanding = o ? o.total_minor - o.paid_minor : 0;
  // A website delivery fee, net of its GST (the GST is inside Tax): whatever the total holds beyond goods and tax.
  const delivery = o
    ? o.total_minor - (o.subtotal_minor - o.discount_minor + o.tax_minor)
    : 0;
  const canPay =
    !!o &&
    [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "out_for_delivery",
      "shipped",
      "completed",
    ].includes(o.status) &&
    outstanding > 0;
  // Delivery orders are marked shipped from the Shipment card, where the courier's tracking link is entered.
  const shipsViaPanel =
    o?.order_type === "shipping" || o?.order_type === "delivery";
  const steps = (o ? (NEXT_STEP[o.status] ?? []) : []).filter(
    (s) => !(shipsViaPanel && s.to === "shipped"),
  );
  const canCancelNow =
    !!o && ["pending", "confirmed", "preparing", "ready"].includes(o.status);
  const cur = o?.currency ?? tenant?.currency ?? "INR";

  return (
    <PortalShell tenant={tenant} active="orders">
      <Link
        href="/portal/orders"
        className="mb-space-3 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-600 hover:underline"
      >
        <ArrowLeft size={14} /> All orders
      </Link>
      {order.error && (
        <p className="text-[14px] font-medium text-error">
          {order.error.message}
        </p>
      )}
      {!o && !order.error && <SkeletonLines rows={3} />}
      {o && (
        <>
          <div className="mb-space-5 flex flex-wrap items-start justify-between gap-space-3">
            <div className="min-w-0">
              <h1 className="text-display [overflow-wrap:anywhere]">
                {o.order_number}
              </h1>
              <div className="mt-space-2 flex flex-wrap items-center gap-space-2">
                <ChannelBadge channel={o.channel} />
                <OrderStatusBadge status={o.status} />
                <PaymentStatusBadge status={o.payment_status} />
                {o.sale_type === "wholesale" &&
                  (() => {
                    const badge = (
                      <Badge tone="indigo">
                        Wholesale
                        {o.due_date && o.payment_status !== "paid"
                          ? ` · due ${o.due_date}`
                          : ""}
                      </Badge>
                    );
                    // a plain badge while Wholesale is switched off: its pages don't open then
                    return session?.modules?.wholesale === false ? (
                      badge
                    ) : (
                      <Link
                        href={
                          o.sales_order_id
                            ? `/portal/wholesale/orders/${o.sales_order_id}`
                            : "/portal/wholesale?tab=invoices"
                        }
                      >
                        {badge}
                      </Link>
                    );
                  })()}
              </div>
              <p className="mt-space-2 text-[13px] text-ink-600 [overflow-wrap:anywhere]">
                Placed {formatDateTime(o.placed_at)} · {humanize(o.order_type)}
                {o.customer_id && (
                  <>
                    {" "}
                    ·{" "}
                    <Link
                      href={`/portal/customers/${o.customer_id}`}
                      className="font-semibold text-brand-600 hover:underline"
                    >
                      View customer
                    </Link>
                  </>
                )}
              </p>
            </div>
            <div
              id="order-actions"
              className="mobile-page-actions flex w-full flex-wrap gap-space-2 md:w-auto [&>button]:whitespace-nowrap [&_svg]:shrink-0"
            >
              {canUpdate &&
                steps.map((s) => (
                  <Button
                    key={s.to}
                    disabled={busy}
                    onClick={() =>
                      advance.mutate(
                        s.to,
                        done(`Order ${humanize(s.to).toLowerCase()}`),
                      )
                    }
                  >
                    <PackageCheck size={16} /> {s.label}
                  </Button>
                ))}
              {canUpdate && canPay && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAmount((outstanding / 100).toFixed(2));
                    setPayOpen(true);
                  }}
                >
                  <CreditCard size={16} /> Record payment
                </Button>
              )}
              {hasGrant(session, "orders:return") &&
                session?.modules?.returns !== false &&
                o.status === "completed" && (
                  <Button
                    variant="secondary"
                    onClick={() => setReturning(true)}
                  >
                    <Undo2 size={16} /> Return / exchange
                  </Button>
                )}
              {o.status !== "pending" && o.status !== "cancelled" && (
                <Button
                  variant="secondary"
                  onClick={() => openOrderPdf(o.id, o.order_number)}
                >
                  <FileText size={16} />{" "}
                  {o.status === "completed"
                    ? "Tax invoice"
                    : "Order confirmation"}
                </Button>
              )}
              {canCancel && canCancelNow && (
                <Button
                  variant="destructive"
                  onClick={() => setCancelOpen(true)}
                >
                  <Ban size={16} /> Cancel order
                </Button>
              )}
            </div>
          </div>

          {o.status === "cancelled" && (
            <Card className="mb-space-4 border-warning/40 bg-warning-tint p-space-3 text-[13.5px] text-warning [overflow-wrap:anywhere]">
              Cancelled{o.cancel_reason ? `: ${o.cancel_reason}` : ""}.{" "}
              {o.paid_minor - o.refunded_minor > 0 && (
                <strong>
                  {formatMoney(o.paid_minor - o.refunded_minor, cur)} was paid
                  and is due back to the customer.
                </strong>
              )}
            </Card>
          )}

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-space-4 lg:grid-cols-3">
            <Card className="min-w-0 p-space-3 md:p-space-4 lg:col-span-2">
              <h2 className="mb-space-3 text-[15px] font-bold text-ink-900">
                Items
              </h2>
              <ul className="divide-y divide-line">
                {o.items.map((item) => {
                  const bound = item.serials?.length ?? 0;
                  const needsSerials =
                    item.serialization_type !== "NONE" &&
                    o.channel !== "pos" &&
                    ["pending", "confirmed", "preparing", "ready"].includes(
                      o.status,
                    ) &&
                    bound < item.quantity;
                  return (
                    <li key={item.id} className="py-space-3">
                      <div className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-x-space-3 gap-y-space-2 md:flex md:justify-between md:gap-space-3">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={`Cover image of ${item.name_snapshot}`}
                            width={64}
                            height={80}
                            unoptimized
                            className="h-20 w-16 shrink-0 rounded-md border border-line object-cover"
                          />
                        ) : (
                          <span
                            className="flex h-20 w-16 shrink-0 items-center justify-center rounded-md border border-line bg-ink-50 text-ink-300"
                            role="img"
                            aria-label={`No cover image for ${item.name_snapshot}`}
                          >
                            <ImageIcon size={24} aria-hidden="true" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-ink-900 [overflow-wrap:anywhere]">
                            {item.name_snapshot}
                          </p>
                          <p className="text-[12.5px] text-ink-600 [overflow-wrap:anywhere]">
                            {item.sku_snapshot} · {item.quantity} ×{" "}
                            {formatMoney(item.unit_price_minor, cur)}
                            {item.tax_minor > 0 && (
                              <> · tax {formatMoney(item.tax_minor, cur)}</>
                            )}
                            {item.returned_quantity > 0 && (
                              <> · {item.returned_quantity} returned</>
                            )}
                          </p>
                        </div>
                        <p className="col-start-2 min-w-0 font-semibold [overflow-wrap:anywhere] md:shrink-0">
                          {formatMoney(item.line_total_minor, cur)}
                        </p>
                      </div>
                      {item.serials && item.serials.length > 0 && (
                        <p className="mt-1 text-[12.5px] text-ink-600 [overflow-wrap:anywhere]">
                          {item.serialization_type === "IMEI"
                            ? "IMEI"
                            : "Serial"}
                          :{" "}
                          {item.serials
                            .map(
                              (s) =>
                                `${s.serial_number} (${humanize(s.status)})`,
                            )
                            .join(", ")}
                        </p>
                      )}
                      {canUpdate && needsSerials && (
                        <div className="mobile-page-actions mt-space-2 flex flex-wrap items-center gap-space-2">
                          <Input
                            aria-label={`${item.serialization_type === "IMEI" ? "IMEI" : "Serial"} numbers for ${item.name_snapshot}`}
                            placeholder={`${item.quantity - bound} ${item.serialization_type === "IMEI" ? "IMEI" : "serial"} number(s), comma separated`}
                            value={serialDraft[item.id] ?? ""}
                            onChange={(e) =>
                              setSerialDraft({
                                ...serialDraft,
                                [item.id]: e.target.value,
                              })
                            }
                            className="max-w-md"
                          />
                          <Button
                            variant="secondary"
                            disabled={
                              busy || !(serialDraft[item.id] ?? "").trim()
                            }
                            onClick={() =>
                              bindSerials.mutate(
                                {
                                  itemId: item.id,
                                  serials: serialDraft[item.id]
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                },
                                done("Units bound", () =>
                                  setSerialDraft({
                                    ...serialDraft,
                                    [item.id]: "",
                                  }),
                                ),
                              )
                            }
                          >
                            Bind units
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>

            <div className="min-w-0 space-y-space-4">
              <Card className="min-w-0 p-space-3 md:p-space-4">
                <h2 className="mb-space-2 text-[15px] font-bold text-ink-900">
                  Summary
                </h2>
                <Row
                  label="Subtotal"
                  value={formatMoney(o.subtotal_minor, cur)}
                />
                {o.discount_minor > 0 && (
                  <Row
                    label="Discount"
                    value={`− ${formatMoney(o.discount_minor, cur)}`}
                  />
                )}
                {delivery > 0 && (
                  <Row
                    label="Delivery (before GST)"
                    value={formatMoney(delivery, cur)}
                  />
                )}
                <Row label="Tax" value={formatMoney(o.tax_minor, cur)} />
                <div className="my-1 border-t border-line" />
                <Row
                  label="Total"
                  value={
                    <span className="text-[16px] font-bold">
                      {formatMoney(o.total_minor, cur)}
                    </span>
                  }
                />
                <Row label="Paid" value={formatMoney(o.paid_minor, cur)} />
                {o.refunded_minor > 0 && (
                  <Row
                    label="Refunded"
                    value={formatMoney(o.refunded_minor, cur)}
                  />
                )}
                {outstanding > 0 && o.status !== "cancelled" && (
                  <Row
                    label="Outstanding"
                    value={
                      <span className="text-warning">
                        {formatMoney(outstanding, cur)}
                      </span>
                    }
                  />
                )}
              </Card>
              <ShipmentPanel order={o} canUpdate={canUpdate} currency={cur} />
              {(returns.data ?? []).length > 0 && (
                <Card className="min-w-0 p-space-3 md:p-space-4">
                  <h2 className="mb-space-2 text-[15px] font-bold text-ink-900">
                    Returns
                  </h2>
                  <ul className="divide-y divide-line">
                    {(returns.data ?? []).map((r) => (
                      <li
                        key={r.id}
                        className="flex min-w-0 flex-wrap items-center justify-between gap-space-2 py-2 text-[13.5px] md:flex-nowrap"
                      >
                        <Link
                          href={`/portal/returns?id=${r.id}`}
                          className="min-w-0 font-semibold text-brand-700 [overflow-wrap:anywhere] hover:underline"
                        >
                          {r.return_number}
                        </Link>
                        <span className="min-w-0 text-ink-600 [overflow-wrap:anywhere]">
                          {formatMoney(r.items_value_minor, cur)}
                        </span>
                        <ReturnStatusBadge r={r} />
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              <Card className="min-w-0 p-space-3 md:p-space-4">
                <h2 className="mb-space-2 text-[15px] font-bold text-ink-900">
                  Payments
                </h2>
                {o.payments.length === 0 && (
                  <p className="text-[13px] text-ink-400">No payments yet.</p>
                )}
                <ul className="divide-y divide-line">
                  {o.payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex min-w-0 flex-wrap items-center justify-between gap-space-2 py-2 text-[13.5px] md:flex-nowrap"
                    >
                      <span className="min-w-0 [overflow-wrap:anywhere]">
                        <span className="font-medium text-ink-900">
                          {methodLabel(p.method)}
                        </span>
                        <span className="ml-2 text-ink-400">
                          {formatMoney(p.amount_minor, cur)}
                        </span>
                      </span>
                      <span className="mobile-page-actions flex min-w-0 max-w-full flex-wrap items-center gap-space-2">
                        <Badge
                          tone={
                            p.status === "paid"
                              ? "success"
                              : p.status === "failed"
                                ? "neutral"
                                : "warning"
                          }
                        >
                          {humanize(p.status)}
                        </Badge>
                        {canUpdate &&
                          p.method === "cod" &&
                          p.status === "pending" &&
                          o.status !== "cancelled" && (
                            <Button
                              variant="secondary"
                              disabled={busy}
                              onClick={() =>
                                capture.mutate(p.id, done("Cash collected"))
                              }
                            >
                              Collect
                            </Button>
                          )}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>

          <Modal
            open={cancelOpen}
            onClose={() => setCancelOpen(false)}
            title="Cancel this order?"
            description="Reserved stock is released. Any money already paid stays recorded and is flagged as due back."
            footer={
              <>
                <Button variant="ghost" onClick={() => setCancelOpen(false)}>
                  Keep order
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy || !reason.trim()}
                  onClick={() =>
                    cancel.mutate(
                      reason.trim(),
                      done("Order cancelled", () => {
                        setCancelOpen(false);
                        setReason("");
                      }),
                    )
                  }
                >
                  Cancel order
                </Button>
              </>
            }
          >
            <Field label="Reason" htmlFor="cancel_reason" required>
              <Textarea
                id="cancel_reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </Modal>

          <Modal
            open={payOpen}
            onClose={() => setPayOpen(false)}
            title="Record a payment"
            description={`${formatMoney(outstanding, cur)} outstanding.`}
            footer={
              <>
                <Button variant="ghost" onClick={() => setPayOpen(false)}>
                  Close
                </Button>
                <Button
                  disabled={
                    busy ||
                    toMinor(amount) === null ||
                    (toMinor(amount) ?? 0) === 0
                  }
                  onClick={() =>
                    recordPayment.mutate(
                      { method, amount_minor: toMinor(amount) ?? 0 },
                      done(
                        method === "cod"
                          ? "Cash on delivery recorded"
                          : "Payment recorded",
                        () => setPayOpen(false),
                      ),
                    )
                  }
                >
                  Save payment
                </Button>
              </>
            }
          >
            <Field label="Method" htmlFor="pay_method">
              <AnchoredSelect
                id="pay_method"
                value={method}
                onValueChange={setMethod}
                label="Method"
                options={[
                  "cash",
                  "card",
                  "upi",
                  "netbanking",
                  "cod",
                  "wallet",
                ].map((value) => ({ value, label: methodLabel(value) }))}
              />
            </Field>
            <Field
              label={`Amount (${cur})`}
              htmlFor="pay_amount"
              hint="Cannot exceed the amount outstanding."
            >
              <Input
                id="pay_amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
          </Modal>

          {returning && (
            <ReturnModal order={o} onClose={() => setReturning(false)} />
          )}

          <RecordActivity entityType="order" entityId={o.id} />
        </>
      )}
    </PortalShell>
  );
}

/** The order's PDF in a new tab: its GST tax invoice once delivered, the order confirmation before (the same file the customer gets on
 * WhatsApp). Downloads instead where the browser can't show PDFs. */
async function openOrderPdf(orderId: string, orderNumber: string) {
  const tab = window.open("", "_blank"); // opened before the request, so the popup isn't blocked
  const res = await erpBlob(`/api/v1/orders/${orderId}/pdf`);
  if (!res.data) {
    tab?.close();
    toast.error("Couldn't open the PDF", res.error ?? undefined);
    return;
  }
  const url = URL.createObjectURL(res.data);
  if (tab) tab.location.href = url;
  else {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${orderNumber}.pdf`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
