import React from "react";
import { Box, Text } from "ink";
import type { NodeWithRelations } from "../../core/types.js";

export interface NodeListProps {
  nodes: NodeWithRelations[];
  selectedIndex: number;
  focused: boolean;
  loading: boolean;
  error: string | null;
}

export function NodeList({ nodes, selectedIndex, focused, loading, error }: NodeListProps) {
  const borderColor = focused ? "cyan" : undefined;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={borderColor}
      flexGrow={1}
      overflow="hidden"
    >
      <Text bold underline>
        {" "}
        Nodes {focused ? "(active)" : ""}
      </Text>
      {loading && <Text color="yellow"> Loading...</Text>}
      {error && <Text color="red"> Error: {error}</Text>}
      {!loading && !error && nodes.length === 0 && <Text color="gray"> No nodes found.</Text>}
      {!loading &&
        !error &&
        nodes.map((node, index) => {
          const isSelected = index === selectedIndex;
          const prefix = isSelected ? "> " : "  ";
          const tags = node.tags.length > 0 ? ` [${node.tags.join(",")}]` : "";
          const bodyPreview = node.body.slice(0, 40).replace(/\n/g, " ");
          const color = isSelected ? (focused ? "cyan" : "white") : undefined;
          return (
            <Box key={node.id}>
              <Text color={color} bold={isSelected} inverse={isSelected && focused}>
                {prefix}
                <Text bold>{node.kind}</Text>
                {tags}
                {"  "}
                {bodyPreview}
              </Text>
            </Box>
          );
        })}
    </Box>
  );
}
