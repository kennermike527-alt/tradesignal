import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { getDashboardPayload } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const payload = await getDashboardPayload(420);
  return <DashboardClient payload={payload} />;
}
