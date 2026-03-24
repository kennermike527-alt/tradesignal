"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { IntelligenceCenter, SourcePlatform, WatchlistKey } from "@/lib/types";

type Props = {
  open: boolean;
  watchlistKey: WatchlistKey | null;
  watchlistLabel: string;
  center: IntelligenceCenter;
  sourcePlatform: SourcePlatform;
  pending: boolean;
  message: { kind: "success" | "error"; text: string } | null;
  onClose: () => void;
  onSubmit: (input: { displayName?: string; handle: string }) => void;
};

export function AddWatchlistAccountDialog({
  open,
  watchlistKey,
  watchlistLabel,
  center,
  sourcePlatform,
  pending,
  message,
  onClose,
  onSubmit,
}: Props) {
  const [displayName, setDisplayName] = React.useState("");
  const [handle, setHandle] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setDisplayName("");
      setHandle("");
    }
  }, [open]);

  if (!open || !watchlistKey) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm">
      <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-2xl">
        <CardHeader className="space-y-1 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Add account to {watchlistLabel}</CardTitle>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-border/70 bg-background/60 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Context locked: {center} · {sourcePlatform === "X" ? "X" : "LinkedIn"}
          </p>
        </CardHeader>

        <CardContent className="space-y-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>Account name (optional)</span>
            <Input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="h-9 text-sm"
              placeholder="Display name"
            />
          </label>

          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>{sourcePlatform === "X" ? "Handle / username" : "Handle / slug"} (required)</span>
            <Input
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              className="h-9 text-sm"
              placeholder={sourcePlatform === "X" ? "@account" : "company-slug"}
            />
          </label>

          {message ? (
            <div
              className={`rounded border px-2 py-1.5 text-xs ${
                message.kind === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-200"
              }`}
            >
              {message.text}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" className="h-8 px-3 text-xs" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              className="h-8 gap-1.5 px-3 text-xs"
              onClick={() => onSubmit({ displayName: displayName.trim(), handle: handle.trim() })}
              disabled={pending || !handle.trim()}
            >
              <Plus className="size-3" />
              {pending ? "Adding..." : "Add account"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
