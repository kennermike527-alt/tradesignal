import { ingestLatestPosts } from "../lib/ingestion/ingest-service";

async function main() {
  const result = await ingestLatestPosts({ initiatedBy: "script", generateSummaries: true });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
