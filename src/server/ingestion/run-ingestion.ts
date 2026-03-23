import { prisma } from '@/lib/prisma';
import { getProvider } from '@/server/providers';
import { summarizePostIfMissing } from '@/server/summaries/summary-service';
import type { IngestionResult } from '@/types/social';

function engagementScore(input: {
  likeCount: number;
  replyCount: number;
  repostCount: number;
  quoteCount?: number | null;
}): number {
  return (
    input.likeCount +
    input.replyCount * 2 +
    input.repostCount * 3 +
    (input.quoteCount ?? 0) * 2
  );
}

export async function runIngestion(providerName = 'x-placeholder'): Promise<IngestionResult> {
  const provider = getProvider(providerName);
  const startedAt = new Date();

  const run = await prisma.ingestionRun.create({
    data: {
      provider: provider.getProviderName(),
      startedAt,
      status: 'RUNNING',
      notes: 'Ingestion run started',
    },
  });

  const result: IngestionResult = {
    runId: run.id,
    provider: provider.getProviderName(),
    status: 'SUCCESS',
    accountsProcessed: 0,
    fetchedPosts: 0,
    insertedPosts: 0,
    summarizedPosts: 0,
    deduplicatedPosts: 0,
    errors: [],
  };

  try {
    const accounts = await prisma.account.findMany({
      where: {
        isActive: true,
        provider: provider.getProviderName(),
      },
      orderBy: { handle: 'asc' },
    });

    for (const account of accounts) {
      try {
        const rawPosts = await provider.fetchLatestPostsForAccount({
          id: account.id,
          handle: account.handle,
          displayName: account.displayName,
          category: account.category,
          tags: account.tags,
          provider: account.provider,
        });

        result.accountsProcessed += 1;
        result.fetchedPosts += rawPosts.length;

        for (const rawPost of rawPosts) {
          const normalized = provider.normalizePost(rawPost, {
            id: account.id,
            handle: account.handle,
            displayName: account.displayName,
            category: account.category,
            tags: account.tags,
            provider: account.provider,
          });

          const existing = await prisma.post.findUnique({
            where: {
              provider_externalPostId: {
                provider: normalized.provider,
                externalPostId: normalized.externalPostId,
              },
            },
            select: { id: true },
          });

          const post = await prisma.post.upsert({
            where: {
              provider_externalPostId: {
                provider: normalized.provider,
                externalPostId: normalized.externalPostId,
              },
            },
            update: {
              accountId: account.id,
              content: normalized.content,
              postedAt: normalized.postedAt,
              sourceUrl: normalized.sourceUrl,
              likeCount: normalized.likeCount,
              replyCount: normalized.replyCount,
              repostCount: normalized.repostCount,
              quoteCount: normalized.quoteCount,
              fetchedAt: new Date(),
              rawPayload: normalized.rawPayload,
              engagementScore: engagementScore(normalized),
            },
            create: {
              provider: normalized.provider,
              externalPostId: normalized.externalPostId,
              accountId: account.id,
              content: normalized.content,
              postedAt: normalized.postedAt,
              sourceUrl: normalized.sourceUrl,
              likeCount: normalized.likeCount,
              replyCount: normalized.replyCount,
              repostCount: normalized.repostCount,
              quoteCount: normalized.quoteCount,
              fetchedAt: new Date(),
              rawPayload: normalized.rawPayload,
              engagementScore: engagementScore(normalized),
            },
            select: { id: true },
          });

          if (existing) {
            result.deduplicatedPosts += 1;
            continue;
          }

          result.insertedPosts += 1;

          const summarized = await summarizePostIfMissing(post.id);
          if (summarized) {
            result.summarizedPosts += 1;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown ingestion error';
        result.errors.push({ accountHandle: account.handle, message });
      }
    }

    if (result.errors.length > 0) {
      result.status = result.accountsProcessed > 0 ? 'PARTIAL' : 'FAILED';
    }
  } catch (error) {
    result.status = 'FAILED';
    result.errors.push({
      accountHandle: 'SYSTEM',
      message: error instanceof Error ? error.message : 'Unhandled ingestion pipeline error',
    });
  }

  await prisma.ingestionRun.update({
    where: { id: run.id },
    data: {
      status: result.status,
      finishedAt: new Date(),
      notes:
        result.status === 'SUCCESS'
          ? `Completed successfully. Inserted ${result.insertedPosts} new posts.`
          : `Completed with issues. ${result.errors.length} account errors.`,
      stats: {
        accountsProcessed: result.accountsProcessed,
        fetchedPosts: result.fetchedPosts,
        insertedPosts: result.insertedPosts,
        summarizedPosts: result.summarizedPosts,
        deduplicatedPosts: result.deduplicatedPosts,
        errorCount: result.errors.length,
      },
    },
  });

  return result;
}
