import { promises as fs } from "node:fs";
import path from "node:path";
import { AccountCategory, SocialProvider } from "@prisma/client";
import { db } from "@/lib/db";

type WatchlistCsvRow = {
  platform: string;
  handle: string;
  url: string;
  priority: string;
  notes: string;
};

type SyncOptions = {
  provider?: SocialProvider;
};

type SyncResult = {
  csvPath: string;
  rowsRead: number;
  matchedRows: number;
  created: number;
  reactivated: number;
  skipped: number;
};

const DEFAULT_RELATIVE = path.join("..", "mission-control", "jobs", "social-watchlist.tradesignal.csv");

function resolveCsvPath() {
  const override = process.env.TRADESIGNAL_WATCHLIST_CSV_PATH?.trim();
  if (override) return override;
  return path.resolve(process.cwd(), DEFAULT_RELATIVE);
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  out.push(current);
  return out.map((v) => v.trim());
}

function parseCsv(content: string): WatchlistCsvRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = {
    platform: header.indexOf("platform"),
    handle: header.indexOf("handle"),
    url: header.indexOf("url"),
    priority: header.indexOf("priority"),
    notes: header.indexOf("notes"),
  };

  const rows: WatchlistCsvRow[] = [];

  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    rows.push({
      platform: idx.platform >= 0 ? cols[idx.platform] ?? "" : "",
      handle: idx.handle >= 0 ? cols[idx.handle] ?? "" : "",
      url: idx.url >= 0 ? cols[idx.url] ?? "" : "",
      priority: idx.priority >= 0 ? cols[idx.priority] ?? "" : "",
      notes: idx.notes >= 0 ? cols[idx.notes] ?? "" : "",
    });
  }

  return rows;
}

function providerFromPlatform(platform: string): SocialProvider | null {
  const p = platform.trim().toLowerCase();
  if (p === "x") return SocialProvider.X;
  if (p === "linkedin") return SocialProvider.LINKEDIN;
  return null;
}

function normalizeHandle(raw: string) {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

function extractHandleFromUrl(url: string, provider: SocialProvider): string {
  try {
    const u = new URL(url);
    const parts = decodeURIComponent(u.pathname)
      .split("/")
      .map((p) => p.trim())
      .filter(Boolean);

    if (provider === SocialProvider.X) {
      return normalizeHandle(parts[0] ?? "");
    }

    if (parts[0] === "company" || parts[0] === "showcase" || parts[0] === "school") {
      return normalizeHandle(parts[1] ?? "");
    }

    return normalizeHandle(parts[parts.length - 1] ?? "");
  } catch {
    return "";
  }
}

function titleCase(handle: string) {
  return handle
    .split(/[-_]+/)
    .map((token) => (token ? token[0].toUpperCase() + token.slice(1) : token))
    .join(" ");
}

export async function syncAccountsFromWatchlistCsv(options: SyncOptions = {}): Promise<SyncResult> {
  const csvPath = resolveCsvPath();

  const raw = await fs.readFile(csvPath, "utf-8");
  const parsed = parseCsv(raw);

  const deduped = new Map<string, { provider: SocialProvider; handle: string }>();

  for (const row of parsed) {
    const provider = providerFromPlatform(row.platform);
    if (!provider) continue;
    if (options.provider && provider !== options.provider) continue;

    const handle = normalizeHandle(row.handle) || extractHandleFromUrl(row.url, provider);
    if (!handle) continue;

    deduped.set(`${provider}:${handle}`, { provider, handle });
  }

  let created = 0;
  let reactivated = 0;

  const rows = [...deduped.values()];

  for (const row of rows) {
    const where = {
      provider_handle: {
        provider: row.provider,
        handle: row.handle,
      },
    } as const;

    const existing = await db.account.findUnique({
      where,
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!existing) {
      await db.account.create({
        data: {
          provider: row.provider,
          handle: row.handle,
          displayName: titleCase(row.handle),
          category: AccountCategory.ECOSYSTEM,
          tags: ["watchlist", "trade-news", "csv-import"],
          isActive: true,
        },
      });
      created += 1;
      continue;
    }

    if (!existing.isActive) {
      await db.account.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
      reactivated += 1;
    }
  }

  return {
    csvPath,
    rowsRead: parsed.length,
    matchedRows: rows.length,
    created,
    reactivated,
    skipped: parsed.length - rows.length,
  };
}
