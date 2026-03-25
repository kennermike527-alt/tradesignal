import { AccountCategory, IngestionStatus, SocialProvider } from "@prisma/client";
import { subHours } from "date-fns";
import { db } from "@/lib/db";
import { buildDemoPayload } from "@/lib/dashboard/demo-payload";
import { cadenceLabelForAccounts } from "@/lib/ingestion/budget-guard";
import { getDatabaseHealth } from "@/lib/runtime/db-health";
import { getOrCreateContextSummary } from "@/lib/summarization/context-summarization-service";
import { fromDbWatchlistKey } from "@/lib/watchlists";
import { applyClassificationToPosts, buildDashboardIntelligence } from "@/lib/intelligence/account-led-intelligence-service";
import type { DashboardPayload, DashboardPost, DashboardStats, IntelligenceCenter, SourcePlatform } from "@/lib/types";

function normalizeHandle(handle: string) {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

function inferSourcePlatform(sourceUrl: string): SourcePlatform {
  const lower = sourceUrl.toLowerCase();
  if (lower.includes("linkedin.com")) return "LINKEDIN";
  return "X";
}

function fallbackCenterFromTags(tags: string[]): IntelligenceCenter | null {
  const normalized = tags.map((tag) => tag.toLowerCase());
  if (normalized.some((tag) => tag.includes("iota"))) return "IOTA";
  if (normalized.some((tag) => tag.includes("twin"))) return "TWIN";
  return null;
}

function buildStats(posts: DashboardPost[], activeAccounts: number, latestStatus: IngestionStatus | null, latestAt: Date | null): DashboardStats {
  const now = Date.now();
  const in2h = now - 2 * 60 * 60 * 1000;
  const in24h = now - 24 * 60 * 60 * 1000;

  const highSignalPosts = posts.filter(
    (post) => post.likeCount + post.replyCount * 2 + post.repostCount * 3 + post.quoteCount * 2 >= 420
  ).length;

  const opportunitiesDetected = posts.filter((post) => {
    const classification = post.classification;
    if (!classification) return false;

    return ["CONTENT_OPPORTUNITY", "REPLY_OPPORTUNITY", "RELATIONSHIP_OPPORTUNITY"].includes(
      classification.actionability
    );
  }).length;

  return {
    trackedAccounts: activeAccounts,
    activeAccounts,
    newPosts2h: posts.filter((post) => post.postedAt.getTime() >= in2h).length,
    newPosts24h: posts.filter((post) => post.postedAt.getTime() >= in24h).length,
    highSignalPosts,
    opportunitiesDetected,
    latestIngestionStatus: latestStatus,
    latestIngestionAt: latestAt,
  };
}

export async function getDashboardPayload(limit = 420): Promise<DashboardPayload> {
  const dbHealth = await getDatabaseHealth();

  if (!dbHealth.ok) {
    return buildDemoPayload({
      dbCode: dbHealth.code,
      dbMessage: dbHealth.message,
    });
  }

  try {
    const [postsRaw, accounts, watchlistRows, latestRun, ingestionRuns, initialContextSummary] = await Promise.all([
      db.post.findMany({
        orderBy: { postedAt: "desc" },
        take: limit,
        include: {
          account: {
            select: {
              id: true,
              displayName: true,
              handle: true,
              category: true,
              tags: true,
            },
          },
          summary: {
            select: {
              summary: true,
              model: true,
            },
          },
          classification: {
            select: {
              topics: true,
              postType: true,
              tone: true,
              actionability: true,
              whyItMatters: true,
              actionableAngle: true,
              confidence: true,
              model: true,
            },
          },
        },
      }),
      db.account.findMany({
        where: { isActive: true },
        orderBy: { displayName: "asc" },
        select: {
          id: true,
          displayName: true,
          handle: true,
          category: true,
          tags: true,
        },
      }),
      db.watchlistAccount.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          watchlistKey: true,
          center: true,
          sourcePlatform: true,
          handle: true,
          handleNormalized: true,
          displayName: true,
          createdAt: true,
        },
      }),
      db.ingestionRun.findFirst({
        orderBy: { startedAt: "desc" },
        select: {
          status: true,
          finishedAt: true,
          startedAt: true,
        },
      }),
      db.ingestionRun.findMany({
        take: 10,
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          notes: true,
        },
      }),
      getOrCreateContextSummary({
        center: "IOTA",
        sourcePlatform: "X",
        windowHours: 24,
      }),
    ]);

    if (postsRaw.length === 0) {
      return buildDemoPayload({
        dbCode: "CONNECTED",
        dbMessage: "Database is reachable, but no live posts are available yet.",
      });
    }

    const assignmentMap = new Map<string, IntelligenceCenter[]>();
    for (const row of watchlistRows) {
      const key = `${row.sourcePlatform}:${row.handleNormalized}`;
      if (!assignmentMap.has(key)) assignmentMap.set(key, []);
      assignmentMap.get(key)!.push(row.center);
    }

    const posts: DashboardPost[] = postsRaw.map((post) => {
      const sourcePlatform = inferSourcePlatform(post.sourceUrl);
      const assignmentKey = `${sourcePlatform}:${normalizeHandle(post.account.handle)}`;
      const assignedCenters = assignmentMap.get(assignmentKey) || [];

      const center =
        assignedCenters[0] ||
        fallbackCenterFromTags(post.account.tags) ||
        null;

      return {
        id: post.id,
        provider: post.provider,
        externalPostId: post.externalPostId,
        accountId: post.accountId,
        content: post.content,
        postedAt: post.postedAt,
        fetchedAt: post.fetchedAt,
        sourceUrl: post.sourceUrl,
        likeCount: post.likeCount,
        replyCount: post.replyCount,
        repostCount: post.repostCount,
        quoteCount: post.quoteCount ?? 0,
        sourcePlatform,
        center,
        account: post.account,
        summary: post.summary,
        classification: post.classification,
      };
    });

    const hydratedPosts = applyClassificationToPosts(posts);

    const watchlistAssignments = watchlistRows.map((row) => ({
      id: row.id,
      watchlistKey: fromDbWatchlistKey(row.watchlistKey),
      center: row.center,
      sourcePlatform: row.sourcePlatform,
      handle: row.handle,
      displayName: row.displayName,
      createdAt: row.createdAt,
    }));

    const intelligence = await buildDashboardIntelligence(hydratedPosts);

    const stats = buildStats(
      hydratedPosts,
      accounts.length,
      latestRun?.status ?? null,
      latestRun?.finishedAt ?? latestRun?.startedAt ?? null
    );

    return {
      posts: hydratedPosts,
      accounts,
      categories: Object.values(AccountCategory),
      watchlistAssignments,
      initialContextSummary,
      intelligence,
      stats,
      ingestionRuns,
      system: {
        mode: "LIVE",
        dbCode: "CONNECTED",
        dbMessage: "Database connected.",
        providerLabel: SocialProvider.X,
        summaryLabel: process.env.OPENAI_API_KEY ? "OpenAI + fallback" : "Heuristic fallback",
        cadenceLabel: cadenceLabelForAccounts(accounts.length),
        lastRefreshAt: new Date(),
      },
    };
  } catch {
    return buildDemoPayload({
      dbCode: "UNREACHABLE",
      dbMessage: "Database query failed. Showing demo-mode intelligence stream with controlled fallback.",
    });
  }
}

export function statusTone(status: IngestionStatus | null) {
  if (!status) return "muted" as const;
  if (status === IngestionStatus.SUCCESS) return "success" as const;
  if (status === IngestionStatus.PARTIAL) return "warning" as const;
  if (status === IngestionStatus.FAILED) return "danger" as const;
  return "muted" as const;
}

export function isFresh(ts: Date) {
  return ts.getTime() >= subHours(new Date(), 2).getTime();
}
