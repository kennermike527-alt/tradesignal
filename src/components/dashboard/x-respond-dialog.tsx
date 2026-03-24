"use client";

import * as React from "react";
import { Send, X } from "lucide-react";
import type { DashboardPost } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  open: boolean;
  post: DashboardPost | null;
  pending?: boolean;
  message: { kind: "success" | "error"; text: string } | null;
  onClose: () => void;
  onSubmit: (input: { text: string; replyToTweetId?: string }) => void;
};

function extractTweetId(sourceUrl: string) {
  const match = sourceUrl.match(/\/status\/(\d+)/i);
  return match?.[1] ?? undefined;
}

export function XRespondDialog({ open, post, pending = false, message, onClose, onSubmit }: Props) {
  const [text, setText] = React.useState("");

  React.useEffect(() => {
    if (!open || !post) {
      setText("");
      return;
    }

    setText(`@${post.account.handle} `);
  }, [open, post]);

  if (!open || !post) return null;

  const replyToTweetId = extractTweetId(post.sourceUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm">
      <Card className="w-full max-w-lg border-border/80 bg-card/95 shadow-2xl">
        <CardHeader className="space-y-1 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Respond from your X account</CardTitle>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-border/70 bg-background/60 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Target: @{post.account.handle} · {post.sourcePlatform === "X" ? "X" : "LinkedIn"}
          </p>
        </CardHeader>

        <CardContent className="space-y-3">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-h-[120px] w-full rounded border border-border/70 bg-background/60 p-2 text-sm text-foreground outline-none focus:border-primary/40"
            placeholder="Write your response…"
            maxLength={280}
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{replyToTweetId ? `Replying to tweet ${replyToTweetId}` : "Posting a new tweet"}</span>
            <span>{text.length}/280</span>
          </div>

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
              onClick={() => onSubmit({ text: text.trim(), replyToTweetId })}
              disabled={pending || text.trim().length < 2 || text.trim().length > 280}
            >
              <Send className="size-3" />
              {pending ? "Posting..." : "Post to X"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
