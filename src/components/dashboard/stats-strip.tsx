import { Activity, Clock3, Database, Radar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardStats } from "@/lib/types";
import { statusTone } from "@/lib/dashboard/queries";

type Props = {
  stats: DashboardStats;
};

export function StatsStrip({ stats }: Props) {
  const tone = statusTone(stats.latestIngestionStatus);

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Active accounts</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-2xl font-semibold">{stats.activeAccounts}</p>
          <Radar className="size-4 text-muted-foreground" />
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Posts in 24h</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-2xl font-semibold">{stats.posts24h}</p>
          <Activity className="size-4 text-muted-foreground" />
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Posts in 7d</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-2xl font-semibold">{stats.posts7d}</p>
          <Database className="size-4 text-muted-foreground" />
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Latest ingestion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p
            className={[
              "text-sm font-semibold uppercase tracking-wide",
              tone === "success" && "text-emerald-400",
              tone === "warning" && "text-amber-400",
              tone === "danger" && "text-rose-400",
              tone === "muted" && "text-muted-foreground",
            ]
              .filter(Boolean)
              .join(" ")}
          >
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
