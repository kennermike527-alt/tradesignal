import { AccountCategory, IngestionStatus } from "@prisma/client";
import { subDays } from "date-fns";
import { db } from "@/lib/db";
import type { DashboardPayload } from "@/lib/types";

function emptyPayload(): DashboardPayload {
  return {
    posts: [],
    accounts: [],
    categories: Object.values(AccountCategory),
    stats: {
      totalAccounts: 0,
      activeAccounts: 0,
      posts24h: 0,
      posts7d: 0,
      latestIngestionStatus: null,
      latestIngestionAt: null,
    },
    ingestionRuns: [],
  };
}

export async function getDashboardPayload(limit = 300): Promise<DashboardPayload> {
  try {
    const [posts, accounts, latestRun, posts24h, posts7d, activeAccounts, ingestionRuns] = await Promise.all([
      db.post.findMany({
        orderBy: { postedAt: "desc" },
        take: limit,
        include: {
          account: true,
          summary: true,
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
      db.ingestionRun.findFirst({ orderBy: { startedAt: "desc" } }),
      db.post.count({ where: { postedAt: { gte: subDays(new Date(), 1) } } }),
      db.post.count({ where: { postedAt: { gte: subDays(new Date(), 7) } } }),
      db.account.count({ where: { isActive: true } }),
      db.ingestionRun.findMany({
        take: 5,
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          notes: true,
        },
      }),
    ]);

    return {
      posts,
      accounts,
      categories: Object.values(AccountCategory),
      stats: {
        totalAccounts: accounts.length,
        activeAccounts,
        posts24h,
        posts7d,
        latestIngestionStatus: latestRun?.status ?? null,
        latestIngestionAt: latestRun?.finishedAt ?? latestRun?.startedAt ?? null,
      },
      ingestionRuns,
    };
  } catch {
    return emptyPayload();
  }
}

export function statusTone(status: IngestionStatus | null) {
  if (!status) return "muted" as const;
  if (status === IngestionStatus.SUCCESS) return "success" as const;
  if (status === IngestionStatus.PARTIAL) return "warning" as const;
  if (status === IngestionStatus.FAILED) return "danger" as const;
  return "muted" as const;
}
