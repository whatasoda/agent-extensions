export type NodeId = string; // ULID, 26 chars

export interface Node {
  id: NodeId;
  kind: string;
  body: string;
  properties: Record<string, unknown>;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export interface Link {
  from_id: NodeId;
  to_id: NodeId;
  link_type: string;
  created_at: string; // ISO 8601
}

export interface NodeWithRelations extends Node {
  tags: string[];
  links_from: Link[];
  links_to: Link[];
}

export interface Tag {
  node_id: NodeId;
  tag: string;
}

export interface SearchResult {
  nodes: NodeWithRelations[];
  total: number;
}
