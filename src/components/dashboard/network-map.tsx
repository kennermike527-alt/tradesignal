"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type cytoscape from "cytoscape";
import { AccountCategory } from "@prisma/client";
import { Activity, ArrowRightLeft, Link2, Network, Orbit, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardAccount, DashboardPost, IntelligenceCenter, SourcePlatform } from "@/lib/types";
import { buildSignalNetwork } from "@/lib/dashboard/network";

const CytoscapeComponent = dynamic(() => import("react-cytoscapejs"), {
  ssr: false,
});

type Props = {
  posts: DashboardPost[];
  accounts: DashboardAccount[];
  selectedAccountId: string;
  centerFocus: IntelligenceCenter;
  sourceTab: SourcePlatform;
  onSelectAccount: (accountId: string) => void;
};

type HoverState = {
  id: string;
  label: string;
  handle: string;
  category: AccountCategory;
  influence: number;
  postCount: number;
  recentPostCount: number;
};

const HUB_IOTA = "__hub_iota__";
const HUB_TWIN = "__hub_twin__";

const CATEGORY_COLORS: Record<AccountCategory, string> = {
  ECOSYSTEM: "#74a3ff",
  COMPETITOR: "#ff6c83",
  MEDIA: "#63d9b0",
  INFLUENCER: "#f3bc63",
  FOUNDER: "#cb8dff",
};

