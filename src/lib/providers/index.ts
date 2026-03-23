import { SocialProvider } from "@prisma/client";
import { MockXProvider } from "@/lib/providers/mock-x-provider";
import type { SocialIngestionProvider } from "@/lib/providers/social-provider";

export function getProvider(provider: SocialProvider): SocialIngestionProvider {
  switch (provider) {
    case SocialProvider.X:
    default:
      return new MockXProvider();
  }
}
