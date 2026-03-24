import { IngestionStatus, Prisma, SocialProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/providers";
import { getDatabaseHealth } from "@/lib/runtime/db-health";
import { generatePostSummary } from "@/lib/summary/summary-service";
import type { IngestionOutcome, NormalizedSocialPost } from "@/lib/types";

type IngestOptions = {
  provider?: SocialProvider;
  generateSummaries?: boolean;
  initiatedBy?: "manual" | "cron" | "script";
};

function normalizeForCreate(post: NormalizedSocialPost): Omit<Prisma.PostCreateInput, "account"> {
  return {
    provider: post.provider,
    externalPostId: post.externalPostId,
    content: post.content,
    postedAt: post.postedAt,
    sourceUrl: post.sourceUrl,
    likeCount: post.likeCount,
    replyCount: post.replyCount,
    repostCount: post.repostCount,
    quoteCount: post.quoteCount ?? null,
    fetchedAt: new Date(),
    rawPayload: (post.rawPayload as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
  };
}

function baseFailure(code: IngestionOutcome["errorCode"], message: string): IngestionOutcome {
  return {
    runId: "unavailable",
    status: IngestionStatus.FAILED,
    accountsProcessed: 0,
    postsFetched: 0,
    postsInserted: 0,
    summariesGenerated: 0,
    errorCode: code,
    errors: [message],
  };
}

export async function ingestLatestPosts(options: IngestOptions = {}): Promise<IngestionOutcome> {
  const provider = options.provider ?? SocialProvider.X;
  const generateSummaries = options.generateSummaries ?? true;

  const dbHealth = await getDatabaseHealth();
  if (!dbHealth.ok) {
    return baseFailure(
      dbHealth.code === "MISSING_DATABASE_URL" ? "DB_URL_MISSING" : "DB_UNREACHABLE",
      dbHealth.message
    );
  }

  let run;

  try {
    run = await db.ingestionRun.create({
      data: {
        provider,
        status: IngestionStatus.RUNNING,
        notes: options.initiatedBy ? `initiatedBy=${options.initiatedBy}` : undefined,
      },
    });
  } catch {
    return baseFailure("DB_UNREACHABLE", "Unable to initialize ingestion run record.");
  }

  const result: IngestionOutcome = {
    runId: run.id,
    status: IngestionStatus.SUCCESS,
    accountsProcessed: 0,
    postsFetched: 0,
    postsInserted: 0,
    summariesGenerated: 0,
    errors: [],
    errorCode: "NONE",
  };

  try {
    const providerImpl = getProvider(provider);
    const accounts = await db.account.findMany({
      where: { provider, isActive: true },
      select: {
        id: true,
        displayName: true,
        handle: true,
        category: true,
        tags: true,
        isActive: true,
        provider: true,
      },
      orderBy: { displayName: "asc" },
    });

    for (const account of accounts) {
      result.accountsProcessed += 1;

      try {
        const posts = await providerImpl.fetchLatestPostsForAccount(account);
        result.postsFetched += posts.length;

        for (const normalized of posts) {
          const existing = await db.post.findUnique({
            where: {
              provider_externalPostId: {
                provider: normalized.provider,
                externalPostId: normalized.externalPostId,
              },
            },
            select: { id: true },
          });

          if (existing) continue;

          const createdPost = await db.post.create({
            data: {
              ...normalizeForCreate(normalized),
              account: { connect: { id: account.id } },
            },
          });

          result.postsInserted += 1;

          if (generateSummaries) {
            const summaryPayload = await generatePostSummary({
              post: createdPost,
              account,
            });

            await db.postSummary.create({
              data: {
                postId: createdPost.id,
                summary: summaryPayload.summary,
                model: summaryPayload.model,
              },
            });

            result.summariesGenerated += 1;
          }
        }
      } catch {
        result.errors.push(`Unable to ingest account ${account.handle}.`);
      }
    }

    if (result.errors.length > 0) {
      result.status = result.postsInserted > 0 ? IngestionStatus.PARTIAL : IngestionStatus.FAILED;
      result.errorCode = "INGESTION_FAILURE";
    }

    await db.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: result.status,
        finishedAt: new Date(),
        notes:
          result.errors.length > 0
            ? `${result.errors.length} account(s) had ingestion issues.`
            : `Processed ${result.accountsProcessed} accounts`,
        metadata: {
          accountsProcessed: result.accountsProcessed,
          postsFetched: result.postsFetched,
          postsInserted: result.postsInserted,
          summariesGenerated: result.summariesGenerated,
          provider: provider,
          errorCount: result.errors.length,
        },
      },
    });

    return result;
  } catch {
    await db.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: IngestionStatus.FAILED,
        finishedAt: new Date(),
        notes: "Ingestion failed due to internal processing error.",
      },
    });

    return baseFailure("INGESTION_FAILURE", "Ingestion processing failed.");
  }
}
