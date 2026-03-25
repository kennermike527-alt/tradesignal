import type { EngagementType } from "@prisma/client";
import type { ProviderCapabilityView, SourcePlatform } from "@/lib/types";

const ALL_TYPES: EngagementType[] = ["REPLY", "REPOST", "QUOTE", "COMMENT", "MENTION", "LIKE"];

const SUPPORT: Record<SourcePlatform, EngagementType[]> = {
  X: ["REPLY", "REPOST", "QUOTE", "MENTION"],
  LINKEDIN: ["COMMENT", "REPOST", "MENTION"],
};

const NOTES: Record<SourcePlatform, string> = {
  X: "Replies/reposts/quotes/mentions are modeled. Likes depend on provider access level and are currently treated as unavailable by default.",
  LINKEDIN:
    "Comments/reposts/mentions modeled. Reaction/like detail varies by provider endpoints and may be partial depending on access.",
};

export function getProviderCapabilities(): ProviderCapabilityView[] {
  return (Object.keys(SUPPORT) as SourcePlatform[]).map((provider) => {
    const available = SUPPORT[provider];
    const unavailable = ALL_TYPES.filter((type) => !available.includes(type));

    return {
      provider,
      availableEngagementTypes: available,
      unavailableEngagementTypes: unavailable,
      notes: NOTES[provider],
    };
  });
}
