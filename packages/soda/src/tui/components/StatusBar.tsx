import React from "react";
import { Box, Text } from "ink";

export interface StatusBarProps {
  filterFocused: boolean;
}

export function StatusBar({ filterFocused }: StatusBarProps) {
  if (filterFocused) {
    return (
      <Box borderStyle="single" paddingX={1} flexShrink={0}>
        <Text>
          <Text bold color="cyan">
            [Enter]
          </Text>{" "}
          apply filter{"  "}
          <Text bold color="cyan">
            [Esc]
          </Text>{" "}
          cancel
        </Text>
      </Box>
    );
  }

  return (
    <Box borderStyle="single" paddingX={1} flexShrink={0}>
      <Text>
        <Text bold color="cyan">
          [j/k]
        </Text>{" "}
        navigate{"  "}
        <Text bold color="cyan">
          [Tab]
        </Text>{" "}
        switch panel{"  "}
        <Text bold color="cyan">
          [/]
        </Text>{" "}
        filter{"  "}
        <Text bold color="cyan">
          [b]
        </Text>
        rainstorm{"  "}
        <Text bold color="cyan">
          [r]
        </Text>
        eview{"  "}
        <Text bold color="cyan">
          [y]
        </Text>
        copy{"  "}
        <Text bold color="cyan">
          [q]
        </Text>
        uit
      </Text>
    </Box>
  );
}
