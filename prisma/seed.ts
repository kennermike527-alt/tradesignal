import { AccountCategory, PrismaClient, SocialProvider } from "@prisma/client";

const prisma = new PrismaClient();

const WATCHLIST = [
  { displayName: "OpenAI", handle: "OpenAI", category: AccountCategory.ECOSYSTEM, tags: ["ai", "foundation-models"] },
  { displayName: "Anthropic", handle: "AnthropicAI", category: AccountCategory.COMPETITOR, tags: ["ai", "safety"] },
  { displayName: "xAI", handle: "xai", category: AccountCategory.COMPETITOR, tags: ["ai", "llm"] },
  { displayName: "Perplexity", handle: "perplexity_ai", category: AccountCategory.COMPETITOR, tags: ["search", "assistant"] },
  { displayName: "The Information", handle: "theinformation", category: AccountCategory.MEDIA, tags: ["media", "tech"] },
  { displayName: "Bloomberg", handle: "business", category: AccountCategory.MEDIA, tags: ["markets", "macro"] },
  { displayName: "CoinDesk", handle: "CoinDesk", category: AccountCategory.MEDIA, tags: ["crypto", "markets"] },
  { displayName: "Sam Altman", handle: "sama", category: AccountCategory.FOUNDER, tags: ["founder", "ai"] },
  { displayName: "Elon Musk", handle: "elonmusk", category: AccountCategory.INFLUENCER, tags: ["influencer", "macro"] },
  { displayName: "Naval", handle: "naval", category: AccountCategory.INFLUENCER, tags: ["influencer", "startups"] },
  { displayName: "Vitalik Buterin", handle: "VitalikButerin", category: AccountCategory.INFLUENCER, tags: ["crypto", "research"] },
  { displayName: "a16z", handle: "a16z", category: AccountCategory.ECOSYSTEM, tags: ["vc", "market-narrative"] },
  { displayName: "Stripe", handle: "stripe", category: AccountCategory.ECOSYSTEM, tags: ["payments", "fintech"] },
  { displayName: "SBF (archive)", handle: "SBF_FTX", category: AccountCategory.MEDIA, tags: ["historical", "risk"] },
  { displayName: "Messari", handle: "MessariCrypto", category: AccountCategory.MEDIA, tags: ["research", "data"] },
];

async function main() {
  for (const account of WATCHLIST) {
    await prisma.account.upsert({
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
  }

  // Keep old seeded accounts active state untouched, but ensure minimum watchlist exists.
  // Intentionally not deleting existing records for safer local iteration.
  console.log(`Seeded ${WATCHLIST.length} watchlist accounts.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
