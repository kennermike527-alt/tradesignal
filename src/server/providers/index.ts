import type { SocialProvider } from '@/types/social';
import { XPlaceholderProvider } from '@/server/providers/x-placeholder.provider';

export function getProvider(providerName = 'x-placeholder'): SocialProvider {
  if (providerName === 'x-placeholder') {
    return new XPlaceholderProvider();
  }

  throw new Error(`Unsupported provider: ${providerName}`);
}
