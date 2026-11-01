"use client";

import {
  Add01Icon,
  Briefcase01Icon,
  CheckmarkCircle02Icon,
  CrownIcon,
  GiftIcon,
  MoreHorizontalIcon,
  Notification01Icon,
  Search01Icon,
  Settings02Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import {
  CheckLine,
  HistoryList,
  StatCard,
  StatusPill,
  TierCrown,
  ViewHeader,
} from "@/components/crm/membership/parts";
import { RuleModal } from "@/components/crm/rules/RuleModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { type CrmSettings } from "@/lib/crm";
import { erp, formatMoney, fromMinor, toMinor, useErpQuery } from "@/lib/erp";
import {
  TIER_LABEL,
  type HistoryEntry,
  type Overview,
  type QualificationRule,
  type RulesResponse,
} from "@/lib/membership";
import {
  FREQUENCY_LABEL,
  describeAction,
  describeConditions,
  type CrmRule,
  type RuleRun,
} from "@/lib/rules";
import { toast } from "@/lib/toast";

type SubTab = "qualification" | "automations" | "history";
const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "qualification", label: "Qualification Rules" },
  { key: "automations", label: "Automations" },
  { key: "history", label: "History" },
];
const TIER_KEYS = ["silver", "gold", "platinum"] as const;

function qualIcon(r: QualificationRule) {
  const key = r.id.replace("system:", "");
  if (key === "silver" || key === "gold" || key === "platinum")
    return <TierCrown tier={key} size={32} />;
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-tint text-success">
      <HugeiconsIcon
        icon={key === "inactive" ? Briefcase01Icon : UserIcon}
        size={16}
      />
    </span>
  );
}

const pillFor = (status: CrmRule["status"]) =>
  status === "active" ? "active" : status === "draft" ? "draft" : "paused";

/** Membership > Rules: how tiers are earned (points, plus optional minimum spend and orders), automations that really run (points,
 * follow-ups), and the history of changes. */
