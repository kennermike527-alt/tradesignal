import OpenAI from "openai";
import { db } from "@/lib/db";
import { BASELINE_TERMS, detectSourcePlatformFromUrl, pickCenterFromText } from "@/lib/context/context-resolver";
import { compactWhitespace, truncate } from "@/lib/utils";
import type {
  ContextNarrativeSummary,
  ContextSummaryTone,
  GlobalNarrativeSummary,
  IntelligenceCenter,
  NarrativeTopicSummary,
  SourcePlatform,
} from "@/lib/types";

type ContextSummaryOptions = {
  center: IntelligenceCenter;
  sourcePlatform: SourcePlatform;
  windowHours?: number;
  forceRefresh?: boolean;
};

type ClusterBucket = {
  id: string;
  label: string;
  terms: Set<string>;
  handles: Set<string>;
  posts: Array<{
    content: string;
    sourceUrl: string;
    postedAt: Date;
    handle: string;
    displayName: string;
    summary: string | null;
    engagement: number;
  }>;
};

type ModelOutput = {
  global_summary: GlobalNarrativeSummary;
  topics: NarrativeTopicSummary[];
};

type ProviderName = "openai" | "heuristic";

const DEFAULT_SUMMARY_MODEL = process.env.CONTEXT_SUMMARY_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
const SUMMARY_PROVIDER = (process.env.CONTEXT_SUMMARY_PROVIDER || "openai").toLowerCase() as ProviderName;
const SUMMARY_REFRESH_MINUTES = Number(process.env.CONTEXT_SUMMARY_REFRESH_MINUTES || 90);
const MAX_POSTS_FOR_SUMMARY = Number(process.env.CONTEXT_SUMMARY_MAX_POSTS || 300);

const CLUSTER_PATTERNS: Array<{ id: string; label: string; keywords: string[] }> = [
  { id: "partnerships", label: "Partnerships & Integrations", keywords: ["partner", "integration", "alliance", "collaboration", "joint"] },
  { id: "launches", label: "Launches & Product Execution", keywords: ["launch", "release", "ship", "roadmap", "beta", "feature", "deploy"] },
  { id: "regulation", label: "Regulation & Policy", keywords: ["regulat", "policy", "compliance", "sanction", "tax", "framework", "law"] },
  { id: "competition", label: "Competition & Positioning", keywords: ["competitor", "rival", "market share", "vs", "alternative"] },
  { id: "market", label: "Market Sentiment & Liquidity", keywords: ["liquidity", "flow", "volatility", "sentiment", "demand", "risk"] },
  { id: "infra", label: "Infrastructure & Standards", keywords: ["standard", "infrastructure", "interoperability", "protocol", "security", "performance"] },
];

const STOPWORDS = new Set(
  [
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "have",
    "has",
    "into",
    "about",
    "your",
    "their",
    "our",
    "just",
    "will",
    "been",
    "they",
    "them",
    "were",
    "what",
    "when",
    "where",
    "while",
    "more",
    "most",
    "some",
    "many",
    "only",
    "over",
    "under",
    "within",
    "across",
    "post",
    "posts",
    "today",
    "week",
    "month",
    "using",
    "also",
    "than",
    "then",
    "into",
    "onto",
    "very",
    "new",
    "update",
    "updates",
    "thread",
    "link",
    "linkedin",
    "twitter",
    "xcom",
    "https",
    "http",
  ].concat([...BASELINE_TERMS])
);

let openAiClient: OpenAI | null = null;

function getOpenAiClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openAiClient) {
    openAiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openAiClient;
}

function toneFromText(text: string): ContextSummaryTone {
  const lower = text.toLowerCase();
  const positive = (lower.match(/gain|growth|improv|strong|opportun|momentum|adoption/g) || []).length;
  const negative = (lower.match(/risk|declin|drop|delay|issue|concern|block|pressure/g) || []).length;

  if (positive > 0 && negative > 0) return "mixed";
  if (positive > negative) return "positive";
  if (negative > positive) return "negative";
  return "neutral";
}

