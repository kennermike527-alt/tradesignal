import type { Account, AccountCategory, IngestionRun, IngestionStatus, Post, PostSummary, SocialProvider } from "@prisma/client";

export type TrackedAccount = Pick<Account, "id" | "displayName" | "handle" | "category" | "tags" | "isActive" | "provider">;

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

export type DashboardPost = Post & {
  account: Account;
  summary: PostSummary | null;
};

export type DashboardStats = {
  totalAccounts: number;
  activeAccounts: number;
  posts24h: number;
  posts7d: number;
  latestIngestionStatus: IngestionStatus | null;
  latestIngestionAt: Date | null;
};

export type DashboardPayload = {
  posts: DashboardPost[];
  accounts: Pick<Account, "id" | "displayName" | "handle" | "category" | "tags">[];
  categories: AccountCategory[];
  stats: DashboardStats;
  ingestionRuns: Pick<IngestionRun, "id" | "status" | "startedAt" | "finishedAt" | "notes">[];
};

export type IngestionOutcome = {
  runId: string;
  status: IngestionStatus;
  accountsProcessed: number;
  postsFetched: number;
  postsInserted: number;
  summariesGenerated: number;
  errors: string[];
};
