import { describe, expect, it } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { Box, Text } from "ink";
import { NodeList } from "./components/NodeList.js";
import { FilterBar, parseFilter } from "./components/FilterBar.js";
import { StatusBar } from "./components/StatusBar.js";
import { NodeDetail } from "./components/NodeDetail.js";
import { LinkList } from "./components/LinkList.js";
import type { NodeWithRelations } from "../core/types.js";

const sampleNode: NodeWithRelations = {
  body: "Test body content",
  created_at: "2024-01-01T00:00:00Z",
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  kind: "memo",
  links_from: [],
  links_to: [],
  properties: {},
  tags: ["urgent", "test"],
  updated_at: "2024-01-01T00:00:00Z",
};

describe("App renders without error", () => {
  it("renders a simple box without crashing", () => {
    const { lastFrame } = render(
      <Box>
        <Text>soda-brain TUI</Text>
      </Box>,
    );
    expect(lastFrame()).toContain("soda-brain TUI");
  });
});

describe("NodeList displays node items", () => {
  it("renders node kind and body preview", () => {
    const { lastFrame } = render(
      <NodeList
        nodes={[sampleNode]}
        selectedIndex={0}
        focused={true}
        loading={false}
        error={null}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("memo");
    expect(frame).toContain("Test body content");
  });

  it("renders tags for node", () => {
    const { lastFrame } = render(
      <NodeList
        nodes={[sampleNode]}
        selectedIndex={0}
        focused={false}
        loading={false}
        error={null}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("urgent");
  });

  it("shows loading state", () => {
    const { lastFrame } = render(
      <NodeList nodes={[]} selectedIndex={0} focused={false} loading={true} error={null} />,
    );
    expect(lastFrame()).toContain("Loading");
  });

  it("shows empty state when no nodes", () => {
    const { lastFrame } = render(
      <NodeList nodes={[]} selectedIndex={0} focused={false} loading={false} error={null} />,
    );
    expect(lastFrame()).toContain("No nodes");
  });

  it("shows error state", () => {
    const { lastFrame } = render(
      <NodeList nodes={[]} selectedIndex={0} focused={false} loading={false} error="DB error" />,
    );
    expect(lastFrame()).toContain("Error");
    expect(lastFrame()).toContain("DB error");
  });

  it("renders multiple nodes", () => {
    const node2: NodeWithRelations = {
      ...sampleNode,
      body: "Another node",
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
      kind: "todo",
      tags: [],
    };
    const { lastFrame } = render(
      <NodeList
        nodes={[sampleNode, node2]}
        selectedIndex={1}
        focused={true}
        loading={false}
        error={null}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("memo");
    expect(frame).toContain("todo");
    expect(frame).toContain("Another node");
  });
});

describe("FilterBar accepts text input", () => {
  it("renders with empty value and placeholder when unfocused", () => {
    const { lastFrame } = render(
      <FilterBar value="" onChange={() => {}} focused={false} onBlur={() => {}} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Filter:");
    expect(frame).toContain("press / to filter");
  });

  it("renders with focused state", () => {
    const { lastFrame } = render(
      <FilterBar value="" onChange={() => {}} focused={true} onBlur={() => {}} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Filter:");
  });

  it("renders provided value", () => {
    const { lastFrame } = render(
      <FilterBar
        value="kind:todo tag:urgent"
        onChange={() => {}}
        focused={false}
        onBlur={() => {}}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("kind:todo");
    expect(frame).toContain("tag:urgent");
  });
});

describe("FilterBar parseFilter", () => {
  it("parses kind prefix", () => {
    const result = parseFilter("kind:todo");
    expect(result.kind).toBe("todo");
    expect(result.tag).toBeUndefined();
    expect(result.query).toBeUndefined();
  });

  it("parses tag prefix", () => {
    const result = parseFilter("tag:urgent");
    expect(result.tag).toBe("urgent");
    expect(result.kind).toBeUndefined();
  });

  it("parses remaining text as query", () => {
    const result = parseFilter("kind:todo hello world");
    expect(result.kind).toBe("todo");
    expect(result.query).toBe("hello world");
  });

  it("handles empty input", () => {
    const result = parseFilter("");
    expect(result.kind).toBeUndefined();
    expect(result.tag).toBeUndefined();
    expect(result.query).toBeUndefined();
  });
});

describe("StatusBar shows keybind hints", () => {
  it("renders standard keybind hints", () => {
    const { lastFrame } = render(<StatusBar filterFocused={false} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("j/k");
    expect(frame).toContain("Tab");
    expect(frame).toContain("/");
    expect(frame).toContain("b");
    expect(frame).toContain("r");
    expect(frame).toContain("y");
    expect(frame).toContain("q");
  });

  it("renders filter-focused hints when filter is focused", () => {
    const { lastFrame } = render(<StatusBar filterFocused={true} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Enter");
    expect(frame).toContain("Esc");
  });
});

describe("NodeDetail renders node information", () => {
  it("shows placeholder when no node selected", () => {
    const { lastFrame } = render(<NodeDetail node={null} focused={false} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Select a node");
  });

  it("displays node details", () => {
    const { lastFrame } = render(<NodeDetail node={sampleNode} focused={false} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("memo");
    expect(frame).toContain("Test body content");
    expect(frame).toContain("urgent");
  });
});

describe("LinkList renders links", () => {
  it("shows no links message when empty", () => {
    const { lastFrame } = render(
      <LinkList linksFrom={[]} linksTo={[]} selectedIndex={0} focused={false} />,
    );
    expect(lastFrame()).toContain("No links");
  });

  it("renders outgoing links", () => {
    const link = {
      created_at: "2024-01-01T00:00:00Z",
      from_id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      link_type: "related",
      to_id: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
    };
    const { lastFrame } = render(
      <LinkList linksFrom={[link]} linksTo={[]} selectedIndex={0} focused={false} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("->");
    expect(frame).toContain("related");
  });

  it("renders incoming links", () => {
    const link = {
      created_at: "2024-01-01T00:00:00Z",
      from_id: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
      link_type: "blocks",
      to_id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    };
    const { lastFrame } = render(
      <LinkList linksFrom={[]} linksTo={[link]} selectedIndex={0} focused={false} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("<-");
    expect(frame).toContain("blocks");
  });
});
