import { AccountCategory, IngestionStatus, SocialProvider } from "@prisma/client";
import type {
  DashboardAccount,
  DashboardPayload,
  DashboardPost,
  DashboardStats,
  IngestionRunPreview,
  IntelligenceCenter,
  SourcePlatform,
  TerminalSystemStatus,
} from "@/lib/types";

type BuildDemoOptions = {
  dbCode: TerminalSystemStatus["dbCode"];
  dbMessage: string;
};

const DEMO_ACCOUNTS: DashboardAccount[] = [
  { id: "a1", displayName: "IOTA Foundation", handle: "iota", category: AccountCategory.ECOSYSTEM, tags: ["iota", "ecosystem"] },
  { id: "a2", displayName: "Twin Labs", handle: "twinlabs", category: AccountCategory.ECOSYSTEM, tags: ["twin", "ecosystem"] },
  { id: "a3", displayName: "OpenAI", handle: "OpenAI", category: AccountCategory.COMPETITOR, tags: ["agents", "models"] },
  { id: "a4", displayName: "Messari", handle: "MessariCrypto", category: AccountCategory.MEDIA, tags: ["research", "macro"] },
  { id: "a5", displayName: "a16z crypto", handle: "a16zcrypto", category: AccountCategory.ECOSYSTEM, tags: ["venture", "infra"] },
  { id: "a6", displayName: "Vitalik Buterin", handle: "VitalikButerin", category: AccountCategory.FOUNDER, tags: ["governance", "protocol"] },
  { id: "a7", displayName: "The Defiant", handle: "DefiantNews", category: AccountCategory.MEDIA, tags: ["narrative", "coverage"] },
  { id: "a8", displayName: "LayerZero", handle: "LayerZero_Core", category: AccountCategory.COMPETITOR, tags: ["bridges", "liquidity"] },
  { id: "a9", displayName: "Ryan Selkis", handle: "twobitidiot", category: AccountCategory.INFLUENCER, tags: ["sentiment", "analysis"] },
  { id: "a10", displayName: "Bankless", handle: "BanklessHQ", category: AccountCategory.MEDIA, tags: ["distribution", "community"] },
];

const TEMPLATES: Array<{ accountId: string; center: IntelligenceCenter; text: string; summary: string; tags: string[] }> = [
  {
    accountId: "a1",
    center: "IOTA",
    text: "IOTA ecosystem teams are coordinating on wallet-level attribution primitives for creator campaigns.",
    summary: "Strong distribution signal for IOTA-aligned outreach and ecosystem amplification.",
    tags: ["ecosystem", "distribution", "opportunity"],
  },
  {
    accountId: "a2",
    center: "TWIN",
    text: "Twin stack is pushing fast-turn execution tooling and narrative monitoring hooks this week.",
    summary: "Execution thread with immediate engagement potential for teams seeking realtime ops.",
    tags: ["execution", "tooling", "engage-now"],
  },
  {
    accountId: "a4",
    center: "IOTA",
    text: "Research desks report liquidity rotation into utility narratives anchored by infra-first chains.",
    summary: "Narrative regime shift; useful for IOTA positioning and media response.",
    tags: ["liquidity", "media", "high-signal"],
  },
  {
    accountId: "a5",
    center: "TWIN",
    text: "Ecosystem founders prioritize weekly shipping logs over milestone-only updates to sustain trust.",
    summary: "Direct operator guidance for Twin comms cadence and engagement sequencing.",
    tags: ["founder", "execution", "cadence"],
  },
  {
    accountId: "a6",
    center: "IOTA",
    text: "Governance proposals are increasingly fee-sensitivity aware and tied to retention metrics.",
    summary: "Policy narrative worth monitoring closely across protocol and ecosystem accounts.",
    tags: ["governance", "policy", "signal"],
  },
  {
    accountId: "a8",
    center: "TWIN",
    text: "Competitor incentive design is pivoting from first-touch volume toward retained usage quality.",
    summary: "Competitive repositioning opens messaging and product differentiation opportunities.",
    tags: ["competitor", "retention", "opportunity"],
  },
  {
    accountId: "a10",
    center: "IOTA",
    text: "Creator-led distribution channels are outperforming paid growth in this cycle.",
    summary: "Engagement queue candidate for IOTA ecosystem growth operators.",
    tags: ["distribution", "media", "engage-now"],
  },
  {
    accountId: "a3",
    center: "TWIN",
    text: "Model vendors are emphasizing reliability under constrained latency over benchmark theatrics.",
    summary: "Execution-quality narrative aligns with Twin’s command-center positioning.",
    tags: ["competitor", "latency", "execution"],
  },
];

function channelize(text: string, summary: string, platform: SourcePlatform) {
  if (platform === "X") {
    return { text, summary };
  }

  return {
    text: `${text}\n\nOperators are now asking for practical workflows, not just sentiment snapshots.`,
    summary: `${summary} LinkedIn audiences are discussing implementation playbooks, so this is suitable for strategic response content.`,
  };
}

function buildDemoPosts(now: Date): DashboardPost[] {
  const platforms: SourcePlatform[] = ["X", "LINKEDIN"];
  const posts: DashboardPost[] = [];

  TEMPLATES.forEach((template, index) => {
    const account = DEMO_ACCOUNTS.find((item) => item.id === template.accountId)!;

    platforms.forEach((platform, platformIndex) => {
      const minutesAgo = 12 + index * 19 + platformIndex * 7;
      const postedAt = new Date(now.getTime() - minutesAgo * 60 * 1000);
      const likeCount = 35 + ((index + 3) * 44 + platformIndex * 11) % 420;
      const replyCount = 5 + ((index + 2) * 13 + platformIndex * 3) % 64;
      const repostCount = 4 + ((index + 5) * 17 + platformIndex * 4) % 120;
      const quoteCount = 1 + ((index + 1) * 5 + platformIndex * 2) % 24;

      const channel = channelize(template.text, template.summary, platform);
      const id = `demo-${platform.toLowerCase()}-${index + 1}`;
      const sourceUrl =
        platform === "X"
          ? `https://x.com/${account.handle}/status/${id}`
          : `https://www.linkedin.com/feed/update/${id}`;

      posts.push({
        id,
        provider: SocialProvider.X,
        accountId: account.id,
        externalPostId: `ext-${id}`,
        content: channel.text,
        postedAt,
        fetchedAt: new Date(postedAt.getTime() + 3 * 60 * 1000),
        sourceUrl,
        likeCount,
        replyCount,
        repostCount,
        quoteCount,
        sourcePlatform: platform,
        center: template.center,
        account,
        summary: {
          summary: channel.summary,
          model: "demo-curated",
        },
      });
    });
  });

  return posts.sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
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
      startedAt: new Date(now.getTime() - 16 * 60 * 1000),
      finishedAt: new Date(now.getTime() - 15 * 60 * 1000),
      notes: "Source streams active. Demo mode enabled while DB is offline.",
    },
    {
      id: "demo-run-2",
      status: IngestionStatus.SUCCESS,
      startedAt: new Date(now.getTime() - 52 * 60 * 1000),
      finishedAt: new Date(now.getTime() - 51 * 60 * 1000),
      notes: "Network graph data prepared for X + LinkedIn tabs.",
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
      providerLabel: "X + LinkedIn demo streams",
      summaryLabel: process.env.OPENAI_API_KEY ? "OpenAI + fallback" : "Heuristic fallback",
      cadenceLabel: "Manual ingest + /api/ingest scheduler",
      lastRefreshAt: now,
    },
  };
}
