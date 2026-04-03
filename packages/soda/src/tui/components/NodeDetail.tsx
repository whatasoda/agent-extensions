import React from "react";
import { Box, Text } from "ink";
import type { NodeWithRelations } from "../../core/types.js";

export interface NodeDetailProps {
  node: NodeWithRelations | null;
  focused: boolean;
}

export function NodeDetail({ node, focused }: NodeDetailProps) {
  const borderColor = focused ? "cyan" : undefined;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={borderColor}
      flexGrow={2}
      overflow="hidden"
    >
      <Text bold underline>
        {" "}
        Detail {focused ? "(active)" : ""}
      </Text>
      {node === null ? (
        <Text color="gray"> Select a node to view details.</Text>
      ) : (
        <>
          <Box paddingX={1} flexDirection="column">
            <Text>
              <Text bold>ID: </Text>
              {node.id}
            </Text>
            <Text>
              <Text bold>Kind: </Text>
              {node.kind}
            </Text>
            {node.tags.length > 0 && (
              <Text>
                <Text bold>Tags: </Text>
                {node.tags.join(", ")}
              </Text>
            )}
            <Text>
              <Text bold>Created: </Text>
              {node.created_at}
            </Text>
          </Box>
          <Box paddingX={1} flexDirection="column" marginTop={1}>
            <Text bold>Body:</Text>
            <Text>{node.body || "(empty)"}</Text>
          </Box>
          {Object.keys(node.properties).length > 0 && (
            <Box paddingX={1} flexDirection="column" marginTop={1}>
              <Text bold>Properties:</Text>
              {Object.entries(node.properties).map(([k, v]) => (
                <Text key={k}>
                  {"  "}
                  <Text bold>{k}:</Text> {JSON.stringify(v)}
                </Text>
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
