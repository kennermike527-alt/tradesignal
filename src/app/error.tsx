'use client';

import { Button } from '@/components/ui/button';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-start justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold text-slate-100">Dashboard failed to load</h1>
      <p className="text-sm text-slate-300">{error.message || 'Unexpected server error.'}</p>
      <Button onClick={reset}>Retry</Button>
    </main>
  );
}
