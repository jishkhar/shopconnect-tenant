"use client";

import {
  Add01Icon,
  Calendar03Icon,
  CrownIcon,
  Globe02Icon,
  Mail01Icon,
  Megaphone01Icon,
  Message01Icon,
  PackageIcon,
  Store01Icon,
  Tag01Icon,
  UserIcon,
  Comment01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MessageList } from "@/components/crm/shared";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import {
  DateTimeField,
  isoToLocalInput,
  localInputToIso,
} from "@/components/ui/DateTimeField";
import { Field } from "@/components/ui/Field";
import { OptionCard, Section, generateCode } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import {
  SEGMENT_META,
  SEGMENT_ORDER,
  TEXTAREA_CLASS,
  formatDate,
  type Campaign,
  type CampaignAudience,
  type CampaignChannel,
  type CampaignObjective,
  type CampaignType,
  type CrmMessage,
  type Segment,
} from "@/lib/crm";
import {
  useWhatsAppTemplates,
  type WhatsAppTemplate,
} from "@/hooks/useWhatsApp";
import { discountOffer, discountSummary } from "@/lib/discountSummary";
import { erp, toMinor, useErpQuery, type Discount } from "@/lib/erp";
import type { SavedSegment } from "@/lib/rules";
import { hasGrant, useStaffSession } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

const MESSAGING: CampaignChannel[] = ["whatsapp", "email", "sms"];

const CHANNELS: { key: CampaignChannel; label: string; icon: ReactNode }[] = [
  { key: "whatsapp", label: "WhatsApp", icon: <WhatsAppIcon size={22} /> },
  {
    key: "email",
    label: "Email",
    icon: <HugeiconsIcon icon={Mail01Icon} size={22} />,
  },
  {
    key: "sms",
    label: "SMS",
    icon: <HugeiconsIcon icon={Message01Icon} size={22} />,
  },
  {
    key: "pos",
    label: "POS",
    icon: <HugeiconsIcon icon={Store01Icon} size={22} />,
  },
  {
    key: "website",
    label: "Website",
    icon: <HugeiconsIcon icon={Globe02Icon} size={22} />,
  },
];
const CHANNEL_LABEL = Object.fromEntries(
  CHANNELS.map((c) => [c.key, c.label]),
) as Record<CampaignChannel, string>;

const TYPES: {
  key: CampaignType;
  label: string;
  hint: string;
  icon: typeof Tag01Icon;
}[] = [
  {
    key: "discount",
    label: "Discount campaign",
    hint: "Promote a discount or offer",
    icon: Tag01Icon,
  },
  {
    key: "loyalty",
    label: "Loyalty campaign",
    hint: "Bonus points, rewards",
    icon: CrownIcon,
  },
  {
    key: "message",
    label: "Message campaign",
    hint: "Inform or engage customers",
    icon: Comment01Icon,
  },
  {
    key: "launch",
    label: "New product launch",
    hint: "Announce new arrivals",
    icon: PackageIcon,
  },
  {
    key: "event",
    label: "Event campaign",
    hint: "Special event or sale",
    icon: Calendar03Icon,
  },
];

const OBJECTIVES: [CampaignObjective, string][] = [
  ["sales", "Increase sales"],
  ["retention", "Customer retention"],
  ["loyalty", "Loyalty & rewards"],
  ["launch", "Promote a new product"],
  ["reactivation", "Win back inactive customers"],
  ["awareness", "Brand awareness"],
];

const TOKENS = [
  "{{name}}",
  "{{code}}",
  "{{discount}}",
  "{{expiry_date}}",
  "{{store_name}}",
];

type Form = {
  name: string;
  objective: CampaignObjective;
  description: string;
  type: CampaignType;
  /** Set when an older campaign goes to one chosen customer: the filters below don't apply to it. */
  customerId: string;
  segment: string;
  segmentId: string;
  tag: string;
  customerType: string;
  onlyNew: boolean;
  city: string;
  purchase: string;
  gender: string;
  since: string;
  discountMode: "existing" | "new";
  discountId: string;
  newName: string;
  newCode: string;
  newKind: "percent" | "flat";
  newValue: string;
  newMinOrder: string;
  channels: CampaignChannel[];
  message: string;
  /** WhatsApp: the approved template, as "name|language", and one value per {{n}}. */
  template: string;
  params: string[];
  startsAt: string;
  endsAt: string;
};
const EMPTY: Form = {
  name: "",
  objective: "sales",
  description: "",
  type: "discount",
  customerId: "",
  segment: "",
  segmentId: "",
  tag: "",
  customerType: "",
  onlyNew: false,
  city: "",
  purchase: "",
  gender: "",
  since: "",
  discountMode: "existing",
  discountId: "",
  newName: "",
  newCode: "",
  newKind: "percent",
  newValue: "",
  newMinOrder: "",
  channels: ["whatsapp", "email"],
  message: "Hi {{name}}, ",
  template: "",
  params: [],
  startsAt: "",
  endsAt: "",
};

