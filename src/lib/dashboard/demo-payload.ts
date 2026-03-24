import { AccountCategory, IngestionStatus, SocialProvider } from "@prisma/client";
import type { DashboardAccount, DashboardPayload, DashboardPost, DashboardStats, IngestionRunPreview, TerminalSystemStatus } from "@/lib/types";

type BuildDemoOptions = {
  dbCode: TerminalSystemStatus["dbCode"];
  dbMessage: string;
};

const DEMO_ACCOUNTS: DashboardAccount[] = [
  { id: "a1", displayName: "OpenAI", handle: "OpenAI", category: AccountCategory.ECOSYSTEM, tags: ["launch", "models"] },
  { id: "a2", displayName: "Anthropic", handle: "AnthropicAI", category: AccountCategory.COMPETITOR, tags: ["safety", "enterprise"] },
  { id: "a3", displayName: "Messari", handle: "MessariCrypto", category: AccountCategory.MEDIA, tags: ["research", "macro"] },
  { id: "a4", displayName: "a16z crypto", handle: "a16zcrypto", category: AccountCategory.ECOSYSTEM, tags: ["ecosystem", "funding"] },
  { id: "a5", displayName: "Vitalik Buterin", handle: "VitalikButerin", category: AccountCategory.FOUNDER, tags: ["protocol", "roadmap"] },
  { id: "a6", displayName: "The Defiant", handle: "DefiantNews", category: AccountCategory.MEDIA, tags: ["coverage", "narrative"] },
  { id: "a7", displayName: "LayerZero", handle: "LayerZero_Core", category: AccountCategory.COMPETITOR, tags: ["bridges", "liquidity"] },
  { id: "a8", displayName: "Ryan Selkis", handle: "twobitidiot", category: AccountCategory.INFLUENCER, tags: ["sentiment", "hot-take"] },
  { id: "a9", displayName: "Paradigm", handle: "paradigm", category: AccountCategory.ECOSYSTEM, tags: ["infra", "rollups"] },
  { id: "a10", displayName: "Bankless", handle: "BanklessHQ", category: AccountCategory.MEDIA, tags: ["podcast", "distribution"] },
];

const FEED_TEMPLATES: Array<{ accountId: string; text: string; summary: string; tags: string[] }> = [
  {
    accountId: "a1",
    text: "We just rolled out a lightweight reasoning mode focused on latency-sensitive tasks. Early enterprise testers report stronger reliability for fast-turn workflows.",
    summary:
      "This can pull developer attention toward low-latency agents and raises the bar for response quality under strict time constraints.",
    tags: ["ecosystem", "latency", "product"],
  },
  {
    accountId: "a2",
    text: "Policy update: expanded constitutional guardrail tooling for enterprise tenants, now with domain-scoped policy bundles.",
    summary:
      "Signals enterprise compliance positioning and could influence procurement decisions for regulated buyers.",
    tags: ["competitor", "policy", "enterprise"],
  },
  {
    accountId: "a3",
    text: "Flows to modular L2 infra accelerated this week while memecoin attention cooled. Desk behavior suggests rotation into utility narratives.",
    summary:
      "Narrative rotation is underway; engagement strategy should prioritize utility and infra creators over pure hype channels.",
    tags: ["media", "flows", "rotation"],
  },
  {
    accountId: "a4",
    text: "Founder teams shipping weekly devlogs are compounding trust faster than teams posting milestone-only updates. Distribution cadence matters.",
    summary:
      "Operator takeaway: reward predictable shipping narratives. This is a direct signal for who to engage and amplify.",
    tags: ["ecosystem", "distribution", "engage-now"],
  },
  {
    accountId: "a5",
    text: "Rollup economics discussion: sequencer fee dynamics still underpriced in many governance frameworks.",
    summary:
      "High-value policy thread for protocol teams; likely to shape upcoming governance debate and thought leadership cycles.",
    tags: ["founder", "governance", "high-signal"],
  },
  {
    accountId: "a6",
    text: "Breaking: two major teams are coordinating around shared wallet standards for social-driven attribution.",
    summary:
      "Standardization narratives create partnership windows; this is likely an engagement opportunity for tooling teams.",
    tags: ["media", "partnership", "opportunity"],
  },
  {
    accountId: "a7",
    text: "Cross-chain liquidity incentives now weighted by retention, not just first-bridge volume. Mercenary flow gets penalized.",
    summary:
      "Competitor strategy shift: retention-first mechanics may redirect liquidity conversations over the next cycle.",
    tags: ["competitor", "liquidity", "retention"],
  },
  {
    accountId: "a8",
    text: "Sentiment is peaking in AI-agent discourse but conviction is thin. Watch who actually ships pipelines this week.",
    summary:
      "Useful challenge signal: ignore broad hype and track execution receipts. Good trigger for selective engagement.",
    tags: ["influencer", "sentiment", "execution"],
  },
  {
    accountId: "a9",
    text: "New OSS release focused on proving-time improvements for zk-friendly app primitives.",
    summary:
      "Technical momentum thread with high downstream impact for infra narratives and developer ecosystem attention.",
    tags: ["ecosystem", "infra", "zk"],
  },
  {
    accountId: "a10",
    text: "Tonight: live panel on where social distribution beats paid growth in crypto product launches.",
    summary:
      "Strong short-term engagement opportunity if the team wants rapid mindshare in creator-heavy channels.",
    tags: ["media", "distribution", "opportunity"],
  },
];

