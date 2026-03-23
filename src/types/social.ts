import type { AccountCategory } from '@prisma/client';

export type ProviderName = 'x-placeholder';

export interface ProviderAccount {
  id: string;
  handle: string;
  displayName: string;
  category: AccountCategory;
  tags: string[];
  provider: string;
}

export interface ProviderRawPost {
  id: string;
  text: string;
  createdAt: string;
  url: string;
  metrics?: {
    likeCount?: number;
    replyCount?: number;
    repostCount?: number;
    quoteCount?: number;
  };
  [key: string]: unknown;
}

export interface NormalizedPost {
  provider: string;
  externalPostId: string;
  content: string;
  postedAt: Date;
  sourceUrl: string;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  quoteCount?: number | null;
  rawPayload?: unknown;
}

export interface SocialProvider {
  getProviderName(): ProviderName | string;
  fetchLatestPostsForAccount(account: ProviderAccount): Promise<ProviderRawPost[]>;
  normalizePost(rawPost: ProviderRawPost, account: ProviderAccount): NormalizedPost;
}

export interface IngestionResult {
  runId: string;
  provider: string;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  accountsProcessed: number;
  fetchedPosts: number;
  insertedPosts: number;
  summarizedPosts: number;
  deduplicatedPosts: number;
  errors: Array<{ accountHandle: string; message: string }>;
}

export type TimeWindow = '24h' | '7d' | '30d' | 'all';