const CATEGORY_ORDER: AccountCategory[] = [
  AccountCategory.ECOSYSTEM,
  AccountCategory.COMPETITOR,
  AccountCategory.MEDIA,
  AccountCategory.FOUNDER,
  AccountCategory.INFLUENCER,
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function categoryAngle(category: AccountCategory) {
  const index = Math.max(0, CATEGORY_ORDER.indexOf(category));
  const sector = (Math.PI * 2) / CATEGORY_ORDER.length;
  return -Math.PI / 2 + index * sector;
}

function computePresetPositions(
  nodes: Array<{ id: string; category: AccountCategory; influenceScore: number }>,
  maxInfluence: number
) {
  const positions: Record<string, { x: number; y: number }> = {
    [HUB_IOTA]: { x: -48, y: 6 },
    [HUB_TWIN]: { x: 48, y: 6 },
  };

  const groups = new Map<AccountCategory, Array<{ id: string; influenceScore: number }>>();
  for (const category of CATEGORY_ORDER) groups.set(category, []);

  for (const node of nodes) {
    groups.get(node.category)?.push({ id: node.id, influenceScore: node.influenceScore });
  }

  for (const category of CATEGORY_ORDER) {
    const group = (groups.get(category) ?? []).sort((a, b) => b.influenceScore - a.influenceScore);
    if (group.length === 0) continue;

    const centerAngle = categoryAngle(category);
    const spread = Math.max(0.45, Math.min(1.25, group.length * 0.08));

    group.forEach((node, index) => {
      const t = group.length === 1 ? 0 : index / (group.length - 1);
      const angle = centerAngle - spread / 2 + t * spread;
      const normalized = node.influenceScore / maxInfluence;
      const radius = 230 + (1 - normalized) * 125 + (index % 3) * 10;

      positions[node.id] = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    });
  }

  return positions;
}

export function NetworkMap({ posts, accounts, selectedAccountId, centerFocus, sourceTab, onSelectAccount }: Props) {
  const [hovered, setHovered] = React.useState<HoverState | null>(null);

  const network = React.useMemo(() => buildSignalNetwork(posts, accounts), [posts, accounts]);

  const maxInfluence = React.useMemo(() => {
    const max = network.nodes.reduce((best, node) => Math.max(best, node.influenceScore), 1);
    return Math.max(1, max);
  }, [network.nodes]);

  const referenceNow = React.useMemo(
    () => posts.reduce((maxTs, post) => Math.max(maxTs, post.postedAt.getTime()), 0),
    [posts]
  );
  const recentCutoff = referenceNow - 2 * 60 * 60 * 1000;
  const recentPostCount = React.useMemo(
    () => posts.filter((post) => post.postedAt.getTime() >= recentCutoff).length,
    [posts, recentCutoff]
  );

  const nodesById = React.useMemo(() => {
    return new Map(network.nodes.map((node) => [node.id, node]));
  }, [network.nodes]);

  const positions = React.useMemo(() => {
    return computePresetPositions(network.nodes, maxInfluence);
  }, [network.nodes, maxInfluence]);

  const elements = React.useMemo(() => {
    const nodeEls = network.nodes.map((node) => {
      const normalized = node.influenceScore / maxInfluence;
      const size = clamp(22 + normalized * 34, 22, 60);

      return {
        data: {
          id: node.id,
          label: node.label,
          handle: `@${node.handle}`,
          category: node.category,
          postCount: node.postCount,
          recentPostCount: node.recentPostCount,
          influence: Math.round(node.influenceScore),
          color: CATEGORY_COLORS[node.category],
          size,
        },
        classes: node.id === selectedAccountId ? "selected" : "",
      };
    });

    const iotaHub = {
      data: {
        id: HUB_IOTA,
        label: "IOTA",
        handle: "center",
        category: AccountCategory.ECOSYSTEM,
        postCount: posts.filter((post) => post.center === "IOTA").length,
        recentPostCount,
        influence: Math.max(100, Math.round(maxInfluence * 0.35)),
        color: "#52a7ff",
        size: centerFocus === "IOTA" ? 90 : 78,
      },
      classes: centerFocus === "IOTA" ? "hub hub-active" : "hub",
    };

    const twinHub = {
      data: {
        id: HUB_TWIN,
        label: "TWIN",
        handle: "center",
        category: AccountCategory.ECOSYSTEM,
        postCount: posts.filter((post) => post.center === "TWIN").length,
        recentPostCount,
        influence: Math.max(100, Math.round(maxInfluence * 0.32)),
        color: "#f5b84d",
        size: centerFocus === "TWIN" ? 90 : 78,
      },
      classes: centerFocus === "TWIN" ? "hub hub-active" : "hub",
    };

    const edgeEls = network.edges.map((edge) => {
      const shared = edge.sharedNarratives.length;
      return {
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          weight: edge.weight,
          narrativeCount: shared,
          color: shared > 0 ? "#8e82ff" : "#4d6f92",
        },
      };
    });

    const hubEdges = network.nodes.flatMap((node) => [
      {
        data: {
          id: `hub-iota-${node.id}`,
          source: HUB_IOTA,
          target: node.id,
          weight: node.id === selectedAccountId ? 1.1 : 0.55,
          narrativeCount: 0,
          color: "#315579",
        },
        classes: "hub-edge",
      },
      {
        data: {
          id: `hub-twin-${node.id}`,
          source: HUB_TWIN,
          target: node.id,
          weight: node.id === selectedAccountId ? 1.1 : 0.55,
          narrativeCount: 0,
          color: "#5a4a35",
        },
        classes: "hub-edge",
      },
    ]);

    const bridge = {
      data: {
        id: "hub-bridge",
        source: HUB_IOTA,
        target: HUB_TWIN,
        weight: 3,
        narrativeCount: 0,
        color: "#8fa3c5",
      },
      classes: "hub-bridge",
    };

    return [iotaHub, twinHub, ...nodeEls, bridge, ...hubEdges, ...edgeEls];
  }, [network, maxInfluence, selectedAccountId, posts, recentPostCount, centerFocus]);

  const setCy = React.useCallback(
    (instance: unknown) => {
      const cy = instance as cytoscape.Core;

      cy.off("mouseover", "node");
      cy.off("mouseout", "node");
      cy.off("tap", "node");
      cy.off("tap");

      cy.on("mouseover", "node", (event) => {
        const id = event.target.id();
        if (id === HUB_IOTA || id === HUB_TWIN) {
          const centerName: IntelligenceCenter = id === HUB_IOTA ? "IOTA" : "TWIN";
          setHovered({
            id,
            label: centerName,
            handle: "center",
            category: AccountCategory.ECOSYSTEM,
            influence: Math.round(network.nodes.reduce((sum, n) => sum + n.influenceScore, 0)),
            postCount: posts.filter((post) => post.center === centerName).length,
            recentPostCount,
          });
          return;
        }

        const node = nodesById.get(id);
        if (!node) return;

        setHovered({
          id: node.id,
          label: node.label,
          handle: node.handle,
          category: node.category,
          influence: Math.round(node.influenceScore),
          postCount: node.postCount,
          recentPostCount: node.recentPostCount,
        });
      });

      cy.on("mouseout", "node", () => {
        setHovered(null);
      });

      cy.on("tap", "node", (event) => {
        const id = event.target.id();
        if (id === HUB_IOTA || id === HUB_TWIN) {
          onSelectAccount("all");
          return;
        }
        onSelectAccount(id);
      });

      cy.on("tap", (event) => {
        if (event.target === cy) setHovered(null);
      });
    },
    [nodesById, onSelectAccount, network.nodes, posts, recentPostCount]
  );

  const clusterSignal = network.edges.filter((edge) => edge.sharedNarratives.length > 0).length;

  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
            {centerFocus} center constellation · {sourceTab === "X" ? "X" : "LinkedIn"}
          </CardTitle>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/50 px-2 py-0.5">
              <UserRound className="size-3" /> {network.nodes.length} nodes
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/50 px-2 py-0.5">
              <Link2 className="size-3" /> {network.edges.length} edges
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/50 px-2 py-0.5">
              <Orbit className="size-3" /> {clusterSignal} narrative links
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-2 pt-0">
        <div
          className="h-[360px] overflow-hidden rounded border border-border/70"
          style={{
            background:
              "radial-gradient(circle at center, rgba(23,35,61,0.95) 0%, rgba(7,13,28,0.98) 65%), radial-gradient(circle at 10% 10%, rgba(121,88,255,0.16), transparent 35%)",
          }}
        >
          <CytoscapeComponent
            elements={elements}
            style={{ width: "100%", height: "100%" }}
            cy={setCy}
            wheelSensitivity={0.16}
            minZoom={0.5}
            maxZoom={2.2}
            layout={{
              name: "preset",
              positions,
              fit: true,
              padding: 20,
            }}
            stylesheet={[
              {
                selector: "node",
                style: {
                  "background-color": "data(color)",
                  width: "data(size)",
                  height: "data(size)",
                  label: "data(label)",
                  "text-max-width": 72,
                  "text-wrap": "wrap",
                  color: "#dbe4ff",
                  "font-size": 8,
                  "font-weight": 600,
                  "text-valign": "bottom",
                  "text-halign": "center",
                  "text-margin-y": 8,
                  "border-width": 1.5,
                  "border-color": "#bfd0ff",
                  "shadow-color": "data(color)",
                  "shadow-opacity": 0.45,
                  "shadow-blur": 15,
                },
              },
              {
                selector: "node.hub",
                style: {
                  "background-color": "#090f1c",
                  "border-width": 3,
                  "font-size": 11,
                  "font-weight": 700,
                  "text-margin-y": 12,
                  "shadow-opacity": 0.8,
                  "shadow-blur": 24,
                },
              },
              {
                selector: "node.hub-active",
                style: {
                  "border-color": "#ffffff",
                },
              },
              {
                selector: "node.selected",
                style: {
                  "border-width": 3,
                  "border-color": "#ffffff",
                },
              },
              {
                selector: "edge",
                style: {
                  width: "mapData(weight, 1, 24, 1, 4.5)",
                  "line-color": "data(color)",
                  opacity: 0.52,
                  "curve-style": "bezier",
                },
              },
              {
                selector: "edge.hub-edge",
                style: {
                  width: 1,
                  opacity: 0.22,
                  "line-style": "dotted",
                },
              },
              {
                selector: "edge.hub-bridge",
                style: {
                  width: 2,
                  opacity: 0.5,
                  "line-style": "solid",
                },
              },
            ]}
          />
        </div>

        <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
          <div className="rounded border border-border/70 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground">
            Hover a node for details. Click account nodes to filter feed. IOTA + TWIN hubs stay centered.
          </div>
          <button
            onClick={() => onSelectAccount("all")}
            className="inline-flex items-center justify-center gap-1 rounded border border-border/70 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <ArrowRightLeft className="size-3" /> Clear account filter
          </button>
        </div>

        {hovered ? (
          <div className="grid gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-1 text-[11px]">
            <p className="font-semibold text-foreground">
              {hovered.label} <span className="text-muted-foreground">@{hovered.handle}</span>
            </p>
            <p className="text-muted-foreground">
              {hovered.category} · influence {hovered.influence} · posts {hovered.postCount} · recent {hovered.recentPostCount}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
          {Object.entries(CATEGORY_COLORS).map(([category, color]) => (
            <span key={category} className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/40 px-2 py-0.5">
              <Activity className="size-2.5" style={{ color }} /> {category.toLowerCase()}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/40 px-2 py-0.5">
            <Network className="size-2.5" /> edges: mentions + replies + shared narratives
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
