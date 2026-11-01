import { formatMoney } from "@/lib/erp";
import { SEGMENT_META, type Segment } from "@/lib/crm";
import type { TagColor, TagIcon } from "@/lib/tags";

/** CRM rules and segments (backend: services/crm_rules.py, services/crm_conditions.py). */
export type ConditionField =
  | "total_spend"
  | "orders"
  | "points"
  | "days_since_last_purchase"
  | "joined_within_days"
  | "birthday_within_days"
  | "birthday_this_month"
  | "membership_expires_within_days"
  | "coupon_uses"
  | "tier"
  | "customer_type"
  | "purchase_channel"
  | "city"
  | "gender"
  | "has_tag";
export type ConditionOp = "gt" | "gte" | "lt" | "lte" | "eq" | "in" | "is";
export type Condition = {
  field: ConditionField;
  op: ConditionOp;
  value?: number | boolean | string | string[];
};
export type Match = "all" | "any";
export type RuleFrequency = "real_time" | "daily" | "weekly";
export type RuleStatus = "active" | "draft" | "paused";
export type RuleScope = "tag" | "membership";
export type RuleAction =
  | { type: "tag" }
  | {
      type: "award_points";
      points: number;
      reason: string | null;
      once: "ever" | "year" | "month";
    }
  | { type: "follow_up"; note: string; once: "ever" | "year" | "month" };

export type CrmRule = {
  id: string;
  scope: RuleScope;
  name: string;
  description: string | null;
  conditions: Condition[];
  match: Match;
  action: RuleAction;
  tag_id: string | null;
  frequency: RuleFrequency;
  status: RuleStatus;
  last_run_at: string | null;
  matched_count: number;
  created_at: string;
  tag_name: string | null;
  tag_color: TagColor | null;
  tag_icon: TagIcon | null;
  tag_status: string | null;
  rule_type: string;
};
export type RuleRun = { matched: number; added: number; removed: number };
export type RuleList = {
  items: CrmRule[];
  kpis: {
    total: number;
    active: number;
    active_last_month: number;
    events_this_month: number;
    customers_matched: number;
  };
};
export type Preview = {
  matched: number;
  sample: { id: string; name: string }[];
};
export type SavedSegment = {
  id: string;
  name: string;
  description: string | null;
  conditions: Condition[];
  match: Match;
  member_count: number;
  counted_at: string | null;
  created_at: string;
  rule_type: string;
};

type Input =
  | "money"
  | "number"
  | "none"
  | "tiers"
  | "channels"
  | "customer_type"
  | "text"
  | "gender"
  | "tags";

export const FIELD_META: Record<
  ConditionField,
  { label: string; ops: ConditionOp[]; input: Input; unit?: string }
> = {
  total_spend: {
    label: "Total spend",
    ops: ["gt", "gte", "lt", "lte"],
    input: "money",
  },
  orders: {
    label: "Number of orders",
    ops: ["gt", "gte", "lt", "lte", "eq"],
    input: "number",
  },
  points: {
    label: "Loyalty points",
    ops: ["gt", "gte", "lt", "lte"],
    input: "number",
  },
  days_since_last_purchase: {
    label: "Days since last purchase",
    ops: ["gt", "gte", "lt", "lte"],
    input: "number",
    unit: "days",
  },
  joined_within_days: {
    label: "Joined within",
    ops: ["lte"],
    input: "number",
    unit: "days",
  },
  birthday_within_days: {
    label: "Birthday within",
    ops: ["lte"],
    input: "number",
    unit: "days",
  },
  birthday_this_month: {
    label: "Birthday this month",
    ops: ["is"],
    input: "none",
  },
  membership_expires_within_days: {
    label: "Membership expires within",
    ops: ["lte"],
    input: "number",
    unit: "days",
  },
  coupon_uses: {
    label: "Coupon uses",
    ops: ["gt", "gte", "lt", "lte"],
    input: "number",
  },
  tier: { label: "Membership", ops: ["in"], input: "tiers" },
  customer_type: {
    label: "Customer type",
    ops: ["eq"],
    input: "customer_type",
  },
  purchase_channel: { label: "Has bought via", ops: ["in"], input: "channels" },
  city: { label: "City", ops: ["eq"], input: "text" },
  gender: { label: "Gender", ops: ["eq"], input: "gender" },
  has_tag: { label: "Has tag", ops: ["in"], input: "tags" },
};

