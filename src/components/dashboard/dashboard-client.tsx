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
  KeyRound,
  Layers,
  Info,
  LogOut,
  MessageSquare,
  Plus,
  Radar,
  RefreshCw,
  Repeat2,
  Sparkles,
  Target,
  ThumbsUp,
  Zap,
} from "lucide-react";
import { AccountCategory } from "@prisma/client";
import type {
  ContextNarrativeSummary,
  DashboardPayload,
  DashboardPost,
  IntelligenceCenter,
  NarrativeTopicSummary,
  SourcePlatform,
  WatchlistKey,
} from "@/lib/types";
import { addWatchlistAccountAction, getContextSummaryAction, refreshContextSummaryAction } from "@/app/actions";
import { AddWatchlistAccountDialog } from "@/components/dashboard/add-watchlist-account-dialog";
import { XLoginDialog } from "@/components/dashboard/x-login-dialog";
import { XRespondDialog } from "@/components/dashboard/x-respond-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ManualIngestButton } from "@/components/dashboard/manual-ingest-button";
import { NetworkMap } from "@/components/dashboard/network-map";
import { toTitleCase, truncate } from "@/lib/utils";

type Props = {
  payload: DashboardPayload;
};

type TimeWindow = "2h" | "24h" | "72h" | "7d" | "all";

const watchlists: Array<{ key: WatchlistKey; label: string; description: string }> = [
  { key: "all", label: "All signals", description: "Entire monitored stream" },
  { key: "priority", label: "Priority radar", description: "High-signal + opportunities" },
  { key: "competitors", label: "Competitor board", description: "Competitive posture updates" },
  { key: "founders", label: "Founder tape", description: "Roadmap + strategic intent" },
  { key: "media", label: "Media pulse", description: "Narrative amplification risk" },
  { key: "ecosystem", label: "Ecosystem ops", description: "Partnership + launch chatter" },
];

const centers: IntelligenceCenter[] = ["IOTA", "TWIN"];
const sources: SourcePlatform[] = ["X", "LINKEDIN"];
const numberFmt = new Intl.NumberFormat();
const X_SESSION_STORAGE_KEY = "tradesignal.x.session.v1";

type XSession = {
  username: string;
  accessToken: string;
};

function normalizeHandleForMatch(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

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

function postMatchesNarrativeTopic(post: DashboardPost, topic: NarrativeTopicSummary) {
  const text = `${post.content} ${post.summary?.summary ?? ""}`.toLowerCase();

  const termHit = topic.key_terms.some((term) => {
    const normalized = term.trim().toLowerCase();
    if (!normalized || normalized.length < 3) return false;
    return text.includes(normalized);
  });

  const labelTokens = topic.topic_name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);

  const labelHit = labelTokens.some((token) => text.includes(token));
  const handleHit = topic.respond_to_handles.some(
    (handle) => normalizeHandleForMatch(post.account.handle) === normalizeHandleForMatch(handle)
  );

  return termHit || labelHit || handleHit;
}

function postMatchesKeyTopic(post: DashboardPost, topic: string) {
  const normalized = topic.trim().toLowerCase();
  if (!normalized) return false;

  const text = `${post.content} ${post.summary?.summary ?? ""} ${post.account.tags.join(" ")}`.toLowerCase();
  return text.includes(normalized);
}

function tokenizeAngle(value: string) {
  const STOPWORDS = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "into",
    "what",
    "where",
    "should",
    "could",
    "would",
    "your",
    "their",
    "about",
    "against",
    "under",
    "over",
    "around",
    "while",
    "have",
    "has",
    "had",
    "is",
    "are",
  ]);

  return (value.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []).filter((token) => !STOPWORDS.has(token));
}

function scoreEngageAngleToPost(angle: string, post: DashboardPost) {
  const terms = tokenizeAngle(angle);
  if (terms.length === 0) return 0;

  const text = `${post.content} ${post.summary?.summary ?? ""} ${post.account.handle} ${post.account.tags.join(" ")}`.toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (text.includes(term)) score += 1;
  }

  return score;
}

function dbTone(code: DashboardPayload["system"]["dbCode"]) {
  if (code === "CONNECTED") return "text-emerald-300 border-emerald-600/40 bg-emerald-500/10";
  if (code === "MISSING_DATABASE_URL") return "text-amber-300 border-amber-600/40 bg-amber-500/10";
  return "text-rose-300 border-rose-600/40 bg-rose-500/10";
}

