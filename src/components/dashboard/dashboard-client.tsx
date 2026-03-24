"use client";

import * as React from "react";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Activity,
  AlertTriangle,
  Bot,
  Bookmark,
  Clock3,
  ExternalLink,
  Filter,
  Flame,
  Layers,
  MessageSquare,
  Radar,
  Repeat2,
  Sparkles,
  Target,
  ThumbsUp,
  Zap,
} from "lucide-react";
import { AccountCategory } from "@prisma/client";
import type { DashboardPayload, DashboardPost } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ManualIngestButton } from "@/components/dashboard/manual-ingest-button";
import { toTitleCase, truncate } from "@/lib/utils";

type Props = {
  payload: DashboardPayload;
};

type TimeWindow = "2h" | "24h" | "72h" | "7d" | "all";

type WatchlistKey = "all" | "priority" | "competitors" | "founders" | "media" | "ecosystem";

const watchlists: Array<{ key: WatchlistKey; label: string; description: string }> = [
  { key: "all", label: "All signals", description: "Entire monitored stream" },
  { key: "priority", label: "Priority radar", description: "High-signal + opportunities" },
  { key: "competitors", label: "Competitor board", description: "Competitive posture updates" },
  { key: "founders", label: "Founder tape", description: "Roadmap + strategic intent" },
  { key: "media", label: "Media pulse", description: "Narrative amplification risk" },
  { key: "ecosystem", label: "Ecosystem ops", description: "Partnership + launch chatter" },
];

const narrativePatterns = [
  { id: "policy", label: "Policy", test: /policy|regulat|compliance/i },
  { id: "partnership", label: "Partnerships", test: /partner|integrat|alliance/i },
  { id: "liquidity", label: "Liquidity", test: /liquidity|flow|volume/i },
  { id: "governance", label: "Governance", test: /governance|proposal|vote/i },
  { id: "execution", label: "Execution", test: /ship|release|deployed|roadmap/i },
  { id: "distribution", label: "Distribution", test: /distribution|growth|audience|reach/i },
];

const numberFmt = new Intl.NumberFormat();

function engagementScore(post: DashboardPost) {
  return post.likeCount + post.replyCount * 2 + post.repostCount * 3 + post.quoteCount * 2;
}

function isOpportunity(post: DashboardPost) {
  const text = `${post.content} ${post.summary?.summary ?? ""}`.toLowerCase();
  return /opportun|engage|opening|window|partnership|distribution/.test(text);
}

function isHighSignal(post: DashboardPost) {
  return engagementScore(post) >= 420;
}

function inWindow(postedAt: Date, window: TimeWindow) {
  if (window === "all") return true;

  const now = Date.now();
  const hours = window === "2h" ? 2 : window === "24h" ? 24 : window === "72h" ? 72 : 24 * 7;
  const cutoff = now - hours * 60 * 60 * 1000;
  return postedAt.getTime() >= cutoff;
}

function watchlistMatch(post: DashboardPost, watchlist: WatchlistKey) {
  if (watchlist === "all") return true;
  if (watchlist === "priority") return isHighSignal(post) || isOpportunity(post);
  if (watchlist === "competitors") return post.account.category === AccountCategory.COMPETITOR;
  if (watchlist === "founders") return post.account.category === AccountCategory.FOUNDER;
  if (watchlist === "media") return post.account.category === AccountCategory.MEDIA;
  if (watchlist === "ecosystem") return post.account.category === AccountCategory.ECOSYSTEM;
  return true;
}

function dbTone(code: DashboardPayload["system"]["dbCode"]) {
  if (code === "CONNECTED") return "text-emerald-300 border-emerald-600/40 bg-emerald-500/10";
  if (code === "MISSING_DATABASE_URL") return "text-amber-300 border-amber-600/40 bg-amber-500/10";
  return "text-rose-300 border-rose-600/40 bg-rose-500/10";
}

