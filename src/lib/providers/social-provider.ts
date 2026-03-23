import type { SocialProvider } from "@prisma/client";
import type { NormalizedSocialPost, TrackedAccount } from "@/lib/types";

export interface SocialIngestionProvider {
  getProviderName(): SocialProvider;
  fetchLatestPostsForAccount(account: TrackedAccount): Promise<NormalizedSocialPost[]>;
}
