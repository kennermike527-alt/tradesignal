import { SocialProvider, type AccountCategory } from "@prisma/client";
import type { NormalizedSocialPost, TrackedAccount } from "@/lib/types";
import type { SocialIngestionProvider } from "@/lib/providers/social-provider";
import { compactWhitespace } from "@/lib/utils";

const CATEGORY_SNIPPETS: Record<AccountCategory, string[]> = {
  ECOSYSTEM: [
    "shipping a new API primitive",
    "announced partnership momentum",
    "expanding enterprise distribution",
    "rolling out reliability upgrades",
  ],
  COMPETITOR: [
    "positioned against incumbent pricing",
    "hinted at upcoming launch",
    "pushed a benchmark narrative",
    "framed product velocity as moat",
  ],
  MEDIA: [
    "published a fresh market narrative",
    "shared a high-signal thread",
    "surfaced policy-related risk",
    "amplified an execution datapoint",
  ],
  INFLUENCER: [
    "sparked narrative debate",
    "issued a directional call",
    "framed market sentiment shift",
    "highlighted asymmetric risk",
  ],
  FOUNDER: [
    "shared strategic roadmap context",
    "teased internal milestone",
    "commented on market structure",
    "highlighted execution leverage",
  ],
};

function stableHash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

export class MockXProvider implements SocialIngestionProvider {
  getProviderName() {
    return SocialProvider.X;
  }

  async fetchLatestPostsForAccount(account: TrackedAccount): Promise<NormalizedSocialPost[]> {
    const now = new Date();
    const thirtyMinuteSlot = Math.floor(now.getTime() / (30 * 60 * 1000));

    const posts: NormalizedSocialPost[] = [];

    for (let i = 0; i < 2; i += 1) {
      const seed = stableHash(`${account.handle}-${thirtyMinuteSlot}-${i}`);
      const shouldEmit = seed % 100 < 68;
      if (!shouldEmit) continue;

      const minutesAgo = seed % 150;
      const postedAt = new Date(now.getTime() - minutesAgo * 60 * 1000);
      const snippetPool = CATEGORY_SNIPPETS[account.category] || CATEGORY_SNIPPETS.MEDIA;
      const snippet = snippetPool[seed % snippetPool.length];

      const content = compactWhitespace(
        `${account.displayName} ${snippet}. Thread focuses on execution signal ${seed % 17} and likely second-order impacts for operators tracking this account.`
      );

      const externalPostId = `${account.handle}-${thirtyMinuteSlot}-${i}`;
      const sourceUrl = `https://x.com/${account.handle}/status/${stableHash(externalPostId).toString()}`;

      posts.push({
        provider: SocialProvider.X,
        externalPostId,
        content,
        postedAt,
        sourceUrl,
        likeCount: 20 + (seed % 260),
        replyCount: 2 + (seed % 44),
        repostCount: 1 + (seed % 70),
        quoteCount: seed % 18,
        rawPayload: {
          provider: "mock-x-provider",
          seed,
          slot: thirtyMinuteSlot,
          handle: account.handle,
        },
      });
    }

    posts.sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
    return posts;
  }
}
