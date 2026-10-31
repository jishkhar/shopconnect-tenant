"use client";

import {
  Call02Icon,
  Calendar03Icon,
  Location01Icon,
  Mail01Icon,
  Message01Icon,
  Note01Icon,
  StarIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ChannelBadge,
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/erp/StatusBadges";
import {
  Avatar,
  ComposeModal,
  MessageList,
  SegmentBadge,
} from "@/components/crm/shared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { SkeletonLines } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import {
  TEXTAREA_CLASS,
  formatDate,
  type CrmMessage,
  type CrmNote,
  type CrmProfile,
} from "@/lib/crm";
import {
  erp,
  formatDateTime,
  formatMoney,
  useErpQuery,
  type Order,
  type StoreCredit,
} from "@/lib/erp";
import { toast } from "@/lib/toast";
import { formatPhone } from "@/lib/phone";

type Tab = "overview" | "orders" | "communication" | "notes";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "orders", label: "Purchase History" },
  { key: "communication", label: "Communication" },
  { key: "notes", label: "Notes" },
];

function Fact({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-space-2 text-[13.5px] text-ink-900">
      <span className="mt-0.5 text-ink-400">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

function Mini({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-line p-space-2">
      <span className="text-brand-600">{icon}</span>
      <p className="mt-1 text-[16px] font-bold text-ink-900">{value}</p>
      <p className="text-[11px] text-ink-600">{label}</p>
    </div>
  );
}

/** One customer, CRM style: contact facts, loyalty, tags, purchase history, messages and notes. Used in the side panel and the full page. */
export function CustomerProfile({
  customerId,
  currency,
  canEdit,
  canAdjustLoyalty = canEdit,
  onChanged,
  showOpenLink,
}: {
  customerId: string;
  currency: string;
  canEdit: boolean;
  canAdjustLoyalty?: boolean;
  onChanged?: () => void;
  showOpenLink?: boolean;
}) {
  const router = useRouter();
  const profile = useErpQuery<CrmProfile>(
    `/api/v1/crm/customers/${customerId}`,
  );
  const credit = useErpQuery<StoreCredit>(
    `/api/v1/customers/${customerId}/store-credit`,
  );
  const [tab, setTab] = useState<Tab>("overview");
  const orders = useErpQuery<Order[]>(
    tab === "orders"
      ? `/api/v1/orders?customer_id=${customerId}&limit=100`
      : null,
  );
  const messages = useErpQuery<CrmMessage[]>(
    tab === "communication"
      ? `/api/v1/crm/messages?customer_id=${customerId}`
      : null,
  );
  const notes = useErpQuery<CrmNote[]>(
    tab === "notes" ? `/api/v1/crm/customers/${customerId}/notes` : null,
  );
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tagText, setTagText] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    gstin: "",
    notes: "",
    status: "active",
    birthday: "",
    gender: "",
    preferences: "",
    optIn: false,
  });
  const [adjust, setAdjust] = useState({ delta: "", reason: "" });
  const [noteBody, setNoteBody] = useState("");
  const [followUp, setFollowUp] = useState("");

  const c = profile.data;
  if (profile.error)
    return (
      <p className="text-[13.5px] font-medium text-error">{profile.error}</p>
    );
  if (!c) return <SkeletonLines rows={4} />;

  const changed = () => {
    profile.reload();
    onChanged?.();
  };
  const defaultAddress =
    c.addresses.find((a) => a.is_default) ?? c.addresses[0];

  function openEdit() {
    if (!c) return;
    setForm({
      name: c.name,
      email: c.email ?? "",
      gstin: c.gstin ?? "",
      notes: c.notes ?? "",
      status: c.status,
      birthday: c.birthday ?? "",
      gender: c.gender ?? "",
      preferences: c.preferences ?? "",
      optIn: c.whatsapp_opt_in,
    });
    setEditing(true);
  }

  /** Block (or unblock) the customer: a blocked customer can't sign in to the website, order there or on WhatsApp, or get messages. */
  async function toggleBlock() {
    if (!c) return;
    setBusy(true);
    const blocked = c.status === "blocked";
    const res = await erp(`/api/v1/customers/${customerId}`, "PATCH", {
      status: blocked ? "active" : "blocked",
    });
    setBusy(false);
    setBlocking(false);
    if (res.error)
      return toast.error(
        blocked
          ? "Couldn't unblock the customer"
          : "Couldn't block the customer",
        res.error,
      );
    toast.success(blocked ? "Customer unblocked" : "Customer blocked");
    changed();
  }

  async function saveEdit() {
    setBusy(true);
    const a = await erp(`/api/v1/customers/${customerId}`, "PATCH", {
      name: form.name.trim(),
      email: form.email.trim(),
      gstin: form.gstin.trim(),
      notes: form.notes.trim(),
      status: form.status,
    });
    const b = a.error
      ? a
      : await erp(`/api/v1/crm/customers/${customerId}/profile`, "PATCH", {
          birthday: form.birthday || null,
          gender: form.gender || null,
          preferences: form.preferences.trim() || null,
          whatsapp_opt_in: form.optIn,
        });
    setBusy(false);
    if (b.error) return toast.error("Couldn't save the customer", b.error);
    toast.success("Customer updated");
    setEditing(false);
    changed();
  }

  async function changeTags(add: string[], remove: string[]) {
    const res = await erp("/api/v1/crm/tags", "POST", {
      customer_ids: [customerId],
      add,
      remove,
    });
    if (res.error) return toast.error("Couldn't change tags", res.error);
    setTagText("");
    changed();
  }

  async function saveAdjust() {
    const delta = Number.parseInt(adjust.delta, 10);
    if (!Number.isFinite(delta) || delta === 0)
      return toast.error(
        "Enter the points",
        "Use a positive number to add or a negative one to take away.",
      );
    setBusy(true);
    const res = await erp(
      `/api/v1/crm/customers/${customerId}/loyalty`,
      "POST",
      { delta, reason: adjust.reason.trim() },
    );
    setBusy(false);
    if (res.error) return toast.error("Couldn't adjust points", res.error);
    toast.success("Loyalty points updated");
    setAdjusting(false);
    setAdjust({ delta: "", reason: "" });
    changed();
  }

  async function addNote() {
    setBusy(true);
    const res = await erp(`/api/v1/crm/customers/${customerId}/notes`, "POST", {
      body: noteBody.trim(),
      follow_up_at: followUp ? new Date(followUp).toISOString() : null,
    });
    setBusy(false);
    if (res.error) return toast.error("Couldn't add the note", res.error);
    setNoteBody("");
    setFollowUp("");
    notes.reload();
    onChanged?.();
  }

  async function noteDone(n: CrmNote) {
    const res = await erp(`/api/v1/crm/notes/${n.id}`, "PATCH", {
      done: !n.done_at,
    });
    if (res.error) return toast.error("Couldn't update the note", res.error);
    notes.reload();
    onChanged?.();
  }

  async function removeNote(n: CrmNote) {
    const res = await erp(`/api/v1/crm/notes/${n.id}`, "DELETE");
    if (res.error) return toast.error("Couldn't delete the note", res.error);
    notes.reload();
    onChanged?.();
  }

  return (
    <div>
      <div className="mb-space-3 flex flex-wrap items-start gap-space-3">
        <Avatar name={c.name} size={48} />
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-space-2 text-[18px] font-bold text-ink-900">
            {c.name || "Unnamed customer"}
            <SegmentBadge segment={c.segment} />
            {c.status === "blocked" && <Badge tone="error">Blocked</Badge>}
          </h2>
          <p className="text-[12px] text-ink-400">
            Customer ID: {c.customer_code ?? "—"}
          </p>
        </div>
        <div className="mobile-page-actions flex gap-space-2">
          {showOpenLink && (
            <Button
              variant="ghost"
              onClick={() => router.push(`/portal/customers/${c.id}`)}
            >
              Open
            </Button>
          )}
          {canEdit && (
            <>
              <Button variant="ghost" onClick={() => setComposing(true)}>
                <HugeiconsIcon icon={Message01Icon} size={15} /> Message
              </Button>
              <Button variant="ghost" onClick={openEdit}>
                Edit
              </Button>
              <Button variant="ghost" onClick={() => setBlocking(true)}>
                {c.status === "blocked" ? "Unblock" : "Block"}
              </Button>
            </>
          )}
        </div>
      </div>
      {c.status === "blocked" && (
        <p className="mb-space-3 rounded-md bg-error-tint px-space-3 py-space-2 text-[13px] text-ink-900">
          This customer is blocked: they can&apos;t sign in to the website,
          place orders there or on WhatsApp, or receive messages and campaigns.
        </p>
      )}
      <ConfirmDialog
        open={blocking}
        title={
          c.status === "blocked"
            ? "Unblock this customer?"
            : "Block this customer?"
        }
        message={
          c.status === "blocked"
            ? `${c.name || "This customer"} will be able to sign in, order on the website and WhatsApp, and get messages again.`
            : `${c.name || "This customer"} won't be able to sign in to the website, place orders there or on WhatsApp, or receive messages and campaigns. Their order history stays.`
        }
        confirmLabel={c.status === "blocked" ? "Unblock" : "Block"}
        destructive={c.status !== "blocked"}
        busy={busy}
        onConfirm={toggleBlock}
        onCancel={() => setBlocking(false)}
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} className="!mb-space-3" />

      {tab === "overview" && (
        <div className="space-y-space-4">
          <ul className="space-y-space-2">
            <Fact icon={<HugeiconsIcon icon={Call02Icon} size={16} />}>
              {formatPhone(c.phone) || (
                <span className="text-ink-400">No phone</span>
              )}
            </Fact>
            <Fact icon={<HugeiconsIcon icon={Mail01Icon} size={16} />}>
              {c.email ?? <span className="text-ink-400">No email</span>}
            </Fact>
            <Fact icon={<HugeiconsIcon icon={Location01Icon} size={16} />}>
              {defaultAddress ? (
                [
                  defaultAddress.line1,
                  defaultAddress.line2,
                  defaultAddress.city,
                  defaultAddress.state,
                  defaultAddress.pincode,
                ]
                  .filter(Boolean)
                  .join(", ")
              ) : (
                <span className="text-ink-400">No saved address</span>
              )}
            </Fact>
            <Fact icon={<HugeiconsIcon icon={Calendar03Icon} size={16} />}>
              Joined {formatDate(c.created_at)} · Last purchase{" "}
              {formatDate(c.last_order_at)}
              {c.birthday && <> · Birthday {formatDate(c.birthday)}</>}
            </Fact>
          </ul>

          <div className="grid grid-cols-2 gap-space-2 sm:grid-cols-4">
            <Mini
              icon={<HugeiconsIcon icon={StarIcon} size={18} />}
              label="Loyalty points"
              value={c.loyalty.points.toLocaleString("en-IN")}
            />
            <Mini
              icon={<HugeiconsIcon icon={Wallet01Icon} size={18} />}
              label="Credit balance"
              value={formatMoney(credit.data?.balance_minor ?? 0, currency)}
            />
            <Mini
              icon={<HugeiconsIcon icon={Note01Icon} size={18} />}
              label="Total orders"
              value={c.total_orders}
            />
            <Mini
              icon={<HugeiconsIcon icon={Wallet01Icon} size={18} />}
              label="Total spent"
              value={formatMoney(c.total_spent_minor, currency)}
            />
          </div>
          {canAdjustLoyalty && c.membership_eligible && (
            <Button
              className="mobile-page-action"
              variant="ghost"
              onClick={() => setAdjusting(true)}
            >
              Adjust loyalty points
            </Button>
          )}
          {!c.membership_eligible && (
            <p className="text-[12px] text-ink-600">
              The customer must join membership from their storefront Profile
              before earning or redeeming loyalty points.
            </p>
          )}

          <div>
            <h3 className="mb-space-2 text-[13px] font-bold text-ink-900">
              Customer tags
            </h3>
            <div className="flex flex-wrap items-center gap-space-2">
              {c.tags.length === 0 && (
                <span className="text-[13px] text-ink-400">No tags yet.</span>
              )}
              {c.tags.map((t) => (
                <Badge key={t} tone="clay" className="normal-case">
                  {t}
                  {canEdit && (
                    <button
                      type="button"
                      aria-label={`Remove ${t}`}
                      className="ml-1 text-ink-600 hover:text-error"
                      onClick={() => changeTags([], [t])}
                    >
                      ×
                    </button>
                  )}
                </Badge>
              ))}
              {canEdit && (
                <form
                  className="flex items-center gap-space-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (tagText.trim()) changeTags([tagText], []);
                  }}
                >
                  <Input
                    value={tagText}
                    onChange={(e) => setTagText(e.target.value)}
                    placeholder="+ Add tag"
                    className="!h-8 w-32 text-[13px]"
                    aria-label="Add tag"
                  />
                </form>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-y-space-2 text-[13.5px]">
            <dt className="text-ink-600">Gender</dt>
            <dd className="col-span-2 capitalize">{c.gender ?? "—"}</dd>
            <dt className="text-ink-600">Preferences</dt>
            <dd className="col-span-2 whitespace-pre-wrap">
              {c.preferences ?? "—"}
            </dd>
            <dt className="text-ink-600">WhatsApp</dt>
            <dd className="col-span-2">
              {c.whatsapp_opt_in ? (
                <Badge tone="success">Opted in</Badge>
              ) : (
                "Not opted in"
              )}
            </dd>
            <dt className="text-ink-600">Internal note</dt>
            <dd className="col-span-2 whitespace-pre-wrap">{c.notes ?? "—"}</dd>
          </dl>

          {c.addresses.length > 1 && (
            <div>
              <h3 className="mb-space-2 text-[13px] font-bold text-ink-900">
                All addresses
              </h3>
              <div className="grid gap-space-2 md:grid-cols-2">
                {c.addresses.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-md border border-line p-space-2 text-[13px]"
                  >
                    <p className="font-semibold text-ink-900">
                      {a.label ?? "Address"}{" "}
                      {a.is_default && <Badge tone="brand">Default</Badge>}
                    </p>
                    <p className="text-ink-600">
                      {[a.line1, a.line2, a.city, a.state, a.pincode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "orders" && (
        <div>
          {orders.loading && <SkeletonLines rows={3} />}
          {!orders.loading && (orders.data ?? []).length === 0 && (
            <p className="text-[13px] text-ink-400">No orders yet.</p>
          )}
          <ul className="divide-y divide-line">
            {(orders.data ?? []).map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/portal/orders/${o.id}`)}
                  className="flex w-full flex-wrap items-center justify-between gap-space-2 py-space-2 text-left text-[13.5px] hover:bg-black/[0.02]"
                >
                  <span className="flex items-center gap-space-2">
                    <span className="font-semibold text-ink-900">
                      {o.order_number}
                    </span>
                    <ChannelBadge channel={o.channel} />
                  </span>
                  <span className="flex flex-wrap items-center gap-space-2">
                    <span className="text-ink-600">
                      {formatDateTime(o.placed_at)}
                    </span>
                    <span className="font-medium">
                      {formatMoney(o.total_minor, o.currency)}
                    </span>
                    <PaymentStatusBadge status={o.payment_status} />
                    <OrderStatusBadge status={o.status} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "communication" && (
        <div>
          {canEdit && (
            <Button
              className="mobile-page-action mb-space-3"
              onClick={() => setComposing(true)}
            >
              <HugeiconsIcon icon={Message01Icon} size={15} /> New message
            </Button>
          )}
          {messages.loading ? (
            <SkeletonLines rows={3} />
          ) : (
            <MessageList
              messages={messages.data ?? []}
              empty="No messages sent to this customer yet."
            />
          )}
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-space-3">
          {canEdit && (
            <Card className="space-y-space-2 p-space-3">
              <textarea
                rows={3}
                className={TEXTAREA_CLASS}
                placeholder="Write a note about this customer…"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                aria-label="Note"
              />
              <div className="flex flex-wrap items-center gap-space-2">
                <label
                  className="text-[12.5px] text-ink-600"
                  htmlFor="followup"
                >
                  Follow up on
                </label>
                <Input
                  id="followup"
                  type="datetime-local"
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  className="!h-9 w-auto"
                />
                <Button
                  className="mobile-page-action ml-auto"
                  disabled={busy || !noteBody.trim()}
                  onClick={addNote}
                >
                  Add note
                </Button>
              </div>
            </Card>
          )}
          {notes.loading && <SkeletonLines rows={2} />}
          {!notes.loading && (notes.data ?? []).length === 0 && (
            <p className="text-[13px] text-ink-400">No notes yet.</p>
          )}
          <ul className="space-y-space-2">
            {(notes.data ?? []).map((n) => (
              <li
                key={n.id}
                className="rounded-md border border-line p-space-3 text-[13.5px]"
              >
                <p
                  className={
                    n.done_at ? "text-ink-400 line-through" : "text-ink-900"
                  }
                >
                  {n.body}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-space-2 text-[12px] text-ink-400">
                  {n.author ?? "Staff"} · {formatDateTime(n.created_at)}
                  {n.follow_up_at && (
                    <Badge tone={n.done_at ? "neutral" : "warning"}>
                      Follow up {formatDateTime(n.follow_up_at)}
                    </Badge>
                  )}
                  {canEdit && (
                    <span className="mobile-page-actions ml-auto flex gap-space-3">
                      {n.follow_up_at && (
                        <button
                          type="button"
                          className="font-semibold text-brand-600 hover:underline"
                          onClick={() => noteDone(n)}
                        >
                          {n.done_at ? "Reopen" : "Mark done"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="font-semibold text-error hover:underline"
                        onClick={() => removeNote(n)}
                      >
                        Delete
                      </button>
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ComposeModal
        customer={composing ? c : null}
        onClose={() => setComposing(false)}
        onSent={() => {
          messages.reload();
          onChanged?.();
        }}
      />

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit customer"
        description="The phone number identifies the customer and can't be changed here."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !form.name.trim()} onClick={saveEdit}>
              Save changes
            </Button>
          </>
        }
      >
        <Field label="Name" htmlFor="e_name" required>
          <Input
            id="e_name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Email" htmlFor="e_email">
          <Input
            id="e_email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-space-3">
          <Field label="Birthday" htmlFor="e_bday">
            <Input
              id="e_bday"
              type="date"
              value={form.birthday}
              onChange={(e) => setForm({ ...form, birthday: e.target.value })}
            />
          </Field>
          <Field label="Gender" htmlFor="e_gender">
            <Select
              id="e_gender"
              value={form.gender}
              onValueChange={(value) => setForm({ ...form, gender: value })}
            >
              <option value="">Not specified</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </Select>
          </Field>
        </div>
        <Field label="GSTIN" htmlFor="e_gstin">
          <Input
            id="e_gstin"
            value={form.gstin}
            onChange={(e) => setForm({ ...form, gstin: e.target.value })}
          />
        </Field>
        <Field label="Preferences" htmlFor="e_pref">
          <textarea
            id="e_pref"
            rows={2}
            className={TEXTAREA_CLASS}
            value={form.preferences}
            onChange={(e) => setForm({ ...form, preferences: e.target.value })}
          />
        </Field>
        <Field label="Internal note" htmlFor="e_notes">
          <Input
            id="e_notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <Field label="Status" htmlFor="e_status">
          <Select
            id="e_status"
            value={form.status}
            onValueChange={(value) => setForm({ ...form, status: value })}
          >
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </Select>
        </Field>
        <label className="flex items-center gap-space-2 text-[14px]">
          <input
            type="checkbox"
            checked={form.optIn}
            onChange={(e) => setForm({ ...form, optIn: e.target.checked })}
          />
          Customer agreed to receive WhatsApp messages
        </label>
      </Modal>

      <Modal
        open={adjusting}
        onClose={() => setAdjusting(false)}
        title="Adjust loyalty points"
        description={`Current balance: ${c.loyalty.points} points.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdjusting(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !adjust.delta || !adjust.reason.trim()}
              onClick={saveAdjust}
            >
              Save
            </Button>
          </>
        }
      >
        <Field label="Points (negative to take away)" htmlFor="l_delta">
          <Input
            id="l_delta"
            inputMode="numeric"
            value={adjust.delta}
            onChange={(e) =>
              setAdjust({
                ...adjust,
                delta: e.target.value.replace(/[^\d-]/g, ""),
              })
            }
          />
        </Field>
        <Field label="Reason" htmlFor="l_reason" required>
          <Input
            id="l_reason"
            value={adjust.reason}
            onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })}
          />
        </Field>
      </Modal>
    </div>
  );
}
