import OpenAI from "openai";
import { db } from "@/lib/db";
import { classifyPostForIntelligence } from "@/lib/intelligence/account-led-intelligence-service";
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

type TopicCluster = {
  label: string;
  posts: Array<{
    handle: string;
    content: string;
    summary: string | null;
    postedAt: Date;
    engagement: number;
    topics: string[];
  }>;
};

type ModelOutput = {
  global_summary: GlobalNarrativeSummary;
  topics: NarrativeTopicSummary[];
};

const SUMMARY_PROVIDER = (process.env.CONTEXT_SUMMARY_PROVIDER || "openai").toLowerCase();
const SUMMARY_MODEL = process.env.CONTEXT_SUMMARY_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
const SUMMARY_REFRESH_MINUTES = Number(process.env.CONTEXT_SUMMARY_REFRESH_MINUTES || 90);
const MAX_POSTS = Number(process.env.CONTEXT_SUMMARY_MAX_POSTS || 300);

let client: OpenAI | null = null;

const BASELINE = new Set(["iota", "twin", "iotafoundation", "twinfoundation"]);

function normalizeHandle(handle: string) {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

function detectSourceFromUrl(url: string): SourcePlatform {
  return url.toLowerCase().includes("linkedin.com") ? "LINKEDIN" : "X";
}

function ensureArray(value: unknown, max = 8) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => (typeof item === "string" ? compactWhitespace(item) : ""))
    .filter(Boolean)
    .slice(0, max);
}

function toneFromText(text: string): ContextSummaryTone {
  const lower = text.toLowerCase();
  const pos = (lower.match(/gain|strong|momentum|upside|improv/g) || []).length;
  const neg = (lower.match(/risk|drop|pressure|downside|delay/g) || []).length;
  if (pos > 0 && neg > 0) return "mixed";
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

function clusterPosts(
  posts: Array<{
    handle: string;
    content: string;
    summary: string | null;
    postedAt: Date;
    engagement: number;
    topics: string[];
  }>
): TopicCluster[] {
  const map = new Map<string, TopicCluster>();

  for (const post of posts) {
    const primary = post.topics[0] || "general";
    const label = primary.replace(/[-_]/g, " ");

    if (!map.has(label)) {
      map.set(label, { label, posts: [] });
    }

    map.get(label)!.posts.push(post);
  }

  return [...map.values()]
    .map((cluster) => ({
      ...cluster,
      posts: cluster.posts.sort((a, b) => b.engagement - a.engagement),
    }))
    .sort((a, b) => b.posts.length - a.posts.length)
    .slice(0, 8);
}

function extractKeyTopics(clusters: TopicCluster[]) {
  const freq = new Map<string, number>();

  for (const cluster of clusters) {
    for (const post of cluster.posts) {
      for (const topic of post.topics) {
        const key = topic.toLowerCase();
        if (BASELINE.has(key)) continue;
        freq.set(key, (freq.get(key) || 0) + 1);
      }
    }
  }

  return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([topic]) => topic).slice(0, 14);
}

