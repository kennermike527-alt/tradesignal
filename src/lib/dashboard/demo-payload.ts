import { AccountCategory, IngestionStatus, SocialProvider } from "@prisma/client";
import { cadenceLabelForAccounts } from "@/lib/ingestion/budget-guard";
import { applyClassificationToPosts } from "@/lib/intelligence/account-led-intelligence-service";
import type {
  DashboardAccount,
  DashboardPayload,
  DashboardPost,
  IntelligenceCenter,
  SourcePlatform,
  TerminalSystemStatus,
  WatchlistAssignment,
} from "@/lib/types";

type BuildDemoOptions = {
  dbCode: TerminalSystemStatus["dbCode"];
  dbMessage: string;
};

const DEMO_ACCOUNTS: DashboardAccount[] = [
  { id: "acct-1", displayName: "IOTA Foundation", handle: "iota", category: AccountCategory.ECOSYSTEM, tags: ["iota", "ecosystem"] },
  { id: "acct-2", displayName: "Twin Foundation", handle: "twinfoundation", category: AccountCategory.ECOSYSTEM, tags: ["twin", "ops"] },
  { id: "acct-3", displayName: "Freight Nexus", handle: "freightnexus", category: AccountCategory.COMPETITOR, tags: ["competitor", "pricing"] },
  { id: "acct-4", displayName: "Policy Radar", handle: "policyradar", category: AccountCategory.INFLUENCER, tags: ["policy", "macro"] },
  { id: "acct-5", displayName: "Port Ops Weekly", handle: "portopsweekly", category: AccountCategory.MEDIA, tags: ["ports", "shipping"] },
  { id: "acct-6", displayName: "SupplyChain CTO", handle: "supplychaincto", category: AccountCategory.FOUNDER, tags: ["founder", "infra"] },
];

function makePost(
  id: string,
  account: DashboardAccount,
  center: IntelligenceCenter,
  sourcePlatform: SourcePlatform,
  content: string,
  minuteOffset: number
): DashboardPost {
  const postedAt = new Date(Date.now() - minuteOffset * 60 * 1000);

  return {
    id,
    provider: SocialProvider.X,
    externalPostId: id,
    accountId: account.id,
    content,
    postedAt,
    fetchedAt: new Date(postedAt.getTime() + 60 * 1000),
    sourceUrl:
      sourcePlatform === "X"
        ? `https://x.com/${account.handle}/status/${id}`
        : `https://www.linkedin.com/company/${account.handle}/posts/${id}`,
    likeCount: 25 + (minuteOffset % 120),
    replyCount: 5 + (minuteOffset % 30),
    repostCount: 4 + (minuteOffset % 20),
    quoteCount: 1 + (minuteOffset % 10),
    sourcePlatform,
    center,
    account,
    summary: {
      summary: `Operator summary: ${content.slice(0, 100)}...`,
      model: "demo",
    },
    classification: null,
  };
}

function buildPosts(): DashboardPost[] {
  const p: DashboardPost[] = [];

  p.push(makePost("p1", DEMO_ACCOUNTS[0], "IOTA", "X", "Port integration pilots moving into customs documentation workflows with new partner APIs.", 8));
  p.push(makePost("p2", DEMO_ACCOUNTS[0], "IOTA", "X", "Compliance framework update for cross-border settlement now includes regulatory rollback conditions.", 16));
  p.push(makePost("p3", DEMO_ACCOUNTS[4], "IOTA", "X", "Port congestion narratives fading while throughput reliability becomes key KPI for operators.", 32));
  p.push(makePost("p4", DEMO_ACCOUNTS[1], "TWIN", "X", "Execution playbook v2: routing alerts into comms decision loops reduced response lag.", 10));
  p.push(makePost("p5", DEMO_ACCOUNTS[2], "TWIN", "X", "Competitor pricing adjustments indicate pressure on premium data feeds.", 18));
  p.push(makePost("p6", DEMO_ACCOUNTS[5], "TWIN", "LINKEDIN", "Infrastructure maturity benchmark: teams with weekly ops recaps get faster partner conversions.", 20));
  p.push(makePost("p7", DEMO_ACCOUNTS[3], "IOTA", "LINKEDIN", "Macro policy window opening around digital trade corridors and customs modernization.", 24));
  p.push(makePost("p8", DEMO_ACCOUNTS[2], "TWIN", "LINKEDIN", "Audience attention shifting from hype posts to execution metrics and integration proof.", 28));

  return applyClassificationToPosts(p).sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
}

function buildWatchlists(): WatchlistAssignment[] {
  return [
    {
      id: "w1",
      watchlistKey: "priority",
      center: "IOTA",
      sourcePlatform: "X",
      handle: "@iota",
      displayName: "IOTA Foundation",
      createdAt: new Date(),
    },
    {
      id: "w2",
      watchlistKey: "competitors",
      center: "TWIN",
      sourcePlatform: "X",
      handle: "@freightnexus",
      displayName: "Freight Nexus",
      createdAt: new Date(),
    },
  ];
}

