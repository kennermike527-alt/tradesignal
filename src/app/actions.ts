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

  if (code === "BUDGET_GUARD_BLOCK") {
    return "Ingestion blocked by budget guard. Increase cadence interval or reduce scope to stay within monthly cap.";
  }

  return "Ingestion did not complete. Please retry.";
}

export async function runManualIngestionAction(): Promise<ManualIngestResponse> {
  const result = await ingestLatestPosts({ initiatedBy: "manual", generateSummaries: true });

  if (result.status === "SUCCESS" || result.status === "PARTIAL") {
    revalidatePath("/");

    const budgetSuffix = result.budget
      ? ` Est. monthly API burn: $${result.budget.projectedMonthlyCostUsd.toFixed(2)} at ${result.budget.cadenceMinutes}m cadence.`
      : "";

    return {
      ok: true,
      message: `${result.status}: inserted ${result.postsInserted} posts, generated ${result.summariesGenerated} summaries.${budgetSuffix}`,
      runId: result.runId,
    };
  }

  return {
    ok: false,
    message: `${userMessageFromCode(result.errorCode)}${
      result.budget
        ? ` Current estimate: $${result.budget.projectedMonthlyCostUsd.toFixed(2)}/mo at ${
            result.budget.cadenceMinutes
          }m cadence (min ${result.budget.minimumCadenceMinutes}m).`
        : ""
    }`,
  };
}
