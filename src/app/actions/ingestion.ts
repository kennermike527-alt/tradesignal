"use server";

import { revalidatePath } from "next/cache";
import { ingestLatestPosts } from "@/lib/ingestion/ingest-service";

export async function runIngestionAction() {
  const result = await ingestLatestPosts({ initiatedBy: "manual", generateSummaries: true });
  revalidatePath("/");
  return result;
}