const templateKey = (t: { name: string; language?: string | null }) =>
  `${t.name}|${t.language ?? ""}`;

/** The template's body with the values typed so far in place of {{1}}, {{2}} … (tokens like {{name}} left as they are). */
function fillPreview(body: string, params: string[]) {
  return body.replace(
    /\{\{\s*(\d+)\s*\}\}/g,
    (whole, n) => params[Number(n) - 1] || whole,
  );
}

const audienceOf = (f: Form): CampaignAudience =>
  f.customerId
    ? { customer_id: f.customerId }
    : {
        ...(f.segment ? { segment: f.segment as Segment } : {}),
        ...(f.segmentId ? { segment_id: f.segmentId } : {}),
        ...(f.tag ? { tag: f.tag } : {}),
        ...(f.customerType
          ? { customer_type: f.customerType as "individual" | "business" }
          : {}),
        ...(f.onlyNew ? { only_new: true } : {}),
        ...(f.city ? { city: f.city } : {}),
        ...(f.purchase
          ? {
              purchase: f.purchase as NonNullable<CampaignAudience["purchase"]>,
            }
          : {}),
        ...(f.gender
          ? { gender: f.gender as NonNullable<CampaignAudience["gender"]> }
          : {}),
        ...(f.since
          ? { since: f.since as NonNullable<CampaignAudience["since"]> }
          : {}),
      };

function audienceLabel(a: Campaign["audience"]) {
  if (a.customer_id) return "Individual customer";
  const parts = [
    a.segment ? SEGMENT_META[a.segment].label : null,
    a.segment_id ? "saved segment" : null,
    a.tag ? `tag: ${a.tag}` : null,
    a.customer_type ? `${a.customer_type} customers` : null,
    a.city ?? null,
  ].filter(Boolean);
  return parts.length ? parts.join(" + ") : "All customers";
}

