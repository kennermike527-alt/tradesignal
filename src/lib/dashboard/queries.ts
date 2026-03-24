import { AccountCategory, IngestionStatus, SocialProvider } from "@prisma/client";
import { subHours } from "date-fns";
import { db } from "@/lib/db";
import { buildDemoPayload } from "@/lib/dashboard/demo-payload";
import { detectSourcePlatformFromUrl, pickCenterFromText } from "@/lib/context/context-resolver";
import { cadenceLabelForAccounts } from "@/lib/ingestion/budget-guard";
import { getDatabaseHealth } from "@/lib/runtime/db-health";
import { getOrCreateContextSummary } from "@/lib/summarization/context-summarization-service";
import { fromDbWatchlistKey } from "@/lib/watchlists";
import type { DashboardPayload, DashboardPost, DashboardStats } from "@/lib/types";

function buildStats(posts: DashboardPost[], activeAccounts: number, latestStatus: IngestionStatus | null, latestAt: Date | null): DashboardStats {
  const now = Date.now();
  const in2h = now - 2 * 60 * 60 * 1000;
  const in24h = now - 24 * 60 * 60 * 1000;

  const highSignalPosts = posts.filter(
    (post) => post.likeCount + post.replyCount * 2 + post.repostCount * 3 + post.quoteCount * 2 >= 420
  ).length;

  const opportunitiesDetected = posts.filter((post) => {
    const text = `${post.content} ${post.summary?.summary ?? ""}`.toLowerCase();
    return /engage|opportun|partnership|opening|window|distribution/.test(text);
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

export async function getDashboardPayload(limit = 320): Promise<DashboardPayload> {
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

    const posts: DashboardPost[] = postsRaw.map((post) => {
      const sourcePlatform = detectSourcePlatformFromUrl(post.sourceUrl);
      const center = pickCenterFromText(`${post.content} ${post.summary?.summary ?? ""}`, post.account.handle);

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
      };
    });

    const watchlistAssignments = watchlistRows.map((row) => ({
      id: row.id,
      watchlistKey: fromDbWatchlistKey(row.watchlistKey),
      center: row.center,
      sourcePlatform: row.sourcePlatform,
      handle: row.handle,
      displayName: row.displayName,
      createdAt: row.createdAt,
    }));

    const stats = buildStats(
      posts,
      accounts.length,
      latestRun?.status ?? null,
      latestRun?.finishedAt ?? latestRun?.startedAt ?? null
    );

    return {
      posts,
      accounts,
      categories: Object.values(AccountCategory),
      watchlistAssignments,
      initialContextSummary,
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