export function DashboardClient({ payload }: Props) {
  const { posts, categories, ingestionRuns, system, intelligence } = payload;

  const [watchlistAssignments, setWatchlistAssignments] = React.useState(payload.watchlistAssignments);

  const [centerFocus, setCenterFocus] = React.useState<IntelligenceCenter>("IOTA");
  const [sourceByCenter, setSourceByCenter] = React.useState<Record<IntelligenceCenter, SourcePlatform>>({
    IOTA: "X",
    TWIN: "X",
  });
  const sourceTab = sourceByCenter[centerFocus];

  const summaryCacheRef = React.useRef<Record<string, ContextNarrativeSummary>>({});

  const [watchlist, setWatchlist] = React.useState<WatchlistKey>("all");
  const [accountId, setAccountId] = React.useState<string>("all");
  const [category, setCategory] = React.useState<string>("all");
  const [query, setQuery] = React.useState("");
  const [minEngagement, setMinEngagement] = React.useState(0);
  const [timeWindow, setTimeWindow] = React.useState<TimeWindow>("24h");
  const [highSignalOnly, setHighSignalOnly] = React.useState(false);
  const [competitorsOnly, setCompetitorsOnly] = React.useState(false);
  const [opportunitiesOnly, setOpportunitiesOnly] = React.useState(false);
  const [postTypeFilter, setPostTypeFilter] = React.useState<string>("all");
  const [toneFilter, setToneFilter] = React.useState<string>("all");
  const [actionabilityFilter, setActionabilityFilter] = React.useState<string>("all");
  const [engagingHandleFilter, setEngagingHandleFilter] = React.useState<string>("all");
  const [adjacentInterestFilter, setAdjacentInterestFilter] = React.useState<string>("all");
  const [interestKindFilter, setInterestKindFilter] = React.useState<string>("all");
  const [engagementTypeFilter, setEngagementTypeFilter] = React.useState<string>("all");
  const [narrativeFilter, setNarrativeFilter] = React.useState<string>("all");
  const [selectedKeyTopics, setSelectedKeyTopics] = React.useState<string[]>([]);
  const [savedPostIds, setSavedPostIds] = React.useState<string[]>([]);
  const [assignedPostIds, setAssignedPostIds] = React.useState<string[]>([]);
  const [taggedPostIds, setTaggedPostIds] = React.useState<string[]>([]);

  const [watchlistDialog, setWatchlistDialog] = React.useState<{ open: boolean; watchlistKey: WatchlistKey | null }>(
    { open: false, watchlistKey: null }
  );
  const [watchlistDialogMessage, setWatchlistDialogMessage] = React.useState<
    { kind: "success" | "error"; text: string } | null
  >(null);
  const [watchlistToast, setWatchlistToast] = React.useState<string | null>(null);
  const [watchlistPending, startWatchlistTransition] = React.useTransition();

  const [summaryWindowHours, setSummaryWindowHours] = React.useState<24 | 72>(24);
  const [contextSummary, setContextSummary] = React.useState<ContextNarrativeSummary | null>(
    payload.initialContextSummary
  );
  const [summaryError, setSummaryError] = React.useState<string | null>(null);
  const [summaryPending, startSummaryTransition] = React.useTransition();

  const [showHighSignalInfo, setShowHighSignalInfo] = React.useState(false);

  const [xSession, setXSession] = React.useState<XSession | null>(null);
  const [xLoginOpen, setXLoginOpen] = React.useState(false);
  const [xLoginMessage, setXLoginMessage] = React.useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [xComposeOpen, setXComposeOpen] = React.useState(false);
  const [xComposeTarget, setXComposeTarget] = React.useState<DashboardPost | null>(null);
  const [xComposeMessage, setXComposeMessage] = React.useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [xActionToast, setXActionToast] = React.useState<string | null>(null);
  const [pendingRespondPost, setPendingRespondPost] = React.useState<DashboardPost | null>(null);
  const [engageTargetPostId, setEngageTargetPostId] = React.useState<string | null>(null);
  const [xPending, startXTransition] = React.useTransition();

  const trackedOverview = intelligence.trackedOverview;
  const topEngagers = intelligence.topEngagers;
  const adjacentInterests = intelligence.adjacentInterests;
  const actionableSignals = intelligence.actionableSignals;
  const providerCapabilities = intelligence.providerCapabilities;

  const centerScopedPosts = React.useMemo(() => posts.filter((post) => post.center === centerFocus), [posts, centerFocus]);

  const sourceScopedPosts = React.useMemo(
    () => centerScopedPosts.filter((post) => post.sourcePlatform === sourceTab),
    [centerScopedPosts, sourceTab]
  );

  const sourceScopedAccounts = React.useMemo(() => {
    const ids = new Set(sourceScopedPosts.map((post) => post.accountId));
    return [...new Map(sourceScopedPosts.map((post) => [post.accountId, post.account])).values()].filter((acc) => ids.has(acc.id));
  }, [sourceScopedPosts]);

  const postTypeOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const post of sourceScopedPosts) {
      if (post.classification?.postType) set.add(post.classification.postType);
    }
    return [...set].sort();
  }, [sourceScopedPosts]);

  const toneOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const post of sourceScopedPosts) {
      if (post.classification?.tone) set.add(post.classification.tone);
    }
    return [...set].sort();
  }, [sourceScopedPosts]);

  const actionabilityOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const post of sourceScopedPosts) {
      if (post.classification?.actionability) set.add(post.classification.actionability);
    }
    return [...set].sort();
  }, [sourceScopedPosts]);

  const visualizationPosts = React.useMemo(() => {
    if (selectedKeyTopics.length === 0) return sourceScopedPosts;

    return sourceScopedPosts.filter((post) =>
      selectedKeyTopics.some((topic) => postMatchesKeyTopic(post, topic))
    );
  }, [sourceScopedPosts, selectedKeyTopics]);

  const visualizationAccounts = React.useMemo(() => {
    const ids = new Set(visualizationPosts.map((post) => post.accountId));
    return sourceScopedAccounts.filter((account) => ids.has(account.id));
  }, [visualizationPosts, sourceScopedAccounts]);

  const contextWatchlistAssignments = React.useMemo(() => {
    return watchlistAssignments.filter(
      (item) => item.center === centerFocus && item.sourcePlatform === sourceTab
    );
  }, [watchlistAssignments, centerFocus, sourceTab]);

  const watchlistAccountsByKey = React.useMemo(() => {
    const map: Record<WatchlistKey, Array<(typeof contextWatchlistAssignments)[number]>> = {
      all: [],
      priority: [],
      competitors: [],
      founders: [],
      media: [],
      ecosystem: [],
    };

    for (const assignment of contextWatchlistAssignments) {
      map[assignment.watchlistKey].push(assignment);
    }

    return map;
  }, [contextWatchlistAssignments]);

  const summaryKey = `${centerFocus}:${sourceTab}:${summaryWindowHours}`;

  React.useEffect(() => {
    if (!payload.initialContextSummary) return;
    const key = `${payload.initialContextSummary.center}:${payload.initialContextSummary.sourcePlatform}:${payload.initialContextSummary.windowHours}`;
    summaryCacheRef.current[key] = payload.initialContextSummary;
  }, [payload.initialContextSummary]);

  React.useEffect(() => {
    const cached = summaryCacheRef.current[summaryKey];
    if (cached) {
      setContextSummary(cached);
      setSummaryError(null);
      return;
    }

    startSummaryTransition(async () => {
      const result = await getContextSummaryAction({
        center: centerFocus,
        sourcePlatform: sourceTab,
        windowHours: summaryWindowHours,
      });

      if (!result.ok || !result.summary) {
        setSummaryError(result.message || "Unable to load narrative command layer.");
        return;
      }

      summaryCacheRef.current[summaryKey] = result.summary;
      setContextSummary(result.summary);
      setSummaryError(null);
    });
  }, [centerFocus, sourceTab, summaryWindowHours, summaryKey, startSummaryTransition]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(X_SESSION_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<XSession>;
      if (!parsed.username || !parsed.accessToken) return;

      setXSession({
        username: parsed.username,
        accessToken: parsed.accessToken,
      });
    } catch {
      // ignore storage parse errors
    }
  }, []);

  React.useEffect(() => {
    if (!xActionToast) return;
    const timer = window.setTimeout(() => setXActionToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [xActionToast]);

  React.useEffect(() => {
    if (accountId === "all") return;
    const exists = sourceScopedAccounts.some((acc) => acc.id === accountId);
    if (!exists) setAccountId("all");
  }, [accountId, sourceScopedAccounts]);

  const scopedReferenceTime = React.useMemo(
    () => sourceScopedPosts.reduce((maxTs, post) => Math.max(maxTs, post.postedAt.getTime()), system.lastRefreshAt.getTime()),
    [sourceScopedPosts, system.lastRefreshAt]
  );

  const scopedStats = React.useMemo(() => {
    const in2h = scopedReferenceTime - 2 * 60 * 60 * 1000;
    const in24h = scopedReferenceTime - 24 * 60 * 60 * 1000;

    return {
      trackedAccounts: sourceScopedAccounts.length,
      newPosts2h: sourceScopedPosts.filter((post) => post.postedAt.getTime() >= in2h).length,
      newPosts24h: sourceScopedPosts.filter((post) => post.postedAt.getTime() >= in24h).length,
      highSignalPosts: sourceScopedPosts.filter(isHighSignal).length,
      opportunitiesDetected: sourceScopedPosts.filter(isOpportunity).length,
    };
  }, [sourceScopedAccounts, sourceScopedPosts, scopedReferenceTime]);

  const summaryTopics = React.useMemo(() => contextSummary?.topics ?? [], [contextSummary]);
  const summaryKeyTopics = React.useMemo(() => contextSummary?.keyTopics ?? [], [contextSummary]);
  const summaryEngageNow = React.useMemo(
    () => contextSummary?.global_summary.top_opportunities_to_engage ?? [],
    [contextSummary]
  );

  const narrativeFocusUpdatedText = contextSummary
    ? formatDistanceToNowStrict(new Date(contextSummary.generatedAt), { addSuffix: true })
    : "no summary";

  React.useEffect(() => {
    setSelectedKeyTopics((current) =>
      current.filter((topic) => summaryKeyTopics.some((keyTopic) => keyTopic.toLowerCase() === topic.toLowerCase()))
    );
  }, [summaryKeyTopics]);

  const narrativeFocusOptions = React.useMemo(() => {
    return summaryTopics
      .map((topic) => ({
        id: topic.topic_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        label: topic.topic_name,
        count: sourceScopedPosts.filter((post) => postMatchesNarrativeTopic(post, topic)).length,
        topic,
      }))
      .filter((item) => item.id && item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [summaryTopics, sourceScopedPosts]);

  React.useEffect(() => {
    if (narrativeFilter === "all") return;
    if (!narrativeFocusOptions.some((option) => option.id === narrativeFilter)) {
      setNarrativeFilter("all");
    }
  }, [narrativeFilter, narrativeFocusOptions]);

  const selectedNarrativeTopic = React.useMemo(() => {
    if (narrativeFilter === "all") return null;
    return narrativeFocusOptions.find((option) => option.id === narrativeFilter)?.topic ?? null;
  }, [narrativeFilter, narrativeFocusOptions]);

  const activeWatchlistHandleSet = React.useMemo(() => {
    return new Set(watchlistAccountsByKey[watchlist].map((item) => normalizeHandleForMatch(item.handle)));
  }, [watchlistAccountsByKey, watchlist]);

  const filtered = React.useMemo(() => {
    return sourceScopedPosts
      .filter((post) => {
        if (watchlist === "all") return true;

        const byRule = watchlistMatch(post, watchlist);
        const byAssignedHandle = activeWatchlistHandleSet.has(normalizeHandleForMatch(post.account.handle));
        return byRule || byAssignedHandle;
      })
      .filter((post) => (accountId === "all" ? true : post.accountId === accountId))
      .filter((post) => (category === "all" ? true : post.account.category === category))
      .filter((post) => inWindow(post.postedAt, timeWindow))
      .filter((post) => engagementScore(post) >= minEngagement)
      .filter((post) => (postTypeFilter === "all" ? true : post.classification?.postType === postTypeFilter))
      .filter((post) => (toneFilter === "all" ? true : post.classification?.tone === toneFilter))
      .filter((post) =>
        actionabilityFilter === "all" ? true : post.classification?.actionability === actionabilityFilter
      )
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
        if (engagingHandleFilter === "all") return true;
        const text = `${post.content} ${post.summary?.summary ?? ""}`.toLowerCase();
        return text.includes(engagingHandleFilter.toLowerCase());
      })
      .filter((post) => (adjacentInterestFilter === "all" ? true : postMatchesKeyTopic(post, adjacentInterestFilter)))
      .filter((post) => {
        if (narrativeFilter === "all") return true;
        if (!selectedNarrativeTopic) return true;
        return postMatchesNarrativeTopic(post, selectedNarrativeTopic);
      })
      .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
  }, [
    sourceScopedPosts,
    watchlist,
    accountId,
    category,
    timeWindow,
    minEngagement,
    postTypeFilter,
    toneFilter,
    actionabilityFilter,
    query,
    highSignalOnly,
    competitorsOnly,
    opportunitiesOnly,
    engagingHandleFilter,
    adjacentInterestFilter,
    narrativeFilter,
    selectedNarrativeTopic,
    activeWatchlistHandleSet,
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

  const filteredTopEngagers = React.useMemo(() => {
    return topEngagers.filter((engager) =>
      engagingHandleFilter === "all" ? true : engager.handle.toLowerCase() === engagingHandleFilter.toLowerCase()
    );
  }, [topEngagers, engagingHandleFilter]);

  const filteredAdjacentInterests = React.useMemo(() => {
    return adjacentInterests.filter((interest) => {
      if (adjacentInterestFilter !== "all" && interest.interest !== adjacentInterestFilter) return false;
      if (interestKindFilter !== "all" && interest.interestKind !== interestKindFilter) return false;
      return true;
    });
  }, [adjacentInterests, adjacentInterestFilter, interestKindFilter]);

  const filteredActionableSignals = React.useMemo(() => {
    return actionableSignals.filter((signal) =>
      actionabilityFilter === "all" ? true : signal.signalType === actionabilityFilter
    );
  }, [actionableSignals, actionabilityFilter]);

  const resetFilters = () => {
    setWatchlist("all");
    setAccountId("all");
    setCategory("all");
    setQuery("");
    setMinEngagement(0);
    setTimeWindow("24h");
    setPostTypeFilter("all");
    setToneFilter("all");
    setActionabilityFilter("all");
    setEngagingHandleFilter("all");
    setAdjacentInterestFilter("all");
    setInterestKindFilter("all");
    setEngagementTypeFilter("all");
    setHighSignalOnly(false);
    setCompetitorsOnly(false);
    setOpportunitiesOnly(false);
    setNarrativeFilter("all");
    setSelectedKeyTopics([]);
  };

  const toggleItem = (value: string, setValue: React.Dispatch<React.SetStateAction<string[]>>) => {
    setValue((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };

  const handleGraphSelectAccount = React.useCallback((nextAccountId: string) => {
    setAccountId(nextAccountId);
  }, []);

  const openWatchlistDialog = React.useCallback((nextWatchlistKey: WatchlistKey) => {
    setWatchlistDialog({ open: true, watchlistKey: nextWatchlistKey });
    setWatchlistDialogMessage(null);
  }, []);

  const closeWatchlistDialog = React.useCallback(() => {
    setWatchlistDialog({ open: false, watchlistKey: null });
    setWatchlistDialogMessage(null);
  }, []);

  const handleAddWatchlistAccount = React.useCallback(
    (input: { displayName?: string; handle: string }) => {
      const watchlistKey = watchlistDialog.watchlistKey;
      if (!watchlistKey) return;

      setWatchlistDialogMessage(null);

      startWatchlistTransition(async () => {
        const result = await addWatchlistAccountAction({
          watchlistKey,
          center: centerFocus,
          sourcePlatform: sourceTab,
          handle: input.handle,
          displayName: input.displayName,
        });

        if (!result.ok || !result.assignment) {
          setWatchlistDialogMessage({
            kind: "error",
            text: result.message,
          });
          return;
        }

        setWatchlistAssignments((current) => {
          const exists = current.some((item) => item.id === result.assignment?.id);
          if (exists) return current;
          return [result.assignment!, ...current];
        });

        setWatchlistToast(result.message);
        closeWatchlistDialog();
      });
    },
    [watchlistDialog.watchlistKey, centerFocus, sourceTab, startWatchlistTransition, closeWatchlistDialog]
  );

  const dialogWatchlistLabel =
    watchlists.find((item) => item.key === watchlistDialog.watchlistKey)?.label ?? "Watchlist";

  const refreshContextSummary = React.useCallback(() => {
    startSummaryTransition(async () => {
      const result = await refreshContextSummaryAction({
        center: centerFocus,
        sourcePlatform: sourceTab,
        windowHours: summaryWindowHours,
      });

      if (!result.ok || !result.summary) {
        setSummaryError(result.message || "Unable to refresh narrative command layer.");
        return;
      }

      summaryCacheRef.current[summaryKey] = result.summary;
      setContextSummary(result.summary);
      setSummaryError(null);
    });
  }, [centerFocus, sourceTab, summaryWindowHours, summaryKey, startSummaryTransition]);

  const openRespondFlow = React.useCallback((post: DashboardPost) => {
    if (sourceTab !== "X") {
      setXActionToast("Direct response posting is currently available only on X context.");
      return;
    }

    if (!xSession) {
      setPendingRespondPost(post);
      setXLoginMessage({ kind: "error", text: "Connect your X account first to post responses." });
      setXLoginOpen(true);
      return;
    }

    setXComposeTarget(post);
    setXComposeMessage(null);
    setXComposeOpen(true);
  }, [sourceTab, xSession]);

  const handleConnectX = React.useCallback((input: { username: string; accessToken: string }) => {
    if (!input.username.trim() || !input.accessToken.trim()) {
      setXLoginMessage({ kind: "error", text: "Username and token are required." });
      return;
    }

    const session = {
      username: input.username.trim().replace(/^@+/, ""),
      accessToken: input.accessToken.trim(),
    };

    setXSession(session);
    window.localStorage.setItem(X_SESSION_STORAGE_KEY, JSON.stringify(session));
    setXLoginMessage({ kind: "success", text: `Connected as @${session.username}.` });

    if (pendingRespondPost) {
      setXComposeTarget(pendingRespondPost);
      setXComposeOpen(true);
      setPendingRespondPost(null);
    }

    setXActionToast(`X connected: @${session.username}`);
    setTimeout(() => {
      setXLoginOpen(false);
      setXLoginMessage(null);
    }, 350);
  }, [pendingRespondPost]);

  const disconnectX = React.useCallback(() => {
    setXSession(null);
    setPendingRespondPost(null);
    window.localStorage.removeItem(X_SESSION_STORAGE_KEY);
    setXActionToast("Disconnected X account.");
  }, []);

  const handlePostResponse = React.useCallback(
    (input: { text: string; replyToTweetId?: string }) => {
      if (!xSession) {
        setXComposeMessage({ kind: "error", text: "No X session found. Connect your account first." });
        return;
      }

      startXTransition(async () => {
        try {
          const response = await fetch("/api/x/respond", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accessToken: xSession.accessToken,
              text: input.text,
              replyToTweetId: input.replyToTweetId,
            }),
          });

          const json = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };

          if (!response.ok || !json.ok) {
            setXComposeMessage({ kind: "error", text: json.message || "Unable to post to X." });
            return;
          }

          setXComposeMessage({ kind: "success", text: "Posted to X successfully." });
          setXActionToast(`Response posted from @${xSession.username}.`);
          setTimeout(() => {
            setXComposeOpen(false);
            setXComposeTarget(null);
            setXComposeMessage(null);
          }, 350);
        } catch {
          setXComposeMessage({ kind: "error", text: "Network error while posting to X." });
        }
      });
    },
    [xSession, startXTransition]
  );

  const engageAngleTargets = React.useMemo(() => {
    return summaryEngageNow.map((angle) => {
      let bestPost: DashboardPost | null = null;
      let bestScore = -1;

      for (const post of engageNow) {
        const score = scoreEngageAngleToPost(angle, post);
        if (score > bestScore) {
          bestScore = score;
          bestPost = post;
        }
      }

      return {
        angle,
        post: bestPost,
      };
    });
  }, [summaryEngageNow, engageNow]);

  React.useEffect(() => {
    if (engageNow.length === 0) {
      if (engageTargetPostId !== null) setEngageTargetPostId(null);
      return;
    }

    const exists = engageNow.some((post) => post.id === engageTargetPostId);
    if (!exists) {
      setEngageTargetPostId(engageNow[0].id);
    }
  }, [engageNow, engageTargetPostId]);

  const selectedEngagePost = React.useMemo(
    () => engageNow.find((post) => post.id === engageTargetPostId) ?? engageNow[0] ?? null,
    [engageNow, engageTargetPostId]
  );

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
                <h1 className="text-lg font-semibold leading-tight sm:text-xl">{centerFocus} intelligence command center</h1>
              </div>
              <div className="flex items-center gap-2">
                {sourceTab === "X" ? (
                  xSession ? (
                    <button
                      type="button"
                      onClick={disconnectX}
                      className="inline-flex h-8 items-center gap-1 rounded border border-border/70 bg-background/60 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <LogOut className="size-3" /> @{xSession.username}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setXLoginMessage(null);
                        setXLoginOpen(true);
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded border border-border/70 bg-background/60 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <KeyRound className="size-3" /> X login
                    </button>
                  )
                ) : null}
                <ManualIngestButton compact />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${dbTone(system.dbCode)}`}>
                <Activity className="size-3" /> {system.mode} · {system.dbCode}
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/60 px-2 py-0.5">
                <Layers className="size-3" /> Streams: X + LinkedIn tabs
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/60 px-2 py-0.5">
                <Bot className="size-3" /> Summaries: {system.summaryLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/60 px-2 py-0.5">
                <Clock3 className="size-3" /> Refresh: {system.lastRefreshAt.toLocaleTimeString()} ({system.cadenceLabel})
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded border border-border/70 bg-background/50 p-0.5 text-xs">
                {centers.map((center) => (
                  <button
                    key={center}
                    onClick={() => {
                      setCenterFocus(center);
                      setAccountId("all");
                    }}
                    className={`rounded px-2 py-1 ${
                      centerFocus === center ? "bg-primary/20 text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {center} dashboard
                  </button>
                ))}
              </div>

              <div className="inline-flex rounded border border-border/70 bg-background/50 p-0.5 text-xs">
                {sources.map((source) => (
                  <button
                    key={source}
                    onClick={() => {
                      setSourceByCenter((current) => ({ ...current, [centerFocus]: source }));
                      setAccountId("all");
                    }}
                    className={`rounded px-2 py-1 ${
                      sourceTab === source ? "bg-primary/20 text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {source === "X" ? "X" : "LinkedIn"}
                  </button>
                ))}
              </div>
            </div>

            {system.mode === "DEMO" ? (
              <div className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
                {system.dbMessage}
              </div>
            ) : null}

            {xActionToast ? (
              <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
                {xActionToast}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded border border-border/70 bg-card/70 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tracked accounts</p>
            <p className="text-lg font-semibold">{numberFmt.format(scopedStats.trackedAccounts)}</p>
          </div>
          <div className="rounded border border-border/70 bg-card/70 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">New posts (2h / 24h)</p>
            <p className="text-lg font-semibold">
              {numberFmt.format(scopedStats.newPosts2h)} / {numberFmt.format(scopedStats.newPosts24h)}
            </p>
          </div>
          <div className="relative rounded border border-border/70 bg-card/70 px-3 py-2">
            <div className="flex items-center gap-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">High-signal posts</p>
              <button
                type="button"
                onClick={() => setShowHighSignalInfo((current) => !current)}
                className="inline-flex h-4 w-4 items-center justify-center rounded border border-border/70 bg-background/60 text-muted-foreground hover:text-foreground"
                aria-label="Explain high-signal posts"
              >
                <Info className="size-2.5" />
              </button>
            </div>
            <p className="text-lg font-semibold">{numberFmt.format(scopedStats.highSignalPosts)}</p>
            {showHighSignalInfo ? (
              <div className="absolute right-2 top-7 z-20 max-w-[240px] rounded border border-border/70 bg-background/95 p-2 text-[11px] text-muted-foreground shadow-xl">
                High-signal posts are messages whose weighted engagement score is elevated.
                <br />
                Score = likes + (replies × 2) + (reposts × 3) + (quotes × 2), threshold ≥ 420.
              </div>
            ) : null}
          </div>
          <div className="rounded border border-border/70 bg-card/70 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Opportunities detected</p>
            <p className="text-lg font-semibold">{numberFmt.format(scopedStats.opportunitiesDetected)}</p>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
          <aside className="space-y-3">
            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Watchlists</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-2 pt-0">
                {watchlistToast ? (
                  <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
                    {watchlistToast}
                  </div>
                ) : null}

                {watchlists.map((item) => {
                  const tracked = watchlistAccountsByKey[item.key];
                  const trackedHandleSet = new Set(tracked.map((entry) => normalizeHandleForMatch(entry.handle)));

                  const matchingPosts = sourceScopedPosts.filter((post) => {
                    if (item.key === "all") return true;
                    return (
                      watchlistMatch(post, item.key) ||
                      trackedHandleSet.has(normalizeHandleForMatch(post.account.handle))
                    );
                  });

                  const contributorMap = new Map<string, { handle: string; displayName: string; count: number }>();
                  for (const post of matchingPosts) {
                    const key = normalizeHandleForMatch(post.account.handle);
                    const existing = contributorMap.get(key);

                    if (!existing) {
                      contributorMap.set(key, {
                        handle: post.account.handle,
                        displayName: post.account.displayName,
                        count: 1,
                      });
                    } else {
                      existing.count += 1;
                    }
                  }

                  const contributors = [...contributorMap.values()].sort((a, b) => b.count - a.count);
                  const contributorPreview = contributors.slice(0, 4);
                  const contributorOverflow = Math.max(0, contributors.length - contributorPreview.length);

                  const active = item.key === watchlist;
                  const count = matchingPosts.length;

                  return (
                    <div
                      key={item.key}
                      className={`rounded border px-2 py-1.5 transition ${
                        active
                          ? "border-primary/40 bg-primary/10"
                          : "border-border/60 bg-background/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => {
                            setWatchlist(item.key);
                            setWatchlistToast(null);
                          }}
                          className="flex-1 text-left"
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                              {item.label}
                            </span>
                            <span className="text-xs text-muted-foreground">{count}</span>
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">{item.description}</p>
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openWatchlistDialog(item.key);
                          }}
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border/70 bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          title={`Add account to ${item.label}`}
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>

                      {contributorPreview.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {contributorPreview.map((entry) => (
                            <span
                              key={`${item.key}-${entry.handle}`}
                              title={`@${entry.handle}`}
                              className="inline-flex items-center rounded border border-border/70 bg-background/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {entry.displayName}
                            </span>
                          ))}
                          {contributorOverflow > 0 ? (
                            <span className="inline-flex items-center rounded border border-border/70 bg-background/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              +{contributorOverflow}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Narrative focus</CardTitle>
                  <span className="text-[10px] text-muted-foreground">
                    {summaryPending ? "Updating..." : `Updated ${narrativeFocusUpdatedText}`}
                  </span>
                </div>
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
                {narrativeFocusOptions.length === 0 ? (
                  <p className="rounded border border-border/60 bg-background/40 px-2 py-1.5 text-[11px] text-muted-foreground">
                    AI topic clusters will appear once context summary is generated.
                  </p>
                ) : (
                  narrativeFocusOptions.map((item) => (
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
                  ))
                )}
              </CardContent>
            </Card>

          </aside>

          <section className="space-y-2">
            <NetworkMap
              posts={visualizationPosts}
              accounts={visualizationAccounts}
              selectedAccountId={accountId}
              centerFocus={centerFocus}
              sourceTab={sourceTab}
              onSelectAccount={handleGraphSelectAccount}
            />

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
                    {sourceScopedAccounts.map((account) => (
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

                <label className="grid gap-1 text-[11px] text-muted-foreground md:col-span-2 xl:col-span-2">
                  <span>Post type</span>
                  <select
                    value={postTypeFilter}
                    onChange={(event) => setPostTypeFilter(event.target.value)}
                    className="h-8 rounded border border-input bg-background px-2 text-xs text-foreground"
                  >
                    <option value="all">All post types</option>
                    {postTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-[11px] text-muted-foreground">
                  <span>Tone</span>
                  <select
                    value={toneFilter}
                    onChange={(event) => setToneFilter(event.target.value)}
                    className="h-8 rounded border border-input bg-background px-2 text-xs text-foreground"
                  >
                    <option value="all">All tones</option>
                    {toneOptions.map((option) => (
                      <option key={option} value={option}>
                        {option.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-[11px] text-muted-foreground">
                  <span>Actionability</span>
                  <select
                    value={actionabilityFilter}
                    onChange={(event) => setActionabilityFilter(event.target.value)}
                    className="h-8 rounded border border-input bg-background px-2 text-xs text-foreground"
                  >
                    <option value="all">All actions</option>
                    {actionabilityOptions.map((option) => (
                      <option key={option} value={option}>
                        {option.toLowerCase().replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-[11px] text-muted-foreground">
                  <span>Engaging account</span>
                  <select
                    value={engagingHandleFilter}
                    onChange={(event) => setEngagingHandleFilter(event.target.value)}
                    className="h-8 rounded border border-input bg-background px-2 text-xs text-foreground"
                  >
                    <option value="all">All engagers</option>
                    {topEngagers.slice(0, 40).map((engager) => (
                      <option key={engager.id} value={engager.handle}>
                        @{engager.handle}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-[11px] text-muted-foreground">
                  <span>Adjacent interest</span>
                  <select
                    value={adjacentInterestFilter}
                    onChange={(event) => setAdjacentInterestFilter(event.target.value)}
                    className="h-8 rounded border border-input bg-background px-2 text-xs text-foreground"
                  >
                    <option value="all">All interests</option>
                    {adjacentInterests.slice(0, 40).map((interest) => (
                      <option key={interest.interest} value={interest.interest}>
                        {interest.interest}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-[11px] text-muted-foreground">
                  <span>Interest type</span>
                  <select
                    value={interestKindFilter}
                    onChange={(event) => setInterestKindFilter(event.target.value)}
                    className="h-8 rounded border border-input bg-background px-2 text-xs text-foreground"
                  >
                    <option value="all">All</option>
                    <option value="TRADE_RELATED">Trade-related</option>
                    <option value="ADJACENT_NON_TRADE">Adjacent / non-trade</option>
                  </select>
                </label>

                <label className="grid gap-1 text-[11px] text-muted-foreground">
                  <span>Engagement type</span>
                  <select
                    value={engagementTypeFilter}
                    onChange={(event) => setEngagementTypeFilter(event.target.value)}
                    className="h-8 rounded border border-input bg-background px-2 text-xs text-foreground"
                  >
                    <option value="all">All supported</option>
                    {providerCapabilities
                      .find((cap) => cap.provider === sourceTab)
                      ?.availableEngagementTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.toLowerCase()}
                        </option>
                      ))}
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
              {sourceScopedPosts.length === 0 ? (
                <Card className="border-border/70 bg-card/70">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No {sourceTab === "X" ? "X" : "LinkedIn"} stream data yet for {centerFocus}. Ingest or switch tab.
                  </CardContent>
                </Card>
              ) : filtered.length === 0 ? (
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
                              <Badge variant="secondary" className="text-[10px]">
                                {post.sourcePlatform === "X" ? "X" : "LinkedIn"}
                              </Badge>
                              {highSignal ? (
                                <Badge className="border-0 bg-rose-500/15 text-[10px] text-rose-300">high velocity</Badge>
                              ) : null}
                              {opportunity ? (
                                <Badge className="border-0 bg-emerald-500/15 text-[10px] text-emerald-300">engage now</Badge>
                              ) : null}
                              {post.classification ? (
                                <>
                                  <Badge className="border-0 bg-sky-500/15 text-[10px] text-sky-300">
                                    {post.classification.postType.toLowerCase().replace(/_/g, " ")}
                                  </Badge>
                                  <Badge className="border-0 bg-violet-500/15 text-[10px] text-violet-300">
                                    {post.classification.tone.toLowerCase()}
                                  </Badge>
                                </>
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
                            {post.classification?.whyItMatters ? (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                <span className="font-medium text-foreground">Impact:</span> {post.classification.whyItMatters}
                              </p>
                            ) : null}
                            {post.classification?.actionableAngle ? (
                              <p className="mt-1 text-[11px] text-emerald-200">
                                <span className="font-medium text-emerald-300">Angle:</span> {post.classification.actionableAngle}
                              </p>
                            ) : null}
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
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Narrative command layer</CardTitle>
                  <button
                    type="button"
                    onClick={refreshContextSummary}
                    disabled={summaryPending}
                    className="inline-flex h-7 items-center gap-1 rounded border border-border/70 bg-background/60 px-2 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-60"
                  >
                    <RefreshCw className={`size-3 ${summaryPending ? "animate-spin" : ""}`} /> Refresh
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 p-2 pt-0">
                <div className="inline-flex rounded border border-border/70 bg-background/50 p-0.5 text-[11px]">
                  {[24, 72].map((hours) => (
                    <button
                      key={hours}
                      onClick={() => setSummaryWindowHours(hours as 24 | 72)}
                      className={`rounded px-2 py-1 ${
                        summaryWindowHours === hours ? "bg-primary/20 text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {hours === 24 ? "24h" : "3d"}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {contextSummary
                    ? `Generated ${formatDistanceToNowStrict(new Date(contextSummary.generatedAt), { addSuffix: true })} · ${
                        contextSummary.postCount
                      } post(s)`
                    : "No narrative summary generated yet."}
                </p>
                {summaryError ? (
                  <div className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200">
                    {summaryError}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Tracked account overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-2 pt-0 text-xs">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Top topics</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {trackedOverview.topTopics.slice(0, 8).map((topic) => (
                      <span key={topic} className="rounded border border-border/70 bg-background/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Top post types</p>
                  <div className="mt-1 space-y-1">
                    {trackedOverview.topPostTypes.slice(0, 4).map((entry) => (
                      <div key={entry.type} className="flex items-center justify-between rounded border border-border/70 bg-background/40 px-2 py-1">
                        <span>{String(entry.type).toLowerCase().replace(/_/g, " ")}</span>
                        <span className="text-muted-foreground">{entry.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Engaging audience</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-2 pt-0">
                {filteredTopEngagers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No reliable engager events available for this provider/context yet.</p>
                ) : (
                  filteredTopEngagers.slice(0, 6).map((engager) => (
                    <div key={engager.id} className="rounded border border-border/70 bg-background/40 p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">@{engager.handle}</span>
                        <span className="text-muted-foreground">{engager.totalEngagements} interactions</span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        first {formatDistanceToNowStrict(new Date(engager.firstSeenAt), { addSuffix: true })} · last {formatDistanceToNowStrict(
                          new Date(engager.lastSeenAt),
                          { addSuffix: true }
                        )}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Adjacent interests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-2 pt-0">
                {filteredAdjacentInterests.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No adjacent-interest profiles yet (requires engager activity ingestion).</p>
                ) : (
                  filteredAdjacentInterests.slice(0, 8).map((interest) => (
                    <div key={interest.interest} className="rounded border border-border/70 bg-background/40 p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{interest.interest}</span>
                        <span className="text-[10px] text-muted-foreground">{interest.interestKind === "TRADE_RELATED" ? "trade" : "adjacent"}</span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        confidence {(interest.confidence * 100).toFixed(0)}% · {interest.representativeKeywords.slice(0, 4).join(", ")}
                      </p>
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
                {summaryTopics.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No clustered narratives in the selected window.</p>
                ) : (
                  summaryTopics.slice(0, 6).map((topic) => (
                    <div key={topic.topic_name} className="rounded border border-border/70 bg-background/40 p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{topic.topic_name}</p>
                        <span className="text-[10px] uppercase text-muted-foreground">{topic.tone}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{truncate(topic.summary, 120)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Key topics</CardTitle>
                  {selectedKeyTopics.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setSelectedKeyTopics([])}
                      className="rounded border border-border/70 bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Clear ({selectedKeyTopics.length})
                    </button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 p-2 pt-0">
                {summaryKeyTopics.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No high-signal key terms yet.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1">
                      {summaryKeyTopics.slice(0, 18).map((topic) => {
                        const active = selectedKeyTopics.some(
                          (selectedTopic) => selectedTopic.toLowerCase() === topic.toLowerCase()
                        );

                        return (
                          <button
                            key={topic}
                            type="button"
                            onClick={() =>
                              setSelectedKeyTopics((current) => {
                                const exists = current.some(
                                  (selectedTopic) => selectedTopic.toLowerCase() === topic.toLowerCase()
                                );
                                if (exists) {
                                  return current.filter(
                                    (selectedTopic) => selectedTopic.toLowerCase() !== topic.toLowerCase()
                                  );
                                }
                                return [...current, topic];
                              })
                            }
                            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] transition ${
                              active
                                ? "border-primary/40 bg-primary/15 text-foreground"
                                : "border-border/70 bg-background/50 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {topic}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {selectedKeyTopics.length > 0
                        ? `Visualization filtered by ${selectedKeyTopics.length} selected key topic(s).`
                        : "Select one or more key topics to filter the constellation relationships."}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Engage now</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-2 pt-0">
                {filteredActionableSignals.length > 0 ? (
                  filteredActionableSignals.slice(0, 3).map((signal) => (
                    <div key={signal.id} className="rounded border border-border/70 bg-background/40 p-2 text-xs">
                      <p className="font-medium">{signal.title}</p>
                      <p className="mt-0.5 text-muted-foreground">{truncate(signal.description, 110)}</p>
                    </div>
                  ))
                ) : null}

                {engageAngleTargets.length > 0 ? (
                  engageAngleTargets.slice(0, 4).map((item, index) => {
                    const active = item.post?.id === selectedEngagePost?.id;

                    return (
                      <button
                        key={`angle-${index}`}
                        type="button"
                        onClick={() => {
                          if (item.post) setEngageTargetPostId(item.post.id);
                        }}
                        className={`w-full rounded border p-2 text-left text-xs transition ${
                          active
                            ? "border-primary/40 bg-primary/10 text-foreground"
                            : "border-border/70 bg-background/40 text-muted-foreground"
                        }`}
                      >
                        <p>{item.angle}</p>
                        {item.post ? (
                          <p className="mt-1 text-[10px] text-muted-foreground">Target: @{item.post.account.handle}</p>
                        ) : (
                          <p className="mt-1 text-[10px] text-muted-foreground">No matching post in current scope.</p>
                        )}
                      </button>
                    );
                  })
                ) : null}

                {selectedEngagePost ? (
                  <div className="rounded border border-primary/30 bg-primary/10 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">Tweet to engage: @{selectedEngagePost.account.handle}</p>
                      <a
                        href={selectedEngagePost.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-primary hover:underline"
                      >
                        Open tweet
                      </a>
                    </div>
                    <p className="mt-1 text-muted-foreground">{truncate(selectedEngagePost.content, 160)}</p>
                  </div>
                ) : null}

                {engageNow.length > 0 ? (
                  engageNow.slice(0, 6).map((post) => {
                    const active = selectedEngagePost?.id === post.id;

                    return (
                      <div
                        key={`engage-${post.id}`}
                        className={`rounded border p-2 text-xs ${
                          active
                            ? "border-primary/40 bg-primary/10"
                            : "border-border/70 bg-background/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setEngageTargetPostId(post.id)}
                            className="text-left font-medium"
                          >
                            @{post.account.handle}
                          </button>
                          <button
                            type="button"
                            onClick={() => openRespondFlow(post)}
                            className="inline-flex h-6 items-center gap-1 rounded border border-border/70 bg-background/70 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            {xSession ? "Respond" : "Login to respond"}
                          </button>
                        </div>
                        <p className="mt-0.5 text-muted-foreground">{truncate(post.summary?.summary ?? post.content, 120)}</p>
                      </div>
                    );
                  })
                ) : summaryEngageNow.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No immediate opportunities in current scope.</p>
                ) : null}
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
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Provider capability notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-2 pt-0 text-xs">
                {(providerCapabilities.find((cap) => cap.provider === sourceTab)
                  ? [providerCapabilities.find((cap) => cap.provider === sourceTab)!]
                  : providerCapabilities
                ).map((capability) => (
                  <div key={capability.provider} className="rounded border border-border/70 bg-background/40 p-2">
                    <p className="font-medium">{capability.provider === "X" ? "X" : "LinkedIn"}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Supported: {capability.availableEngagementTypes.map((type) => type.toLowerCase()).join(", ") || "none"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{capability.notes}</p>
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

      <AddWatchlistAccountDialog
        open={watchlistDialog.open}
        watchlistKey={watchlistDialog.watchlistKey}
        watchlistLabel={dialogWatchlistLabel}
        center={centerFocus}
        sourcePlatform={sourceTab}
        pending={watchlistPending}
        message={watchlistDialogMessage}
        onClose={closeWatchlistDialog}
        onSubmit={handleAddWatchlistAccount}
      />

      <XLoginDialog
        open={xLoginOpen}
        pending={xPending}
        message={xLoginMessage}
        onClose={() => {
          setXLoginOpen(false);
          setXLoginMessage(null);
        }}
        onSubmit={handleConnectX}
      />

      <XRespondDialog
        open={xComposeOpen}
        post={xComposeTarget}
        pending={xPending}
        message={xComposeMessage}
        onClose={() => {
          setXComposeOpen(false);
          setXComposeTarget(null);
          setXComposeMessage(null);
        }}
        onSubmit={handlePostResponse}
      />
    </main>
  );
}
