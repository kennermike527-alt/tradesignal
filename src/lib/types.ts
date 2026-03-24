import type { Account, AccountCategory, IngestionStatus, SocialProvider } from "@prisma/client";

export type TrackedAccount = Pick<Account, "id" | "displayName" | "handle" | "category" | "tags" | "isActive" | "provider">;

export type IntelligenceCenter = "IOTA" | "TWIN";
export type SourcePlatform = "X" | "LINKEDIN";
export type WatchlistKey = "all" | "priority" | "competitors" | "founders" | "media" | "ecosystem";

export type NormalizedSocialPost = {
  provider: SocialProvider;
  externalPostId: string;
  content: string;
  postedAt: Date;
  sourceUrl: string;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  quoteCount?: number | null;
  rawPayload?: unknown;
};

export type DashboardAccount = {
  id: string;
  displayName: string;
  handle: string;
  category: AccountCategory;
  tags: string[];
};

export type DashboardPost = {
  id: string;
  provider: SocialProvider;
  accountId: string;
  externalPostId: string;
  content: string;
  postedAt: Date;
  fetchedAt: Date;
  sourceUrl: string;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  quoteCount: number;
  sourcePlatform: SourcePlatform;
  center: IntelligenceCenter | null;
  account: DashboardAccount;
  summary: {
    summary: string;
    model: string;
  } | null;
};

export type DashboardStats = {
  trackedAccounts: number;
  activeAccounts: number;
  newPosts2h: number;
  newPosts24h: number;
  highSignalPosts: number;
  opportunitiesDetected: number;
  latestIngestionStatus: IngestionStatus | null;
  latestIngestionAt: Date | null;
};

export type IngestionRunPreview = {
  id: string;
  status: IngestionStatus;
  startedAt: Date;
  finishedAt: Date | null;
  notes: string | null;
};

export type WatchlistAssignment = {
  id: string;
  watchlistKey: WatchlistKey;
  center: IntelligenceCenter;
  sourcePlatform: SourcePlatform;
  handle: string;
  displayName: string | null;
  createdAt: Date;
};

export type TerminalSystemStatus = {
  mode: "LIVE" | "DEMO";
  dbCode: "CONNECTED" | "MISSING_DATABASE_URL" | "UNREACHABLE";
  dbMessage: string;
  providerLabel: string;
  summaryLabel: string;
  cadenceLabel: string;
  lastRefreshAt: Date;
};

export type DashboardPayload = {
  posts: DashboardPost[];
  accounts: DashboardAccount[];
  categories: AccountCategory[];
  watchlistAssignments: WatchlistAssignment[];
  stats: DashboardStats;
  ingestionRuns: IngestionRunPreview[];
  system: TerminalSystemStatus;
};

export type IngestionErrorCode =
  | "NONE"
  | "DB_URL_MISSING"
  | "DB_UNREACHABLE"
  | "INGESTION_FAILURE"
  | "BUDGET_GUARD_BLOCK";

export type IngestionOutcome = {
  runId: string;
  status: IngestionStatus;
  accountsProcessed: number;
  postsFetched: number;
  postsInserted: number;
  summariesGenerated: number;
  errors: string[];
  errorCode: IngestionErrorCode;
  budget?: {
    monthlyBudgetUsd: number;
    cadenceMinutes: number;
    estimatedCostPerRunUsd: number;
    projectedMonthlyCostUsd: number;
    minimumCadenceMinutes: number;
  };
};
