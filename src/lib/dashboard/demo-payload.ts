import { AccountCategory, IngestionStatus, SocialProvider } from "@prisma/client";
import { cadenceLabelForAccounts } from "@/lib/ingestion/budget-guard";
import type {
  ContextNarrativeSummary,
  DashboardAccount,
  DashboardPayload,
  DashboardPost,
  IntelligenceCenter,
  NarrativeTopicSummary,
  SourcePlatform,
  TerminalSystemStatus,
  WatchlistAssignment,
  WatchlistKey,
} from "@/lib/types";

type BuildDemoOptions = {
  dbCode: TerminalSystemStatus["dbCode"];
  dbMessage: string;
};

const DEMO_ACCOUNTS: DashboardAccount[] = [
  { id: "acct-1", displayName: "IOTA Foundation", handle: "iota", category: AccountCategory.ECOSYSTEM, tags: ["iota", "ecosystem", "infra"] },
  { id: "acct-2", displayName: "Twin Foundation", handle: "twinfoundation", category: AccountCategory.ECOSYSTEM, tags: ["twin", "foundation", "execution"] },
  { id: "acct-3", displayName: "Port Ops Weekly", handle: "portopsweekly", category: AccountCategory.MEDIA, tags: ["ports", "shipping", "logistics"] },
  { id: "acct-4", displayName: "TradeStack Research", handle: "tradestacklab", category: AccountCategory.INFLUENCER, tags: ["analysis", "policy", "flows"] },
  { id: "acct-5", displayName: "Freight Nexus", handle: "freightnexus", category: AccountCategory.COMPETITOR, tags: ["competitor", "pricing", "saas"] },
  { id: "acct-6", displayName: "Global Customs Forum", handle: "customsforum", category: AccountCategory.MEDIA, tags: ["customs", "regulation", "trade"] },
  { id: "acct-7", displayName: "Maritime Insight", handle: "maritimeinsight", category: AccountCategory.MEDIA, tags: ["maritime", "capacity", "routes"] },
  { id: "acct-8", displayName: "SupplyChain CTO", handle: "supplychaincto", category: AccountCategory.FOUNDER, tags: ["founder", "standards", "integration"] },
  { id: "acct-9", displayName: "Policy Radar", handle: "policyradar", category: AccountCategory.INFLUENCER, tags: ["policy", "risk", "briefings"] },
  { id: "acct-10", displayName: "Ops Desk", handle: "opsdesk", category: AccountCategory.ECOSYSTEM, tags: ["ops", "execution", "metrics"] },
];

const CONTEXT_TOPIC_SEEDS: Record<string, Array<{ topicName: string; keyTerms: string[]; tone: NarrativeTopicSummary["tone"] }>> = {
  "IOTA:X": [
    { topicName: "Port integration pilots", keyTerms: ["pilot", "port", "integration", "customs"], tone: "positive" },
    { topicName: "Regulatory interoperability", keyTerms: ["regulatory", "compliance", "framework", "customs"], tone: "mixed" },
    { topicName: "Settlement latency pressure", keyTerms: ["latency", "settlement", "throughput", "network"], tone: "neutral" },
  ],
  "IOTA:LINKEDIN": [
    { topicName: "Enterprise rollout sequencing", keyTerms: ["enterprise", "rollout", "integration", "program"], tone: "positive" },
    { topicName: "Trade finance digitization", keyTerms: ["finance", "digitization", "workflow", "compliance"], tone: "mixed" },
    { topicName: "Partner enablement", keyTerms: ["partner", "enablement", "ecosystem", "delivery"], tone: "positive" },
  ],
  "TWIN:X": [
    { topicName: "Execution playbooks", keyTerms: ["execution", "playbook", "ops", "automation"], tone: "positive" },
    { topicName: "Competitor pressure on pricing", keyTerms: ["competitor", "pricing", "pressure", "market"], tone: "negative" },
    { topicName: "Narrative amplification", keyTerms: ["narrative", "amplification", "distribution", "engagement"], tone: "mixed" },
  ],
  "TWIN:LINKEDIN": [
    { topicName: "Ops maturity benchmarks", keyTerms: ["benchmark", "maturity", "operations", "kpi"], tone: "neutral" },
    { topicName: "Adoption blockers", keyTerms: ["blocker", "integration", "procurement", "risk"], tone: "mixed" },
    { topicName: "Commercial partnerships", keyTerms: ["commercial", "partnership", "pipeline", "deployment"], tone: "positive" },
  ],
};

function keyForContext(center: IntelligenceCenter, sourcePlatform: SourcePlatform) {
  return `${center}:${sourcePlatform}`;
}

function sourceUrlFor(platform: SourcePlatform, handle: string, id: string) {
  if (platform === "X") return `https://x.com/${handle}/status/${id}`;
  return `https://www.linkedin.com/company/${handle}/posts/${id}`;
}

