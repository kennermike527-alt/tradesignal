import { ActivitySquare, DatabaseZap, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ManualIngestButton } from "@/components/dashboard/manual-ingest-button";

type Props = {
  providerLabel: string;
};

export function DashboardHeader({ providerLabel }: Props) {
  return (
    <Card className="relative overflow-hidden border-primary/25 bg-card/80 backdrop-blur">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.24),transparent_45%)]" />
      <CardContent className="relative z-10 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            <ActivitySquare className="size-3.5" />
            SignalForge — tradesignal
          </p>

          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Real-time social intelligence command center
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2 py-1">
              <DatabaseZap className="size-3.5" /> Provider: {providerLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-primary">
              <Sparkles className="size-3.5" /> AI summaries enabled
            </span>
          </div>
        </div>

        <ManualIngestButton />
      </CardContent>
    </Card>
  );
}
