"use server";

import { revalidatePath } from "next/cache";
import { ingestLatestPosts } from "@/lib/ingestion/ingest-service";

type ManualIngestResponse = {
  ok: boolean;
  message: string;
  runId?: string;
};

function userMessageFromCode(code: string) {
  if (code === "DB_URL_MISSING") {
    return "Ingestion offline: DATABASE_URL missing. Configure env + run npm run db:setup.";
  }

  if (code === "DB_UNREACHABLE") {
    return "Ingestion offline: database unreachable. Check database service and DATABASE_URL.";
  }

  if (code === "INGESTION_FAILURE") {
    return "Ingestion completed with issues. Review ingestion runs panel for status details.";
  }

  return "Ingestion did not complete. Please retry.";
}

export async function runManualIngestionAction(): Promise<ManualIngestResponse> {
  const result = await ingestLatestPosts({ initiatedBy: "manual", generateSummaries: true });

  if (result.status === "SUCCESS" || result.status === "PARTIAL") {
    revalidatePath("/");
    return {
      ok: true,
      message: `${result.status}: inserted ${result.postsInserted} posts, generated ${result.summariesGenerated} summaries.`,
      runId: result.runId,
    };
  }

  return {
    ok: false,
    message: userMessageFromCode(result.errorCode),
  };
}