function toneAngles(tone: NarrativeTopicSummary["tone"], topicName: string) {
  if (tone === "negative") {
    return [
      `Acknowledge risk in ${topicName.toLowerCase()} and provide mitigation steps.`,
      "Offer concrete operator checklist to reduce friction this week.",
    ];
  }

  if (tone === "mixed") {
    return [
      `Frame a balanced view on ${topicName.toLowerCase()} with next-step recommendations.`,
      "Reply with a practical case study and one measurable outcome.",
    ];
  }

  return [
    `Join the thread with an execution-forward take on ${topicName.toLowerCase()}.`,
    "Add one concrete metric and one operational recommendation.",
  ];
}

function buildDemoContextSummary(
  center: IntelligenceCenter,
  sourcePlatform: SourcePlatform,
  windowHours: number,
  posts: DashboardPost[]
): ContextNarrativeSummary {
  const key = keyForContext(center, sourcePlatform);
  const seeds = CONTEXT_TOPIC_SEEDS[key] || [];
  const scopedPosts = posts.filter((post) => post.center === center && post.sourcePlatform === sourcePlatform);

  const topics: NarrativeTopicSummary[] = seeds.map((seed, index) => {
    const topicPosts = scopedPosts.filter((post) => {
      const text = `${post.content} ${post.summary?.summary ?? ""}`.toLowerCase();
      return seed.keyTerms.some((term) => text.includes(term));
    });

    const handles = [...new Set(topicPosts.map((post) => post.account.handle))].slice(0, 4);

    return {
      topic_name: seed.topicName,
      summary: `Discussion is centered on ${seed.topicName.toLowerCase()} with ${topicPosts.length || 2} active signal(s) in this context window. Operators are prioritizing concrete execution updates over abstract positioning.`,
      tone: seed.tone,
      why_it_matters: `This narrative is shaping near-term attention allocation in ${center} on ${sourcePlatform === "X" ? "X" : "LinkedIn"}, and can influence engagement efficiency.`,
      engagement_angles: toneAngles(seed.tone, seed.topicName),
      respond_to_handles: handles,
      key_terms: seed.keyTerms,
      post_count: topicPosts.length || index + 2,
    };
  });

  const keyTopics = [...new Set(topics.flatMap((topic) => topic.key_terms))].slice(0, 12);

  return {
    center,
    sourcePlatform,
    windowHours,
    postCount: scopedPosts.length,
    generatedAt: new Date(),
    model: "demo-command-layer",
    keyTopics,
    global_summary: {
      key_narratives_right_now: topics.slice(0, 3).map((topic) => topic.topic_name),
      gaining_momentum: topics.slice(0, 2).map((topic) => `${topic.topic_name} is gaining traction.`),
      fading: ["Generic macro commentary without execution detail."],
      attention_concentrated: [
        `${scopedPosts.length} context-scoped posts across ${topics.length} clusters.`,
        `Primary attention is on ${topics[0]?.topic_name ?? "operational updates"}.`,
      ],
      top_opportunities_to_engage: topics.flatMap((topic) => topic.engagement_angles.slice(0, 1)).slice(0, 6),
    },
    topics,
  };
}

function buildDemoPosts(now: Date) {
  const posts: DashboardPost[] = [];
  const contexts: Array<{ center: IntelligenceCenter; sourcePlatform: SourcePlatform }> = [
    { center: "IOTA", sourcePlatform: "X" },
    { center: "IOTA", sourcePlatform: "LINKEDIN" },
    { center: "TWIN", sourcePlatform: "X" },
    { center: "TWIN", sourcePlatform: "LINKEDIN" },
  ];

  let idx = 0;

  for (const context of contexts) {
    const seeds = CONTEXT_TOPIC_SEEDS[keyForContext(context.center, context.sourcePlatform)] || [];

    seeds.forEach((seed, seedIndex) => {
      for (let i = 0; i < 3; i += 1) {
        const account = DEMO_ACCOUNTS[(seedIndex * 3 + i + (context.center === "TWIN" ? 2 : 0)) % DEMO_ACCOUNTS.length];
        const minuteOffset = idx * 13 + seedIndex * 5 + i * 3;
        const postedAt = new Date(now.getTime() - minuteOffset * 60 * 1000);
        const id = `demo-${context.center.toLowerCase()}-${context.sourcePlatform.toLowerCase()}-${idx + 1}`;

        const likeCount = 40 + ((idx + 4) * 17) % 290;
        const replyCount = 6 + ((idx + 7) * 5) % 40;
        const repostCount = 4 + ((idx + 11) * 7) % 70;
        const quoteCount = 1 + ((idx + 3) * 3) % 16;

        const baseText = `${context.center} ${seed.topicName} update: ${seed.keyTerms.join(", " )} are driving operator discussion this cycle.`;

        posts.push({
          id,
          provider: SocialProvider.X,
          accountId: account.id,
          externalPostId: id,
          content: context.sourcePlatform === "X" ? baseText : `${baseText} Teams are sharing implementation lessons and partner dependencies.`,
          postedAt,
          fetchedAt: new Date(postedAt.getTime() + 4 * 60 * 1000),
          sourceUrl: sourceUrlFor(context.sourcePlatform, account.handle, id),
          likeCount,
          replyCount,
          repostCount,
          quoteCount,
          sourcePlatform: context.sourcePlatform,
          center: context.center,
          account,
          summary: {
            summary: `Signal indicates ongoing ${seed.topicName.toLowerCase()} conversation with practical engagement openings for ${context.center}.`,
            model: "demo-seeded",
          },
        });

        idx += 1;
      }
    });
  }

  return posts.sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
}

