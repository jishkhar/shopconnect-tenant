"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CataloguePage } from "@/hooks/useTeam";

type Column = "view" | "write" | "delete";
const COLUMNS: { key: Column; label: string }[] = [
  { key: "view", label: "View" },
  { key: "write", label: "Write" },
  { key: "delete", label: "Delete" },
];

// What each extra action is called in the editor; anything not listed shows its action name.
export const PERMISSION_LABEL: Record<string, string> = {
  "orders:create_any_channel": "Create orders for any channel",
  "customers:send_campaigns": "Send campaigns to customers",
  "orders:discount": "Give discounts on orders",
  "orders:return": "Take returns",
  "orders:cancel": "Cancel orders",
  "orders:create": "Create orders",
  "orders:view": "See orders",
  "payments:create": "Take payments",
  "payments:refund": "Refund payments",
  "customers:create": "Add customers",
  "inventory:view": "See stock",
  "inventory:serials": "Pick serial numbers / IMEIs",
  "terminals:manage": "Change this till's settings",
  "barcodes:print": "Print shop labels",
  "retail:bill": "Bill at the counter",
  "transfers:approve": "Approve transfers",
  "transfers:approve_high_value": "Approve high-value transfers",
  "transfers:dispatch": "Dispatch transfers",
  "transfers:request": "Request transfers",
  "procurement:approve": "Approve purchase orders",
  "procurement:return": "Return goods to suppliers",
  "procurement:pay": "Pay suppliers",
  "expenses:approve": "Approve expenses",
  "expenses:pay": "Pay expenses",
  "finance:reconcile": "Reconcile settlements",
  "users:assign_roles": "Give people roles",
  "wholesale:approve": "Confirm sales orders",
  "wholesale:dispatch": "Dispatch sales orders",
  "wholesale:override_price": "Change wholesale prices on an order",
  "wholesale:override_credit": "Sell past a customer's credit limit",
  "wholesale:receive_payment": "Record payments from business customers",
  "wholesale:view": "See sales orders and wholesale invoices",
  "wholesale:create": "Create quotations and sales orders",
  "wholesale:cancel": "Cancel or close sales orders short",
  "customer_accounts:view": "See business customers",
  "customer_accounts:create": "Add business customers",
  "customer_accounts:update": "Change business customers",
  "price_lists:view": "See price lists",
  "procurement:view": "See purchase orders and supplier bills",
  "procurement:create": "Create purchase orders",
  "procurement:receive": "Receive goods from suppliers",
  "suppliers:view": "See suppliers",
  "suppliers:create": "Add suppliers",
  "suppliers:update": "Change suppliers",
  "wholesale_till:bill": "Bill business customers at their prices",
  "wholesale_till:credit": "Put bills on a business customer's account",
};

export function permissionLabel(p: string): string {
  return (
    PERMISSION_LABEL[p] ??
    p
      .split(":")[1]
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase())
  );
}

