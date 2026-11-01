"use client";

import {
  BarChart3,
  LifeBuoy,
  CalendarDays,
  CalendarHeart,
  CalendarOff,
  Clock,
  Globe,
  FolderOpen,
  LayoutDashboard,
  LogIn,
  Lock,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  Banknote,
  Building2,
  Package,
  Truck,
  Settings,
  ShoppingCart,
  Store,
  Tag,
  TrendingUp,
  UserCheck,
  Undo2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDataTransferHorizontalIcon,
  WarehouseIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { cn } from "@/lib/cn";
import type { Service } from "@/lib/services";
import { hasPermission, useStaffSession } from "@/lib/staffAuth";
import type { PortalTenant } from "@/lib/portalAuth";

type NavGroup =
  "Main" | "Sales Channels" | "Back Office" | "Workforce" | "Admin";

type NavItem = {
  key: string;
  label: string;
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  href: string;
  /** Permission key (lib/staffAuth.ts PAGE_MODULE) deciding whether the item is shown. */
  pageKey: string;
  group: NavGroup;
  /** Listed but not usable yet. */
  disabled?: boolean;
  /** The service this item is the page of; it shows a lock while that service does not work. */
  service?: Service;
  /** Pages under this one, shown beneath it while it or one of them is open (their keys start with this item's key). */
  children?: { key: string; label: string; href: string }[];
};

type IconProps = { size?: number; strokeWidth?: number; className?: string };
const hugeNav = (icon: typeof WarehouseIcon) =>
  function NavIcon({ size, strokeWidth, className }: IconProps) {
    return (
      <HugeiconsIcon
        icon={icon}
        size={size}
        strokeWidth={strokeWidth}
        className={className}
      />
    );
  };
const InventoryNavIcon = hugeNav(WarehouseIcon);
const TransfersNavIcon = hugeNav(ArrowDataTransferHorizontalIcon);

const NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/portal/dashboard",
    pageKey: "dashboard",
    group: "Main",
  },
  {
    key: "orders",
    label: "Orders",
    icon: ShoppingCart,
    href: "/portal/orders",
    pageKey: "orders",
    group: "Main",
  },
  {
    key: "returns",
    label: "Returns",
    icon: Undo2,
    href: "/portal/returns",
    pageKey: "orders",
    group: "Main",
  },
  {
    key: "products",
    label: "Products",
    icon: Package,
    href: "/portal/products",
    pageKey: "products",
    group: "Main",
  },
  {
    key: "collections",
    label: "Collections",
    icon: FolderOpen,
    href: "/portal/collections",
    pageKey: "products",
    group: "Main",
  },
  {
    key: "customers",
    label: "Customers",
    icon: Users,
    href: "/portal/customers",
    pageKey: "customers",
    group: "Main",
    children: [
      { key: "customers", label: "All Customers", href: "/portal/customers" },
      {
        key: "customers-membership",
        label: "Membership",
        href: "/portal/customers/membership",
      },
      { key: "customers-tags", label: "Tags", href: "/portal/customers/tags" },
      {
        key: "customers-segments",
        label: "Segments",
        href: "/portal/customers/segments",
      },
    ],
  },
  {
    key: "whatsapp-inbox",
    label: "WhatsApp Inbox",
    icon: MessageCircle,
    href: "/portal/whatsapp-inbox",
    pageKey: "whatsapp",
    group: "Main",
  },
  {
    key: "whatsapp-automation",
    label: "WhatsApp Automation",
    icon: Zap,
    href: "/portal/whatsapp-automation",
    pageKey: "whatsapp",
    group: "Main",
  },
  {
    key: "discounts",
    label: "Discounts",
    icon: Tag,
    href: "/portal/discounts",
    pageKey: "discounts",
    group: "Main",
  },
  {
    key: "campaigns",
    label: "Campaigns",
    icon: Megaphone,
    href: "/portal/campaigns",
    pageKey: "customers",
    group: "Main",
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: BarChart3,
    href: "/portal/analytics",
    pageKey: "reports",
    group: "Main",
  },
  {
    key: "feedback",
    label: "Feedback",
    icon: MessageSquareText,
    href: "/portal/feedback",
    pageKey: "feedback",
    group: "Main",
  },
  {
    key: "growth",
    label: "Growth",
    icon: TrendingUp,
    href: "/portal/growth",
    pageKey: "growth",
    group: "Main",
    disabled: true,
  },

  {
    key: "channel-online",
    label: "Website",
    icon: Globe,
    href: "/portal/channels/online",
    pageKey: "channels",
    group: "Sales Channels",
    service: "online",
  },
  {
    key: "channel-pos",
    label: "POS",
    icon: Store,
    href: "/portal/channels/pos",
    pageKey: "channels",
    group: "Sales Channels",
    service: "pos",
  },
  {
    key: "channel-whatsapp",
    label: "WhatsApp",
    icon: WhatsAppIcon,
    href: "/portal/channels/whatsapp",
    pageKey: "channels",
    group: "Sales Channels",
    service: "whatsapp",
  },

  {
    key: "procurement",
    label: "Procurement",
    icon: Truck,
    href: "/portal/procurement",
    pageKey: "procurement",
    group: "Back Office",
  },
  {
    key: "wholesale",
    label: "Wholesale",
    icon: Building2,
    href: "/portal/wholesale",
    pageKey: "wholesale",
    group: "Back Office",
  },
  {
    key: "inventory",
    label: "Inventory",
    icon: InventoryNavIcon,
    href: "/portal/inventory",
    pageKey: "inventory",
    group: "Back Office",
  },
  {
    key: "transfers",
    label: "Transfers",
    icon: TransfersNavIcon,
    href: "/portal/transfers",
    pageKey: "transfers",
    group: "Back Office",
  },
  {
    key: "finance",
    label: "Finance",
    icon: Banknote,
    href: "/portal/finance",
    pageKey: "finance",
    group: "Back Office",
  },

  {
    key: "my-attendance",
    label: "Attendance",
    icon: Clock,
    href: "/portal/attendance",
    pageKey: "check_in_out",
    group: "Workforce",
  },
  {
    key: "check-in-out",
    label: "Check-in / Check-out",
    icon: LogIn,
    href: "/portal/check-in-out",
    pageKey: "check_in_out",
    group: "Workforce",
  },
  {
    key: "leave",
    label: "My Leave",
    icon: CalendarOff,
    href: "/portal/leave",
    pageKey: "my_leave",
    group: "Workforce",
  },
  {
    key: "holidays",
    label: "Holidays",
    icon: CalendarHeart,
    href: "/portal/holidays",
    pageKey: "holidays",
    group: "Workforce",
  },
  {
    key: "team-attendance",
    label: "Team Attendance",
    icon: UserCheck,
    href: "/portal/attendance-overview",
    pageKey: "attendance",
    group: "Workforce",
  },
  {
    key: "leave-requests",
    label: "Leave Requests",
    icon: CalendarDays,
    href: "/portal/leave-requests",
    pageKey: "leave_requests",
    group: "Workforce",
  },
];

