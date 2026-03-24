"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type cytoscape from "cytoscape";
import { AccountCategory } from "@prisma/client";
import { Activity, ArrowRightLeft, Compass, Link2, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardAccount, DashboardPost } from "@/lib/types";
import { buildSignalNetwork } from "@/lib/dashboard/network";

const CytoscapeComponent = dynamic(() => import("react-cytoscapejs"), {
  ssr: false,
});

type Props = {
  posts: DashboardPost[];
  accounts: DashboardAccount[];
  selectedAccountId: string;
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

const CATEGORY_COLORS: Record<AccountCategory, string> = {
  ECOSYSTEM: "#7c8cff",
  COMPETITOR: "#ff6b7a",
  MEDIA: "#7be3ba",
  INFLUENCER: "#f8bf69",
  FOUNDER: "#d596ff",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function NetworkMap({ posts, accounts, selectedAccountId, onSelectAccount }: Props) {
  const [hovered, setHovered] = React.useState<HoverState | null>(null);

  const network = React.useMemo(() => buildSignalNetwork(posts, accounts), [posts, accounts]);

  const maxInfluence = React.useMemo(() => {
    const max = network.nodes.reduce((best, node) => Math.max(best, node.influenceScore), 1);
    return Math.max(1, max);
  }, [network.nodes]);

  const nodesById = React.useMemo(() => {
    return new Map(network.nodes.map((node) => [node.id, node]));
  }, [network.nodes]);

  const elements = React.useMemo(() => {
    const nodeEls = network.nodes.map((node) => {
      const normalized = node.influenceScore / maxInfluence;
      const size = clamp(22 + normalized * 36, 22, 64);

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
          selected: node.id === selectedAccountId ? 1 : 0,
        },
      };
    });

    const edgeEls = network.edges.map((edge) => {
      const shared = edge.sharedNarratives.length;
      const labelParts: string[] = [];
      if (edge.mentionCount > 0) labelParts.push(`mentions ${edge.mentionCount}`);
      if (edge.replyCount > 0) labelParts.push(`replies ${edge.replyCount}`);
      if (shared > 0) labelParts.push(`shared ${shared}`);

      return {
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          weight: edge.weight,
          label: labelParts.join(" · "),
          color: shared > 0 ? "#8f7bff" : "#55607a",
        },
      };
    });

    return [...nodeEls, ...edgeEls];
  }, [network, maxInfluence, selectedAccountId]);

  const setCy = React.useCallback(
    (instance: unknown) => {
      const cy = instance as cytoscape.Core;
      cy.off("mouseover", "node");
      cy.off("mouseout", "node");
      cy.off("tap", "node");
      cy.off("tap");

      cy.on("mouseover", "node", (event) => {
        const id = event.target.id();
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
        onSelectAccount(event.target.id());
      });

      cy.on("tap", (event) => {
        if (event.target === cy) {
          setHovered(null);
        }
      });
    },
    [nodesById, onSelectAccount]
  );

  const clusterSignal = network.edges.filter((edge) => edge.sharedNarratives.length > 0).length;

  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Account interaction network</CardTitle>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/50 px-2 py-0.5">
              <UserRound className="size-3" /> {network.nodes.length} nodes
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/50 px-2 py-0.5">
              <Link2 className="size-3" /> {network.edges.length} edges
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-border/70 bg-background/50 px-2 py-0.5">
              <Compass className="size-3" /> {clusterSignal} cluster links
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-2 pt-0">
        <div className="h-[330px] overflow-hidden rounded border border-border/70 bg-background/60">
          <CytoscapeComponent
            elements={elements}
            style={{ width: "100%", height: "100%" }}
            cy={setCy}
            wheelSensitivity={0.18}
            minZoom={0.35}
            maxZoom={2.4}
            layout={{
              name: "cose",
              animate: false,
              padding: 30,
              nodeRepulsion: 7600,
              idealEdgeLength: 100,
              edgeElasticity: 180,
              gravity: 0.25,
              nestingFactor: 0.55,
              fit: true,
            }}
            stylesheet={[
              {
                selector: "node",
                style: {
                  "background-color": "data(color)",
                  label: "data(handle)",
                  width: "data(size)",
                  height: "data(size)",
                  color: "#cdd5f1",
                  "font-size": 9,
                  "text-valign": "bottom",
                  "text-halign": "center",
                  "text-margin-y": 7,
                  "text-background-opacity": 0,
                  "border-width": "mapData(selected, 0, 1, 1, 3)",
                  "border-color": "#cad2ff",
                },
              },
              {
                selector: "edge",
                style: {
                  width: "mapData(weight, 1, 22, 1, 6)",
                  "line-color": "data(color)",
                  opacity: 0.6,
                  "curve-style": "bezier",
                  "target-arrow-shape": "none",
                },
              },
              {
                selector: "node:hover",
                style: {
                  "border-width": 3,
                  "border-color": "#ffffff",
                },
              },
            ]}
          />
        </div>

        <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
          <div className="rounded border border-border/70 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground">
            Hover a node for context. Click a node to filter the feed by that account.
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
        </div>
      </CardContent>
    </Card>
  );
}