function buildPrompt(
  center: IntelligenceCenter,
  sourcePlatform: SourcePlatform,
  windowHours: number,
  clusters: TopicCluster[],
  keyTopics: string[]
) {
  const payload = clusters.map((cluster) => ({
    topic_seed: cluster.label,
    post_count: cluster.posts.length,
    sample_posts: cluster.posts.slice(0, 5).map((post) => ({
      handle: post.handle,
      text: truncate(post.content, 220),
      summary: post.summary ? truncate(post.summary, 180) : null,
      engagement: post.engagement,
      posted_at: post.postedAt.toISOString(),
      detected_topics: post.topics,
    })),
  }));

  return [
    "You are an operator intelligence assistant.",
    "Output concise JSON only. No markdown.",
    "Do not compare platforms. Stay strictly inside the provided context.",
    "Avoid fluff and generic phrasing.",
    "Baseline words like IOTA/TWIN are context labels, not useful topic labels.",
    `Context center: ${center}`,
    `Context platform: ${sourcePlatform}`,
    `Window hours: ${windowHours}`,
    `Pre-key-topics: ${keyTopics.join(", ") || "none"}`,
    "Required JSON schema:",
    '{"global_summary":{"key_narratives_right_now":[],"gaining_momentum":[],"fading":[],"attention_concentrated":[],"top_opportunities_to_engage":[]},"topics":[{"topic_name":"","summary":"","tone":"positive|negative|neutral|mixed","why_it_matters":"","engagement_angles":[],"respond_to_handles":[],"key_terms":[],"post_count":0}] }',
    "Cluster input:",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

function fallbackOutput(clusters: TopicCluster[], keyTopics: string[]): ModelOutput {
  const topics: NarrativeTopicSummary[] = clusters.map((cluster) => {
    const merged = cluster.posts.slice(0, 2).map((p) => p.summary || p.content).join(" ");
    const handles = [...new Set(cluster.posts.map((p) => p.handle))].slice(0, 4);

    return {
      topic_name: cluster.label,
      summary: truncate(
        `Tracked accounts are discussing ${cluster.label} with ${cluster.posts.length} post(s) in this context.`,
        220
      ),
      tone: toneFromText(merged),
      why_it_matters: "This narrative affects near-term visibility and engagement opportunities around tracked accounts.",
      engagement_angles: [
        `Reply with one concrete operator insight on ${cluster.label}.`,
        "Add a short evidence-backed take with one measurable implication.",
      ],
      respond_to_handles: handles,
      key_terms: cluster.posts.flatMap((p) => p.topics).slice(0, 8),
      post_count: cluster.posts.length,
    };
  });

  return {
    global_summary: {
      key_narratives_right_now: topics.slice(0, 4).map((t) => t.topic_name),
      gaining_momentum: topics.slice(0, 3).map((t) => `${t.topic_name} gaining momentum`),
      fading: [],
      attention_concentrated: [`${topics.length} active clusters`, `${keyTopics.slice(0, 4).join(", ")}`],
      top_opportunities_to_engage: topics.flatMap((t) => t.engagement_angles.slice(0, 1)).slice(0, 6),
    },
    topics,
  };
}

function parseOutput(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;

  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeTopic(value: unknown): NarrativeTopicSummary | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;

  const topic_name = compactWhitespace(typeof v.topic_name === "string" ? v.topic_name : "");
  const summary = compactWhitespace(typeof v.summary === "string" ? v.summary : "");
  const why_it_matters = compactWhitespace(typeof v.why_it_matters === "string" ? v.why_it_matters : "");
  const post_count = typeof v.post_count === "number" ? Math.max(0, Math.floor(v.post_count)) : 0;

  if (!topic_name || !summary || !why_it_matters) return null;

  const toneRaw = typeof v.tone === "string" ? v.tone.toLowerCase() : "neutral";
  const tone: ContextSummaryTone = ["positive", "negative", "neutral", "mixed"].includes(toneRaw)
    ? (toneRaw as ContextSummaryTone)
    : "neutral";

  return {
    topic_name,
    summary: truncate(summary, 280),
    tone,
    why_it_matters: truncate(why_it_matters, 220),
    engagement_angles: ensureArray(v.engagement_angles, 5),
    respond_to_handles: ensureArray(v.respond_to_handles, 6).map((h) => h.replace(/^@+/, "")),
    key_terms: ensureArray(v.key_terms, 10).filter((term) => !BASELINE.has(term.toLowerCase())),
    post_count,
  };
}

function normalizeGlobal(value: unknown): GlobalNarrativeSummary {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    key_narratives_right_now: ensureArray(v.key_narratives_right_now, 6),
    gaining_momentum: ensureArray(v.gaining_momentum, 6),
    fading: ensureArray(v.fading, 4),
    attention_concentrated: ensureArray(v.attention_concentrated, 4),
    top_opportunities_to_engage: ensureArray(v.top_opportunities_to_engage, 8),
  };
}

function toContextSummary(row: {
  center: IntelligenceCenter;
  sourcePlatform: SourcePlatform;
  windowHours: number;
  postCount: number;
  generatedAt: Date;
  summaryJson: unknown;
  keyTopics: string[];
}): ContextNarrativeSummary {
  const payload = (row.summaryJson && typeof row.summaryJson === "object" ? row.summaryJson : {}) as Record<string, unknown>;
  const topicsRaw = Array.isArray(payload.topics) ? payload.topics : [];

  return {
    center: row.center,
    sourcePlatform: row.sourcePlatform,
    windowHours: row.windowHours,
    postCount: row.postCount,
    generatedAt: row.generatedAt,
    model: typeof payload.model === "string" ? payload.model : "unknown",
    keyTopics: row.keyTopics,
    global_summary: normalizeGlobal(payload.global_summary),
    topics: topicsRaw.map((item) => normalizeTopic(item)).filter((t): t is NarrativeTopicSummary => Boolean(t)),
  };
}

export const CONTEXT_SUMMARY_PROMPT_TEMPLATE_VERSION = "v2-account-led";

export function getContextSummaryPromptPreview() {
  return {
    provider: SUMMARY_PROVIDER,
    model: SUMMARY_MODEL,
    refreshMinutes: SUMMARY_REFRESH_MINUTES,
    maxPosts: MAX_POSTS,
    templateVersion: CONTEXT_SUMMARY_PROMPT_TEMPLATE_VERSION,
  };
}

async function summarizeWithModel(
  center: IntelligenceCenter,
  sourcePlatform: SourcePlatform,
  windowHours: number,
  clusters: TopicCluster[],
  keyTopics: string[]
): Promise<{ output: ModelOutput; model: string }> {
  if (SUMMARY_PROVIDER !== "openai") {
    return { output: fallbackOutput(clusters, keyTopics), model: "heuristic-fallback" };
  }

  if (!process.env.OPENAI_API_KEY) {
    return { output: fallbackOutput(clusters, keyTopics), model: "heuristic-no-api-key" };
  }

  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const prompt = buildPrompt(center, sourcePlatform, windowHours, clusters, keyTopics);
    const response = await client.responses.create({
      model: SUMMARY_MODEL,
      input: prompt,
      temperature: 0.1,
      max_output_tokens: 1300,
    });

    const parsed = parseOutput(response.output_text || "");
    if (!parsed) {
      return { output: fallbackOutput(clusters, keyTopics), model: `${SUMMARY_MODEL}-parse-fallback` };
    }

    const topics = (Array.isArray(parsed.topics) ? parsed.topics : [])
      .map((item) => normalizeTopic(item))
      .filter((t): t is NarrativeTopicSummary => Boolean(t));

    return {
      output: {
        global_summary: normalizeGlobal(parsed.global_summary),
        topics: topics.length > 0 ? topics : fallbackOutput(clusters, keyTopics).topics,
      },
      model: SUMMARY_MODEL,
    };
  } catch {
    return { output: fallbackOutput(clusters, keyTopics), model: `${SUMMARY_MODEL}-error-fallback` };
  }
}