export function DashboardClient({ payload }: Props) {
  const { posts, accounts, categories, stats, ingestionRuns, system } = payload;

  const [watchlist, setWatchlist] = React.useState<WatchlistKey>("all");
  const [accountId, setAccountId] = React.useState<string>("all");
  const [category, setCategory] = React.useState<string>("all");
  const [query, setQuery] = React.useState("");
  const [minEngagement, setMinEngagement] = React.useState(0);
  const [timeWindow, setTimeWindow] = React.useState<TimeWindow>("24h");
  const [highSignalOnly, setHighSignalOnly] = React.useState(false);
  const [competitorsOnly, setCompetitorsOnly] = React.useState(false);
  const [opportunitiesOnly, setOpportunitiesOnly] = React.useState(false);
  const [narrativeFilter, setNarrativeFilter] = React.useState<string>("all");
  const [savedPostIds, setSavedPostIds] = React.useState<string[]>([]);
  const [assignedPostIds, setAssignedPostIds] = React.useState<string[]>([]);
  const [taggedPostIds, setTaggedPostIds] = React.useState<string[]>([]);

  const narrativeCounts = React.useMemo(() => {
    return narrativePatterns
      .map((pattern) => ({
        id: pattern.id,
        label: pattern.label,
        count: posts.filter((post) => pattern.test.test(`${post.content} ${post.summary?.summary ?? ""}`)).length,
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [posts]);

  const filtered = React.useMemo(() => {
    return posts
      .filter((post) => watchlistMatch(post, watchlist))
      .filter((post) => (accountId === "all" ? true : post.accountId === accountId))
      .filter((post) => (category === "all" ? true : post.account.category === category))
      .filter((post) => inWindow(post.postedAt, timeWindow))
      .filter((post) => engagementScore(post) >= minEngagement)
      .filter((post) =>
        query.trim().length === 0
          ? true
          : `${post.content} ${post.summary?.summary ?? ""} ${post.account.displayName} ${post.account.handle}`
              .toLowerCase()
              .includes(query.toLowerCase())
      )
      .filter((post) => (highSignalOnly ? isHighSignal(post) : true))
      .filter((post) => (competitorsOnly ? post.account.category === AccountCategory.COMPETITOR : true))
      .filter((post) => (opportunitiesOnly ? isOpportunity(post) : true))
      .filter((post) => {
        if (narrativeFilter === "all") return true;
        const pattern = narrativePatterns.find((item) => item.id === narrativeFilter);
        if (!pattern) return true;
        return pattern.test.test(`${post.content} ${post.summary?.summary ?? ""}`);
      })
      .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
  }, [
    posts,
    watchlist,
    accountId,
    category,
    timeWindow,
    minEngagement,
    query,
    highSignalOnly,
    competitorsOnly,
    opportunitiesOnly,
    narrativeFilter,
  ]);

  const engageNow = React.useMemo(() => {
    return [...filtered]
      .filter((post) => isOpportunity(post) || isHighSignal(post))
      .sort((a, b) => engagementScore(b) - engagementScore(a))
      .slice(0, 6);
  }, [filtered]);

  const highVelocity = React.useMemo(() => {
    return [...filtered].sort((a, b) => engagementScore(b) - engagementScore(a)).slice(0, 6);
  }, [filtered]);

  const priorityMentions = React.useMemo(() => {
    return [...filtered]
      .filter((post) => post.account.tags.some((tag) => ["launch", "policy", "founder", "ecosystem"].includes(tag)))
      .slice(0, 6);
  }, [filtered]);

  const resetFilters = () => {
    setWatchlist("all");
    setAccountId("all");
    setCategory("all");
    setQuery("");
    setMinEngagement(0);
    setTimeWindow("24h");
    setHighSignalOnly(false);
    setCompetitorsOnly(false);
    setOpportunitiesOnly(false);
    setNarrativeFilter("all");
  };

  const toggleItem = (value: string, setValue: React.Dispatch<React.SetStateAction<string[]>>) => {
    setValue((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };

  return (
    <main className="min-h-screen bg-background px-3 py-3 sm:px-4 lg:px-5">
      <div className="mx-auto max-w-[1600px] space-y-3">
        <Card className="border-primary/30 bg-card/85 backdrop-blur">
          <CardContent className="space-y-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                  <Radar className="size-3.5" /> tradesignal // signalforge terminal
                </p>
                <h1 className="text-lg font-semibold leading-tight sm:text-xl">Real-time social intelligence command center</h1>
              </div>
              <ManualIngestButton compact />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${dbTone(system.dbCode)}`}>
                <Activity className="size-3" /> {system.mode} · {system.dbCode}
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/60 px-2 py-0.5">
                <Layers className="size-3" /> Source: {system.providerLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/60 px-2 py-0.5">
                <Bot className="size-3" /> Summaries: {system.summaryLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/60 px-2 py-0.5">
                <Clock3 className="size-3" /> Refresh: {system.lastRefreshAt.toLocaleTimeString()} ({system.cadenceLabel})
              </span>
            </div>

            {system.mode === "DEMO" ? (
              <div className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
                {system.dbMessage}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded border border-border/70 bg-card/70 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tracked accounts</p>
            <p className="text-lg font-semibold">{numberFmt.format(stats.trackedAccounts)}</p>
          </div>
          <div className="rounded border border-border/70 bg-card/70 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">New posts (2h / 24h)</p>
            <p className="text-lg font-semibold">
              {numberFmt.format(stats.newPosts2h)} / {numberFmt.format(stats.newPosts24h)}
            </p>
          </div>
          <div className="rounded border border-border/70 bg-card/70 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">High-signal posts</p>
            <p className="text-lg font-semibold">{numberFmt.format(stats.highSignalPosts)}</p>
          </div>
          <div className="rounded border border-border/70 bg-card/70 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Opportunities detected</p>
            <p className="text-lg font-semibold">{numberFmt.format(stats.opportunitiesDetected)}</p>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
          <aside className="space-y-3">
            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Watchlists</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-2 pt-0">
                {watchlists.map((item) => {
                  const count = posts.filter((post) => watchlistMatch(post, item.key)).length;
                  const active = item.key === watchlist;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setWatchlist(item.key)}
                      className={`w-full rounded border px-2 py-1.5 text-left text-xs transition ${
                        active
                          ? "border-primary/40 bg-primary/10 text-foreground"
                          : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.label}</span>
                        <span>{count}</span>
                      </div>
                      <p className="mt-0.5 text-[10px] opacity-80">{item.description}</p>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Narrative focus</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-2 pt-0">
                <button
                  onClick={() => setNarrativeFilter("all")}
                  className={`w-full rounded border px-2 py-1.5 text-left text-xs ${
                    narrativeFilter === "all"
                      ? "border-primary/40 bg-primary/10"
                      : "border-border/60 bg-background/40 text-muted-foreground"
                  }`}
                >
                  All narratives
                </button>
                {narrativeCounts.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setNarrativeFilter(item.id)}
                    className={`flex w-full items-center justify-between rounded border px-2 py-1.5 text-xs ${
                      narrativeFilter === item.id
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/60 bg-background/40 text-muted-foreground"
                    }`}
                  >
                    <span>{item.label}</span>
                    <span>{item.count}</span>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Saved views</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-2 pt-0 text-xs text-muted-foreground">
                <p>• Engage now</p>
                <p>• Competitor escalation</p>
                <p>• Founder narrative shift</p>
                <p>• Distribution windows</p>
              </CardContent>
            </Card>
          </aside>

          <section className="space-y-2">
            <Card className="border-border/70 bg-card/70">
              <CardContent className="grid gap-2 p-2 md:grid-cols-2 xl:grid-cols-6">
                <label className="grid gap-1 text-[11px] text-muted-foreground">
                  <span>Account</span>
                  <select
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                    className="h-8 rounded border border-input bg-background px-2 text-xs text-foreground"
                  >
                    <option value="all">All accounts</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-[11px] text-muted-foreground">
                  <span>Category</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="h-8 rounded border border-input bg-background px-2 text-xs text-foreground"
                  >
                    <option value="all">All categories</option>
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {toTitleCase(item)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-[11px] text-muted-foreground">
                  <span>Keyword</span>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Search narrative"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>

                <label className="grid gap-1 text-[11px] text-muted-foreground">
                  <span>Min engagement</span>
                  <Input
                    className="h-8 text-xs"
                    type="number"
                    min={0}
                    value={minEngagement}
                    onChange={(event) => setMinEngagement(Number(event.target.value || 0))}
                  />
                </label>

                <label className="grid gap-1 text-[11px] text-muted-foreground">
                  <span>Time window</span>
                  <select
                    value={timeWindow}
                    onChange={(event) => setTimeWindow(event.target.value as TimeWindow)}
                    className="h-8 rounded border border-input bg-background px-2 text-xs text-foreground"
                  >
                    <option value="2h">Last 2h</option>
                    <option value="24h">Last 24h</option>
                    <option value="72h">Last 72h</option>
                    <option value="7d">Last 7d</option>
                    <option value="all">All time</option>
                  </select>
                </label>

                <div className="grid gap-1 text-[11px] text-muted-foreground">
                  <span>Actions</span>
                  <button
                    onClick={resetFilters}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded border border-border/70 bg-background/50 px-2 text-xs hover:text-foreground"
                  >
                    <Filter className="size-3" /> Reset filters
                  </button>
                </div>

                <div className="md:col-span-2 xl:col-span-6">
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setHighSignalOnly((v) => !v)}
                      className={`rounded border px-2 py-1 text-[11px] ${
                        highSignalOnly ? "border-primary/40 bg-primary/10 text-foreground" : "border-border/70 text-muted-foreground"
                      }`}
                    >
                      <Flame className="mr-1 inline size-3" /> High signal only
                    </button>
                    <button
                      onClick={() => setCompetitorsOnly((v) => !v)}
                      className={`rounded border px-2 py-1 text-[11px] ${
                        competitorsOnly ? "border-primary/40 bg-primary/10 text-foreground" : "border-border/70 text-muted-foreground"
                      }`}
                    >
                      <AlertTriangle className="mr-1 inline size-3" /> Competitors only
                    </button>
                    <button
                      onClick={() => setOpportunitiesOnly((v) => !v)}
                      className={`rounded border px-2 py-1 text-[11px] ${
                        opportunitiesOnly
                          ? "border-primary/40 bg-primary/10 text-foreground"
                          : "border-border/70 text-muted-foreground"
                      }`}
                    >
                      <Target className="mr-1 inline size-3" /> Opportunities only
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="rounded border border-border/70 bg-card/60 px-2 py-1 text-xs text-muted-foreground">
              Feed priority: what changed • why it matters • what deserves action • who to engage
            </div>

            <div className="max-h-[calc(100vh-300px)] space-y-2 overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <Card className="border-border/70 bg-card/70">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No signals match current filters. Reset filters or broaden your watchlist.
                  </CardContent>
                </Card>
              ) : (
                filtered.map((post) => {
                  const score = engagementScore(post);
                  const opportunity = isOpportunity(post);
                  const highSignal = isHighSignal(post);

                  return (
                    <Card key={post.id} className="border-border/70 bg-card/75 hover:border-primary/35">
                      <CardContent className="space-y-2 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold">{post.account.displayName}</p>
                              <span className="text-[11px] text-muted-foreground">@{post.account.handle}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {toTitleCase(post.account.category)}
                              </Badge>
                              {highSignal ? (
                                <Badge className="border-0 bg-rose-500/15 text-[10px] text-rose-300">high velocity</Badge>
                              ) : null}
                              {opportunity ? (
                                <Badge className="border-0 bg-emerald-500/15 text-[10px] text-emerald-300">engage now</Badge>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {post.account.tags.slice(0, 4).map((tag) => (
                                <Badge key={`${post.id}-${tag}`} variant="secondary" className="text-[10px]">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div className="text-right text-[11px] text-muted-foreground">
                            <p>{formatDistanceToNowStrict(post.postedAt, { addSuffix: true })}</p>
                            <p>{post.postedAt.toLocaleString()}</p>
                          </div>
                        </div>

                        <p className="text-sm leading-snug text-foreground/95">{truncate(post.content, 460)}</p>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <ThumbsUp className="size-3" /> {numberFmt.format(post.likeCount)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="size-3" /> {numberFmt.format(post.replyCount)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Repeat2 className="size-3" /> {numberFmt.format(post.repostCount)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Zap className="size-3" /> score {numberFmt.format(score)}
                          </span>
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
                          <div className="rounded border border-primary/25 bg-primary/8 p-2">
                            <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary/90">
                              <Sparkles className="size-3" /> Why this matters
                            </p>
                            <p className="text-xs leading-relaxed text-foreground/90">{post.summary.summary}</p>
                          </div>
                        ) : (
                          <div className="rounded border border-border/70 bg-muted/20 p-2 text-xs text-muted-foreground">
                            Summary pending.
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1 text-[11px]">
                          <button
                            onClick={() => toggleItem(post.id, setSavedPostIds)}
                            className={`rounded border px-2 py-1 ${
                              savedPostIds.includes(post.id)
                                ? "border-primary/40 bg-primary/10 text-foreground"
                                : "border-border/70 text-muted-foreground"
                            }`}
                          >
                            <Bookmark className="mr-1 inline size-3" /> {savedPostIds.includes(post.id) ? "Saved" : "Save"}
                          </button>
                          <button
                            onClick={() => toggleItem(post.id, setAssignedPostIds)}
                            className={`rounded border px-2 py-1 ${
                              assignedPostIds.includes(post.id)
                                ? "border-primary/40 bg-primary/10 text-foreground"
                                : "border-border/70 text-muted-foreground"
                            }`}
                          >
                            <Target className="mr-1 inline size-3" /> {assignedPostIds.includes(post.id) ? "Assigned" : "Assign"}
                          </button>
                          <button
                            onClick={() => toggleItem(post.id, setTaggedPostIds)}
                            className={`rounded border px-2 py-1 ${
                              taggedPostIds.includes(post.id)
                                ? "border-primary/40 bg-primary/10 text-foreground"
                                : "border-border/70 text-muted-foreground"
                            }`}
                          >
                            <Layers className="mr-1 inline size-3" /> {taggedPostIds.includes(post.id) ? "Tagged" : "Tag"}
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </section>

          <aside className="space-y-2">
            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Engage now</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-2 pt-0">
                {engageNow.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No immediate opportunities in current scope.</p>
                ) : (
                  engageNow.map((post) => (
                    <div key={`engage-${post.id}`} className="rounded border border-border/70 bg-background/40 p-2 text-xs">
                      <p className="font-medium">@{post.account.handle}</p>
                      <p className="mt-0.5 text-muted-foreground">{truncate(post.summary?.summary ?? post.content, 120)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Emerging narratives</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-2 pt-0">
                {narrativeCounts.slice(0, 6).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded border border-border/70 bg-background/40 px-2 py-1 text-xs">
                    <span>{item.label}</span>
                    <span className="text-muted-foreground">{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">High velocity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-2 pt-0">
                {highVelocity.slice(0, 5).map((post) => (
                  <div key={`velocity-${post.id}`} className="rounded border border-border/70 bg-background/40 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">@{post.account.handle}</span>
                      <span className="text-rose-300">{numberFmt.format(engagementScore(post))}</span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">{truncate(post.content, 90)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Priority mentions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-2 pt-0">
                {priorityMentions.slice(0, 5).map((post) => (
                  <div key={`priority-${post.id}`} className="rounded border border-border/70 bg-background/40 p-2 text-xs">
                    <p className="font-medium">@{post.account.handle}</p>
                    <p className="mt-0.5 text-muted-foreground">{truncate(post.summary?.summary ?? post.content, 100)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Ingestion runs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-2 pt-0">
                {ingestionRuns.slice(0, 6).map((run) => (
                  <div key={run.id} className="rounded border border-border/70 bg-background/40 p-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{run.status}</span>
                      <span className="text-muted-foreground">{formatDistanceToNowStrict(run.startedAt, { addSuffix: true })}</span>
                    </div>
                    {run.notes ? <p className="mt-0.5 text-muted-foreground">{truncate(run.notes, 96)}</p> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}
