import { Actionability, PostTone, PostType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { BASELINE_TERMS } from "@/lib/context/context-resolver";
import { getProviderCapabilities } from "@/lib/providers/capabilities";
import type {
  ActionableSignalView,
  AdjacentInterestView,
  DashboardIntelligence,
  DashboardPost,
  DashboardStats,
  EngagerView,
  TrackedOverview,
} from "@/lib/types";

const TOPIC_HINTS: Array<{ terms: string[]; topic: string }> = [
  { terms: ["partner", "integration", "alliance"], topic: "partnerships" },
  { terms: ["launch", "release", "ship", "rollout"], topic: "launches" },
  { terms: ["regulat", "compliance", "policy", "tariff"], topic: "regulation" },
  { terms: ["macro", "rates", "inflation", "dollar"], topic: "macro" },
  { terms: ["liquidity", "flow", "volume", "basis"], topic: "market-structure" },
  { terms: ["ai", "model", "automation", "agent"], topic: "ai" },
  { terms: ["infra", "protocol", "security", "throughput"], topic: "infrastructure" },
  { terms: ["meme", "culture", "community"], topic: "culture" },
];

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "about",
  "have",
  "has",
  "are",
  "was",
  "were",
  "will",
  "over",
  "under",
  "while",
  "only",
  "more",
  "most",
  "just",
  "into",
  "x",
  "linkedin",
  ...BASELINE_TERMS,
]);

function normalizeTokens(value: string) {
  return (value.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []).filter((token) => !STOPWORDS.has(token));
}

function detectTopics(text: string) {
  const lower = text.toLowerCase();
  const matches = TOPIC_HINTS.filter((hint) => hint.terms.some((term) => lower.includes(term))).map((hint) => hint.topic);
  if (matches.length > 0) return [...new Set(matches)].slice(0, 5);

  const tokens = normalizeTokens(text);
  return [...new Set(tokens)].slice(0, 3);
}

function detectPostType(text: string): PostType {
  const lower = text.toLowerCase();

  if (/thread|how to|guide|explainer/.test(lower)) return "EDUCATIONAL_THREAD";
  if (/announce|launch|release|rolled out|now live/.test(lower)) return "ANNOUNCEMENT";
  if (/partner|integration|collaboration|alliance/.test(lower)) return "PARTNERSHIP_MENTION";
  if (/market|price|chart|liquidity|orderflow/.test(lower)) return "MARKET_COMMENTARY";
  if (/macro|policy|fed|tariff|geopolitics/.test(lower)) return "MACRO_COMMENTARY";
  if (/thesis|setup|conviction|position/.test(lower)) return "TRADE_THESIS";
  if (/opinion|think|hot take/.test(lower)) return "OPINION";
  if (/meme|lol|gm|culture/.test(lower)) return "MEME_CULTURAL";
  if (/community|space|ama|join/.test(lower)) return "COMMUNITY_SIGNAL";
  if (/reply|respond|drop your/.test(lower)) return "CALL_TO_ACTION";

  return "OTHER";
}

function detectTone(text: string): PostTone {
  const lower = text.toLowerCase();

  const bullish = (lower.match(/bull|upside|breakout|momentum|gain|strong/g) || []).length;
  const bearish = (lower.match(/bear|drawdown|risk|downside|selloff|weak/g) || []).length;
  const reactive = (lower.match(/breaking|just in|reaction|responding/g) || []).length;
  const promo = (lower.match(/launch|signup|early access|demo|join/g) || []).length;
  const analytical = (lower.match(/data|evidence|analysis|framework|model/g) || []).length;

  if (bullish > 0 && bearish > 0) return "MIXED";
  if (bullish > bearish) return "BULLISH";
  if (bearish > bullish) return "BEARISH";
  if (promo > 0) return "PROMOTIONAL";
  if (reactive > 0) return "REACTIVE";
  if (analytical > 0) return "ANALYTICAL";

  return "NEUTRAL";
}

function detectActionability(text: string, engagement: number): Actionability {
  const lower = text.toLowerCase();

  if (engagement >= 320) return "REPLY_OPPORTUNITY";
  if (/partner|introduce|collaboration|co-build/.test(lower)) return "RELATIONSHIP_OPPORTUNITY";
  if (/guide|framework|explain|analysis|thesis/.test(lower)) return "CONTENT_OPPORTUNITY";
  if (/watch|monitor|signal|tracking/.test(lower)) return "TREND_WORTH_MONITORING";

  return "NO_ACTION";
}

