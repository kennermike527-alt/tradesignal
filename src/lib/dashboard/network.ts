import { AccountCategory } from "@prisma/client";
import type { DashboardAccount, DashboardPost } from "@/lib/types";

const narrativePatterns = [
  { id: "policy", test: /policy|regulat|compliance/i },
  { id: "partnership", test: /partner|integrat|alliance/i },
  { id: "liquidity", test: /liquidity|flow|volume/i },
  { id: "governance", test: /governance|proposal|vote/i },
  { id: "execution", test: /ship|release|deployed|roadmap/i },
  { id: "distribution", test: /distribution|growth|audience|reach/i },
];

export type SignalNode = {
  id: string;
  label: string;
  handle: string;
  category: AccountCategory;
  postCount: number;
  recentPostCount: number;
  influenceScore: number;
  lastSeenAt: Date | null;
};

export type SignalEdge = {
  id: string;
  source: string;
  target: string;
  weight: number;
  mentionCount: number;
  replyCount: number;
  sharedNarratives: string[];
};

export type SignalNetwork = {
  nodes: SignalNode[];
  edges: SignalEdge[];
};

function engagementScore(post: DashboardPost) {
  return post.likeCount + post.replyCount * 2 + post.repostCount * 3 + post.quoteCount * 2;
}

function detectNarratives(post: DashboardPost) {
  const text = `${post.content} ${post.summary?.summary ?? ""}`;
  return narrativePatterns.filter((pattern) => pattern.test.test(text)).map((pattern) => pattern.id);
}

function edgeKey(source: string, target: string) {
  return source < target ? `${source}::${target}` : `${target}::${source}`;
}

function ensureEdge(map: Map<string, SignalEdge>, source: string, target: string): SignalEdge {
  const key = edgeKey(source, target);
  const existing = map.get(key);
  if (existing) return existing;

  const created: SignalEdge = {
    id: key,
    source: source < target ? source : target,
    target: source < target ? target : source,
    weight: 0,
    mentionCount: 0,
    replyCount: 0,
    sharedNarratives: [],
  };

  map.set(key, created);
  return created;
}

export function buildSignalNetwork(posts: DashboardPost[], accounts: DashboardAccount[]): SignalNetwork {
  const accountByHandle = new Map(accounts.map((account) => [account.handle.toLowerCase(), account]));

  const nodeStats = new Map(
    accounts.map((account) => [
      account.id,
      {
        postCount: 0,
        recentPostCount: 0,
        influenceScore: 0,
        lastSeenAt: null as Date | null,
        narratives: new Set<string>(),
      },
    ])
  );

  const edgeMap = new Map<string, SignalEdge>();
  const now = Date.now();
  const twoHoursAgo = now - 2 * 60 * 60 * 1000;

  for (const post of posts) {
    const stats = nodeStats.get(post.accountId);
    if (!stats) continue;

    stats.postCount += 1;
    stats.influenceScore += engagementScore(post);

    if (post.postedAt.getTime() >= twoHoursAgo) {
      stats.recentPostCount += 1;
    }

    if (!stats.lastSeenAt || post.postedAt > stats.lastSeenAt) {
      stats.lastSeenAt = post.postedAt;
    }

    const detected = detectNarratives(post);
    for (const narrativeId of detected) {
      stats.narratives.add(narrativeId);
    }

    const text = `${post.content} ${post.summary?.summary ?? ""}`;
    const mentionMatches = Array.from(text.matchAll(/@([A-Za-z0-9_]{2,30})/g));
    const mentionedIds = new Set<string>();

    for (const match of mentionMatches) {
      const handle = match[1]?.toLowerCase();
      if (!handle) continue;
      const account = accountByHandle.get(handle);
      if (!account) continue;
      if (account.id === post.accountId) continue;
      mentionedIds.add(account.id);
    }

    for (const mentionedId of mentionedIds) {
      const edge = ensureEdge(edgeMap, post.accountId, mentionedId);
      edge.mentionCount += 1;
    }

    const firstMention = text.trim().match(/^@([A-Za-z0-9_]{2,30})/);
    if (firstMention?.[1]) {
      const repliedTo = accountByHandle.get(firstMention[1].toLowerCase());
      if (repliedTo && repliedTo.id !== post.accountId) {
        const edge = ensureEdge(edgeMap, post.accountId, repliedTo.id);
        edge.replyCount += 1;
      }
    }
  }

  const accountIds = accounts.map((account) => account.id);
  for (let i = 0; i < accountIds.length; i += 1) {
    for (let j = i + 1; j < accountIds.length; j += 1) {
      const left = nodeStats.get(accountIds[i]);
      const right = nodeStats.get(accountIds[j]);
      if (!left || !right) continue;

      const overlap = [...left.narratives].filter((narrativeId) => right.narratives.has(narrativeId));
      if (overlap.length === 0) continue;

      const edge = ensureEdge(edgeMap, accountIds[i], accountIds[j]);
      edge.sharedNarratives = Array.from(new Set([...edge.sharedNarratives, ...overlap]));
    }
  }

  const nodes: SignalNode[] = accounts.map((account) => {
    const stats = nodeStats.get(account.id)!;
    const influenceScore = Math.max(1, stats.influenceScore);

    return {
      id: account.id,
      label: account.displayName,
      handle: account.handle,
      category: account.category,
      postCount: stats.postCount,
      recentPostCount: stats.recentPostCount,
      influenceScore,
      lastSeenAt: stats.lastSeenAt,
    };
  });

  const edges: SignalEdge[] = [...edgeMap.values()]
    .map((edge) => {
      const narrativeWeight = edge.sharedNarratives.length * 2;
      const mentionWeight = edge.mentionCount * 3;
      const replyWeight = edge.replyCount * 4;
      const weight = mentionWeight + replyWeight + narrativeWeight;

      return {
        ...edge,
        weight,
      };
    })
    .filter((edge) => edge.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 260);

  return { nodes, edges };
}
