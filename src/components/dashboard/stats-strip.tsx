import { Activity, Clock3, Database, Radar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardStats } from "@/lib/types";
import { statusTone } from "@/lib/dashboard/queries";

type Props = {
  stats: DashboardStats;
};

function toneClass(tone: ReturnType<typeof statusTone>) {
  if (tone === "success") return "text-emerald-400";
  if (tone === "warning") return "text-amber-400";
  if (tone === "danger") return "text-rose-400";
  return "text-muted-foreground";
}

export function StatsStrip({ stats }: Props) {
  const tone = statusTone(stats.latestIngestionStatus);

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Tracked accounts</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-2">
          <div>
            <p className="text-2xl font-semibold leading-none">{stats.activeAccounts}</p>
            <p className="mt-1 text-xs text-muted-foreground">Active of {stats.totalAccounts}</p>
          </div>
          <Radar className="size-4 text-muted-foreground" />
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Signal throughput (24h)</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-2">
          <div>
            <p className="text-2xl font-semibold leading-none">{stats.posts24h}</p>
            <p className="mt-1 text-xs text-muted-foreground">Recent post ingest volume</p>
          </div>
          <Activity className="size-4 text-muted-foreground" />
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Signal throughput (7d)</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-2">
          <div>
            <p className="text-2xl font-semibold leading-none">{stats.posts7d}</p>
            <p className="mt-1 text-xs text-muted-foreground">Weekly ingest context</p>
          </div>
          <Database className="size-4 text-muted-foreground" />
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Latest ingestion state</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className={`text-sm font-semibold uppercase tracking-wide ${toneClass(tone)}`}>
            {stats.latestIngestionStatus ?? "N/A"}
          </p>
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3 className="size-3" />
            {stats.latestIngestionAt ? new Date(stats.latestIngestionAt).toLocaleString() : "No runs yet"}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
