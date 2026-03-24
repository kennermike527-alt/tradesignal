"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-start justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold text-slate-100">Terminal temporarily unavailable</h1>
      <p className="text-sm text-slate-300">
        We hit a runtime issue while loading the intelligence terminal. No raw infrastructure details are shown in this
        view. Retry once; if it persists, verify environment and database setup.
      </p>
      <Button onClick={reset}>Retry</Button>
    </main>
  );
}