/** Pinned at the bottom of the sidebar (where Log out used to be); Log out lives in the header's account menu. Everything else that was
 * under "Admin" (storefront, team, roles, billing) is inside Settings now. */
const SETTINGS_ITEM: NavItem = {
  key: "settings",
  label: "Settings",
  icon: Settings,
  href: "/portal/settings",
  pageKey: "settings",
  group: "Admin",
};

const SUPPORT_ITEM: NavItem = {
  key: "support",
  label: "Support",
  icon: LifeBuoy,
  href: "/portal/support",
  pageKey: "support",
  group: "Admin",
};

type Props = {
  tenant: PortalTenant | null;
  active: string;
  /** Mobile drawer state: off-canvas below the `lg` breakpoint (PortalShell owns the toggle). */
  open?: boolean;
  onClose?: () => void;
};

/** A sidebar item whose key names an access module ("whatsapp-inbox" -> whatsapp_inbox) is hidden when that module is off; each Back Office
 * item is its own optional module (off too while Back office is off: the server works that out); the whole Workforce group is the one
 * optional module "workforce"; the rest are unaffected. */
function moduleOn(
  modules: Record<string, boolean> | undefined,
  item: NavItem,
): boolean {
  const key =
    item.group === "Workforce" ? "workforce" : item.key.replace(/-/g, "_");
  return modules?.[key] !== false;
}