function tokenize(value: string) {
  return (value.toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g) || []).filter((token) => !STOPWORDS.has(token));
}

function pickClusterLabel(text: string) {
  let winner = CLUSTER_PATTERNS[0];
  let bestScore = 0;

  for (const pattern of CLUSTER_PATTERNS) {
    const score = pattern.keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      winner = pattern;
    }
  }

  if (bestScore === 0) {
    return { id: "ops", label: "Operational Signal Drift" };
  }

  return { id: winner.id, label: winner.label };
}

function buildClusters(
  posts: Array<{
    content: string;
    sourceUrl: string;
    postedAt: Date;
    account: { handle: string; displayName: string };
    summary: { summary: string } | null;
    likeCount: number;
    replyCount: number;
    repostCount: number;
    quoteCount: number | null;
  }>
) {
  const map = new Map<string, ClusterBucket>();

  for (const post of posts) {
    const text = `${post.content} ${post.summary?.summary ?? ""}`.toLowerCase();
    const cluster = pickClusterLabel(text);

    if (!map.has(cluster.id)) {
      map.set(cluster.id, {
        id: cluster.id,
        label: cluster.label,
        terms: new Set<string>(),
        handles: new Set<string>(),
        posts: [],
      });
    }

    const bucket = map.get(cluster.id)!;
    tokenize(text).forEach((token) => bucket.terms.add(token));
    bucket.handles.add(post.account.handle);

    bucket.posts.push({
      content: post.content,
      sourceUrl: post.sourceUrl,
      postedAt: post.postedAt,
      handle: post.account.handle,
      displayName: post.account.displayName,
      summary: post.summary?.summary ?? null,
      engagement: post.likeCount + post.replyCount * 2 + post.repostCount * 3 + (post.quoteCount ?? 0) * 2,
    });
  }

  return [...map.values()]
    .map((bucket) => ({
      ...bucket,
      posts: bucket.posts.sort((a, b) => b.engagement - a.engagement),
    }))
    .sort((a, b) => b.posts.length - a.posts.length)
    .slice(0, 6);
}

function topTermsFromClusters(clusters: ClusterBucket[], limit = 10) {
  const freq = new Map<string, number>();

  for (const cluster of clusters) {
    for (const term of cluster.terms) {
      freq.set(term, (freq.get(term) || 0) + 1);
    }
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term)
    .filter((term) => !BASELINE_TERMS.has(term))
    .slice(0, limit);
}

function ensureArray(value: unknown, max = 8) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => (typeof item === "string" ? compactWhitespace(item) : ""))
    .filter(Boolean)
    .slice(0, max);
}

function ensureUnknownArray(value: unknown, max = 8) {
  if (!Array.isArray(value)) return [] as unknown[];
  return value.slice(0, max);
}

function normalizeTopic(topic: unknown): NarrativeTopicSummary | null {
  if (!topic || typeof topic !== "object") return null;
  const record = topic as Record<string, unknown>;

  const topic_name = compactWhitespace(typeof record.topic_name === "string" ? record.topic_name : "");
  const summary = compactWhitespace(typeof record.summary === "string" ? record.summary : "");
  const why_it_matters = compactWhitespace(typeof record.why_it_matters === "string" ? record.why_it_matters : "");
  const post_count = typeof record.post_count === "number" ? Math.max(0, Math.floor(record.post_count)) : 0;

  if (!topic_name || !summary || !why_it_matters) return null;

  const toneCandidate = typeof record.tone === "string" ? record.tone.toLowerCase() : "neutral";
  const tone: ContextSummaryTone = ["positive", "negative", "neutral", "mixed"].includes(toneCandidate)
    ? (toneCandidate as ContextSummaryTone)
    : toneFromText(`${summary} ${why_it_matters}`);

  return {
    topic_name: truncate(topic_name, 90),
    summary: truncate(summary, 280),
    tone,
    why_it_matters: truncate(why_it_matters, 240),
    engagement_angles: ensureArray(record.engagement_angles, 5),
    respond_to_handles: ensureArray(record.respond_to_handles, 4).map((handle) => handle.replace(/^@+/, "")),
    key_terms: ensureArray(record.key_terms, 8),
    post_count,
  };
}

