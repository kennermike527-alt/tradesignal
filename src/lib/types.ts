import type {
  Account,
  AccountCategory,
  Actionability,
  EngagementType,
  IngestionStatus,
  InterestKind,
  PostTone,
  PostType,
  SocialProvider,
} from "@prisma/client";

export type TrackedAccount = Pick<Account, "id" | "displayName" | "handle" | "category" | "tags" | "isActive" | "provider">;

export type IntelligenceCenter = "IOTA" | "TWIN";
export type SourcePlatform = "X" | "LINKEDIN";
export type WatchlistKey = "all" | "priority" | "competitors" | "founders" | "media" | "ecosystem";

export type ContextSummaryTone = "positive" | "negative" | "neutral" | "mixed";

export type NarrativeTopicSummary = {
  topic_name: string;
  summary: string;
  tone: ContextSummaryTone;
  why_it_matters: string;
  engagement_angles: string[];
  respond_to_handles: string[];
  key_terms: string[];
  post_count: number;
};

export type GlobalNarrativeSummary = {
  key_narratives_right_now: string[];
  gaining_momentum: string[];
  fading: string[];
  attention_concentrated: string[];
  top_opportunities_to_engage: string[];
};

export type ContextNarrativeSummary = {
  center: IntelligenceCenter;
  sourcePlatform: SourcePlatform;
  windowHours: number;
  postCount: number;
  generatedAt: Date;
  model: string;
  keyTopics: string[];
  global_summary: GlobalNarrativeSummary;
  topics: NarrativeTopicSummary[];
};

export type PostClassificationView = {
  topics: string[];
  postType: PostType;
  tone: PostTone;
  actionability: Actionability;
  whyItMatters: string | null;
  actionableAngle: string | null;
  confidence: number;
  model: string;
};

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
  externalPostId: string;
  accountId: string;
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
  classification: PostClassificationView | null;
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

export type TrackedOverview = {
  topTopics: string[];
  topPostTypes: Array<{ type: PostType | "OTHER"; count: number }>;
  topTrackedCategories: Array<{ category: AccountCategory; count: number }>;
};

export type EngagerView = {
  id: string;
  provider: SocialProvider;
  handle: string;
  displayName: string | null;
  totalEngagements: number;
  interactionFrequency: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  influenceScore: number;
};

export type AdjacentInterestView = {
  interest: string;
  confidence: number;
  representativeKeywords: string[];
  representativeHandles: string[];
  interestKind: InterestKind;
};

export type ActionableSignalView = {
  id: string;
  signalType: Actionability;
  title: string;
  description: string;
  targetPostId: string | null;
  targetAccountId: string | null;
  priority: number;
  confidence: number;
  generatedAt: Date;
};

export type ProviderCapabilityView = {
  provider: SourcePlatform;
  availableEngagementTypes: EngagementType[];
  unavailableEngagementTypes: EngagementType[];
  notes: string;
};

export type DashboardIntelligence = {
  trackedOverview: TrackedOverview;
  topEngagers: EngagerView[];
  adjacentInterests: AdjacentInterestView[];
  actionableSignals: ActionableSignalView[];
  providerCapabilities: ProviderCapabilityView[];
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
  initialContextSummary: ContextNarrativeSummary | null;
  intelligence: DashboardIntelligence;
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
