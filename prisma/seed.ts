import { AccountCategory, IngestionStatus, PrismaClient, SocialProvider } from "@prisma/client";

const prisma = new PrismaClient();

const WATCHLIST = [
  { displayName: "OpenAI", handle: "OpenAI", category: AccountCategory.ECOSYSTEM, tags: ["launch", "models", "agents"] },
  { displayName: "Anthropic", handle: "AnthropicAI", category: AccountCategory.COMPETITOR, tags: ["safety", "enterprise"] },
  { displayName: "xAI", handle: "xai", category: AccountCategory.COMPETITOR, tags: ["model-release", "distribution"] },
  { displayName: "Perplexity", handle: "perplexity_ai", category: AccountCategory.COMPETITOR, tags: ["search", "assistant"] },
  { displayName: "Messari", handle: "MessariCrypto", category: AccountCategory.MEDIA, tags: ["research", "narrative"] },
  { displayName: "Bankless", handle: "BanklessHQ", category: AccountCategory.MEDIA, tags: ["podcast", "distribution"] },
  { displayName: "CoinDesk", handle: "CoinDesk", category: AccountCategory.MEDIA, tags: ["markets", "policy"] },
  { displayName: "Sam Altman", handle: "sama", category: AccountCategory.FOUNDER, tags: ["strategy", "founder"] },
  { displayName: "Vitalik Buterin", handle: "VitalikButerin", category: AccountCategory.FOUNDER, tags: ["protocol", "governance"] },
  { displayName: "a16z crypto", handle: "a16zcrypto", category: AccountCategory.ECOSYSTEM, tags: ["ecosystem", "venture"] },
  { displayName: "Paradigm", handle: "paradigm", category: AccountCategory.ECOSYSTEM, tags: ["infra", "research"] },
  { displayName: "The Defiant", handle: "DefiantNews", category: AccountCategory.MEDIA, tags: ["coverage", "alerts"] },
];

const SIGNAL_LINES = [
  {
    text: "Shipped an incremental release with lower inference latency and better tool-routing behavior in production.",
    summary: "Execution signal: this can pull developer mindshare and shift enterprise evaluation criteria toward reliability under fast-turn constraints.",
  },
  {
    text: "Policy note: compliance workflow now supports domain-scoped moderation rules for regulated teams.",
    summary: "Regulatory positioning signal with direct competitive implications in enterprise procurement cycles.",
  },
  {
    text: "Narrative is rotating from hype to retention metrics. Teams with repeated shipping updates are absorbing attention.",
    summary: "Engagement opportunity: prioritize accounts demonstrating execution receipts rather than one-off announcements.",
  },
  {
    text: "Cross-ecosystem partnership thread now points to shared wallet standards and attribution primitives.",
    summary: "Partnership window likely forming; useful for outreach and co-marketing positioning.",
  },
  {
    text: "Discussion: sequencer economics still underpriced in governance conversations despite clear fee-sensitivity trends.",
    summary: "High-value policy narrative likely to trigger follow-up posts from founder and research accounts.",
  },
  {
    text: "Distribution report: creator channels outperform paid spend for early product launches this week.",
    summary: "Actionable insight for engagement decisions: collaborate with distribution-heavy creators now.",
  },
];

function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

async function seedAccounts() {
  const seededAccounts = [] as Awaited<ReturnType<typeof prisma.account.upsert>>[];

  for (const account of WATCHLIST) {
    const result = await prisma.account.upsert({
      where: {
        provider_handle: {
          provider: SocialProvider.X,
          handle: account.handle,
        },
      },
      create: {
        ...account,
        provider: SocialProvider.X,
        isActive: true,
      },
      update: {
        ...account,
        isActive: true,
      },
    });

    seededAccounts.push(result);
  }

  return seededAccounts;
}

async function seedPosts(accounts: Awaited<ReturnType<typeof seedAccounts>>) {
  const now = Date.now();
  let inserted = 0;

  for (const account of accounts) {
    for (let i = 0; i < 5; i += 1) {
      const seed = hash(`${account.handle}-${i}`);
      const line = SIGNAL_LINES[seed % SIGNAL_LINES.length];
      const postedAt = new Date(now - (seed % 36 + i * 24) * 60 * 60 * 1000 + (seed % 54) * 60 * 1000);

      const externalPostId = `seed-${account.handle}-${i}`;
      const likeCount = 18 + (seed % 380);
      const replyCount = 2 + (seed % 70);
      const repostCount = 1 + (seed % 130);
      const quoteCount = seed % 33;

      const post = await prisma.post.upsert({
        where: {
          provider_externalPostId: {
            provider: SocialProvider.X,
            externalPostId,
          },
        },
        create: {
          provider: SocialProvider.X,
          externalPostId,
          accountId: account.id,
          content: `${line.text} (${account.handle})`,
          postedAt,
          sourceUrl: `https://x.com/${account.handle}/status/${externalPostId}`,
          likeCount,
          replyCount,
          repostCount,
          quoteCount,
          fetchedAt: new Date(postedAt.getTime() + 10 * 60 * 1000),
          rawPayload: {
            source: "seed-script",
            seed,
          },
        },
        update: {
          accountId: account.id,
          content: `${line.text} (${account.handle})`,
          postedAt,
          sourceUrl: `https://x.com/${account.handle}/status/${externalPostId}`,
          likeCount,
          replyCount,
          repostCount,
          quoteCount,
          fetchedAt: new Date(postedAt.getTime() + 10 * 60 * 1000),
        },
      });

      await prisma.postSummary.upsert({
        where: { postId: post.id },
        create: {
          postId: post.id,
          summary: line.summary,
          model: "seed-curated",
        },
        update: {
          summary: line.summary,
          model: "seed-curated",
        },
      });

      inserted += 1;
    }
  }

  return inserted;
}

async function seedIngestionRuns() {
  const existing = await prisma.ingestionRun.count();
  if (existing > 0) return;

  const now = Date.now();

  await prisma.ingestionRun.createMany({
    data: [
      {
        provider: SocialProvider.X,
        startedAt: new Date(now - 20 * 60 * 1000),
        finishedAt: new Date(now - 19 * 60 * 1000),
        status: IngestionStatus.SUCCESS,
        notes: "Seeded baseline run.",
        metadata: {
          source: "seed-script",
        },
      },
      {
        provider: SocialProvider.X,
        startedAt: new Date(now - 80 * 60 * 1000),
        finishedAt: new Date(now - 79 * 60 * 1000),
        status: IngestionStatus.PARTIAL,
        notes: "Provider latency observed in prior sample run.",
        metadata: {
          source: "seed-script",
        },
      },
    ],
  });
}

async function main() {
  const accounts = await seedAccounts();
  const postCount = await seedPosts(accounts);
  await seedIngestionRuns();

  console.log(`[seed] Accounts upserted: ${accounts.length}`);
  console.log(`[seed] Posts upserted: ${postCount}`);
  console.log("[seed] Ingestion runs inserted/updated.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
