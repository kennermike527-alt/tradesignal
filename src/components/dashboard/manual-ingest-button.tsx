"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { runManualIngestionAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

type Props = {
  compact?: boolean;
};

export function ManualIngestButton({ compact = false }: Props) {
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<string | null>(null);

  const onRun = () => {
    setMessage(null);

    startTransition(async () => {
      const result = await runManualIngestionAction();
      setMessage(result.message);
    });
  };

  return (
    <div className="flex w-full max-w-sm flex-col gap-1 sm:w-auto">
      <Button onClick={onRun} disabled={pending} className={`gap-2 ${compact ? "h-8 px-3 text-xs" : ""}`}>
        <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
        {pending ? "Ingesting..." : "Run ingest"}
      </Button>
      {message ? (
        <p className="rounded border border-border/70 bg-background/50 px-2 py-1 text-[11px] text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