function whyItMatters(topics: string[], actionability: Actionability) {
  const topicText = topics.slice(0, 2).join(" + ") || "operational narratives";

  switch (actionability) {
    case "REPLY_OPPORTUNITY":
      return `High-engagement discussion around ${topicText}; reply can capture immediate visibility.`;
    case "RELATIONSHIP_OPPORTUNITY":
      return `Relationship angle present in ${topicText}; direct outreach could convert narrative proximity into access.`;
    case "CONTENT_OPPORTUNITY":
      return `Audience is signaling demand for structured takes on ${topicText}; publish a concise position.`;
    case "TREND_WORTH_MONITORING":
      return `Narrative around ${topicText} is active but still forming; monitor before committing.`;
    default:
      return "Low immediate leverage; keep in background monitoring.";
  }
}

function actionableAngle(actionability: Actionability, topics: string[]) {
  const base = topics.slice(0, 2).join(" / ") || "current discussion";

  switch (actionability) {
    case "REPLY_OPPORTUNITY":
      return `Reply with one hard data point and one clear take on ${base}.`;
    case "RELATIONSHIP_OPPORTUNITY":
      return `DM or public reply proposing a concrete collaboration angle on ${base}.`;
    case "CONTENT_OPPORTUNITY":
      return `Publish a short content brief translating ${base} into operator actions.`;
    case "TREND_WORTH_MONITORING":
      return `Track additional posts for 24h before engaging on ${base}.`;
    default:
      return "No direct action recommended.";
  }
}

export function classifyPostForIntelligence(post: DashboardPost) {
  const text = `${post.content} ${post.summary?.summary ?? ""}`;
  const topics = detectTopics(text);
  const postType = detectPostType(text);
  const tone = detectTone(text);
  const engagement = post.likeCount + post.replyCount * 2 + post.repostCount * 3 + post.quoteCount * 2;
  const actionability = detectActionability(text, engagement);

  return {
    topics,
    postType,
    tone,
    actionability,
    whyItMatters: whyItMatters(topics, actionability),
    actionableAngle: actionableAngle(actionability, topics),
    confidence: 0.68,
    model: "heuristic-account-led-v1",
  };
}

export async function persistClassifications(posts: DashboardPost[]) {
  for (const post of posts) {
    if (post.classification) continue;
    const classification = classifyPostForIntelligence(post);

    await db.postClassification.upsert({
      where: { postId: post.id },
      update: {
        topics: classification.topics,
        postType: classification.postType,
        tone: classification.tone,
        actionability: classification.actionability,
        whyItMatters: classification.whyItMatters,
        actionableAngle: classification.actionableAngle,
        confidence: classification.confidence,
        model: classification.model,
      },
      create: {
        postId: post.id,
        topics: classification.topics,
        postType: classification.postType,
        tone: classification.tone,
        actionability: classification.actionability,
        whyItMatters: classification.whyItMatters,
        actionableAngle: classification.actionableAngle,
        confidence: classification.confidence,
        model: classification.model,
      },
    });
  }
}

export function buildTrackedOverview(posts: DashboardPost[]): TrackedOverview {
  const topicFreq = new Map<string, number>();
  const typeFreq = new Map<PostType | "OTHER", number>();
  const catFreq = new Map<DashboardPost["account"]["category"], number>();

  for (const post of posts) {
    const c = post.classification ?? classifyPostForIntelligence(post);
    for (const topic of c.topics) topicFreq.set(topic, (topicFreq.get(topic) || 0) + 1);

    typeFreq.set(c.postType, (typeFreq.get(c.postType) || 0) + 1);
    catFreq.set(post.account.category, (catFreq.get(post.account.category) || 0) + 1);
  }

  return {
    topTopics: [...topicFreq.entries()].sort((a, b) => b[1] - a[1]).map(([topic]) => topic).slice(0, 8),
    topPostTypes: [...typeFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }))
      .slice(0, 6),
    topTrackedCategories: [...catFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }))
      .slice(0, 6),
  };
}