function buildWatchlistAssignments(now: Date): WatchlistAssignment[] {
  const picks: Array<{ key: WatchlistKey; center: IntelligenceCenter; sourcePlatform: SourcePlatform; handle: string; displayName: string }> = [
    { key: "priority", center: "IOTA", sourcePlatform: "X", handle: "@iota", displayName: "IOTA Foundation" },
    { key: "media", center: "IOTA", sourcePlatform: "X", handle: "@portopsweekly", displayName: "Port Ops Weekly" },
    { key: "ecosystem", center: "IOTA", sourcePlatform: "LINKEDIN", handle: "iota", displayName: "IOTA Foundation" },
    { key: "competitors", center: "TWIN", sourcePlatform: "X", handle: "@freightnexus", displayName: "Freight Nexus" },
    { key: "priority", center: "TWIN", sourcePlatform: "LINKEDIN", handle: "twinfoundation", displayName: "Twin Foundation" },
    { key: "founders", center: "TWIN", sourcePlatform: "X", handle: "@supplychaincto", displayName: "SupplyChain CTO" },
  ];

  return picks.map((item, index) => ({
    id: `watch-${index + 1}`,
    watchlistKey: item.key,
    center: item.center,
    sourcePlatform: item.sourcePlatform,
    handle: item.handle,
    displayName: item.displayName,
    createdAt: new Date(now.getTime() - index * 15 * 60 * 1000),
  }));
}

function buildStats(posts: DashboardPost[], now: Date) {
  const cutoff2h = now.getTime() - 2 * 60 * 60 * 1000;
  const cutoff24h = now.getTime() - 24 * 60 * 60 * 1000;

  const highSignalPosts = posts.filter(
    (post) => post.likeCount + post.replyCount * 2 + post.repostCount * 3 + post.quoteCount * 2 >= 420
  ).length;

  const opportunitiesDetected = posts.filter((post) => {
    const text = `${post.content} ${post.summary?.summary ?? ""}`.toLowerCase();
    return /opportun|engage|partner|integration|rollout|execution/.test(text);
  }).length;

  return {
    trackedAccounts: DEMO_ACCOUNTS.length,
    activeAccounts: DEMO_ACCOUNTS.length,
    newPosts2h: posts.filter((post) => post.postedAt.getTime() >= cutoff2h).length,
    newPosts24h: posts.filter((post) => post.postedAt.getTime() >= cutoff24h).length,
    highSignalPosts,
    opportunitiesDetected,
    latestIngestionStatus: IngestionStatus.SUCCESS,
    latestIngestionAt: now,
  };
}

export function buildDemoContextSummaryForContext(
  center: IntelligenceCenter,
  sourcePlatform: SourcePlatform,
  windowHours = 24
): ContextNarrativeSummary {
  const now = new Date();
  const posts = buildDemoPosts(now);
  return buildDemoContextSummary(center, sourcePlatform, windowHours, posts);
}

export function buildDemoPayload(options: BuildDemoOptions): DashboardPayload {
  const now = new Date();
  const posts = buildDemoPosts(now);
  const watchlistAssignments = buildWatchlistAssignments(now);

  return {
    posts,
    accounts: DEMO_ACCOUNTS,
    categories: Object.values(AccountCategory),
    watchlistAssignments,
    initialContextSummary: buildDemoContextSummary("IOTA", "X", 24, posts),
    stats: buildStats(posts, now),
    ingestionRuns: [
      {
        id: "demo-run-1",
        status: IngestionStatus.SUCCESS,
        startedAt: new Date(now.getTime() - 25 * 60 * 1000),
        finishedAt: new Date(now.getTime() - 24 * 60 * 1000),
        notes: "Demo ingest completed with synthetic context data.",
      },
      {
        id: "demo-run-2",
        status: IngestionStatus.PARTIAL,
        startedAt: new Date(now.getTime() - 85 * 60 * 1000),
        finishedAt: new Date(now.getTime() - 83 * 60 * 1000),
        notes: "Simulated partial run to test operator workflows.",
      },
    ],
    system: {
      mode: "DEMO",
      dbCode: options.dbCode,
      dbMessage: `${options.dbMessage} Showing full dummy command stream for UI and workflow testing.`,
      providerLabel: "X + LinkedIn (dummy stream)",
      summaryLabel: process.env.OPENAI_API_KEY ? "OpenAI + fallback" : "Heuristic fallback",
      cadenceLabel: cadenceLabelForAccounts(DEMO_ACCOUNTS.length),
      lastRefreshAt: now,
    },
  };
}
