"use client";

import {
  CrownIcon,
  RepeatIcon,
  ShoppingCart01Icon,
  UserAdd01Icon,
  UserCheck01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnalyticsTab } from "@/components/crm/AnalyticsTab";
import { CommunicationTab } from "@/components/crm/CommunicationTab";
import { CustomersTab } from "@/components/crm/CustomersTab";
import { KpiTile } from "@/components/crm/shared";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import type { CrmSummary } from "@/lib/crm";
import { erp, formatMoney, useErpQuery } from "@/lib/erp";
import { hasPermission, useStaffSession } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { phoneError, toE164 } from "@/lib/phone";

/** Customers > All Customers. Membership, Tags and Campaigns are their own pages in the sidebar; this page keeps the customer list, the
 * open follow-ups and the customer insights. */
type Tab = "customers" | "follow-ups" | "insights";
const TABS: { key: Tab; label: string }[] = [
  { key: "customers", label: "Customers" },
  { key: "follow-ups", label: "Follow-ups" },
  { key: "insights", label: "Insights" },
];

export default function CustomersPage() {
  const { tenant, ready } = usePortalGuard();
  const session = useStaffSession();
  const router = useRouter();
  const summary = useErpQuery<CrmSummary>("/api/v1/crm/summary");
  const [tab, setTab] = useState<Tab>("customers");
  const [filter, setFilter] = useState({ segment: "", tag: "" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const canCreate = hasPermission(session, "customers", "write");
  const currency = tenant?.currency ?? "INR";
  const s = summary.data;

  if (!ready) return null;

  const changed = () => {
    summary.reload();
    setVersion((v) => v + 1);
  };
  const openCustomer = (id: string) => router.push(`/portal/customers/${id}`);

  async function create() {
    if (busy || !form.name.trim() || (!form.phone.trim() && !form.email.trim()))
      return;
    const bad = phoneError(form.phone);
    if (bad) return toast.error("Check the phone number", bad);
    setBusy(true);
    const res = await erp("/api/v1/customers", "POST", {
      name: form.name.trim(),
      phone: toE164(form.phone),
      email: form.email.trim() || null,
    });
    setBusy(false);
    if (res.error) return toast.error("Couldn't add the customer", res.error);
    toast.success("Customer added");
    setOpen(false);
    setForm({ name: "", phone: "", email: "" });
    changed();
  }

  return (
    <PortalShell tenant={tenant} active="customers">
      <PageHeader
        icon={<HugeiconsIcon icon={UserGroupIcon} size={20} />}
        title="All Customers"
        description="Manage your customers, build relationships and increase repeat sales."
        actionsClassName="w-full justify-end md:w-auto"
        actions={
          canCreate && (
            <Button
              onClick={() => setOpen(true)}
              className="shrink-0 whitespace-nowrap"
            >
              <HugeiconsIcon
                icon={UserAdd01Icon}
                size={16}
                className="shrink-0"
              />{" "}
              Add customer
            </Button>
          )
        }
      />
      {summary.error && (
        <p className="mb-space-3 text-[13px] font-medium text-error">
          {summary.error}
        </p>
      )}
      <div className="mb-space-4 grid grid-cols-2 gap-space-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          stackOnMobile
          label="Total customers"
          value={s?.total_customers ?? "—"}
          icon={<HugeiconsIcon icon={UserGroupIcon} size={20} />}
        />
        <KpiTile
          stackOnMobile
          label="Active customers"
          value={s?.active_customers ?? "—"}
          hint="purchased in last 6 months"
          icon={<HugeiconsIcon icon={UserCheck01Icon} size={20} />}
        />
        <KpiTile
          stackOnMobile
          label="Platinum customers"
          value={s?.platinum_customers ?? "—"}
          icon={<HugeiconsIcon icon={CrownIcon} size={20} />}
        />
        <KpiTile
          stackOnMobile
          label="New customers"
          value={s?.new_this_month ?? "—"}
          hint="this month"
          icon={<HugeiconsIcon icon={UserAdd01Icon} size={20} />}
        />
        <KpiTile
          stackOnMobile
          label="Avg. purchase value"
          value={s ? formatMoney(s.avg_purchase_value_minor, currency) : "—"}
          icon={<HugeiconsIcon icon={ShoppingCart01Icon} size={20} />}
        />
        <KpiTile
          stackOnMobile
          label="Repeat customers"
          value={s ? `${s.repeat_rate_pct}%` : "—"}
          hint={s ? `${s.repeat_customers} customers` : undefined}
          icon={<HugeiconsIcon icon={RepeatIcon} size={20} />}
        />
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "customers" && (
        <CustomersTab
          key={version}
          currency={currency}
          canEdit={canCreate}
          segment={filter.segment}
          tag={filter.tag}
          onFilterChange={(f) => setFilter((cur) => ({ ...cur, ...f }))}
          onChanged={changed}
        />
      )}
      {tab === "follow-ups" && (
        <CommunicationTab
          show="follow-ups"
          canEdit={canCreate}
          onChanged={changed}
          onOpenCustomer={openCustomer}
        />
      )}
      {tab === "insights" && (
        <AnalyticsTab
          currency={currency}
          repeatRate={s?.repeat_rate_pct ?? 0}
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add customer"
        description="Name is required, along with at least one of phone or email."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                busy ||
                !form.name.trim() ||
                (!form.phone.trim() && !form.email.trim())
              }
              type="submit"
              form="add-customer-form"
            >
              Add customer
            </Button>
          </>
        }
      >
        <form
          id="add-customer-form"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <Field label="Name" htmlFor="c_name" required>
            <Input
              id="c_name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field
            label="Phone"
            htmlFor="c_phone"
            required={!form.email.trim()}
            hint="Phone or email is required; either one is enough."
          >
            <PhoneInput
              id="c_phone"
              required={!form.email.trim()}
              value={form.phone}
              onChange={(phone) => setForm({ ...form, phone })}
            />
          </Field>
          <Field label="Email" htmlFor="c_email" required={!form.phone.trim()}>
            <Input
              id="c_email"
              type="email"
              required={!form.phone.trim()}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
        </form>
      </Modal>
    </PortalShell>
  );
}