function buildDemoPosts(now: Date): DashboardPost[] {
  return FEED_TEMPLATES.map((template, index) => {
    const account = DEMO_ACCOUNTS.find((item) => item.id === template.accountId)!;
    const minutesAgo = 8 + index * 17;
    const postedAt = new Date(now.getTime() - minutesAgo * 60 * 1000);

    const likeCount = 40 + (index * 39) % 410;
    const replyCount = 6 + (index * 11) % 64;
    const repostCount = 5 + (index * 17) % 120;
    const quoteCount = 1 + (index * 7) % 28;

    return {
      id: `demo-post-${index + 1}`,
      provider: SocialProvider.X,
      accountId: account.id,
      externalPostId: `demo-ext-${index + 1}`,
      content: template.text,
      postedAt,
      fetchedAt: new Date(now.getTime() - Math.max(1, minutesAgo - 2) * 60 * 1000),
      sourceUrl: `https://x.com/${account.handle}/status/demo-${index + 1}`,
      likeCount,
      replyCount,
      repostCount,
      quoteCount,
      account,
      summary: {
        summary: template.summary,
        model: "demo-curated",
      },
    };
  }).sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
}

function buildStats(posts: DashboardPost[]): DashboardStats {
  const now = Date.now();
  const in2h = now - 2 * 60 * 60 * 1000;
  const in24h = now - 24 * 60 * 60 * 1000;

  const highSignalPosts = posts.filter(
    (post) => post.likeCount + post.replyCount * 2 + post.repostCount * 3 + post.quoteCount * 2 >= 420
  ).length;

  const opportunitiesDetected = posts.filter((post) =>
    `${post.content} ${post.summary?.summary ?? ""}`.toLowerCase().match(/engage|opportun|window|partnership|distribution/)
  ).length;

  return {
    trackedAccounts: DEMO_ACCOUNTS.length,
    activeAccounts: DEMO_ACCOUNTS.length,
    newPosts2h: posts.filter((post) => post.postedAt.getTime() >= in2h).length,
    newPosts24h: posts.filter((post) => post.postedAt.getTime() >= in24h).length,
    highSignalPosts,
    opportunitiesDetected,
    latestIngestionStatus: IngestionStatus.PARTIAL,
    latestIngestionAt: new Date(),
  };
}

function buildRuns(now: Date): IngestionRunPreview[] {
  return [
    {
      id: "demo-run-1",
      status: IngestionStatus.PARTIAL,
      startedAt: new Date(now.getTime() - 14 * 60 * 1000),
      finishedAt: new Date(now.getTime() - 13 * 60 * 1000),
      notes: "Provider reachable. Database unavailable, serving demo stream.",
    },
    {
      id: "demo-run-2",
      status: IngestionStatus.SUCCESS,
      startedAt: new Date(now.getTime() - 49 * 60 * 1000),
      finishedAt: new Date(now.getTime() - 48 * 60 * 1000),
      notes: "Mock ingest simulation completed.",
    },
  ];
}

export function buildDemoPayload(options: BuildDemoOptions): DashboardPayload {
  const now = new Date();
  const posts = buildDemoPosts(now);

  return {
    posts,
    accounts: DEMO_ACCOUNTS,
    categories: Object.values(AccountCategory),
    stats: buildStats(posts),
    ingestionRuns: buildRuns(now),
    system: {
      mode: "DEMO",
      dbCode: options.dbCode,
      dbMessage: options.dbMessage,
      providerLabel: "X (mock provider)",
      summaryLabel: process.env.OPENAI_API_KEY ? "OpenAI + fallback" : "Heuristic fallback",
      cadenceLabel: "Manual ingest + /api/ingest scheduler",
      lastRefreshAt: now,
    },
  };
}
