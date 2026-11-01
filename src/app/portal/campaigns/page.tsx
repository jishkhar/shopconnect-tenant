"use client";

import { Megaphone01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CampaignsTab } from "@/components/crm/CampaignsTab";
import { CommunicationTab } from "@/components/crm/CommunicationTab";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { hasPermission, useStaffSession } from "@/lib/staffAuth";

type View = "campaigns" | "messages";
const VIEWS: { key: View; label: string }[] = [
  { key: "campaigns", label: "Campaigns" },
  { key: "messages", label: "Messages" },
];

/** Campaigns: marketing campaigns (with an existing or new discount) and the log of every message sent to customers. */
export default function CampaignsPage() {
  const { tenant, ready } = usePortalGuard();
  const session = useStaffSession();
  const router = useRouter();
  const [view, setView] = useState<View>("campaigns");
  if (!ready) return null;
  const canEdit = hasPermission(session, "customers", "write");
  return (
    <PortalShell tenant={tenant} active="campaigns">
      <PageHeader
        icon={<HugeiconsIcon icon={Megaphone01Icon} size={20} />}
        title="Campaigns"
        description="Reach your customers on WhatsApp, email and SMS, with an offer from Discounts."
      />
      <Tabs tabs={VIEWS} value={view} onChange={setView} />
      {view === "campaigns" && (
        <CampaignsTab canEdit={canEdit} onChanged={() => {}} />
      )}
      {view === "messages" && (
        <CommunicationTab
          show="messages"
          canEdit={canEdit}
          onChanged={() => {}}
          onOpenCustomer={(id) => router.push(`/portal/customers/${id}`)}
        />
      )}
    </PortalShell>
  );
}
