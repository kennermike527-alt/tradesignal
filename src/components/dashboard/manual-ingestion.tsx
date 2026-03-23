'use client';

import { useState, useTransition } from 'react';
import { Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { runIngestionAction } from '@/app/actions/ingestion';

export function ManualIngestion() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>('');

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            setMessage('');
            const result = await runIngestionAction();
            if (result.status === 'FAILED') {
              setMessage(`Run failed. ${result.errors.length} account errors.`);
              return;
            }
            setMessage(
              `Run ${result.status.toLowerCase()}: ${result.insertedPosts} new post(s), ${result.summarizedPosts} summary(ies), ${result.deduplicatedPosts} deduped.`
            );
          });
        }}
        className="gap-2"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {isPending ? 'Running ingestion...' : 'Run ingestion now'}
      </Button>
      {message ? <p className="text-xs text-slate-300">{message}</p> : null}
    </div>
  );
}
