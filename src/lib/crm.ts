import type { Channel, CustomerAddress } from "@/lib/erp";

export type Segment =
  "regular" | "silver" | "gold" | "platinum" | "inactive" | "not_member";
export type MessageChannel = "whatsapp" | "sms" | "email";

export const SEGMENT_META: Record<
  Segment,
  {
    label: string;
    tone: "warning" | "violet" | "neutral" | "error";
    rule: string;
  }
> = {
  not_member: {
    label: "Not a member",
    tone: "neutral",
    rule: "Has not completed membership enrollment with name, date of birth, phone and email.",
  },
  regular: {
    label: "Regular",
    tone: "neutral",
    rule: "Below the Silver loyalty-point threshold.",
  },
  silver: {
    label: "Silver",
    tone: "neutral",
    rule: "Meets the Silver threshold, below Gold.",
  },
  gold: {
    label: "Gold",
    tone: "warning",
    rule: "Meets the Gold threshold, below Platinum.",
  },
  platinum: {
    label: "Platinum",
    tone: "violet",
    rule: "Meets the highest loyalty-point threshold.",
  },
  inactive: {
    label: "Inactive",
    tone: "error",
    rule: "Has ordered before, but not within the inactive window.",
  },
};
export const SEGMENT_ORDER: Segment[] = [
  "regular",
  "silver",
  "gold",
  "platinum",
  "inactive",
  "not_member",
];

export const MESSAGE_CHANNELS: Record<MessageChannel, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "Email",
};

export type CrmCustomer = {
  id: string;
  customer_code: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  status: "active" | "blocked";
  tags: string[];
  whatsapp_opt_in: boolean;
  total_orders: number;
  total_spent_minor: number;
  last_order_at: string | null;
  created_at: string;
  segment: Segment;
  membership_eligible: boolean;
  membership_joined_at: string | null;
  loyalty_points: number;
};

export type CrmProfile = CrmCustomer & {
  notes: string | null;
  gstin: string | null;
  birthday: string | null;
  gender: string | null;
  preferences: string | null;
  loyalty: { points: number; earned: number; adjusted: number };
  addresses: CustomerAddress[];
};

export type CrmSummary = {
  total_customers: number;
  active_customers: number;
  platinum_customers: number;
  new_this_month: number;
  avg_purchase_value_minor: number;
  repeat_rate_pct: number;
  repeat_customers: number;
  follow_ups_due: number;
};

export type CrmSettings = {
  silver_min_points: number;
  gold_min_points: number;
  platinum_min_points: number;
  inactive_after_days: number;
  points_per_100: number;
  redemption_points: number;
  redemption_value_minor: number;
};

export type CrmNote = {
  id: string;
  customer_id: string;
  customer_name?: string;
  body: string;
  follow_up_at: string | null;
  done_at: string | null;
  created_at: string;
  author: string | null;
};

export type CrmMessage = {
  id: string;
  customer_id: string;
  customer_name: string;
  campaign_id: string | null;
  campaign_name: string | null;
  channel: MessageChannel;
  subject: string | null;
  body: string;
  /** WhatsApp campaign messages go queued → sending → sent → delivered → read (or failed), from Meta's delivery reports. */
  status: "queued" | "sending" | "sent" | "delivered" | "read" | "failed";
  error: string | null;
  created_at: string;
};

export type CampaignChannel = MessageChannel | "pos" | "website";
export type CampaignObjective =
  "sales" | "retention" | "loyalty" | "launch" | "reactivation" | "awareness";
export type CampaignType =
  "discount" | "loyalty" | "message" | "launch" | "event";
export type CampaignAudience = {
  segment?: Segment;
  /** A saved segment (Customers > Segments). */
  segment_id?: string;
  tag?: string;
  customer_id?: string;
  customer_type?: "individual" | "business";
  only_new?: boolean;
  city?: string;
  purchase?: "bought" | "never" | "repeat" | "recent";
  gender?: "male" | "female" | "other";
  since?: "30d" | "90d" | "1y";
};

export type Campaign = {
  id: string;
  name: string;
  channel: MessageChannel;
  audience: CampaignAudience;
  /** Every channel chosen: messaging channels send, POS and website show the offer. `channel` is the first that sends messages. */
  channels: CampaignChannel[];
  description: string | null;
  objective: CampaignObjective;
  campaign_type: CampaignType;
  starts_at: string | null;
  ends_at: string | null;
  subject: string | null;
  message: string;
  discount_id: string | null;
  discount_code: string | null;
  /** "sending": a WhatsApp campaign whose messages are going out in the background. */
  status: "draft" | "sending" | "sent";
  recipient_count: number;
  /** Messages WhatsApp (or the email provider) accepted. */
  delivered_count: number;
  /** WhatsApp only: the approved Meta template sent, and one value per {{n}} (may use {{name}} / {{code}}). */
  whatsapp_template: string | null;
  template_language: string | null;
  template_params: string[];
  /** From Meta's delivery reports: reached the phone, opened, or failed. */
  delivered_n: number;
  read_n: number;
  failed_n: number;
  sent_at: string | null;
  created_at: string;
};

export type LoyaltyOverview = {
  settings: CrmSettings;
  members: number;
  points_earned: number;
  points_adjusted: number;
  top: {
    id: string;
    customer_code: string | null;
    name: string;
    segment: Segment;
    loyalty_points: number;
    credit_balance_minor: number;
  }[];
  recent: {
    id: string;
    customer_id: string;
    customer_name: string;
    delta: number;
    reason: string;
    created_at: string;
  }[];
};

export type CrmAnalytics = {
  customer_growth: { month: string; customers: number }[];
  top_customers: {
    id: string;
    customer_code: string | null;
    name: string;
    segment: Segment;
    total_orders: number;
    total_spent_minor: number;
  }[];
  avg_lifetime_value_minor: number;
  avg_orders_per_customer: number;
  orders_by_channel: {
    channel: Channel;
    orders: number;
    revenue_minor: number;
  }[];
  segments: { key: Segment; customers: number }[];
};

export const initials = (name: string) =>
  (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

export const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

export const TEXTAREA_CLASS =
  "w-full rounded-md border border-line bg-card px-space-3 py-space-2 text-[14px] text-ink-900 shadow-[var(--shadow-sm)] focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none";
