import { WatchlistKey as DbWatchlistKey } from "@prisma/client";
import type { WatchlistKey } from "@/lib/types";

const UI_TO_DB: Record<WatchlistKey, DbWatchlistKey> = {
  all: DbWatchlistKey.ALL,
  priority: DbWatchlistKey.PRIORITY,
  competitors: DbWatchlistKey.COMPETITORS,
  founders: DbWatchlistKey.FOUNDERS,
  media: DbWatchlistKey.MEDIA,
  ecosystem: DbWatchlistKey.ECOSYSTEM,
};

const DB_TO_UI: Record<DbWatchlistKey, WatchlistKey> = {
  [DbWatchlistKey.ALL]: "all",
  [DbWatchlistKey.PRIORITY]: "priority",
  [DbWatchlistKey.COMPETITORS]: "competitors",
  [DbWatchlistKey.FOUNDERS]: "founders",
  [DbWatchlistKey.MEDIA]: "media",
  [DbWatchlistKey.ECOSYSTEM]: "ecosystem",
};

export function toDbWatchlistKey(value: WatchlistKey) {
  return UI_TO_DB[value];
}

export function fromDbWatchlistKey(value: DbWatchlistKey): WatchlistKey {
  return DB_TO_UI[value];
}

export function isWatchlistKey(value: string): value is WatchlistKey {
  return ["all", "priority", "competitors", "founders", "media", "ecosystem"].includes(value);
}
