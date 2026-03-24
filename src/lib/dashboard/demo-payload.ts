import { AccountCategory, IngestionStatus } from "@prisma/client";
import type { DashboardPayload, TerminalSystemStatus } from "@/lib/types";

type BuildDemoOptions = {
  dbCode: TerminalSystemStatus["dbCode"];
  dbMessage: string;
};

export function buildDemoPayload(options: BuildDemoOptions): DashboardPayload {
  const now = new Date();

  return {
    posts: [],
    accounts: [],
    categories: Object.values(AccountCategory),
    stats: {
      trackedAccounts: 0,
      activeAccounts: 0,
      newPosts2h: 0,
      newPosts24h: 0,
      highSignalPosts: 0,
      opportunitiesDetected: 0,
      latestIngestionStatus: IngestionStatus.FAILED,
      latestIngestionAt: now,
    },
    ingestionRuns: [
      {
        id: "live-only-fallback",
        status: IngestionStatus.FAILED,
        startedAt: now,
        finishedAt: now,
        notes: "Live-only mode: no curated fallback stream. Connect DB + ingestion sources to populate dashboard.",
      },
    ],
    system: {
      mode: "DEMO",
      dbCode: options.dbCode,
      dbMessage: `${options.dbMessage} Live-only mode is enabled: no curated fallback account list is injected.`,
      providerLabel: "X + LinkedIn (live-only)",
      summaryLabel: process.env.OPENAI_API_KEY ? "OpenAI + fallback" : "Heuristic fallback",
      cadenceLabel: "Manual ingest + /api/ingest scheduler",
      lastRefreshAt: now,
    },
  };
}
