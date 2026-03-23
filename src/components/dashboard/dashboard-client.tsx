"use client";

import * as React from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { ExternalLink, MessageSquare, Repeat2, Sparkles, ThumbsUp } from "lucide-react";
import type { AccountCategory } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardPost } from "@/lib/types";
import { toTitleCase, truncate } from "@/lib/utils";

type AccountFilter = {
  id: string;
  displayName: string;
  handle: string;
  category: AccountCategory;
};

type TimeWindow = "24h" | "72h" | "7d" | "30d" | "all";

type Props = {
  posts: DashboardPost[];
  accounts: AccountFilter[];
  categories: AccountCategory[];
};

function engagementTotal(post: DashboardPost) {
  return post.likeCount + post.replyCount + post.repostCount + (post.quoteCount || 0);
}

function inWindow(postedAt: Date, window: TimeWindow) {
  if (window === "all") return true;

  const now = Date.now();
  const hours = window === "24h" ? 24 : window === "72h" ? 72 : window === "7d" ? 24 * 7 : 24 * 30;
  const cutoff = now - hours * 60 * 60 * 1000;
  return postedAt.getTime() >= cutoff;
}

export function DashboardClient({ posts, accounts, categories }: Props) {
  const [accountId, setAccountId] = React.useState<string>("all");
  const [category, setCategory] = React.useState<string>("all");
  const [query, setQuery] = React.useState("");
  const [minEngagement, setMinEngagement] = React.useState(0);
  const [timeWindow, setTimeWindow] = React.useState<TimeWindow>("7d");

  const filtered = React.useMemo(() => {
    return posts
      .filter((post) => (accountId === "all" ? true : post.accountId === accountId))
      .filter((post) => (category === "all" ? true : post.account.category === category))
      .filter((post) => (query.trim().length === 0 ? true : `${post.content} ${post.account.displayName} ${post.account.handle}`.toLowerCase().includes(query.toLowerCase())))
      .filter((post) => engagementTotal(post) >= minEngagement)
      .filter((post) => inWindow(new Date(post.postedAt), timeWindow))
      .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
  }, [posts, accountId, category, query, minEngagement, timeWindow]);

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>Account</span>
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="all">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="all">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {toTitleCase(item)}
                </option>
              ))}
            </select>
          </label>

          <Input placeholder="Keyword search" value={query} onChange={(event) => setQuery(event.target.value)} />

          <Input
            type="number"
            min={0}
            placeholder="Min engagement"
            value={minEngagement}
            onChange={(event) => setMinEngagement(Number(event.target.value || 0))}
          />

          <label className="grid gap-1 text-xs text-muted-foreground">
            <span>Time window</span>
            <select
              value={timeWindow}
              onChange={(event) => setTimeWindow(event.target.value as TimeWindow)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="24h">Last 24h</option>
              <option value="72h">Last 72h</option>
              <option value="7d">Last 7d</option>
              <option value="30d">Last 30d</option>
              <option value="all">All time</option>
            </select>
          </label>
        </CardContent>
      </Card>

      {posts.length === 0 ? (
        <Card className="border-border/70 bg-card/70">
          <CardContent className="space-y-2 py-10 text-center">
            <p className="text-sm text-muted-foreground">No posts ingested yet.</p>
            <div className="mx-auto max-w-sm space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-border/70 bg-card/70">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No posts match your current filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => {
            const posted = new Date(post.postedAt);
            const engagement = engagementTotal(post);

            return (
              <Card key={post.id} className="border-border/70 bg-card/70">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{post.account.displayName}</p>
                        <span className="text-xs text-muted-foreground">@{post.account.handle}</span>
                        <Badge variant="outline">{toTitleCase(post.account.category)}</Badge>
                      </div>
                      {post.account.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {post.account.tags.slice(0, 4).map((tag) => (
                            <Badge key={`${post.id}-${tag}`} variant="secondary" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="text-right text-xs text-muted-foreground">
                      <p>{formatDistanceToNowStrict(posted, { addSuffix: true })}</p>
                      <p>{posted.toLocaleString()}</p>
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed text-foreground/90">{truncate(post.content, 420)}</p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp className="size-3" /> {post.likeCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="size-3" /> {post.replyCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Repeat2 className="size-3" /> {post.repostCount}
                    </span>
                    <span>Total: {engagement}</span>
                    <a
                      href={post.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Source <ExternalLink className="size-3" />
                    </a>
                  </div>

                  {post.summary ? (
                    <div className="rounded-md border border-primary/25 bg-primary/5 p-3">
                      <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-primary/90">
                        <Sparkles className="size-3" /> Why this matters
                      </p>
                      <p className="text-sm text-foreground/90">{post.summary.summary}</p>
                    </div>
                  ) : (
                    <div className="rounded-md border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
                      Summary pending…
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
