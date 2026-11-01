"use client";

import {
  ChartBarLineIcon,
  MoreHorizontalIcon,
  Search01Icon,
  UserGroupIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { StatCard } from "@/components/crm/membership/parts";
import { ConditionBuilder } from "@/components/crm/rules/ConditionBuilder";
import { Avatar, SegmentBadge } from "@/components/crm/shared";
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
import { Pager } from "@/components/ui/Pager";
import { formatDate, type CrmCustomer, type CrmSummary } from "@/lib/crm";
import { erp, formatMoney, qs, useErpQuery } from "@/lib/erp";
import {
  conditionReady,
  defaultCondition,
  describeConditions,
  type Condition,
  type Match,
  type SavedSegment,
} from "@/lib/rules";
import type { CustomerTag } from "@/lib/tags";
import { toast } from "@/lib/toast";
import { useDebounced } from "@/lib/useDebounced";

/** Customers > Segments: saved groups of customers defined by conditions, counted live; a campaign can be sent to one. */
export function SegmentsView({
  currency,
  canConfigure,
  creating,
  onCreatingDone,
}: {
  currency: string;
  canConfigure: boolean;
  creating: boolean;
  onCreatingDone: () => void;
}) {
  const router = useRouter();
  const segments = useErpQuery<SavedSegment[]>("/api/v1/crm/customer-segments");
  const summary = useErpQuery<CrmSummary>("/api/v1/crm/summary");
  const tags = useErpQuery<CustomerTag[]>("/api/v1/crm/tags");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SavedSegment | null>(null);
  const [viewing, setViewing] = useState<SavedSegment | null>(null);
  const [removing, setRemoving] = useState<SavedSegment | null>(null);
  const [busy, setBusy] = useState(false);
  const tagList = tags.data ?? [];
  const tagNames = Object.fromEntries(tagList.map((t) => [t.id, t.name]));
  const all = segments.data ?? [];
  const rows = all.filter((s) =>
    `${s.name} ${s.description ?? ""} ${describeConditions(s.conditions, s.match, tagNames)}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const largest = all.reduce<SavedSegment | null>(
    (best, s) => (!best || s.member_count > best.member_count ? s : best),
    null,
  );

  async function remove() {
    if (!removing) return;
    setBusy(true);
    const res = await erp(
      `/api/v1/crm/customer-segments/${removing.id}`,
      "DELETE",
    );
    setBusy(false);
    if (res.error) return toast.error("Couldn't delete the segment", res.error);
    toast.success(`“${removing.name}” deleted`);
    setRemoving(null);
    segments.reload();
  }

  const columns = useMemo<ColumnDef<SavedSegment, unknown>[]>(
    () => [
      {
        header: "Segment",
        cell: ({ row }) => (
          <span>
            <span className="block font-semibold text-ink-900">
              {row.original.name}
            </span>
            {row.original.description && (
              <span className="block text-[12px] text-ink-600">
                {row.original.description}
              </span>
            )}
          </span>
        ),
      },
      {
        header: "Conditions",
        cell: ({ row }) => (
          <span
            className="block max-w-[380px] truncate text-ink-600"
            title={describeConditions(
              row.original.conditions,
              row.original.match,
              tagNames,
            )}
          >
            {describeConditions(
              row.original.conditions,
              row.original.match,
              tagNames,
            )}
          </span>
        ),
      },
      {
        header: "Customers",
        cell: ({ row }) => (
          <span className="font-semibold text-ink-900">
            {row.original.member_count.toLocaleString("en-IN")}
          </span>
        ),
      },
      {
        header: "Type",
        cell: ({ row }) => (
          <span className="text-ink-600">{row.original.rule_type}</span>
        ),
      },
      {
        header: "Created",
        cell: ({ row }) => (
          <span className="text-ink-600">
            {formatDate(row.original.created_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        meta: { className: "!min-w-0" },
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${row.original.name}`}
              onClick={(e) => e.stopPropagation()}
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setViewing(row.original)}>
                View customers
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/portal/campaigns")}
              >
                Send a campaign
              </DropdownMenuItem>
              {canConfigure && (
                <DropdownMenuItem onClick={() => setEditing(row.original)}>
                  Edit
                </DropdownMenuItem>
              )}
              {canConfigure && (
                <DropdownMenuItem onClick={() => setRemoving(row.original)}>
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canConfigure, tagList],
  );

  return (
    <div>
      <div className="mb-space-4 grid grid-cols-2 gap-space-3 xl:grid-cols-3">
        <StatCard
          label="Total Segments"
          value={segments.data ? all.length : "—"}
          icon={<HugeiconsIcon icon={ChartBarLineIcon} size={20} />}
        />
        <StatCard
          label="Largest Segment"
          value={largest ? largest.name : "—"}
          hint={
            largest
              ? `${largest.member_count.toLocaleString("en-IN")} customers`
              : undefined
          }
          icon={<HugeiconsIcon icon={UserMultiple02Icon} size={20} />}
        />
        <StatCard
          label="All Customers"
          value={
            summary.data
              ? summary.data.total_customers.toLocaleString("en-IN")
              : "—"
          }
          hint="to compare segment sizes with"
          icon={<HugeiconsIcon icon={UserGroupIcon} size={20} />}
        />
      </div>
      <Card className="mb-space-3 flex flex-wrap items-center gap-space-2 p-space-3">
        <span className="relative min-w-[200px] flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <Input
            placeholder="Search by segment name or condition…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search segments"
          />
        </span>
      </Card>
      {segments.error && (
        <p className="mb-space-3 text-[13px] font-medium text-error">
          {segments.error}
        </p>
      )}
      <Card className="p-space-2">
        <div className="whitespace-nowrap">
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(s) => s.id}
            loading={segments.loading}
            paginate={false}
            onRowClick={(s) => setViewing(s)}
            emptyMessage={
              segments.loading
                ? "Loading segments…"
                : "No segments yet. Create one, e.g. customers who spent over ₹20,000 or haven't bought in 60 days."
            }
          />
        </div>
        <p className="px-space-3 py-space-3 text-[12.5px] text-ink-600">
          Counts are worked out afresh each time this page loads. Pick a segment
          as a campaign&apos;s audience in Campaigns.
        </p>
      </Card>

      {(creating || editing) && (
        <SegmentModal
          segment={editing}
          tags={tagList}
          onClose={() => {
            setEditing(null);
            onCreatingDone();
          }}
          onSaved={() => {
            setEditing(null);
            onCreatingDone();
            segments.reload();
          }}
        />
      )}
      {viewing && (
        <SegmentCustomers
          segment={viewing}
          currency={currency}
          onClose={() => setViewing(null)}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        title={`Delete “${removing?.name ?? ""}”?`}
        message="Customers aren't changed. Campaigns already sent to it keep their history."
        confirmLabel="Delete segment"
        destructive
        busy={busy}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

function SegmentModal({
  segment,
  tags,
  onClose,
  onSaved,
}: {
  segment: SavedSegment | null;
  tags: CustomerTag[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(segment?.name ?? "");
  const [description, setDescription] = useState(segment?.description ?? "");
  const [conditions, setConditions] = useState<Condition[]>(
    segment?.conditions ?? [defaultCondition("total_spend")],
  );
  const [match, setMatch] = useState<Match>(segment?.match ?? "all");
  const [busy, setBusy] = useState(false);
  const ready =
    !!name.trim() && conditions.length > 0 && conditions.every(conditionReady);

  async function save() {
    if (!ready || busy) return;
    setBusy(true);
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      conditions,
      match,
    };
    const res = segment
      ? await erp<SavedSegment>(
          `/api/v1/crm/customer-segments/${segment.id}`,
          "PUT",
          body,
        )
      : await erp<SavedSegment>("/api/v1/crm/customer-segments", "POST", body);
    setBusy(false);
    if (res.error || !res.data)
      return toast.error("Couldn't save the segment", res.error ?? undefined);
    toast.success(
      `“${res.data.name}” saved`,
      `${res.data.member_count.toLocaleString("en-IN")} customers right now`,
    );
    onSaved();
  }

  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title={segment ? "Edit segment" : "Create segment"}
      description="A segment is a saved group of customers. Whoever matches the conditions at the time is in it."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !ready} onClick={save}>
            {segment ? "Save segment" : "Create segment"}
          </Button>
        </>
      }
    >
      <Field label="Segment name" htmlFor="seg_name" required>
        <Input
          id="seg_name"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Description (optional)" htmlFor="seg_desc">
        <Input
          id="seg_desc"
          maxLength={300}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <p className="mb-space-2 text-[13px] font-bold tracking-wide text-ink-600 uppercase">
        Customers who match
      </p>
      <ConditionBuilder
        conditions={conditions}
        match={match}
        tags={tags}
        onChange={(c, m) => {
          setConditions(c);
          setMatch(m);
        }}
      />
    </Modal>
  );
}

const PAGE = 25;

function SegmentCustomers({
  segment,
  currency,
  onClose,
}: {
  segment: SavedSegment;
  currency: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const [page, setPage] = useState(0);
  const list = useErpQuery<{ total: number; items: CrmCustomer[] }>(
    `/api/v1/crm/customer-segments/${segment.id}/customers${qs({ q, limit: PAGE, offset: page * PAGE })}`,
  );
  const rows = list.data?.items ?? [];
  return (
    <Modal
      open
      onClose={onClose}
      width="xl"
      title={segment.name}
      description={describeConditions(segment.conditions, segment.match)}
    >
      <Input
        placeholder="Search by name, phone or email…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
        className="mb-space-3"
        aria-label="Search customers"
      />
      {list.error && (
        <p className="mb-space-2 text-[13px] font-medium text-error">
          {list.error}
        </p>
      )}
      <div className="divide-y divide-line rounded-lg border border-line">
        {rows.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => router.push(`/portal/customers/${c.id}`)}
            className="flex w-full items-center gap-space-3 px-space-3 py-space-2 text-left hover:bg-black/[0.02]"
          >
            <Avatar name={c.name} size={30} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink-900">
                {c.name || "Unnamed"}
              </span>
              <span className="block truncate text-[12px] text-ink-600">
                {c.phone ?? c.email ?? "—"}
              </span>
            </span>
            <SegmentBadge segment={c.segment} />
            <span className="hidden w-28 text-right text-[13px] text-ink-700 sm:block">
              {formatMoney(c.total_spent_minor, currency)}
            </span>
            <span className="hidden w-20 text-right text-[13px] text-ink-600 sm:block">
              {c.total_orders} orders
            </span>
          </button>
        ))}
        {!list.loading && rows.length === 0 && (
          <p className="p-space-3 text-[13px] text-ink-400">
            No customers match right now.
          </p>
        )}
        {list.loading && (
          <p className="p-space-3 text-[13px] text-ink-400">Loading…</p>
        )}
      </div>
      <Pager
        page={page}
        pageSize={PAGE}
        total={list.data?.total ?? 0}
        noun="customers"
        onPage={setPage}
      />
    </Modal>
  );
}