export function PortalSidebar({
  tenant,
  active,
  open = false,
  onClose,
}: Props) {
  const session = useStaffSession();

  // Nothing until the session has loaded (before it, hasPermission fails open and would flash items the person can't use).
  const allowed = (item: NavItem) =>
    !!session &&
    hasPermission(session, item.pageKey, "view") &&
    moduleOn(session.modules, item);
  const visible = NAV_ITEMS.filter(allowed);
  const showSettings = allowed(SETTINGS_ITEM);
  const showSupport = allowed(SUPPORT_ITEM);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <aside
        style={{
          paddingBottom: "calc(var(--space-4) + env(safe-area-inset-bottom))",
        }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-72 max-w-[85vw] shrink-0 -translate-x-full flex-col bg-brand-700 py-space-4 text-white transition-transform duration-200 ease-out",
          "lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0",
          open && "translate-x-0",
        )}
      >
        <div className="mb-space-4 flex items-center gap-space-3 px-space-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white">
            <LogoMark size={28} />
          </div>
          <div className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-bold">
              {tenant?.name || "ERP"}
            </span>
            <span className="block text-[11.5px] text-white/60">ERP</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="touch-target ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="mx-space-4 mb-space-2 border-t border-white/10" />

        <nav
          className="scrollbar-dark flex-1 overflow-y-auto px-space-3"
          aria-label="Main navigation"
        >
          {visible.map((item, index) => {
            const {
              key,
              label,
              icon: Icon,
              href,
              group,
              disabled,
              children,
            } = item;
            const inGroup = !!children?.some((c) => c.key === active);
            const isActive = key === active || inGroup;
            const startsGroup =
              index === 0 || visible[index - 1].group !== group;
            return (
              <div key={key}>
                {startsGroup && (
                  <p
                    className={cn(
                      "px-space-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-white/50 uppercase",
                      index === 0 ? "pt-space-2" : "pt-space-3",
                    )}
                  >
                    {group}
                  </p>
                )}
                {disabled ? (
                  <span
                    aria-disabled="true"
                    title="Coming soon"
                    className="flex w-full cursor-not-allowed items-center gap-space-3 rounded-md px-space-3 py-2.5 text-left text-[14px] font-medium text-white/40 select-none"
                  >
                    <Icon size={18} strokeWidth={2} className="shrink-0" />
                    {label}
                    <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white/60 uppercase">
                      Soon
                    </span>
                  </span>
                ) : (
                  <Link
                    href={href}
                    onClick={onClose}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-space-3 rounded-md px-space-3 py-2.5 text-left text-[14px] transition-colors duration-150",
                      isActive
                        ? "bg-white font-semibold text-brand-700 shadow-[var(--shadow-sm)]"
                        : "font-medium text-white/85 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon size={18} strokeWidth={2} className="shrink-0" />
                    {label}
                    {item.service &&
                      session?.services?.[item.service]?.locked && (
                        <Lock
                          size={13}
                          strokeWidth={2.25}
                          aria-label="Not active"
                          className="ml-auto shrink-0 opacity-70"
                        />
                      )}
                  </Link>
                )}
                {children && isActive && (
                  <div className="ml-[22px] mt-1 mb-space-1 space-y-0.5 border-l border-white/15 pl-space-2">
                    {children.map((c) => (
                      <Link
                        key={c.key}
                        href={c.href}
                        onClick={onClose}
                        aria-current={c.key === active ? "page" : undefined}
                        className={cn(
                          "block rounded-md px-space-3 py-2 text-[13.5px] transition-colors duration-150",
                          c.key === active
                            ? "bg-white/15 font-semibold text-white"
                            : "font-medium text-white/75 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="mx-space-4 mt-space-2 border-t border-white/10" />
        <div className="px-space-3 pt-space-2">
          {showSupport && (
            <Link
              href={SUPPORT_ITEM.href}
              onClick={onClose}
              aria-current={active === "support" ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-space-3 rounded-md px-space-3 py-2.5 text-left text-[14px] transition-colors duration-150",
                active === "support"
                  ? "bg-white font-semibold text-brand-700 shadow-[var(--shadow-sm)]"
                  : "font-medium text-white/80 hover:bg-white/[0.08] hover:text-white",
              )}
            >
              <LifeBuoy size={18} strokeWidth={2} className="shrink-0" />
              Support
            </Link>
          )}
          {showSettings && (
            <Link
              href={SETTINGS_ITEM.href}
              onClick={onClose}
              aria-current={active === "settings" ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-space-3 rounded-md px-space-3 py-2.5 text-left text-[14px] transition-colors duration-150",
                active === "settings"
                  ? "bg-white font-semibold text-brand-700 shadow-[var(--shadow-sm)]"
                  : "font-medium text-white/80 hover:bg-white/[0.08] hover:text-white",
              )}
            >
              <Settings size={18} strokeWidth={2} className="shrink-0" />
              Settings
            </Link>
          )}
          <p className="px-space-3 pt-space-2 text-[11.5px] leading-snug text-white/55">
            One company. Many branches. One source of truth.
          </p>
        </div>
      </aside>
    </>
  );
}
