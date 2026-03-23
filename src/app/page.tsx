import { SocialProvider } from "@prisma/client";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { IngestionRunsPanel } from "@/components/dashboard/ingestion-runs-panel";
import { StatsStrip } from "@/components/dashboard/stats-strip";
import { getDashboardPayload } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const payload = await getDashboardPayload(350);

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <DashboardHeader providerLabel={SocialProvider.X} />
        <StatsStrip stats={payload.stats} />

        <section className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <DashboardClient posts={payload.posts} accounts={payload.accounts} categories={payload.categories} />
          <IngestionRunsPanel runs={payload.ingestionRuns} />
        </section>
      </div>
    </main>
  );
}