export function RulesView({
  currency,
  canConfigure,
  onChanged,
}: {
  currency: string;
  canConfigure: boolean;
  onChanged: () => void;
}) {
  const data = useErpQuery<RulesResponse>("/api/v1/crm/membership/rules");
  const plans = useErpQuery<Overview>("/api/v1/crm/membership/overview");
  const [sub, setSub] = useState<SubTab>("qualification");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editingQual, setEditingQual] = useState<QualificationRule | null>(
    null,
  );
  const [qual, setQual] = useState({ value: "", spend: "", orders: "" });
  const [automation, setAutomation] = useState<CrmRule | "new" | null>(null);
  const [removing, setRemoving] = useState<CrmRule | null>(null);
  const [busy, setBusy] = useState(false);
  const history = useErpQuery<HistoryEntry[]>(
    sub === "history" ? "/api/v1/crm/membership/history" : null,
  );
  const k = data.data?.kpis;
  const term = search.trim().toLowerCase();
  const qualRows = (data.data?.qualification ?? []).filter((r) =>
    `${r.name} ${r.trigger_text} ${r.action_text}`.toLowerCase().includes(term),
  );
  const autoRows = (data.data?.automations ?? []).filter(
    (r) =>
      `${r.name} ${describeConditions(r.conditions, r.match)} ${describeAction(r.action)}`
        .toLowerCase()
        .includes(term) &&
      (!status || r.status === status),
  );

  const reload = () => {
    data.reload();
    plans.reload();
    onChanged();
  };

  function openQual(r: QualificationRule) {
    setQual({
      value: String(r.value ?? ""),
      spend: r.min_spend_minor ? fromMinor(r.min_spend_minor) : "",
      orders: r.min_orders ? String(r.min_orders) : "",
    });
    setEditingQual(r);
  }

  async function saveQual() {
    if (!editingQual) return;
    const key = editingQual.id.replace("system:", "");
    const value = Number(qual.value);
    if (!Number.isInteger(value) || value < 0 || qual.value.trim() === "")
      return toast.error("Check the value", "Enter a whole number.");
    const body: Record<string, number> = { value };
    if ((TIER_KEYS as readonly string[]).includes(key)) {
      const spend = qual.spend.trim() ? toMinor(qual.spend) : 0;
      if (spend === null || spend < 0)
        return toast.error(
          "Check the spend",
          "Enter an amount, or leave it empty.",
        );
      body.min_spend_minor = spend;
      body.min_orders = qual.orders.trim() ? Number(qual.orders) : 0;
    }
    setBusy(true);
    const res = await erp(
      `/api/v1/crm/membership/rules/system/${key}`,
      "PUT",
      body,
    );
    setBusy(false);
    if (res.error) return toast.error("Couldn't save the rule", res.error);
    toast.success("Rule saved");
    setEditingQual(null);
    reload();
  }

  async function runNow(r: CrmRule) {
    const res = await erp<RuleRun>(
      `/api/v1/crm/rules/membership/${r.id}/run`,
      "POST",
    );
    if (res.error || !res.data)
      return toast.error("Couldn't run the automation", res.error ?? undefined);
    toast.success(
      "Automation ran",
      `${res.data.matched} matched · ${res.data.added} acted on`,
    );
    reload();
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    const res = await erp(
      `/api/v1/crm/rules/membership/${removing.id}`,
      "DELETE",
    );
    setBusy(false);
    if (res.error)
      return toast.error("Couldn't delete the automation", res.error);
    toast.success("Automation deleted");
    setRemoving(null);
    reload();
  }

  const menuClass =
    "flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none";

  const qualColumns = useMemo<ColumnDef<QualificationRule, unknown>[]>(
    () => [
      {
        header: "Rule name",
        cell: ({ row }) => (
          <span className="flex items-center gap-space-2">
            {qualIcon(row.original)}
            <span className="font-semibold text-ink-900">
              {row.original.name}
            </span>
          </span>
        ),
      },
      { header: "Applies to", cell: ({ row }) => row.original.applies_to },
      {
        header: "Trigger / condition",
        cell: ({ row }) => (
          <span className="block max-w-[300px] whitespace-normal">
            {row.original.trigger_text}
          </span>
        ),
      },
      { header: "Action", cell: ({ row }) => row.original.action_text },
      { header: "Frequency", cell: () => "Real-time" },
      { header: "Status", cell: () => <StatusPill status="active" /> },
      ...(canConfigure
        ? [
            {
              id: "actions",
              header: "Actions",
              meta: { className: "!min-w-0" },
              cell: ({ row }: { row: { original: QualificationRule } }) =>
                row.original.field === null ? null : (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Actions for ${row.original.name}`}
                      className={menuClass}
                    >
                      <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => openQual(row.original)}>
                        Edit
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ),
            } as ColumnDef<QualificationRule, unknown>,
          ]
        : []),
    ],
    [canConfigure],
  );

  const autoColumns = useMemo<ColumnDef<CrmRule, unknown>[]>(
    () => [
      {
        header: "Rule name",
        cell: ({ row }) => (
          <span className="flex items-center gap-space-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <HugeiconsIcon
                icon={
                  row.original.action.type === "award_points"
                    ? GiftIcon
                    : Notification01Icon
                }
                size={16}
              />
            </span>
            <span className="font-semibold text-ink-900">
              {row.original.name}
            </span>
          </span>
        ),
      },
      {
        header: "Trigger / condition",
        cell: ({ row }) => (
          <span
            className="block max-w-[280px] truncate"
            title={describeConditions(
              row.original.conditions,
              row.original.match,
            )}
          >
            {describeConditions(row.original.conditions, row.original.match)}
          </span>
        ),
      },
      {
        header: "Action",
        cell: ({ row }) => (
          <span className="block max-w-[240px] truncate">
            {describeAction(row.original.action)}
          </span>
        ),
      },
      {
        header: "Frequency",
        cell: ({ row }) => FREQUENCY_LABEL[row.original.frequency],
      },
      {
        header: "Last run",
        cell: ({ row }) =>
          row.original.last_run_at ? (
            <span className="text-ink-600">
              {new Date(row.original.last_run_at).toLocaleDateString("en-IN")}
              <span className="block text-[12px]">
                {row.original.matched_count.toLocaleString("en-IN")} matched
              </span>
            </span>
          ) : (
            <span className="text-ink-400">Not yet</span>
          ),
      },
      {
        header: "Status",
        cell: ({ row }) => <StatusPill status={pillFor(row.original.status)} />,
      },
      ...(canConfigure
        ? [
            {
              id: "actions",
              header: "Actions",
              meta: { className: "!min-w-0" },
              cell: ({ row }: { row: { original: CrmRule } }) => (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Actions for ${row.original.name}`}
                    className={menuClass}
                  >
                    <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => setAutomation(row.original)}
                    >
                      Edit
                    </DropdownMenuItem>
                    {row.original.status === "active" && (
                      <DropdownMenuItem onClick={() => runNow(row.original)}>
                        Run now
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setRemoving(row.original)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            } as ColumnDef<CrmRule, unknown>,
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canConfigure],
  );

  const q = (key: string) =>
    data.data?.qualification.find((r) => r.id === `system:${key}`);
  const tierLines = (key: (typeof TIER_KEYS)[number], from: string) => {
    const r = q(key);
    return [
      `Loyalty points ≥ ${r?.value?.toLocaleString("en-IN") ?? "—"}`,
      ...(r?.min_spend_minor
        ? [`Spend since joining ≥ ${formatMoney(r.min_spend_minor, currency)}`]
        : []),
      ...(r?.min_orders
        ? [`At least ${r.min_orders.toLocaleString("en-IN")} orders`]
        : []),
      `Auto-upgrade from ${from}`,
    ];
  };
  const summary = [
    {
      tier: "regular" as const,
      lines: [
        "All registered customers are eligible",
        "Auto-assigned when the profile is complete",
      ],
    },
    { tier: "silver" as const, lines: tierLines("silver", "Regular") },
    { tier: "gold" as const, lines: tierLines("gold", "Silver") },
    { tier: "platinum" as const, lines: tierLines("platinum", "Gold") },
  ];
  const editingKey = editingQual?.id.replace("system:", "") ?? "";
  const editingTier = (TIER_KEYS as readonly string[]).includes(editingKey);

  return (
    <div>
      <ViewHeader
        title="Membership Rules"
        description="How customers qualify for Regular, Silver, Gold and Platinum, and automations that reward or follow up with members."
        action={
          canConfigure && (
            <Button
              onClick={() => {
                setSub("automations");
                setAutomation("new");
              }}
              className="shrink-0"
            >
              <HugeiconsIcon icon={Add01Icon} size={16} /> Add automation
            </Button>
          )
        }
      />
      <div className="mb-space-4 grid grid-cols-2 gap-space-3 xl:grid-cols-4">
        <StatCard
          label="Total Rules"
          value={k ? k.total : "—"}
          icon={<HugeiconsIcon icon={GiftIcon} size={20} />}
        />
        <StatCard
          label="Active Rules"
          value={k ? k.active : "—"}
          icon={<HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} />}
        />
        <StatCard
          label="Automation Actions"
          value={
            k ? k.automation_events_this_month.toLocaleString("en-IN") : "—"
          }
          hint="points given / follow-ups this month"
          icon={<HugeiconsIcon icon={Settings02Icon} size={20} />}
        />
        <StatCard
          label="Upcoming Expiry Alerts"
          value={k ? k.expiring_30d : "—"}
          hint="in next 30 days"
          icon={<HugeiconsIcon icon={Notification01Icon} size={20} />}
        />
      </div>

      <Tabs
        tabs={SUB_TABS}
        value={sub}
        onChange={setSub}
        className="!mb-space-3"
      />

      {sub !== "history" && (
        <Card className="mb-space-3 flex flex-wrap items-center gap-space-2 p-space-3">
          <span className="relative min-w-[200px] flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <Input
              placeholder="Search by rule name, condition or action…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Search rules"
            />
          </span>
          {sub === "automations" && (
            <Select
              value={status}
              onValueChange={setStatus}
              className="!w-auto"
              aria-label="Status"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="paused">Paused</option>
            </Select>
          )}
        </Card>
      )}
      {data.error && (
        <p className="mb-space-3 text-[13px] font-medium text-error">
          {data.error}
        </p>
      )}

      <Card className="p-space-2">
        {sub === "history" ? (
          <HistoryList
            entries={history.data ?? []}
            prefixes={["rule", "tier"]}
            loading={history.loading}
          />
        ) : sub === "qualification" ? (
          <>
            <div className="whitespace-nowrap">
              <DataTable
                columns={qualColumns}
                data={qualRows}
                getRowId={(r) => r.id}
                loading={data.loading}
                paginate={false}
                emptyMessage={
                  data.loading ? "Loading rules…" : "No rules match."
                }
              />
            </div>
            <p className="px-space-3 py-space-3 text-[12px] text-ink-400">
              Tiers are worked out live from these settings; editing one changes
              every customer&apos;s tier at once.
            </p>
          </>
        ) : (
          <>
            <div className="whitespace-nowrap">
              <DataTable
                columns={autoColumns}
                data={autoRows}
                getRowId={(r) => r.id}
                loading={data.loading}
                paginate={false}
                emptyMessage={
                  data.loading
                    ? "Loading automations…"
                    : "No automations yet. Add one, e.g. a birthday bonus or a follow-up when a membership is about to expire."
                }
              />
            </div>
            <p className="px-space-3 py-space-3 text-[12px] text-ink-400">
              Automations act on members only, once per customer per period,
              when saved, daily, and after orders when set to real time.
            </p>
          </>
        )}
      </Card>

      <Card className="mt-space-4 p-space-4">
        <div className="mb-space-3 flex items-center gap-space-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <HugeiconsIcon icon={CrownIcon} size={20} />
          </span>
          <div>
            <h3 className="text-[16px] font-bold text-ink-900">
              Tier Qualification Summary
            </h3>
            <p className="text-[12.5px] text-ink-600">
              How customers qualify for each membership tier and the automation
              behaviour.
            </p>
          </div>
        </div>
        <div className="grid gap-space-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((s) => {
            const plan = plans.data?.tiers.find((p) => p.tier === s.tier);
            return (
              <div
                key={s.tier}
                className="rounded-lg border border-line p-space-3"
              >
                <div className="mb-space-2 flex items-center gap-space-3">
                  <TierCrown tier={s.tier} size={40} />
                  <div>
                    <p className="font-semibold text-ink-900">
                      {TIER_LABEL[s.tier]}
                    </p>
                    <p className="text-[12px] text-ink-600">
                      {plan?.description}
                    </p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {s.lines.map((line) => (
                    <CheckLine key={line}>{line}</CheckLine>
                  ))}
                  {(plan?.key_benefits ?? []).slice(0, 2).map((b) => (
                    <CheckLine key={b}>{b}</CheckLine>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      <PointsConversion
        currency={currency}
        canConfigure={canConfigure}
        onChanged={reload}
      />

      <Modal
        open={editingQual !== null}
        onClose={() => setEditingQual(null)}
        title={editingQual?.name ?? ""}
        description="This changes the real settings used to work out every customer's membership tier."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingQual(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || qual.value.trim() === ""}
              onClick={saveQual}
            >
              Save rule
            </Button>
          </>
        }
      >
        <Field
          label={
            editingKey === "inactive"
              ? "Days without a purchase"
              : "Loyalty points required"
          }
          htmlFor="q_value"
          required
        >
          <Input
            id="q_value"
            inputMode="numeric"
            value={qual.value}
            onChange={(e) =>
              setQual({ ...qual, value: e.target.value.replace(/\D/g, "") })
            }
          />
        </Field>
        {editingTier && (
          <div className="grid gap-space-3 sm:grid-cols-2">
            <Field
              label={`Minimum spend since joining (${currency})`}
              htmlFor="q_spend"
              hint="Net of refunds. Empty = no minimum."
            >
              <Input
                id="q_spend"
                inputMode="decimal"
                value={qual.spend}
                onChange={(e) => setQual({ ...qual, spend: e.target.value })}
              />
            </Field>
            <Field
              label="Minimum orders"
              htmlFor="q_orders"
              hint="Empty = no minimum."
            >
              <Input
                id="q_orders"
                inputMode="numeric"
                value={qual.orders}
                onChange={(e) =>
                  setQual({
                    ...qual,
                    orders: e.target.value.replace(/\D/g, ""),
                  })
                }
              />
            </Field>
          </div>
        )}
        {editingTier && (
          <p className="text-[12.5px] text-ink-600">
            A customer needs all of these. Higher tiers can&apos;t ask for less
            than lower ones.
          </p>
        )}
      </Modal>

      {automation !== null && (
        <RuleModal
          scope="membership"
          rule={automation === "new" ? null : automation}
          tags={[]}
          onClose={() => setAutomation(null)}
          onSaved={() => {
            setAutomation(null);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Delete this automation?"
        message={`“${removing?.name ?? ""}” will stop running. Points already given stay.`}
        confirmLabel="Delete"
        destructive
        busy={busy}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

/** How many loyalty points equal how much money when a customer redeems them (moved here from the old Membership tab). */
function PointsConversion({
  currency,
  canConfigure,
  onChanged,
}: {
  currency: string;
  canConfigure: boolean;
  onChanged: () => void;
}) {
  const data = useErpQuery<{ settings: CrmSettings }>("/api/v1/crm/segments");
  const [points, setPoints] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const s = data.data?.settings;
  if (!s) return null;
  const shownAmount = amount ?? fromMinor(s.redemption_value_minor ?? 100);
  const n = Number(points ?? s.redemption_points ?? 100);
  const minor = toMinor(shownAmount);
  const valid =
    Number.isSafeInteger(n) &&
    n > 0 &&
    n <= 10 ** 9 &&
    minor !== null &&
    minor > 0 &&
    minor <= 10 ** 12 &&
    /^\d+(\.\d{1,2})?$/.test(shownAmount);

  async function save() {
    setBusy(true);
    const res = await erp("/api/v1/crm/settings", "PUT", {
      redemption_points: n,
      redemption_value_minor: minor,
    });
    setBusy(false);
    if (res.error) return toast.error("Couldn't save", res.error);
    toast.success("Conversion saved");
    setPoints(null);
    setAmount(null);
    data.reload();
    onChanged();
  }

  return (
    <Card className="mt-space-4 p-space-4">
      <h3 className="mb-space-1 text-[15px] font-bold text-ink-900">
        Loyalty points to money conversion
      </h3>
      <p className="mb-space-3 text-[13px] text-ink-600">
        How many points equal a money deduction when a customer redeems them.
        This is separate from the rate at which customers earn points.
      </p>
      <div className="grid max-w-xl gap-space-3 sm:grid-cols-2">
        <Field
          label="Loyalty points"
          htmlFor="rp_points"
          hint="A positive whole number of points."
        >
          <Input
            id="rp_points"
            inputMode="numeric"
            disabled={!canConfigure || busy}
            value={points ?? String(s.redemption_points ?? 100)}
            onChange={(e) => setPoints(e.target.value)}
          />
        </Field>
        <Field
          label={`Deduction amount (${currency})`}
          htmlFor="rp_amount"
          hint="The money value of those points."
        >
          <Input
            id="rp_amount"
            inputMode="decimal"
            disabled={!canConfigure || busy}
            value={shownAmount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      </div>
      {valid && (
        <p className="text-[13px] font-semibold text-brand-700">
          {n.toLocaleString("en-IN")} points = {formatMoney(minor!, currency)}{" "}
          deduction.
        </p>
      )}
      {canConfigure && (
        <Button
          className="mobile-page-action mt-space-3"
          disabled={busy || !valid || (points === null && amount === null)}
          onClick={save}
        >
          Save conversion
        </Button>
      )}
    </Card>
  );
}
