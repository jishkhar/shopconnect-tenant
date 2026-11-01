"use client";

import { MembershipTab } from "@/components/crm/membership/MembershipTab";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { hasPermission, hasTenantWide, useStaffSession } from "@/lib/staffAuth";

/** Customers > Membership: plans, benefits, members, rules and loyalty points. */
export default function MembershipPage() {
  const { tenant, ready } = usePortalGuard();
  const session = useStaffSession();
  if (!ready) return null;
  return (
    <PortalShell tenant={tenant} active="customers-membership">
      <MembershipTab
        currency={tenant?.currency ?? "INR"}
        canEdit={hasPermission(session, "customers", "write")}
        canConfigure={hasTenantWide(session, "customers:update")}
        onChanged={() => {}}
      />
    </PortalShell>
  );
}