function normalizeGlobalSummary(value: unknown): GlobalNarrativeSummary {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    key_narratives_right_now: ensureArray(record.key_narratives_right_now, 6),
    gaining_momentum: ensureArray(record.gaining_momentum, 6),
    fading: ensureArray(record.fading, 4),
    attention_concentrated: ensureArray(record.attention_concentrated, 4),
    top_opportunities_to_engage: ensureArray(record.top_opportunities_to_engage, 6),
  };
}

function extractJsonObject(value: string) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(value.slice(start, end + 1));
  } catch {
    return null;
  }
}

function fallbackModelOutput(clusters: ClusterBucket[], keyTopics: string[]): ModelOutput {
  const topics: NarrativeTopicSummary[] = clusters.map((cluster) => {
    const sample = cluster.posts.slice(0, 2).map((post) => truncate(post.summary || post.content, 140)).join(" ");

    return {
      topic_name: cluster.label,
      summary: truncate(
        `Conversation is centering on ${cluster.label.toLowerCase()} with ${cluster.posts.length} tracked post(s). ${sample}`,
        280
      ),
      tone: toneFromText(sample),
      why_it_matters: truncate(
        `This narrative is influencing ${cluster.handles.size} tracked account(s) and can shift attention around the current context.`,
        220
      ),
      engagement_angles: [
        `Add a concrete operator take on ${cluster.label.toLowerCase()}.`,
        "Reply to high-engagement posts with execution evidence or specific data.",
      ],
      respond_to_handles: [...cluster.handles].slice(0, 4),
      key_terms: [...cluster.terms].slice(0, 8),
      post_count: cluster.posts.length,
    };
  });

  return {
    global_summary: {
      key_narratives_right_now:
        topics.slice(0, 4).map((topic) => topic.topic_name).length > 0
          ? topics.slice(0, 4).map((topic) => topic.topic_name)
          : keyTopics.slice(0, 4),
      gaining_momentum: topics.slice(0, 3).map((topic) => `${topic.topic_name} is gaining velocity.`),
      fading: [],
      attention_concentrated: [
        `${topics.reduce((sum, topic) => sum + topic.post_count, 0)} posts across ${topics.length} topic cluster(s).`,
      ],
      top_opportunities_to_engage: topics.flatMap((topic) => topic.engagement_angles.slice(0, 1)).slice(0, 5),
    },
    topics,
  };
}

