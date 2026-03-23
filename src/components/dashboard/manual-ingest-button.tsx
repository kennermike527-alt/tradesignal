"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { runManualIngestionAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function ManualIngestButton() {
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
    <div className="flex flex-col gap-2">
      <Button onClick={onRun} disabled={pending} className="gap-2">
        <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
        {pending ? "Running ingestion..." : "Run ingestion now"}
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
