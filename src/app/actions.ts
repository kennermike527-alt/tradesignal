"use server";

import { IntelligenceCenter, Prisma, SourcePlatform } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { buildDemoContextSummaryForContext } from "@/lib/dashboard/demo-payload";
import { ingestLatestPosts } from "@/lib/ingestion/ingest-service";
import { getDatabaseHealth } from "@/lib/runtime/db-health";
import {
  getContextSummaryPromptPreview,
  getOrCreateContextSummary,
} from "@/lib/summarization/context-summarization-service";
import { isWatchlistKey, toDbWatchlistKey } from "@/lib/watchlists";
import type { ContextNarrativeSummary, WatchlistAssignment, WatchlistKey } from "@/lib/types";

type ManualIngestResponse = {
  ok: boolean;
  message: string;
  runId?: string;
};

type AddWatchlistAccountInput = {
  watchlistKey: WatchlistKey;
  center: "IOTA" | "TWIN";
  sourcePlatform: "X" | "LINKEDIN";
  handle: string;
  displayName?: string;
};

type AddWatchlistAccountResponse = {
  ok: boolean;
  message: string;
  assignment?: WatchlistAssignment;
};

type ContextSummaryInput = {
  center: "IOTA" | "TWIN";
  sourcePlatform: "X" | "LINKEDIN";
  windowHours?: number;
};

type ContextSummaryResponse = {
  ok: boolean;
  message?: string;
  summary?: ContextNarrativeSummary;
  promptConfig?: ReturnType<typeof getContextSummaryPromptPreview>;
};

function userMessageFromCode(code: string) {
  if (code === "DB_URL_MISSING") {
    return "Ingestion offline: DATABASE_URL missing. Configure env + run npm run db:setup.";
  }

  if (code === "DB_UNREACHABLE") {
    return "Ingestion offline: database unreachable. Check database service and DATABASE_URL.";
  }

  if (code === "INGESTION_FAILURE") {
    return "Ingestion completed with issues. Review ingestion runs panel for status details.";
  }

  if (code === "BUDGET_GUARD_BLOCK") {
    return "Ingestion blocked by budget guard. Increase cadence interval or reduce scope to stay within monthly cap.";
  }

  return "Ingestion did not complete. Please retry.";
}

function normalizeHandle(sourcePlatform: "X" | "LINKEDIN", rawValue: string) {
  let candidate = rawValue.trim();

  if (sourcePlatform === "X") {
    const xUrlMatch = candidate.match(/(?:x\.com|twitter\.com)\/(?:#!\/)?@?([A-Za-z0-9_]{1,15})/i);
    if (xUrlMatch?.[1]) candidate = xUrlMatch[1];

    candidate = candidate.replace(/^@+/, "").trim();

    if (!/^[A-Za-z0-9_]{1,15}$/.test(candidate)) {
      return {
        ok: false as const,
        message: "Invalid X handle. Use letters, numbers, underscores (1-15 chars).",
      };
    }

    return {
      ok: true as const,
      handle: `@${candidate}`,
      handleNormalized: candidate.toLowerCase(),
    };
  }

  const linkedInCompanyMatch = candidate.match(/linkedin\.com\/(?:company|in)\/([A-Za-z0-9_-]{2,100})/i);
  if (linkedInCompanyMatch?.[1]) candidate = linkedInCompanyMatch[1];

  candidate = candidate.replace(/^@+/, "").trim();

  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,99}$/.test(candidate)) {
    return {
      ok: false as const,
      message: "Invalid LinkedIn handle/slug. Use letters, numbers, dash or underscore.",
    };
  }

  return {
    ok: true as const,
    handle: candidate,
    handleNormalized: candidate.toLowerCase(),
  };
}

function parseCenter(value: string) {
  if (value === IntelligenceCenter.IOTA || value === IntelligenceCenter.TWIN) return value;
  return null;
}

function parseSourcePlatform(value: string) {
  if (value === SourcePlatform.X || value === SourcePlatform.LINKEDIN) return value;
  return null;
}

function normalizeWindowHours(value: number | undefined) {
  if (!value || Number.isNaN(value)) return 24;
  if (value <= 24) return 24;
  return 72;
}

export async function runManualIngestionAction(): Promise<ManualIngestResponse> {
  const result = await ingestLatestPosts({ initiatedBy: "manual", generateSummaries: true });

  if (result.status === "SUCCESS" || result.status === "PARTIAL") {
    revalidatePath("/");

    const budgetSuffix = result.budget
      ? ` Est. monthly API burn: $${result.budget.projectedMonthlyCostUsd.toFixed(2)} at ${result.budget.cadenceMinutes}m cadence.`
      : "";

    return {
      ok: true,
      message: `${result.status}: inserted ${result.postsInserted} posts, generated ${result.summariesGenerated} summaries.${budgetSuffix}`,
      runId: result.runId,
    };
  }

  return {
    ok: false,
    message: `${userMessageFromCode(result.errorCode)}${
      result.budget
        ? ` Current estimate: $${result.budget.projectedMonthlyCostUsd.toFixed(2)}/mo at ${
            result.budget.cadenceMinutes
          }m cadence (min ${result.budget.minimumCadenceMinutes}m).`
        : ""
    }`,
  };
}