function buildPrompt(
  center: IntelligenceCenter,
  sourcePlatform: SourcePlatform,
  windowHours: number,
  clusters: ClusterBucket[],
  keyTopics: string[]
) {
  const payload = clusters.map((cluster) => ({
    topic_seed: cluster.label,
    post_count: cluster.posts.length,
    top_terms: [...cluster.terms].slice(0, 12),
    active_handles: [...cluster.handles].slice(0, 8),
    sample_posts: cluster.posts.slice(0, 4).map((post) => ({
      handle: post.handle,
      posted_at: post.postedAt.toISOString(),
      engagement: post.engagement,
      text: truncate(post.content, 260),
      note: post.summary ? truncate(post.summary, 200) : null,
    })),
  }));

  return [
    "You are an operations-focused social intelligence analyst for a comms/operator team.",
    "Generate concise command-layer briefings.",
    "Do NOT compare with other platforms. Stay strictly inside the provided context.",
    "Avoid fluff, hedging, and generic wording.",
    "Ignore baseline labels like IOTA/TWIN as topic names unless paired with specific differentiators.",
    "Return STRICT JSON only (no markdown).",
    "",
    `Context center: ${center}`,
    `Context platform: ${sourcePlatform}`,
    `Time window hours: ${windowHours}`,
    `Pre-extracted key topics: ${keyTopics.join(", ") || "none"}`,
    "",
    "JSON schema:",
    "{",
    '  "global_summary": {',
    '    "key_narratives_right_now": ["..."],',
    '    "gaining_momentum": ["..."],',
    '    "fading": ["..."],',
    '    "attention_concentrated": ["..."],',
    '    "top_opportunities_to_engage": ["..."]',
    "  },",
    '  "topics": [',
    "    {",
    '      "topic_name": "...",',
    '      "summary": "2-3 sentences max",',
    '      "tone": "positive|negative|neutral|mixed",',
    '      "why_it_matters": "1-2 sentences",',
    '      "engagement_angles": ["action 1", "action 2"],',
    '      "respond_to_handles": ["handle1", "handle2"],',
    '      "key_terms": ["term1", "term2"],',
    '      "post_count": 0',
    "    }",
    "  ]",
    "}",
    "",
    "Cluster input:",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

async function summarizeWithModel(
  center: IntelligenceCenter,
  sourcePlatform: SourcePlatform,
  windowHours: number,
  clusters: ClusterBucket[],
  keyTopics: string[]
): Promise<{ output: ModelOutput; model: string }> {
  const prompt = buildPrompt(center, sourcePlatform, windowHours, clusters, keyTopics);

  if (SUMMARY_PROVIDER !== "openai") {
    return {
      output: fallbackModelOutput(clusters, keyTopics),
      model: "heuristic-fallback",
    };
  }

  const client = getOpenAiClient();
  if (!client) {
    return {
      output: fallbackModelOutput(clusters, keyTopics),
      model: "heuristic-no-api-key",
    };
  }

  try {
    const response = await client.responses.create({
      model: DEFAULT_SUMMARY_MODEL,
      input: prompt,
      temperature: 0.1,
      max_output_tokens: 1400,
    });

    const parsed = extractJsonObject(response.output_text || "");
    if (!parsed || typeof parsed !== "object") {
      return {
        output: fallbackModelOutput(clusters, keyTopics),
        model: `${DEFAULT_SUMMARY_MODEL}-parse-fallback`,
      };
    }

    const record = parsed as Record<string, unknown>;
    const topics = ensureUnknownArray(record.topics, 10)
      .map((item) => normalizeTopic(item))
      .filter((item): item is NarrativeTopicSummary => Boolean(item));

    const normalizedTopics = topics.length > 0 ? topics : fallbackModelOutput(clusters, keyTopics).topics;

    return {
      output: {
        global_summary: normalizeGlobalSummary(record.global_summary),
        topics: normalizedTopics,
      },
      model: DEFAULT_SUMMARY_MODEL,
    };
  } catch {
    return {
      output: fallbackModelOutput(clusters, keyTopics),
      model: `${DEFAULT_SUMMARY_MODEL}-error-fallback`,
    };
  }
}

function toContextNarrativeSummary(
  row: {
    center: "IOTA" | "TWIN";
    sourcePlatform: "X" | "LINKEDIN";
    windowHours: number;
    postCount: number;
    generatedAt: Date;
    summaryJson: unknown;
    keyTopics: string[];
  }
): ContextNarrativeSummary {
  const payload = (row.summaryJson && typeof row.summaryJson === "object" ? row.summaryJson : {}) as Record<string, unknown>;

  const topics = Array.isArray(payload.topics)
    ? payload.topics
        .map((topic) => normalizeTopic(topic))
        .filter((topic): topic is NarrativeTopicSummary => Boolean(topic))
    : [];

  return {
    center: row.center,
    sourcePlatform: row.sourcePlatform,
    windowHours: row.windowHours,
    postCount: row.postCount,
    generatedAt: row.generatedAt,
    model: typeof payload.model === "string" ? payload.model : "unknown",
    keyTopics: row.keyTopics || [],
    global_summary: normalizeGlobalSummary(payload.global_summary),
    topics,
  };
}

export const CONTEXT_SUMMARY_PROMPT_TEMPLATE_VERSION = "v1";

export async function getOrCreateContextSummary(options: ContextSummaryOptions): Promise<ContextNarrativeSummary> {
  const windowHours = options.windowHours ?? 24;
  const forceRefresh = options.forceRefresh ?? false;
  const threshold = new Date(Date.now() - SUMMARY_REFRESH_MINUTES * 60 * 1000);

  if (!forceRefresh) {
    const cached = await db.contextSummary.findFirst({
      where: {
        center: options.center,
        sourcePlatform: options.sourcePlatform,
        windowHours,
        generatedAt: { gte: threshold },
      },
      orderBy: { generatedAt: "desc" },
      select: {
        center: true,
        sourcePlatform: true,
        windowHours: true,
        postCount: true,
        generatedAt: true,
        summaryJson: true,
        keyTopics: true,
      },
    });

    if (cached) {
      return toContextNarrativeSummary(cached);
    }
  }

  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const recentPosts = await db.post.findMany({
    where: { postedAt: { gte: since } },
    orderBy: { postedAt: "desc" },
    take: MAX_POSTS_FOR_SUMMARY,
    select: {
      content: true,
      sourceUrl: true,
      postedAt: true,
      likeCount: true,
      replyCount: true,
      repostCount: true,
      quoteCount: true,
      account: {
        select: {
          handle: true,
          displayName: true,
        },
      },
      summary: {
        select: {
          summary: true,
        },
      },
    },
  });

  const scopedPosts = recentPosts.filter((post) => {
    const center = pickCenterFromText(`${post.content} ${post.summary?.summary ?? ""}`, post.account.handle);
    const sourcePlatform = detectSourcePlatformFromUrl(post.sourceUrl);
    return center === options.center && sourcePlatform === options.sourcePlatform;
  });

  const clusters = buildClusters(scopedPosts);
  const keyTopics = topTermsFromClusters(clusters, 12);

  const modelResult = scopedPosts.length
    ? await summarizeWithModel(options.center, options.sourcePlatform, windowHours, clusters, keyTopics)
    : {
        output: {
          global_summary: {
            key_narratives_right_now: ["No meaningful discussion captured in this window."],
            gaining_momentum: [],
            fading: [],
            attention_concentrated: ["Low signal volume in current context."],
            top_opportunities_to_engage: ["Trigger manual refresh after new posts arrive."],
          },
          topics: [],
        },
        model: "empty-window",
      };

  const row = await db.contextSummary.create({
    data: {
      center: options.center,
      sourcePlatform: options.sourcePlatform,
      windowHours,
      postCount: scopedPosts.length,
      keyTopics,
      summaryJson: {
        model: modelResult.model,
        promptVersion: CONTEXT_SUMMARY_PROMPT_TEMPLATE_VERSION,
        generatedAt: new Date().toISOString(),
        global_summary: modelResult.output.global_summary,
        topics: modelResult.output.topics,
      },
      generatedAt: new Date(),
    },
    select: {
      center: true,
      sourcePlatform: true,
      windowHours: true,
      postCount: true,
      generatedAt: true,
      summaryJson: true,
      keyTopics: true,
    },
  });

  return toContextNarrativeSummary(row);
}

export function getContextSummaryPromptPreview() {
  return {
    provider: SUMMARY_PROVIDER,
    model: DEFAULT_SUMMARY_MODEL,
    refreshMinutes: SUMMARY_REFRESH_MINUTES,
    maxPosts: MAX_POSTS_FOR_SUMMARY,
    templateVersion: CONTEXT_SUMMARY_PROMPT_TEMPLATE_VERSION,
  };
}