const shortDate = (v: string) =>
  new Date(v).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function CampaignsTab({
  canEdit,
  onChanged,
}: {
  canEdit: boolean;
  onChanged: () => void;
}) {
  const campaigns = useErpQuery<Campaign[]>("/api/v1/crm/campaigns");
  // Sending reaches real customers: its own permission (drafting needs customers write).
  const canSend = hasGrant(useStaffSession(), "customers:send_campaigns");
  const tags =
    useErpQuery<{ tag: string; customers: number }[]>("/api/v1/crm/tags");
  const discounts = useErpQuery<Discount[]>("/api/v1/discounts");
  const savedSegments = useErpQuery<SavedSegment[]>(
    "/api/v1/crm/customer-segments",
  );
  const options = useErpQuery<{ cities: string[] }>(
    "/api/v1/crm/audience-options",
  );
  const [editing, setEditing] = useState<Campaign | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState<Campaign | null>(null);
  const [viewing, setViewing] = useState<Campaign | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [activeParam, setActiveParam] = useState(0);
  const log = useErpQuery<CrmMessage[]>(
    viewing ? `/api/v1/crm/messages?campaign_id=${viewing.id}` : null,
  );
  const [audience, setAudience] = useState<{
    total: number;
    reachable: number;
  } | null>(null);
  const templates = useWhatsAppTemplates();
  const usable = (templates.data ?? []).filter((t) => t.usable);
  const chosen: WhatsAppTemplate | undefined = usable.find(
    (t) => templateKey(t) === form.template,
  );
  const whatsapp = form.channels.includes("whatsapp");
  const primary: CampaignChannel =
    form.channels.find((c) => MESSAGING.includes(c)) ?? "whatsapp";
  const { refetch: loadTemplates } = templates;

  // Meta's templates are read when a WhatsApp campaign is being written (not on every page view)
  useEffect(() => {
    if (editing !== null && whatsapp) loadTemplates();
  }, [editing, whatsapp, loadTemplates]);

  // a campaign that is going out: refresh until it's done, so the counts move on their own
  const { reload: reloadCampaigns } = campaigns;
  const anySending = (campaigns.data ?? []).some((k) => k.status === "sending");
  useEffect(() => {
    if (!anySending) return;
    const timer = setInterval(reloadCampaigns, 5000);
    return () => clearInterval(timer);
  }, [anySending, reloadCampaigns]);

  // the estimated audience follows the filters
  const audienceKey = JSON.stringify([audienceOf(form), primary]);
  useEffect(() => {
    if (editing === null) return;
    let cancelled = false;
    erp<{ total: number; reachable: number }>(
      "/api/v1/crm/audience-preview",
      "POST",
      { channel: primary, audience: JSON.parse(audienceKey)[0] },
    ).then((r) => {
      if (!cancelled) setAudience(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [editing, audienceKey, primary]);

  function openNew() {
    setForm(EMPTY);
    setAudience(null);
    setEditing("new");
  }
  function openEdit(k: Campaign) {
    const a = k.audience;
    setForm({
      ...EMPTY,
      name: k.name,
      objective: k.objective,
      description: k.description ?? "",
      type: k.campaign_type,
      customerId: a.customer_id ?? "",
      segment: a.segment ?? "",
      segmentId: a.segment_id ?? "",
      tag: a.tag ?? "",
      customerType: a.customer_type ?? "",
      onlyNew: a.only_new ?? false,
      city: a.city ?? "",
      purchase: a.purchase ?? "",
      gender: a.gender ?? "",
      since: a.since ?? "",
      discountId: k.discount_id ?? "",
      channels: k.channels?.length ? k.channels : [k.channel],
      message: k.message,
      template: k.whatsapp_template
        ? templateKey({
            name: k.whatsapp_template,
            language: k.template_language,
          })
        : "",
      params: k.template_params ?? [],
      startsAt: isoToLocalInput(k.starts_at),
      endsAt: isoToLocalInput(k.ends_at),
    });
    setAudience(null);
    setEditing(k);
  }

  const withCode = (discounts.data ?? []).filter((d) => d.code && d.is_active);
  const picked = withCode.find((d) => d.id === form.discountId);
  const discountRequired = form.type === "discount";
  const text =
    whatsapp && chosen
      ? fillPreview(chosen.body ?? "", form.params)
      : form.message;
  const variables = chosen?.variables ?? 0;

  /** The campaign saved as a draft (the discount made first when "create a new discount" is chosen); null when something is missing. */
  async function persist(): Promise<Campaign | null> {
    const fail = (title: string, detail?: string) => {
      toast.error(title, detail);
      return null;
    };
    if (!form.channels.some((c) => MESSAGING.includes(c)))
      return fail(
        "Pick a channel that sends messages",
        "Choose WhatsApp, Email or SMS. POS and Website only show the offer.",
      );
    if (
      whatsapp &&
      (!chosen ||
        form.params.slice(0, variables).filter((v) => v.trim()).length !==
          variables)
    )
      return fail(
        "Choose a WhatsApp template",
        "Pick an approved template and fill in every value.",
      );
    if (!text.trim()) return fail("Write the message");
    if (form.startsAt && form.endsAt && form.endsAt <= form.startsAt)
      return fail("Check the schedule", "The end must be after the start.");
    if (
      discountRequired &&
      form.discountMode === "existing" &&
      !form.discountId
    )
      return fail("Select a discount");

    setBusy(true);
    let discountId = form.discountMode === "existing" ? form.discountId : "";
    if (form.discountMode === "new") {
      const percent = form.newKind === "percent";
      const value = percent ? Number(form.newValue) : toMinor(form.newValue);
      if (!(value && value > 0 && (!percent || value <= 100))) {
        setBusy(false);
        return fail(
          "Check the discount value",
          percent
            ? "A percentage must be between 0 and 100."
            : "Enter an amount above zero.",
        );
      }
      const made = await erp<Discount>("/api/v1/discounts", "POST", {
        name: form.newName.trim() || form.name.trim(),
        code: form.newCode.trim() || generateCode(),
        kind: form.newKind,
        value,
        min_order_minor: form.newMinOrder.trim()
          ? (toMinor(form.newMinOrder) ?? 0)
          : 0,
        starts_at: localInputToIso(form.startsAt),
        ends_at: localInputToIso(form.endsAt),
      });
      if (made.error || !made.data) {
        setBusy(false);
        return fail("Couldn't create the discount", made.error ?? undefined);
      }
      discountId = made.data.id;
      // saved: from here on it's an existing discount, so a retry doesn't make a second one
      setForm((f) => ({ ...f, discountMode: "existing", discountId }));
      discounts.reload();
    }
    const body = {
      name: form.name.trim(),
      channel: primary,
      channels: form.channels,
      description: form.description.trim() || null,
      objective: form.objective,
      campaign_type: form.type,
      audience: audienceOf(form),
      subject: null,
      message: text.trim(),
      discount_id: discountId || null,
      starts_at: localInputToIso(form.startsAt),
      ends_at: localInputToIso(form.endsAt),
      ...(whatsapp && chosen
        ? {
            whatsapp_template: chosen.name,
            template_language: chosen.language ?? null,
            template_params: form.params.slice(0, variables),
          }
        : {}),
    };
    const res =
      editing === "new"
        ? await erp<Campaign>("/api/v1/crm/campaigns", "POST", body)
        : await erp<Campaign>(
            `/api/v1/crm/campaigns/${(editing as Campaign).id}`,
            "PUT",
            body,
          );
    setBusy(false);
    if (res.error || !res.data)
      return fail("Couldn't save the campaign", res.error ?? undefined);
    campaigns.reload();
    return res.data;
  }

  async function saveDraft() {
    const k = await persist();
    if (!k) return;
    toast.success("Draft saved");
    setEditing(null);
  }
  /** Saves, then asks for the final go-ahead before anything is sent. */
  async function launch() {
    const k = await persist();
    if (!k) return;
    setEditing(null);
    setSending(k);
  }

  const insertToken = (token: string) => {
    if (chosen) {
      if (!variables) return;
      const i = Math.min(activeParam, variables - 1);
      const params = [...form.params];
      params[i] = `${params[i] ?? ""}${token}`;
      setForm({ ...form, params });
    } else setForm({ ...form, message: `${form.message}${token}` });
  };
  const sample = (t: string) =>
    t
      .replaceAll("{{name}}", "Priya")
      .replaceAll("{{code}}", picked?.code ?? "CODE")
      .replaceAll("{{discount}}", picked ? discountOffer(picked) : "your offer")
      .replaceAll(
        "{{expiry_date}}",
        form.endsAt ? shortDate(form.endsAt) : "the end date",
      )
      .replaceAll("{{store_name}}", "our store");

  async function send() {
    if (!sending) return;
    setBusy(true);
    const res = await erp<Campaign>(
      `/api/v1/crm/campaigns/${sending.id}/send`,
      "POST",
    );
    setBusy(false);
    setSending(null);
    if (res.error) return toast.error("Couldn't send the campaign", res.error);
    const k = res.data!;
    if (k.status === "sending")
      toast.success(
        `Sending to ${k.recipient_count} customers`,
        "The messages go out over the next minute. Delivered and read counts update here.",
      );
    else if (k.delivered_count === k.recipient_count)
      toast.success(`Sent to ${k.delivered_count} customers`);
    else
      toast.info(
        `${k.recipient_count} messages recorded`,
        `${k.delivered_count} delivered. The rest were saved but not delivered — see Messages for the reason.`,
      );
    campaigns.reload();
    onChanged();
  }

  async function remove() {
    if (!deleting) return;
    const res = await erp(`/api/v1/crm/campaigns/${deleting.id}`, "DELETE");
    setDeleting(null);
    if (res.error) return toast.error("Couldn't delete", res.error);
    toast.success("Campaign deleted");
    campaigns.reload();
  }

  const columns = useMemo<ColumnDef<Campaign, unknown>[]>(
    () => [
      {
        header: "Campaign",
        cell: ({ row }) => (
          <span className="font-semibold text-ink-900">
            {row.original.name}
          </span>
        ),
      },
      {
        header: "Channel",
        cell: ({ row }) =>
          (row.original.channels?.length
            ? row.original.channels
            : [row.original.channel]
          )
            .map((c) => CHANNEL_LABEL[c])
            .join(", "),
      },
      {
        header: "Audience",
        cell: ({ row }) => (
          <span className="text-ink-600">
            {audienceLabel(row.original.audience)}
          </span>
        ),
      },
      {
        header: "Offer",
        cell: ({ row }) =>
          row.original.discount_code ?? <span className="text-ink-400">—</span>,
      },
      {
        header: "Status",
        cell: ({ row }) => (
          <Badge
            tone={
              row.original.status === "sent"
                ? "success"
                : row.original.status === "sending"
                  ? "warning"
                  : "neutral"
            }
          >
            {row.original.status === "sending"
              ? "Sending…"
              : row.original.status}
          </Badge>
        ),
      },
      {
        header: "Reach",
        cell: ({ row }) => {
          const k = row.original;
          if (k.status === "draft")
            return <span className="text-ink-400">—</span>;
          if (k.channel !== "whatsapp")
            return `${k.delivered_count} / ${k.recipient_count} delivered`;
          return (
            <span className="text-ink-600">
              {k.delivered_n} delivered · {k.read_n} read
              {k.failed_n ? ` · ${k.failed_n} failed` : ""}
              <span className="text-ink-400"> of {k.recipient_count}</span>
            </span>
          );
        },
      },
      {
        header: "Sent",
        cell: ({ row }) => (
          <span className="text-ink-600">
            {formatDate(row.original.sent_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const k = row.original;
          return (
            <span className="flex justify-end gap-space-1">
              {k.status !== "draft" && (
                <Button variant="ghost" onClick={() => setViewing(k)}>
                  Messages
                </Button>
              )}
              {canEdit && k.status === "draft" && (
                <>
                  <Button variant="ghost" onClick={() => openEdit(k)}>
                    Edit
                  </Button>
                  {canSend && (
                    <Button onClick={() => setSending(k)}>Send</Button>
                  )}
                  <Button variant="ghost" onClick={() => setDeleting(k)}>
                    Delete
                  </Button>
                </>
              )}
            </span>
          );
        },
      },
    ],
    [canEdit, canSend],
  );

  return (
    <div>
      <div className="mb-space-3 flex flex-col items-stretch justify-between gap-space-3 md:flex-row md:items-center">
        <p className="min-w-0 text-[13px] text-ink-600">
          Send an offer or announcement to a group of customers, optionally with
          one of your discount codes.
        </p>
        {canEdit && (
          <Button
            onClick={openNew}
            className="mobile-page-action shrink-0 self-end whitespace-nowrap md:self-auto"
          >
            <HugeiconsIcon icon={Add01Icon} size={16} className="shrink-0" />{" "}
            New campaign
          </Button>
        )}
      </div>
      {campaigns.error && (
        <p className="mb-space-3 text-[13px] font-medium text-error">
          {campaigns.error}
        </p>
      )}
      <Card className="p-space-2">
        <div className="whitespace-nowrap">
          <DataTable
            columns={columns}
            data={campaigns.data ?? []}
            getRowId={(k) => k.id}
            loading={campaigns.loading}
            emptyMessage={
              campaigns.loading ? "Loading campaigns…" : "No campaigns yet."
            }
          />
        </div>
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New Campaign" : "Edit Campaign"}
        description="Create a marketing campaign and use an existing discount or create a new one."
        width="xl"
        compact
        bannerIcon={<HugeiconsIcon icon={Megaphone01Icon} size={20} />}
        bodyClassName="bg-paper"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="ghost"
              disabled={busy || !form.name.trim()}
              onClick={saveDraft}
            >
              Save as draft
            </Button>
            <Button
              disabled={busy || !form.name.trim() || !canSend}
              title={
                canSend
                  ? undefined
                  : "Your role can save drafts but not send campaigns."
              }
              onClick={launch}
            >
              Launch campaign
            </Button>
          </>
        }
      >
        <div className="form-compact space-y-space-2">
          <Section n={1} title="Campaign Details">
            <div className="grid gap-space-2 md:grid-cols-2">
              <Field label="Campaign name" htmlFor="k_name" required>
                <Input
                  id="k_name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Objective" htmlFor="k_objective" required>
                <Select
                  id="k_objective"
                  value={form.objective}
                  onValueChange={(v) =>
                    setForm({ ...form, objective: v as CampaignObjective })
                  }
                >
                  {OBJECTIVES.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Description (optional)" htmlFor="k_desc">
              <textarea
                id="k_desc"
                rows={2}
                maxLength={500}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="w-full resize-y rounded-md border border-line bg-card px-space-3 py-2 text-[13px] leading-5 text-ink-900 shadow-[var(--shadow-sm)] focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </Field>
          </Section>

          <Section n={2} title="Campaign Type">
            <div className="grid grid-cols-2 gap-space-2 md:grid-cols-5">
              {TYPES.map((t) => (
                <OptionCard
                  key={t.key}
                  tile
                  selected={form.type === t.key}
                  onSelect={() => setForm({ ...form, type: t.key })}
                  title={t.label}
                  hint={t.hint}
                  icon={<HugeiconsIcon icon={t.icon} size={24} />}
                />
              ))}
            </div>
          </Section>

          <Section n={3} title="Audience">
            {form.customerId ? (
              <p className="text-[13px] text-ink-600">
                This campaign goes to one chosen customer.{" "}
                <button
                  type="button"
                  className="font-semibold text-brand-700 underline"
                  onClick={() => setForm({ ...form, customerId: "" })}
                >
                  Use audience filters instead
                </button>
              </p>
            ) : (
              <>
                <div className="grid gap-space-2 md:grid-cols-3">
                  <Field label="Membership" htmlFor="k_seg">
                    <Select
                      id="k_seg"
                      value={form.segment}
                      onValueChange={(v) => setForm({ ...form, segment: v })}
                    >
                      <option value="">Everyone</option>
                      {SEGMENT_ORDER.map((s: Segment) => (
                        <option key={s} value={s}>
                          {SEGMENT_META[s].label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Saved segment" htmlFor="k_saved">
                    <Select
                      id="k_saved"
                      value={form.segmentId}
                      onValueChange={(v) => setForm({ ...form, segmentId: v })}
                    >
                      <option value="">None</option>
                      {(savedSegments.data ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.member_count.toLocaleString("en-IN")})
                        </option>
                      ))}
                    </Select>
                    <Link
                      href="/portal/customers/segments"
                      className="mt-space-1 inline-block text-[12.5px] font-semibold text-brand-700"
                    >
                      + New segment
                    </Link>
                  </Field>
                  <Field label="Customer tag" htmlFor="k_tag">
                    <Select
                      id="k_tag"
                      value={form.tag}
                      onValueChange={(v) => setForm({ ...form, tag: v })}
                    >
                      <option value="">Any</option>
                      {(tags.data ?? []).map((t) => (
                        <option key={t.tag} value={t.tag}>
                          {t.tag}
                        </option>
                      ))}
                    </Select>
                    <Link
                      href="/portal/customers/tags"
                      className="mt-space-1 inline-block text-[12.5px] font-semibold text-brand-700"
                    >
                      + Add new tag
                    </Link>
                  </Field>
                  <div>
                    <Field label="Customer type" htmlFor="k_type">
                      <Select
                        id="k_type"
                        value={form.customerType}
                        onValueChange={(v) =>
                          setForm({ ...form, customerType: v })
                        }
                      >
                        <option value="">All customers</option>
                        <option value="individual">Individuals</option>
                        <option value="business">Business accounts</option>
                      </Select>
                    </Field>
                    <label className="flex items-center gap-space-2 text-[13px]">
                      <input
                        type="checkbox"
                        checked={form.onlyNew}
                        onChange={(e) =>
                          setForm({ ...form, onlyNew: e.target.checked })
                        }
                      />
                      Only new customers
                    </label>
                  </div>
                </div>
                <p className="mt-space-2 mb-space-1 text-[13px] font-semibold text-ink-900">
                  Additional filters{" "}
                  <span className="font-normal text-ink-600">(optional)</span>
                </p>
                <div className="grid gap-space-2 md:grid-cols-4">
                  <Field label="City / Location" htmlFor="k_city">
                    <Select
                      id="k_city"
                      value={form.city}
                      onValueChange={(v) => setForm({ ...form, city: v })}
                    >
                      <option value="">All locations</option>
                      {(options.data?.cities ?? []).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Purchase behaviour" htmlFor="k_purchase">
                    <Select
                      id="k_purchase"
                      value={form.purchase}
                      onValueChange={(v) => setForm({ ...form, purchase: v })}
                    >
                      <option value="">Any</option>
                      <option value="bought">Has bought before</option>
                      <option value="never">Never bought</option>
                      <option value="repeat">Repeat buyers (2+ orders)</option>
                      <option value="recent">Ordered in last 90 days</option>
                    </Select>
                  </Field>
                  <Field label="Gender" htmlFor="k_gender">
                    <Select
                      id="k_gender"
                      value={form.gender}
                      onValueChange={(v) => setForm({ ...form, gender: v })}
                    >
                      <option value="">All</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </Select>
                  </Field>
                  <Field label="Customer since" htmlFor="k_since">
                    <Select
                      id="k_since"
                      value={form.since}
                      onValueChange={(v) => setForm({ ...form, since: v })}
                    >
                      <option value="">Anytime</option>
                      <option value="30d">Last 30 days</option>
                      <option value="90d">Last 90 days</option>
                      <option value="1y">Last year</option>
                    </Select>
                  </Field>
                </div>
              </>
            )}
            <div className="mt-space-1 flex items-center gap-space-2 rounded-md bg-brand-50 px-space-3 py-space-2 text-[13px] text-ink-900">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-800 text-white">
                <HugeiconsIcon icon={UserIcon} size={14} />
              </span>
              <span>
                <b>
                  Estimated audience:{" "}
                  {audience ? audience.total.toLocaleString("en-IN") : "…"}{" "}
                  customers
                </b>{" "}
                (based on current filters)
                {audience && (
                  <span className="text-ink-600">
                    {" "}
                    · {audience.reachable.toLocaleString("en-IN")} reachable on{" "}
                    {CHANNEL_LABEL[primary]}
                  </span>
                )}
              </span>
            </div>
          </Section>

          <Section n={4} title="Offer / Discount">
            <div className="grid gap-space-2 md:grid-cols-2">
              <OptionCard
                selected={form.discountMode === "existing"}
                onSelect={() => setForm({ ...form, discountMode: "existing" })}
                title="Use existing discount"
                hint="Select a discount from available offers"
              />
              <OptionCard
                selected={form.discountMode === "new"}
                onSelect={() => setForm({ ...form, discountMode: "new" })}
                title="Create a new discount"
                hint="Create a new discount for this campaign"
              />
            </div>
            {form.discountMode === "existing" ? (
              <>
                <div className="mt-space-2 flex items-end gap-space-2">
                  <div className="min-w-0 flex-1">
                    <Field
                      label="Select discount"
                      htmlFor="k_disc"
                      required={discountRequired}
                      className="mb-0"
                    >
                      <Select
                        id="k_disc"
                        value={form.discountId}
                        onValueChange={(v) =>
                          setForm({ ...form, discountId: v })
                        }
                      >
                        <option value="">
                          {discountRequired
                            ? "Choose a discount"
                            : "No discount"}
                        </option>
                        {withCode.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code}) - {discountOffer(d)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <Link
                    href="/portal/discounts"
                    target="_blank"
                    className="inline-flex h-9 shrink-0 items-center rounded-md border border-line bg-card px-space-4 text-[13px] font-semibold text-ink-900 hover:bg-ink-50"
                  >
                    View details
                  </Link>
                </div>
                {picked && (
                  <div className="mt-space-2 flex items-start gap-space-3 rounded-md border border-brand-200 bg-brand-50 p-space-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-800 text-white">
                      <HugeiconsIcon icon={Tag01Icon} size={18} />
                    </span>
                    <div className="min-w-0 text-[13px] text-ink-600">
                      <p className="text-[14px] font-bold text-ink-900">
                        Discount summary
                      </p>
                      <p>{discountSummary(picked)}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-space-2 grid gap-space-2 md:grid-cols-5">
                <Field
                  label="Discount name"
                  htmlFor="k_nd_name"
                  className="md:col-span-2"
                >
                  <Input
                    id="k_nd_name"
                    placeholder={form.name || "Defaults to the campaign name"}
                    value={form.newName}
                    onChange={(e) =>
                      setForm({ ...form, newName: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Coupon code"
                  htmlFor="k_nd_code"
                  className="md:col-span-2"
                >
                  <div className="flex gap-space-2">
                    <Input
                      id="k_nd_code"
                      className="uppercase"
                      value={form.newCode}
                      onChange={(e) =>
                        setForm({ ...form, newCode: e.target.value })
                      }
                    />
                    <Button
                      variant="ghost"
                      type="button"
                      className="shrink-0 border border-line"
                      onClick={() =>
                        setForm({ ...form, newCode: generateCode() })
                      }
                    >
                      Generate
                    </Button>
                  </div>
                </Field>
                <Field label="Type" htmlFor="k_nd_kind">
                  <Select
                    id="k_nd_kind"
                    value={form.newKind}
                    onValueChange={(v) =>
                      setForm({ ...form, newKind: v as "percent" | "flat" })
                    }
                  >
                    <option value="percent">Percentage off</option>
                    <option value="flat">Flat amount off</option>
                  </Select>
                </Field>
                <Field
                  label={
                    form.newKind === "percent" ? "Percentage (%)" : "Amount (₹)"
                  }
                  htmlFor="k_nd_value"
                  required
                >
                  <Input
                    id="k_nd_value"
                    inputMode="decimal"
                    value={form.newValue}
                    onChange={(e) =>
                      setForm({ ...form, newValue: e.target.value })
                    }
                  />
                </Field>
                <Field label="Minimum order (₹)" htmlFor="k_nd_min">
                  <Input
                    id="k_nd_min"
                    inputMode="decimal"
                    value={form.newMinOrder}
                    onChange={(e) =>
                      setForm({ ...form, newMinOrder: e.target.value })
                    }
                  />
                </Field>
                <p className="text-[12px] text-ink-600 md:col-span-3 md:self-end md:pb-space-2">
                  Valid for the campaign&apos;s schedule below. Fine-tune it
                  later on the Discounts page.
                </p>
              </div>
            )}
          </Section>

          <Section n={5} title="Channels & Message">
            <div className="flex flex-wrap items-center justify-between gap-x-space-4 gap-y-space-2 rounded-md border border-line px-space-3 py-space-2">
              {CHANNELS.map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-space-2 text-[13px]"
                >
                  <input
                    type="checkbox"
                    checked={form.channels.includes(c.key)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        channels: e.target.checked
                          ? [...form.channels, c.key]
                          : form.channels.filter((x) => x !== c.key),
                      })
                    }
                  />
                  <span className="text-ink-900">{c.icon}</span>
                  {c.label}
                </label>
              ))}
            </div>
            <div className="mt-space-2 grid gap-space-3 md:grid-cols-[3fr_2fr]">
              <div>
                {whatsapp ? (
                  <>
                    <div className="flex items-end gap-space-2">
                      <div className="min-w-0 flex-1">
                        <Field
                          label="Message template"
                          htmlFor="k_template"
                          required
                          className="mb-0"
                        >
                          <Select
                            id="k_template"
                            value={form.template}
                            onValueChange={(v) =>
                              setForm({ ...form, template: v, params: [] })
                            }
                          >
                            <option value="">
                              {templates.isFetching
                                ? "Loading templates…"
                                : "Choose a template"}
                            </option>
                            {usable.map((t) => (
                              <option
                                key={templateKey(t)}
                                value={templateKey(t)}
                              >
                                {t.name} ({t.language})
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                      <Button
                        variant="ghost"
                        type="button"
                        className="shrink-0 border border-line"
                        onClick={() => setShowPreview(!showPreview)}
                      >
                        Preview
                      </Button>
                    </div>
                    {templates.error && (
                      <p className="mt-space-1 text-[12.5px] text-error">
                        Couldn&apos;t read your WhatsApp templates.{" "}
                        <Link
                          href="/portal/settings/channels/whatsapp"
                          className="underline"
                        >
                          Check the WhatsApp connection
                        </Link>
                        .
                      </p>
                    )}
                    {!templates.isFetching &&
                      templates.data &&
                      usable.length === 0 && (
                        <p className="mt-space-1 text-[12.5px] text-ink-600">
                          No approved marketing or utility templates yet. Create
                          one in Meta&apos;s WhatsApp Manager; once Meta
                          approves it, it appears here.
                        </p>
                      )}
                    {chosen && variables > 0 && (
                      <div className="mt-space-2 grid gap-space-2 md:grid-cols-2">
                        {Array.from({ length: variables }, (_, i) => (
                          <Field
                            key={i}
                            label={`Value for {{${i + 1}}}`}
                            htmlFor={`k_param_${i}`}
                            required
                            className="mb-0"
                          >
                            <Input
                              id={`k_param_${i}`}
                              value={form.params[i] ?? ""}
                              placeholder={
                                i === 0 ? "{{name}}" : "e.g. {{code}} or text"
                              }
                              onFocus={() => setActiveParam(i)}
                              onChange={(e) => {
                                const params = [...form.params];
                                params[i] = e.target.value;
                                setForm({ ...form, params });
                              }}
                            />
                          </Field>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Field label="Message" htmlFor="k_msg" required>
                    <textarea
                      id="k_msg"
                      rows={3}
                      className={TEXTAREA_CLASS}
                      value={form.message}
                      onChange={(e) =>
                        setForm({ ...form, message: e.target.value })
                      }
                    />
                  </Field>
                )}
                {showPreview && (
                  <div className="mt-space-2 rounded-md bg-ink-50 px-space-3 py-space-2 text-[13px] text-ink-900">
                    <p className="mb-space-1 font-semibold">
                      Preview message ({CHANNEL_LABEL[primary]})
                    </p>
                    <p className="whitespace-pre-wrap">
                      {text.trim() ? sample(text) : "Nothing to preview yet."}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <p className="mb-space-1 text-[13px] font-semibold text-ink-900">
                  Personalization
                </p>
                <div className="flex flex-wrap gap-space-2">
                  {TOKENS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => insertToken(t)}
                      className="rounded-md border border-info/30 bg-info-tint px-space-3 py-1 text-[13px] text-info hover:brightness-95"
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <p className="mt-space-2 text-[12px] text-ink-600">
                  Click a tag to add it to the message
                  {chosen ? " value you are editing" : ""}. Each customer sees
                  their own details.
                </p>
              </div>
            </div>
          </Section>

          <Section n={6} title="Schedule & Budget" aside>
            <div className="grid flex-1 gap-space-2 md:grid-cols-2">
              <DateTimeField
                id="k_start"
                label="Start date & time"
                value={form.startsAt}
                onChange={(v) => setForm({ ...form, startsAt: v })}
                defaultTime="10:00"
              />
              <DateTimeField
                id="k_end"
                label="End date & time"
                value={form.endsAt}
                onChange={(v) => setForm({ ...form, endsAt: v })}
                defaultTime="23:59"
              />
            </div>
          </Section>

          <Section n={7} title="Review & Launch" aside>
            <div className="flex flex-1 items-start gap-space-3 rounded-md border border-brand-200 bg-brand-50 p-space-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-800 text-white">
                <HugeiconsIcon icon={Megaphone01Icon} size={18} />
              </span>
              <div className="min-w-0 text-[13px] text-ink-600">
                <p className="text-[14px] font-bold text-ink-900">
                  {form.name.trim() || "Untitled campaign"}
                </p>
                <p>
                  {TYPES.find((t) => t.key === form.type)?.label} • Audience:{" "}
                  {audience ? audience.total.toLocaleString("en-IN") : "…"}{" "}
                  customers • Channels:{" "}
                  {form.channels.map((c) => CHANNEL_LABEL[c]).join(", ") ||
                    "none"}
                  {form.discountMode === "existing" && picked
                    ? ` • Discount: ${picked.code} (${discountOffer(picked)})`
                    : form.discountMode === "new"
                      ? " • Discount: new"
                      : ""}
                </p>
                {(form.startsAt || form.endsAt) && (
                  <p>
                    Schedule:{" "}
                    {form.startsAt
                      ? `${shortDate(form.startsAt)}, ${form.startsAt.split("T")[1]}`
                      : "now"}{" "}
                    to{" "}
                    {form.endsAt
                      ? `${shortDate(form.endsAt)}, ${form.endsAt.split("T")[1]}`
                      : "no end"}
                  </p>
                )}
              </div>
            </div>
          </Section>
        </div>
      </Modal>
      <ConfirmDialog
        open={sending !== null}
        title="Send this campaign?"
        message={`“${sending?.name ?? ""}” goes to everyone in its audience now. A campaign can only be sent once.`}
        confirmLabel="Send"
        busy={busy}
        onConfirm={send}
        onCancel={() => setSending(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this draft?"
        message={`“${deleting?.name ?? ""}” will be removed.`}
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? ""}
        description="Every message in this campaign"
        footer={
          <Button variant="ghost" onClick={() => setViewing(null)}>
            Close
          </Button>
        }
      >
        <MessageList
          messages={log.data ?? []}
          showCustomer
          empty={log.loading ? "Loading…" : "No messages."}
        />
      </Modal>
    </div>
  );
}
