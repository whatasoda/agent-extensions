import { Box, Text } from "ink";
import { TextInput } from "@inkjs/ui";

export interface FilterBarProps {
  value: string;
  onChange: (value: string) => void;
  focused: boolean;
  onBlur: () => void;
}

export function FilterBar({ value, onChange, focused, onBlur }: FilterBarProps) {
  return (
    <Box borderStyle="single" paddingX={1} flexShrink={0}>
      <Text bold color={focused ? "cyan" : "white"}>
        Filter:{" "}
      </Text>
      {focused ? (
        <TextInput defaultValue={value} onChange={onChange} onSubmit={() => onBlur()} />
      ) : (
        <Text>{value || "(press / to filter)"}</Text>
      )}
    </Box>
  );
}

export function parseFilter(input: string): {
  kind?: string;
  tag?: string;
  query?: string;
} {
  const parts = input.trim().split(/\s+/);
  let kind: string | undefined;
  let tag: string | undefined;
  const queryParts: string[] = [];

  for (const part of parts) {
    if (part.startsWith("kind:")) {
      kind = part.slice(5);
    } else if (part.startsWith("tag:")) {
      tag = part.slice(4);
    } else if (part.length > 0) {
      queryParts.push(part);
    }
  }

  return {
    kind: kind || undefined,
    query: queryParts.length > 0 ? queryParts.join(" ") : undefined,
    tag: tag || undefined,
  };
}
