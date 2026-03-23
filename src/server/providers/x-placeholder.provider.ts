import type {
  NormalizedPost,
  ProviderAccount,
  ProviderRawPost,
  SocialProvider,
} from '@/types/social';

const POST_TEMPLATES = [
  'New product update just dropped. Watch positioning and reaction speed.',
  'Macro thread today: policy chatter is shifting sentiment in this sector.',
  'Strong engagement around execution velocity and roadmap clarity.',
  'Interesting narrative inflection: competition is clustering around one theme.',
  'Partnership signal with second-order implications for distribution.',
  'Market structure post: look at what is said and what is omitted.',
];

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function metric(seed: string, base: number, spread: number): number {
  return base + (hash(seed) % spread);
}

/**
 * Placeholder provider for V1 scaffolding.
 * Replace with real X API integration in src/server/providers/ once credentials and API policy are finalized.
 */
export class XPlaceholderProvider implements SocialProvider {
  getProviderName() {
    return 'x-placeholder' as const;
  }

  async fetchLatestPostsForAccount(account: ProviderAccount): Promise<ProviderRawPost[]> {
    const now = new Date();
    const bucket = Math.floor(now.getTime() / (1000 * 60 * 60 * 6));
    const count = (hash(`${account.handle}-${bucket}`) % 3) + 1;

    const posts: ProviderRawPost[] = [];

    for (let i = 0; i < count; i += 1) {
      const postSeed = `${account.handle}-${bucket}-${i}`;
      const template = POST_TEMPLATES[hash(postSeed) % POST_TEMPLATES.length];
      const createdAt = new Date(now.getTime() - (i * 45 + (hash(postSeed) % 30)) * 60_000);

      posts.push({
        id: postSeed,
        text: `${template} (${account.handle})`,
        createdAt: createdAt.toISOString(),
        url: `https://x.com/${account.handle}/status/${postSeed}`,
        metrics: {
          likeCount: metric(`${postSeed}-likes`, 8, 320),
          replyCount: metric(`${postSeed}-replies`, 1, 80),
          repostCount: metric(`${postSeed}-reposts`, 2, 140),
          quoteCount: metric(`${postSeed}-quotes`, 0, 35),
        },
      });
    }

    return posts;
  }

  normalizePost(rawPost: ProviderRawPost): NormalizedPost {
    return {
      provider: this.getProviderName(),
      externalPostId: rawPost.id,
      content: rawPost.text,
      postedAt: new Date(rawPost.createdAt),
      sourceUrl: rawPost.url,
      likeCount: rawPost.metrics?.likeCount ?? 0,
      replyCount: rawPost.metrics?.replyCount ?? 0,
      repostCount: rawPost.metrics?.repostCount ?? 0,
      quoteCount: rawPost.metrics?.quoteCount ?? null,
      rawPayload: rawPost,
    };
  }
}
