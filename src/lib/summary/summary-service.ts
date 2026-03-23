import OpenAI from "openai";
import type { Account, Post } from "@prisma/client";
import { compactWhitespace, truncate } from "@/lib/utils";

type SummaryInput = {
  post: Pick<Post, "content" | "likeCount" | "replyCount" | "repostCount" | "quoteCount" | "sourceUrl" | "postedAt">;
  account: Pick<Account, "displayName" | "handle" | "category" | "tags">;
};

const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

let cachedClient: OpenAI | null = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return cachedClient;
}

function fallbackSummary({ post, account }: SummaryInput) {
  const engagement = post.likeCount + post.replyCount + post.repostCount + (post.quoteCount || 0);
  const intensity = engagement > 250 ? "high engagement" : engagement > 80 ? "moderate engagement" : "early engagement";
  return compactWhitespace(
    `${account.displayName} posted a ${account.category.toLowerCase()} signal with ${intensity}. Watch for narrative follow-through and competitive relevance if adjacent accounts echo this theme.`
  );
}

export async function generatePostSummary(input: SummaryInput): Promise<{ summary: string; model: string }> {
  const client = getClient();
  if (!client) {
    return {
      summary: fallbackSummary(input),
      model: "fallback-heuristic",
    };
  }

  const prompt = [
    "You are generating brief social-intelligence notes for an internal command center.",
    "Return 1-2 sentences only.",
    "State why this post matters from narrative, competitive, policy, or execution perspective.",
    "Avoid generic filler and avoid repeating the post verbatim.",
    "",
    `Account: ${input.account.displayName} (@${input.account.handle})`,
    `Category: ${input.account.category}`,
    `Tags: ${input.account.tags.join(", ") || "none"}`,
    `Engagement: likes=${input.post.likeCount}, replies=${input.post.replyCount}, reposts=${input.post.repostCount}, quotes=${input.post.quoteCount ?? 0}`,
    `Posted at: ${input.post.postedAt.toISOString()}`,
    `Post text: ${truncate(input.post.content, 1200)}`,
  ].join("\n");

  try {
    const response = await client.responses.create({
      model,
      input: prompt,
      temperature: 0.2,
      max_output_tokens: 120,
    });

    const summary = compactWhitespace(response.output_text || "");
    if (!summary) {
      return { summary: fallbackSummary(input), model: `${model}-empty-fallback` };
    }

    return {
      summary: truncate(summary, 420),
      model,
    };
  } catch {
    return {
      summary: fallbackSummary(input),
      model: `${model}-error-fallback`,
    };
  }
}
