import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { generateOpenAISummary } from '@/server/summaries/openai-summary';

export async function summarizePostIfMissing(postId: string): Promise<boolean> {
  if (!env.INGESTION_GENERATE_SUMMARIES) {
    return false;
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { account: true, summary: true },
  });

  if (!post || post.summary) {
    return false;
  }

  const { summary, model } = await generateOpenAISummary({
    accountName: post.account.displayName,
    handle: post.account.handle,
    category: post.account.category,
    tags: post.account.tags,
    content: post.content,
    postedAt: post.postedAt,
    engagement: {
      likeCount: post.likeCount,
      replyCount: post.replyCount,
      repostCount: post.repostCount,
      quoteCount: post.quoteCount ?? 0,
    },
  });

  await prisma.postSummary.create({
    data: {
      postId: post.id,
      summary,
      model,
    },
  });

  return true;
}
