"use client";

import { ChartBarLineIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { SegmentsView } from "@/components/crm/rules/SegmentsView";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { hasTenantWide, useStaffSession } from "@/lib/staffAuth";

/** Customers > Segments. */
export default function CustomerSegmentsPage() {
  const { tenant, ready } = usePortalGuard();
  const session = useStaffSession();
  const [creating, setCreating] = useState(false);
  if (!ready) return null;
  const canConfigure = hasTenantWide(session, "customers:update");
  return (
    <PortalShell tenant={tenant} active="customers-segments">
      <PageHeader
        icon={<HugeiconsIcon icon={ChartBarLineIcon} size={20} />}
        title="Customer Segments"
        description="Save groups of customers by what they do, e.g. big spenders or customers who haven't bought in a while, and reach them with campaigns."
        actions={
          canConfigure && (
            <Button
              onClick={() => setCreating(true)}
              className="shrink-0 whitespace-nowrap"
            >
              <HugeiconsIcon icon={PlusSignIcon} size={16} /> Create segment
            </Button>
          )
        }
      />
      <SegmentsView
        currency={tenant?.currency ?? "INR"}
        canConfigure={canConfigure}
        creating={creating}
        onCreatingDone={() => setCreating(false)}
      />
    </PortalShell>
  );
}