function Tick({
  checked,
  partial,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  partial?: boolean;
  disabled?: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      ref={(el) => {
        if (el) el.indeterminate = !!partial && !checked;
      }}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 accent-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}

type GridProps = {
  pages: CataloguePage[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Permissions the editor cannot hand out (they do not hold them): shown, but locked. */
  locked?: Set<string>;
  readOnly?: boolean;
};

/** The Store-role editor: one row per portal page with View / Write / Delete, as in the reference design. Write also grants View,
 * Delete also grants Write and View; removing View removes the rest. Actions that fit none of the three (approve, refund ...) sit
 * under "Other permissions" for the page. */
export function PermissionGrid({
  pages,
  selected,
  onChange,
  locked,
  readOnly,
}: GridProps) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const groups = [...new Set(pages.map((p) => p.group))];

  const has = (perms: string[]) =>
    perms.length > 0 && perms.every((x) => selected.has(x));
  const some = (perms: string[]) => perms.some((x) => selected.has(x));

  function toggle(page: CataloguePage, col: Column, on: boolean) {
    const next = new Set(selected);
    const add = (perms: string[]) => perms.forEach((x) => next.add(x));
    const drop = (perms: string[]) => perms.forEach((x) => next.delete(x));
    if (on) {
      add(page[col]);
      if (col !== "view") add(page.view);
      if (col === "delete") add(page.write);
    } else {
      drop(page[col]);
      if (col === "view") {
        drop(page.write);
        drop(page.delete);
        drop(page.other);
      }
      if (col === "write") drop(page.delete);
    }
    onChange(next);
  }

  function toggleOther(page: CataloguePage, perm: string, on: boolean) {
    const next = new Set(selected);
    if (on) {
      next.add(perm);
      page.view.forEach((x) => next.add(x));
    } else next.delete(perm);
    onChange(next);
  }

  const blocked = (perms: string[]) =>
    readOnly || perms.some((x) => locked?.has(x));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-[13px]">
        <thead>
          <tr className="text-left text-[11px] tracking-wide text-ink-400 uppercase">
            <th className="py-space-2 pr-space-3 font-semibold">Page</th>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className="w-20 py-space-2 text-center font-semibold"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g}>
            <tr>
              <td
                colSpan={4}
                className="bg-paper px-space-2 py-space-1 text-[11px] font-bold tracking-wide text-ink-600 uppercase"
              >
                {g}
              </td>
            </tr>
            {pages
              .filter((p) => p.group === g)
              .flatMap((p) => {
                const expanded = open.has(p.key);
                const rows = [
                  <tr key={p.key} className="border-t border-line">
                    <td className="py-space-2 pr-space-3 text-ink-900">
                      {p.other.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            const n = new Set(open);
                            if (!n.delete(p.key)) n.add(p.key);
                            setOpen(n);
                          }}
                          className="flex items-center gap-1 text-left font-medium"
                          aria-expanded={expanded}
                        >
                          {expanded ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                          {p.label}
                          {some(p.other) && (
                            <span className="ml-1 rounded-full bg-brand-50 px-1.5 text-[10px] font-bold text-brand-700">
                              +{p.other.filter((x) => selected.has(x)).length}
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className="pl-[18px] font-medium">{p.label}</span>
                      )}
                    </td>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className="py-space-2 text-center">
                        {p[c.key].length === 0 ? (
                          <span className="text-ink-300">—</span>
                        ) : (
                          <Tick
                            label={`${p.label}: ${c.label}`}
                            checked={has(p[c.key])}
                            partial={some(p[c.key])}
                            disabled={blocked(p[c.key])}
                            onChange={(v) => toggle(p, c.key, v)}
                          />
                        )}
                      </td>
                    ))}
                  </tr>,
                ];
                if (expanded) {
                  rows.push(
                    <tr key={`${p.key}-other`}>
                      <td colSpan={4} className="pb-space-2 pl-space-6">
                        <div className="flex flex-col gap-space-1">
                          {p.other.map((x) => (
                            <label
                              key={x}
                              className={cn(
                                "flex items-center gap-space-2 text-[13px] text-ink-600",
                                blocked([x]) && "opacity-50",
                              )}
                            >
                              <Tick
                                label={permissionLabel(x)}
                                checked={selected.has(x)}
                                disabled={blocked([x])}
                                onChange={(v) => toggleOther(p, x, v)}
                              />
                              {permissionLabel(x)}
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>,
                  );
                }
                return rows;
              })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/** The Point of Sale editor: a flat list of what a cashier may do at the till. */
export function PosPermissionList({
  permissions,
  selected,
  onChange,
  locked,
  readOnly,
}: {
  permissions: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  locked?: Set<string>;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-space-2">
      {permissions.map((x) => {
        const off = readOnly || locked?.has(x);
        return (
          <label
            key={x}
            className={cn(
              "flex items-center gap-space-2 text-[13px] text-ink-900",
              off && "opacity-50",
            )}
          >
            <Tick
              label={permissionLabel(x)}
              checked={selected.has(x)}
              disabled={off}
              onChange={(v) => {
                const next = new Set(selected);
                if (v) next.add(x);
                else next.delete(x);
                onChange(next);
              }}
            />
            {permissionLabel(x)}
          </label>
        );
      })}
    </div>
  );
}
