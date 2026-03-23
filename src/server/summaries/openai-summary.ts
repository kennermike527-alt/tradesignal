import OpenAI from 'openai';
import { env } from '@/lib/env';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

export interface SummaryPromptInput {
  accountName: string;
  handle: string;
  category: string;
  tags: string[];
  content: string;
  postedAt: Date;
  engagement: {
    likeCount: number;
    replyCount: number;
    repostCount: number;
    quoteCount: number;
  };
}

function fallbackSummary(input: SummaryPromptInput): string {
  const engagementTotal =
    input.engagement.likeCount +
    input.engagement.replyCount +
    input.engagement.repostCount +
    input.engagement.quoteCount;

  return `${input.accountName} posted a ${input.category} signal touching ${input.tags.slice(0, 2).join(', ') || 'core narrative themes'}. Engagement is ${engagementTotal}, suggesting ${engagementTotal > 150 ? 'above-average attention' : 'early-stage signal development'} worth monitoring.`;
}

export async function generateOpenAISummary(input: SummaryPromptInput): Promise<{ summary: string; model: string }> {
  if (!openai) {
    return {
      summary: fallbackSummary(input),
      model: 'fallback-heuristic',
    };
  }

  const prompt = [
    'You are an analyst for an internal real-time social intelligence dashboard.',
    'Write exactly 1-2 concise sentences explaining why this post matters.',
    'Focus on narrative relevance, competitive implication, or unusual engagement.',
    'Avoid hype, fluff, and generic statements.',
    '',
    `Account: ${input.accountName} (@${input.handle})`,
    `Category: ${input.category}`,
    `Tags: ${input.tags.join(', ') || 'none'}`,
    `Posted at: ${input.postedAt.toISOString()}`,
    `Engagement: likes=${input.engagement.likeCount}, replies=${input.engagement.replyCount}, reposts=${input.engagement.repostCount}, quotes=${input.engagement.quoteCount}`,
    '',
    `Post content: ${input.content}`,
  ].join('\n');

  const response = await openai.responses.create({
    model: env.OPENAI_MODEL,
    input: prompt,
    temperature: 0.3,
    max_output_tokens: 140,
  });

  const summary = response.output_text?.trim() || fallbackSummary(input);

  return {
    summary,
    model: env.OPENAI_MODEL,
  };
}