export function buildDemoContextSummaryForContext(center: IntelligenceCenter, sourcePlatform: SourcePlatform, windowHours = 24) {
  return {
    center,
    sourcePlatform,
    windowHours,
    postCount: 8,
    generatedAt: new Date(),
    model: "demo",
    keyTopics: ["integration", "compliance", "execution", "pricing", "macro", "infrastructure"],
    global_summary: {
      key_narratives_right_now: ["Execution speed", "Compliance windows", "Pricing pressure"],
      gaining_momentum: ["Execution speed across tracked accounts"],
      fading: ["Pure hype narratives"],
      attention_concentrated: ["Tracked accounts discussing operational rollout and integration proof."],
      top_opportunities_to_engage: [
        "Reply with a concrete metric-backed take on execution reliability.",
        "Publish a short breakdown on compliance implications for operators.",
      ],
    },
    topics: [
      {
        topic_name: "Execution reliability",
        summary: "Tracked accounts are emphasizing implementation speed and operational reliability over broad narrative claims.",
        tone: "positive" as const,
        why_it_matters: "Signals audience preference for concrete receipts; useful for tactical reply positioning.",
        engagement_angles: ["Respond with data-backed execution insight."],
        respond_to_handles: ["iota", "twinfoundation"],
        key_terms: ["execution", "reliability", "ops"],
        post_count: 3,
      },
      {
        topic_name: "Regulatory interoperability",
        summary: "Discussion includes compliance and policy framing around trade and settlement workflows.",
        tone: "mixed" as const,
        why_it_matters: "Creates opportunities for concise educational content targeting policy-aware operators.",
        engagement_angles: ["Provide a practical compliance checklist."],
        respond_to_handles: ["policyradar"],
        key_terms: ["compliance", "policy", "regulatory"],
        post_count: 2,
      },
    ],
  };
}

export function buildDemoPayload(options: BuildDemoOptions): DashboardPayload {
  const posts = buildPosts();
  const now = new Date();

  return {
    posts,
    accounts: DEMO_ACCOUNTS,
    categories: Object.values(AccountCategory),
    watchlistAssignments: buildWatchlists(),
    initialContextSummary: buildDemoContextSummaryForContext("IOTA", "X", 24),
    intelligence: {
      trackedOverview: {
        topTopics: ["execution", "compliance", "pricing", "macro"],
        topPostTypes: [
          { type: "MARKET_COMMENTARY", count: 2 },
          { type: "PARTNERSHIP_MENTION", count: 2 },
          { type: "ANNOUNCEMENT", count: 1 },
        ],
        topTrackedCategories: [
          { category: "ECOSYSTEM", count: 3 },
          { category: "MEDIA", count: 2 },
          { category: "COMPETITOR", count: 1 },
        ],
      },
      topEngagers: [],
      adjacentInterests: [],
      actionableSignals: [],
      providerCapabilities: [
        {
          provider: "X",
          availableEngagementTypes: ["REPLY", "REPOST", "QUOTE", "MENTION"],
          unavailableEngagementTypes: ["COMMENT", "LIKE"],
          notes: "Demo capability profile",
        },
        {
          provider: "LINKEDIN",
          availableEngagementTypes: ["COMMENT", "REPOST", "MENTION"],
          unavailableEngagementTypes: ["REPLY", "QUOTE", "LIKE"],
          notes: "Demo capability profile",
        },
      ],
    },
    stats: {
      trackedAccounts: DEMO_ACCOUNTS.length,
      activeAccounts: DEMO_ACCOUNTS.length,
      newPosts2h: 8,
      newPosts24h: 8,
      highSignalPosts: posts.filter((post) => post.likeCount + post.replyCount * 2 + post.repostCount * 3 + post.quoteCount * 2 >= 420).length,
      opportunitiesDetected: posts.filter((post) => post.classification?.actionability !== "NO_ACTION").length,
      latestIngestionStatus: IngestionStatus.SUCCESS,
      latestIngestionAt: now,
    },
    ingestionRuns: [
      {
        id: "demo-run-1",
        status: IngestionStatus.SUCCESS,
        startedAt: new Date(now.getTime() - 15 * 60 * 1000),
        finishedAt: new Date(now.getTime() - 14 * 60 * 1000),
        notes: "Demo ingest completed",
      },
    ],
    system: {
      mode: "DEMO",
      dbCode: options.dbCode,
      dbMessage: `${options.dbMessage} Showing account-led dummy dataset for full UI continuity.`,
      providerLabel: "Tracked-account feed (X + LinkedIn)",
      summaryLabel: process.env.OPENAI_API_KEY ? "OpenAI + fallback" : "Heuristic fallback",
      cadenceLabel: cadenceLabelForAccounts(DEMO_ACCOUNTS.length),
      lastRefreshAt: now,
    },
  };
}