export async function addWatchlistAccountAction(input: AddWatchlistAccountInput): Promise<AddWatchlistAccountResponse> {
  if (!isWatchlistKey(input.watchlistKey)) {
    return { ok: false, message: "Invalid watchlist target." };
  }

  const center = parseCenter(input.center);
  if (!center) {
    return { ok: false, message: "Invalid center context." };
  }

  const sourcePlatform = parseSourcePlatform(input.sourcePlatform);
  if (!sourcePlatform) {
    return { ok: false, message: "Invalid source context." };
  }

  const normalized = normalizeHandle(input.sourcePlatform, input.handle);
  if (!normalized.ok) {
    return { ok: false, message: normalized.message };
  }

  const watchlistKey = toDbWatchlistKey(input.watchlistKey);
  const displayName = input.displayName?.trim() ? input.displayName.trim() : null;

  try {
    const account = await db.account.findFirst({
      where: {
        handle: {
          equals: normalized.handleNormalized,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    const created = await db.watchlistAccount.create({
      data: {
        watchlistKey,
        center,
        sourcePlatform,
        handle: normalized.handle,
        handleNormalized: normalized.handleNormalized,
        displayName,
        accountId: account?.id,
      },
      select: {
        id: true,
        watchlistKey: true,
        center: true,
        sourcePlatform: true,
        handle: true,
        displayName: true,
        createdAt: true,
      },
    });

    revalidatePath("/");

    return {
      ok: true,
      message: `${normalized.handle} added to ${input.watchlistKey}.`,
      assignment: {
        id: created.id,
        watchlistKey: input.watchlistKey,
        center: created.center,
        sourcePlatform: created.sourcePlatform,
        handle: created.handle,
        displayName: created.displayName,
        createdAt: created.createdAt,
      },
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        message: "Duplicate: this handle already exists in that watchlist for the active center/source.",
      };
    }

    return {
      ok: false,
      message: "Unable to add account right now. Please retry.",
    };
  }
}

export async function getContextSummaryAction(input: ContextSummaryInput): Promise<ContextSummaryResponse> {
  const center = parseCenter(input.center);
  const sourcePlatform = parseSourcePlatform(input.sourcePlatform);

  if (!center || !sourcePlatform) {
    return { ok: false, message: "Invalid context for summary request." };
  }

  const windowHours = normalizeWindowHours(input.windowHours);
  const dbHealth = await getDatabaseHealth();

  if (!dbHealth.ok) {
    return {
      ok: true,
      summary: buildDemoContextSummaryForContext(center, sourcePlatform, windowHours),
      promptConfig: getContextSummaryPromptPreview(),
      message: "Database unavailable, using dummy summary layer.",
    };
  }

  try {
    const summary = await getOrCreateContextSummary({
      center,
      sourcePlatform,
      windowHours,
      forceRefresh: false,
    });

    return {
      ok: true,
      summary,
      promptConfig: getContextSummaryPromptPreview(),
    };
  } catch {
    return {
      ok: false,
      message: "Unable to generate context summary right now.",
    };
  }
}

export async function refreshContextSummaryAction(input: ContextSummaryInput): Promise<ContextSummaryResponse> {
  const center = parseCenter(input.center);
  const sourcePlatform = parseSourcePlatform(input.sourcePlatform);

  if (!center || !sourcePlatform) {
    return { ok: false, message: "Invalid context for summary refresh." };
  }

  const windowHours = normalizeWindowHours(input.windowHours);
  const dbHealth = await getDatabaseHealth();

  if (!dbHealth.ok) {
    return {
      ok: true,
      summary: buildDemoContextSummaryForContext(center, sourcePlatform, windowHours),
      promptConfig: getContextSummaryPromptPreview(),
      message: "Database unavailable, refreshed dummy summary layer.",
    };
  }

  try {
    const summary = await getOrCreateContextSummary({
      center,
      sourcePlatform,
      windowHours,
      forceRefresh: true,
    });

    revalidatePath("/");

    return {
      ok: true,
      summary,
      promptConfig: getContextSummaryPromptPreview(),
    };
  } catch {
    return {
      ok: false,
      message: "Unable to refresh context summary right now.",
    };
  }
}
