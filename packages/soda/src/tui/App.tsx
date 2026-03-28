import React, { useCallback, useState } from "react";
import { Box, useApp, useInput } from "ink";
import { FilterBar, parseFilter } from "./components/FilterBar.js";
import { NodeList } from "./components/NodeList.js";
import { NodeDetail } from "./components/NodeDetail.js";
import { LinkList } from "./components/LinkList.js";
import { StatusBar } from "./components/StatusBar.js";
import { useNodes } from "./hooks/useNodes.js";
import { useNavigation } from "./hooks/useNavigation.js";
import { copyToClipboard, launchClaude } from "./actions.js";

export function App() {
  const { exit } = useApp();
  const [filterInput, setFilterInput] = useState("");
  const filter = parseFilter(filterInput);

  const { nodes, loading, error } = useNodes(filter);

  const nav = useNavigation();

  const selectedNode = nodes[nav.selectedListIndex] ?? null;

  const handleNavigate = useCallback(
    (
      input: string,
      key: { upArrow: boolean; downArrow: boolean; tab: boolean; escape: boolean; return: boolean },
    ) => {
      if (input === "q") {
        exit();
        return;
      }

      if (input === "/") {
        nav.focusFilter();
        return;
      }

      if (key.tab) {
        nav.cyclePanel();
        return;
      }

      if (input === "j" || key.downArrow) {
        if (nav.activePanel === "list") {
          nav.navigateDown(nodes.length);
        } else if (nav.activePanel === "links") {
          const allLinks = selectedNode
            ? [...selectedNode.links_from, ...selectedNode.links_to]
            : [];
          nav.navigateDown(allLinks.length);
        }
        return;
      }

      if (input === "k" || key.upArrow) {
        nav.navigateUp();
        return;
      }

      if (key.return) {
        if (nav.activePanel === "list" && selectedNode) {
          // Node is already selected by index, nothing extra needed
        } else if (nav.activePanel === "links" && selectedNode) {
          const allLinks = [...selectedNode.links_from, ...selectedNode.links_to];
          const targetLink = allLinks[nav.selectedLinkIndex];
          if (targetLink) {
            const targetId =
              targetLink.from_id === selectedNode.id ? targetLink.to_id : targetLink.from_id;
            const targetIndex = nodes.findIndex((n) => n.id === targetId);
            if (targetIndex >= 0) {
              nav.setSelectedListIndex(targetIndex);
              nav.setActivePanel("list");
              nav.resetLinkIndex();
            }
          }
        }
        return;
      }

      if (input === "b") {
        const nodeInfo = selectedNode
          ? `Node: ${selectedNode.kind} - ${selectedNode.body.slice(0, 100)}`
          : "No node selected";
        launchClaude(exit, `Brainstorm ideas related to: ${nodeInfo}`);
        return;
      }

      if (input === "r") {
        launchClaude(exit, "Review all todo nodes and suggest priorities.");
        return;
      }

      if (input === "y") {
        if (selectedNode) {
          const text = [
            `ID: ${selectedNode.id}`,
            `Kind: ${selectedNode.kind}`,
            `Tags: ${selectedNode.tags.join(", ")}`,
            `Body: ${selectedNode.body}`,
          ].join("\n");
          copyToClipboard(text);
        }
        return;
      }
    },
    [nav, nodes, selectedNode, exit],
  );

  useInput(handleNavigate, { isActive: !nav.filterFocused });

  useInput(
    (_input, key) => {
      if (key.escape) {
        nav.blurFilter();
      }
    },
    { isActive: nav.filterFocused },
  );

  const handleFilterChange = (value: string) => {
    setFilterInput(value);
  };

  return (
    <Box flexDirection="column" flexGrow={1}>
      <FilterBar
        value={filterInput}
        onChange={handleFilterChange}
        focused={nav.filterFocused}
        onBlur={nav.blurFilter}
      />
      <Box flexDirection="row" flexGrow={1}>
        <NodeList
          nodes={nodes}
          selectedIndex={nav.selectedListIndex}
          focused={nav.activePanel === "list" && !nav.filterFocused}
          loading={loading}
          error={error}
        />
        <NodeDetail
          node={selectedNode}
          focused={nav.activePanel === "detail" && !nav.filterFocused}
        />
        <LinkList
          linksFrom={selectedNode?.links_from ?? []}
          linksTo={selectedNode?.links_to ?? []}
          selectedIndex={nav.selectedLinkIndex}
          focused={nav.activePanel === "links" && !nav.filterFocused}
        />
      </Box>
      <StatusBar filterFocused={nav.filterFocused} />
    </Box>
  );
}