function inferAdjacentInterestsFromEngagers(
  engagerRows: Array<{ interests: string[]; representativeKeywords: string[]; confidence: number; interestKind: InterestKind; handle: string }>
): AdjacentInterestView[] {
  const map = new Map<
    string,
    {
      score: number;
      count: number;
      keywords: Set<string>;
      handles: Set<string>;
      tradeRelatedHits: number;
      nonTradeHits: number;
    }
  >();

  for (const row of engagerRows) {
    for (const interest of row.interests) {
      const key = interest.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          score: 0,
          count: 0,
          keywords: new Set<string>(),
          handles: new Set<string>(),
          tradeRelatedHits: 0,
          nonTradeHits: 0,
        });
      }

      const agg = map.get(key)!;
      agg.score += row.confidence;
      agg.count += 1;
      row.representativeKeywords.forEach((kw) => agg.keywords.add(kw));
      agg.handles.add(row.handle);

      if (row.interestKind === "TRADE_RELATED") agg.tradeRelatedHits += 1;
      else agg.nonTradeHits += 1;
    }
  }

  return [...map.entries()]
    .map(([interest, agg]) => ({
      interest,
      confidence: Math.min(0.99, agg.score / Math.max(1, agg.count)),
      representativeKeywords: [...agg.keywords].slice(0, 6),
      representativeHandles: [...agg.handles].slice(0, 6),
      interestKind: agg.nonTradeHits >= agg.tradeRelatedHits ? "ADJACENT_NON_TRADE" : "TRADE_RELATED",
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 12);
}

export async function buildAudienceAndActionIntelligence(posts: DashboardPost[], context: { center: DashboardPost["center"]; sourcePlatform: DashboardPost["sourcePlatform"] }): Promise<Pick<DashboardIntelligence, "topEngagers" | "adjacentInterests" | "actionableSignals">> {
  if (!context.center) {
    return {
      topEngagers: [],
      adjacentInterests: [],
      actionableSignals: [],
    };
  }

  const trackedAccountIds = [...new Set(posts.map((post) => post.accountId))];

  const engagementEvents = await db.engagementEvent.findMany({
    where: {
      trackedAccountId: { in: trackedAccountIds },
      provider: context.sourcePlatform,
    },
    include: {
      engagingAccount: true,
    },
    orderBy: { occurredAt: "desc" },
    take: 2000,
  });

  const engagerMap = new Map<string, EngagerView>();

  for (const event of engagementEvents) {
    const key = event.engagingAccountId;
    const current = engagerMap.get(key);

    if (!current) {
      engagerMap.set(key, {
        id: event.engagingAccount.id,
        provider: event.engagingAccount.provider,
        handle: event.engagingAccount.handle,
        displayName: event.engagingAccount.displayName,
        totalEngagements: event.count,
        interactionFrequency: 1,
        firstSeenAt: event.engagingAccount.firstSeenAt,
        lastSeenAt: event.occurredAt,
        influenceScore: event.engagingAccount.influenceScore,
      });
      continue;
    }

    current.totalEngagements += event.count;
    current.interactionFrequency += 1;
    if (event.occurredAt > current.lastSeenAt) current.lastSeenAt = event.occurredAt;
  }

  const topEngagers = [...engagerMap.values()].sort((a, b) => b.totalEngagements - a.totalEngagements).slice(0, 12);

  const profileRows = await db.engagerInterestProfile.findMany({
    where: {
      center: context.center,
      sourcePlatform: context.sourcePlatform,
      engagingAccountId: { in: topEngagers.map((engager) => engager.id) },
    },
    include: {
      engagingAccount: true,
    },
    orderBy: { generatedAt: "desc" },
    take: 400,
  });

  const adjacentInterests = inferAdjacentInterestsFromEngagers(
    profileRows.map((row) => ({
      interests: row.inferredInterests,
      representativeKeywords: row.representativeKeywords,
      confidence: row.confidence,
      interestKind: row.interestKind,
      handle: row.engagingAccount.handle,
    }))
  );

  const actionableSignals: ActionableSignalView[] = posts
    .map((post) => {
      const c = post.classification ?? classifyPostForIntelligence(post);
      return {
        id: `sig-${post.id}`,
        signalType: c.actionability,
        title: `${post.account.displayName}: ${c.postType.toLowerCase().replace(/_/g, " ")}`,
        description: c.actionableAngle || c.whyItMatters || "No action suggested.",
        targetPostId: post.id,
        targetAccountId: post.accountId,
        priority:
          c.actionability === "REPLY_OPPORTUNITY"
            ? 90
            : c.actionability === "RELATIONSHIP_OPPORTUNITY"
            ? 80
            : c.actionability === "CONTENT_OPPORTUNITY"
            ? 70
            : c.actionability === "TREND_WORTH_MONITORING"
            ? 50
            : 10,
        confidence: c.confidence,
        generatedAt: new Date(),
      };
    })
    .filter((signal) => signal.signalType !== "NO_ACTION")
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 12);

  return {
    topEngagers,
    adjacentInterests,
    actionableSignals,
  };
}

export async function buildDashboardIntelligence(posts: DashboardPost[]): Promise<DashboardIntelligence> {
  await persistClassifications(posts);

  const hydratedPosts = posts.map((post) => ({
    ...post,
    classification: post.classification ?? classifyPostForIntelligence(post),
  }));

  const trackedOverview = buildTrackedOverview(hydratedPosts);

  const context = {
    center: hydratedPosts[0]?.center ?? null,
    sourcePlatform: hydratedPosts[0]?.sourcePlatform ?? "X",
  };

  const audience = await buildAudienceAndActionIntelligence(hydratedPosts, context);

  return {
    trackedOverview,
    topEngagers: audience.topEngagers,
    adjacentInterests: audience.adjacentInterests,
    actionableSignals: audience.actionableSignals,
    providerCapabilities: getProviderCapabilities(),
  };
}

export function applyClassificationToPosts(posts: DashboardPost[]) {
  return posts.map((post) => ({
    ...post,
    classification: post.classification ?? classifyPostForIntelligence(post),
  }));
}
