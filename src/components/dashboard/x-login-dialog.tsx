"use client";

import * as React from "react";
import { KeyRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  pending?: boolean;
  message: { kind: "success" | "error"; text: string } | null;
  onClose: () => void;
  onSubmit: (input: { username: string; accessToken: string }) => void;
};

export function XLoginDialog({ open, pending = false, message, onClose, onSubmit }: Props) {
  const [username, setUsername] = React.useState("");
  const [accessToken, setAccessToken] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setUsername("");
      setAccessToken("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm">
      <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-2xl">
        <CardHeader className="space-y-1 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Connect X account</CardTitle>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-border/70 bg-background/60 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Needed for direct Engage Now replies from your own X account.
          </p>
        </CardHeader>

        <CardContent className="space-y-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>X username</span>
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="h-9 text-sm"
              placeholder="@yourhandle"
            />
          </label>

          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>User access token (Bearer)</span>
            <Input
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              className="h-9 text-sm"
              placeholder="Paste token"
              type="password"
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
              onClick={() => onSubmit({ username: username.trim(), accessToken: accessToken.trim() })}
              disabled={pending || !username.trim() || !accessToken.trim()}
            >
              <KeyRound className="size-3" />
              {pending ? "Connecting..." : "Connect X"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