export async function getOrCreateContextSummary(options: ContextSummaryOptions): Promise<ContextNarrativeSummary> {
  const windowHours = options.windowHours ?? 24;
  const forceRefresh = options.forceRefresh ?? false;
  const recentThreshold = new Date(Date.now() - SUMMARY_REFRESH_MINUTES * 60 * 1000);

  if (!forceRefresh) {
    const cached = await db.contextSummary.findFirst({
      where: {
        center: options.center,
        sourcePlatform: options.sourcePlatform,
        windowHours,
        generatedAt: { gte: recentThreshold },
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

    if (cached) return toContextSummary(cached);
  }

  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const [watchlistRows, postsRaw] = await Promise.all([
    db.watchlistAccount.findMany({
      where: {
        center: options.center,
        sourcePlatform: options.sourcePlatform,
      },
      select: {
        handleNormalized: true,
      },
    }),
    db.post.findMany({
      where: { postedAt: { gte: since } },
      orderBy: { postedAt: "desc" },
      take: MAX_POSTS,
      include: {
        account: {
          select: {
            handle: true,
          },
        },
        summary: {
          select: {
            summary: true,
          },
        },
        classification: {
          select: {
            topics: true,
          },
        },
      },
    }),
  ]);

  const trackedHandles = new Set(watchlistRows.map((row) => row.handleNormalized));

  const scopedPosts = postsRaw.filter((post) => {
    if (detectSourceFromUrl(post.sourceUrl) !== options.sourcePlatform) return false;

    if (trackedHandles.size === 0) {
      return true;
    }

    return trackedHandles.has(normalizeHandle(post.account.handle));
  });

  const normalized = scopedPosts.map((post) => {
    const inferred = post.classification?.topics?.length
      ? post.classification.topics
      : classifyPostForIntelligence({
          id: post.id,
          provider: post.provider,
          externalPostId: post.externalPostId,
          accountId: post.accountId,
          content: post.content,
          postedAt: post.postedAt,
          fetchedAt: post.fetchedAt,
          sourceUrl: post.sourceUrl,
          likeCount: post.likeCount,
          replyCount: post.replyCount,
          repostCount: post.repostCount,
          quoteCount: post.quoteCount ?? 0,
          sourcePlatform: options.sourcePlatform,
          center: options.center,
          account: {
            id: post.accountId,
            displayName: post.account.handle,
            handle: post.account.handle,
            category: "ECOSYSTEM",
            tags: [],
          },
          summary: post.summary ? { summary: post.summary.summary, model: "db" } : null,
          classification: null,
        }).topics;

    return {
      handle: post.account.handle,
      content: post.content,
      summary: post.summary?.summary ?? null,
      postedAt: post.postedAt,
      engagement: post.likeCount + post.replyCount * 2 + post.repostCount * 3 + (post.quoteCount ?? 0) * 2,
      topics: inferred,
    };
  });

  const clusters = clusterPosts(normalized);
  const keyTopics = extractKeyTopics(clusters);

  const modelResult = normalized.length > 0
    ? await summarizeWithModel(options.center, options.sourcePlatform, windowHours, clusters, keyTopics)
    : {
        output: {
          global_summary: {
            key_narratives_right_now: ["No tracked-account discussion detected in this window."],
            gaining_momentum: [],
            fading: [],
            attention_concentrated: ["No meaningful post volume in selected context."],
            top_opportunities_to_engage: ["Expand tracked account scope or increase window."],
          },
          topics: [],
        },
        model: "empty-window",
      };

  const created = await db.contextSummary.create({
    data: {
      center: options.center,
      sourcePlatform: options.sourcePlatform,
      windowHours,
      postCount: normalized.length,
      keyTopics,
      summaryJson: {
        model: modelResult.model,
        promptVersion: CONTEXT_SUMMARY_PROMPT_TEMPLATE_VERSION,
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

  return toContextSummary(created);
}
