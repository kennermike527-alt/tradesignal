"use server";

import { revalidatePath } from "next/cache";
import { ingestLatestPosts } from "@/lib/ingestion/ingest-service";

type ManualIngestResponse = {
  ok: boolean;
  message: string;
  runId?: string;
};

export async function runManualIngestionAction(): Promise<ManualIngestResponse> {
  try {
    const result = await ingestLatestPosts({ initiatedBy: "manual", generateSummaries: true });
    revalidatePath("/");

    return {
      ok: result.status === "SUCCESS" || result.status === "PARTIAL",
      message: `${result.status}: inserted ${result.postsInserted} posts, generated ${result.summariesGenerated} summaries.`,
      runId: result.runId,
    };
  } catch (error) {
    return {
      ok: false,
      message: `FAILED: ${(error as Error).message || "unknown error"}`,
    };
  }
}
