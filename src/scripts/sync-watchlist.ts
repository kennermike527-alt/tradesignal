import { SocialProvider } from "@prisma/client";
import { syncAccountsFromWatchlistCsv } from "@/lib/watchlist/csv-sync";

async function main() {
  const xResult = await syncAccountsFromWatchlistCsv({ provider: SocialProvider.X });
  const liResult = await syncAccountsFromWatchlistCsv({ provider: SocialProvider.LINKEDIN });

  console.log("[watchlist:sync] X", xResult);
  console.log("[watchlist:sync] LinkedIn", liResult);
}

main().catch((error) => {
  console.error("[watchlist:sync] failed", error);
  process.exit(1);
});
