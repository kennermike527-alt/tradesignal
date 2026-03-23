import type { Account, AccountCategory, IngestionRun, Post, PostSummary } from '@prisma/client';

export type DashboardPost = Post & {
  account: Account;
  summary: PostSummary | null;
};

export interface DashboardStats {
  totalAccounts: number;
  activeAccounts: number;
  totalPosts: number;
  posts24h: number;
  summarizedPosts: number;
  summaryCoverage: number;
}

export interface DashboardData {
  accounts: Account[];
  posts: DashboardPost[];
  runs: IngestionRun[];
  stats: DashboardStats;
}

export const CATEGORY_LABELS: Record<AccountCategory, string> = {
  ecosystem: 'Ecosystem',
  competitor: 'Competitor',
  media: 'Media',
  influencer: 'Influencer',
  founder: 'Founder',
};
