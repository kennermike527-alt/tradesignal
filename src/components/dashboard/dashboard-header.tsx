import { ActivitySquare, DatabaseZap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ManualIngestButton } from "@/components/dashboard/manual-ingest-button";

type Props = {
  providerLabel: string;
};

export function DashboardHeader({ providerLabel }: Props) {
  return (
    <Card className="border-primary/20 bg-card/80">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <ActivitySquare className="size-3.5" />
            SignalForge — tradesignal
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Real-time social intelligence dashboard</h1>
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <DatabaseZap className="size-4" />
            Provider: {providerLabel} · recurring ingestion ready
          </p>
        </div>
        <ManualIngestButton />
      </CardContent>
    </Card>
  );
}
