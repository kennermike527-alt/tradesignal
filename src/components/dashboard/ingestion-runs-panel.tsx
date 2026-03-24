import { IngestionStatus } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Run = {
  id: string;
  status: IngestionStatus;
  startedAt: Date;
  finishedAt: Date | null;
  notes: string | null;
};

type Props = {
  runs: Run[];
};

const STATUS_TONE: Record<IngestionStatus, string> = {
  RUNNING: "text-sky-400",
  SUCCESS: "text-emerald-400",
  PARTIAL: "text-amber-400",
  FAILED: "text-rose-400",
};

export function IngestionRunsPanel({ runs }: Props) {
  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Recent ingestion runs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          runs.map((run) => (
            <div key={run.id} className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className={`font-semibold ${STATUS_TONE[run.status]}`}>{run.status}</span>
                <span className="text-muted-foreground">{new Date(run.startedAt).toLocaleTimeString()}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</p>
              {run.notes ? <p className="mt-1 text-muted-foreground">{run.notes}</p> : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
