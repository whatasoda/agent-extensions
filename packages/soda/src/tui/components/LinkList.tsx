import React from "react";
import { Box, Text } from "ink";
import type { Link } from "../../core/types.js";

export interface LinkListProps {
  linksFrom: Link[];
  linksTo: Link[];
  selectedIndex: number;
  focused: boolean;
}

export function LinkList({ linksFrom, linksTo, selectedIndex, focused }: LinkListProps) {
  const borderColor = focused ? "cyan" : undefined;
  const allLinks = [
    ...linksFrom.map((l) => ({ ...l, direction: "from" as const })),
    ...linksTo.map((l) => ({ ...l, direction: "to" as const })),
  ];

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
        Links {focused ? "(active)" : ""}
      </Text>
      {allLinks.length === 0 ? (
        <Text color="gray"> No links.</Text>
      ) : (
        allLinks.map((link, index) => {
          const isSelected = index === selectedIndex;
          const prefix = isSelected ? "> " : "  ";
          const targetId =
            link.direction === "from" ? link.to_id.slice(0, 10) : link.from_id.slice(0, 10);
          const dirSymbol = link.direction === "from" ? "->" : "<-";
          const color = isSelected ? (focused ? "cyan" : "white") : undefined;
          return (
            <Box key={`${link.from_id}-${link.to_id}-${link.link_type}`}>
              <Text color={color} bold={isSelected} inverse={isSelected && focused}>
                {prefix}
                {dirSymbol} {link.link_type} {targetId}...
              </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
}