export const OP_LABEL: Record<ConditionOp, string> = {
  gt: "is greater than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  eq: "is",
  in: "is any of",
  is: "",
};
const OP_SYMBOL: Record<ConditionOp, string> = {
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  eq: "=",
  in: "",
  is: "",
};

export const CHANNEL_LABEL: Record<string, string> = {
  online: "Website",
  pos: "In store (POS)",
  whatsapp: "WhatsApp",
};
export const FREQUENCY_LABEL: Record<RuleFrequency, string> = {
  real_time: "Real-time",
  daily: "Daily",
  weekly: "Weekly",
};
export const ONCE_LABEL = {
  ever: "Once ever",
  year: "Once a year",
  month: "Once a month",
} as const;

/** A sensible starting value for a field. */
export function defaultCondition(field: ConditionField): Condition {
  const meta = FIELD_META[field];
  const op = meta.ops[0];
  switch (meta.input) {
    case "money":
      return { field, op, value: 2_000_000 };
    case "number":
      return {
        field,
        op,
        value:
          field === "days_since_last_purchase"
            ? 60
            : field === "orders"
              ? 3
              : 30,
      };
    case "none":
      return { field, op, value: true };
    case "tiers":
      return { field, op, value: ["gold"] };
    case "channels":
      return { field, op, value: ["online"] };
    case "customer_type":
      return { field, op, value: "individual" };
    case "gender":
      return { field, op, value: "female" };
    case "tags":
      return { field, op, value: [] };
    default:
      return { field, op, value: "" };
  }
}

/** Whether a condition has a value the server will accept the shape of (the server checks ranges). */
export function conditionReady(c: Condition): boolean {
  const input = FIELD_META[c.field].input;
  if (input === "none") return true;
  if (Array.isArray(c.value)) return c.value.length > 0;
  if (input === "money" || input === "number")
    return typeof c.value === "number" && Number.isInteger(c.value);
  return typeof c.value === "string" && c.value.trim() !== "";
}

/** "Total spend > ₹25,000", "Days since last purchase ≥ 60 days", "Membership is Gold or Platinum". */
export function describeCondition(
  c: Condition,
  tagNames: Record<string, string> = {},
  currency = "INR",
): string {
  const meta = FIELD_META[c.field];
  const sym = OP_SYMBOL[c.op];
  switch (meta.input) {
    case "money":
      return `${meta.label} ${sym} ${formatMoney(Number(c.value ?? 0), currency)}`;
    case "number":
      if (c.op === "lte" && meta.unit)
        return `${meta.label} ${Number(c.value ?? 0).toLocaleString("en-IN")} ${meta.unit}`;
      return `${meta.label} ${sym} ${Number(c.value ?? 0).toLocaleString("en-IN")}${meta.unit ? ` ${meta.unit}` : ""}`;
    case "none":
      return meta.label;
    case "tiers":
      return `${meta.label} is ${((c.value as string[]) ?? []).map((t) => SEGMENT_META[t as Segment]?.label ?? t).join(" or ")}`;
    case "channels":
      return `${meta.label} ${((c.value as string[]) ?? []).map((t) => CHANNEL_LABEL[t] ?? t).join(" or ")}`;
    case "tags":
      return `${meta.label} ${((c.value as string[]) ?? []).map((t) => tagNames[t] ?? "a tag").join(" or ")}`;
    case "customer_type":
      return `${meta.label} is ${c.value === "business" ? "Business (B2B)" : "Individual"}`;
    default:
      return `${meta.label} is ${String(c.value ?? "")}`;
  }
}

export function describeConditions(
  conditions: Condition[],
  match: Match,
  tagNames: Record<string, string> = {},
  currency = "INR",
): string {
  if (conditions.length === 0) return "No conditions yet";
  return conditions
    .map((c) => describeCondition(c, tagNames, currency))
    .join(match === "any" ? " or " : " and ");
}

export function describeAction(a: RuleAction): string {
  if (a.type === "award_points")
    return `Give ${a.points.toLocaleString("en-IN")} points (${ONCE_LABEL[a.once].toLowerCase()})`;
  if (a.type === "follow_up") return `Follow-up: ${a.note}`;
  return "Tag customers";
}
