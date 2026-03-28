import { Database as BunDatabase } from "bun:sqlite";
import { ulid } from "ulid";
import path from "path";
import { readFileSync } from "fs";
import type { Link, Node, NodeWithRelations, SearchResult } from "./types.js";
import { validateProperties } from "./kinds.js";
import { SearchIndex } from "./search.js";

interface NodeRow {
  id: string;
  kind: string;
  body: string;
  properties: string;
  created_at: string;
  updated_at: string;
}

interface TagRow {
  tag: string;
}

interface LinkRow {
  from_id: string;
  to_id: string;
  link_type: string;
  created_at: string;
}

function rowToNode(row: NodeRow): Node {
  return {
    body: row.body,
    created_at: row.created_at,
    id: row.id,
    kind: row.kind,
    properties: JSON.parse(row.properties),
    updated_at: row.updated_at,
  };
}

export class Database {
  private db: BunDatabase;
  private searchIndex: SearchIndex;

  constructor(dbPath = ":memory:") {
    this.db = new BunDatabase(dbPath, { create: true, strict: true });
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.initSchema();
    this.searchIndex = new SearchIndex(this.db);
  }

  private initSchema(): void {
    const schemaPath = path.join(import.meta.dir, "schema.sql");
    const sql = readFileSync(schemaPath, "utf-8");
    this.db.exec(sql);
  }

  private getNodeWithRelations(id: string): NodeWithRelations | null {
    const nodeRow = this.db
      .query<NodeRow, [string]>(
        "SELECT id, kind, body, properties, created_at, updated_at FROM nodes WHERE id = ?",
      )
      .get(id);

    if (!nodeRow) {
      return null;
    }

    const node = rowToNode(nodeRow);

    const tagRows = this.db
      .query<TagRow, [string]>("SELECT tag FROM tags WHERE node_id = ?")
      .all(id);

    const tags = tagRows.map((r) => r.tag);

    const linksFromRows = this.db
      .query<LinkRow, [string]>(
        "SELECT from_id, to_id, link_type, created_at FROM links WHERE from_id = ?",
      )
      .all(id);

    const links_from: Link[] = linksFromRows.map((r) => ({
      created_at: r.created_at,
      from_id: r.from_id,
      link_type: r.link_type,
      to_id: r.to_id,
    }));

    const linksToRows = this.db
      .query<LinkRow, [string]>(
        "SELECT from_id, to_id, link_type, created_at FROM links WHERE to_id = ?",
      )
      .all(id);

    const links_to: Link[] = linksToRows.map((r) => ({
      created_at: r.created_at,
      from_id: r.from_id,
      link_type: r.link_type,
      to_id: r.to_id,
    }));

    return { ...node, links_from, links_to, tags };
  }

  createNode(input: {
    kind: string;
    body?: string;
    properties?: Record<string, unknown>;
    tags?: string[];
  }): NodeWithRelations {
    const { kind, body = "", properties = {}, tags = [] } = input;

    // Validate properties (throws ZodError if invalid)
    const validatedProps = validateProperties(kind, properties);

    const id = ulid();
    const now = new Date().toISOString();

    const insertTx = this.db.transaction(() => {
      this.db
        .query(
          "INSERT INTO nodes (id, kind, body, properties, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(id, kind, body, JSON.stringify(validatedProps), now, now);

      for (const tag of tags) {
        this.db.query("INSERT INTO tags (node_id, tag) VALUES (?, ?)").run(id, tag);
      }
    });

    insertTx();

    const result = this.getNodeWithRelations(id);
    if (!result) {
      throw new Error(`Failed to retrieve node after creation: ${id}`);
    }

    this.searchIndex.indexNode(result);

    return result;
  }

  getNode(id: string): NodeWithRelations | null {
    return this.getNodeWithRelations(id);
  }

  updateNode(input: {
    id: string;
    body?: string;
    kind?: string;
    properties?: Record<string, unknown>;
  }): NodeWithRelations {
    const { id, body, kind, properties } = input;

    const existing = this.getNodeWithRelations(id);
    if (!existing) {
      throw new Error(`Node not found: ${id}`);
    }

    // Remove old FTS entry before updating
    this.searchIndex.removeNode(id, existing);

    const newKind = kind === undefined ? existing.kind : kind;
    const newProperties = properties === undefined ? existing.properties : properties;

    // Re-validate if kind or properties changed
    let validatedProps = existing.properties;
    if (kind !== undefined || properties !== undefined) {
      validatedProps = validateProperties(newKind, newProperties);
    }

    const now = new Date().toISOString();

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (body !== undefined) {
      setClauses.push("body = ?");
      params.push(body);
    }
    if (kind !== undefined) {
      setClauses.push("kind = ?");
      params.push(kind);
    }
    if (kind !== undefined || properties !== undefined) {
      setClauses.push("properties = ?");
      params.push(JSON.stringify(validatedProps));
    }

    setClauses.push("updated_at = ?");
    params.push(now);
    params.push(id);

    const sql = `UPDATE nodes SET ${setClauses.join(", ")} WHERE id = ?`;
    this.db.query(sql).run(...(params as Parameters<typeof this.db.query>));

    const result = this.getNodeWithRelations(id);
    if (!result) {
      throw new Error(`Failed to retrieve node after update: ${id}`);
    }

    this.searchIndex.indexNode(result);

    return result;
  }

  deleteNode(id: string): void {
    const existing = this.getNodeWithRelations(id);
    if (!existing) {
      throw new Error(`Node not found: ${id}`);
    }

    // Remove FTS entry before deleting node
    this.searchIndex.removeNode(id, existing);

    this.db.query("DELETE FROM nodes WHERE id = ?").run(id);
  }

  addTags(nodeId: string, tags: string[]): void {
    const exists = this.db
      .query<{ id: string }, [string]>("SELECT id FROM nodes WHERE id = ?")
      .get(nodeId);
    if (!exists) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const insertTx = this.db.transaction(() => {
      for (const tag of tags) {
        this.db.query("INSERT OR IGNORE INTO tags (node_id, tag) VALUES (?, ?)").run(nodeId, tag);
      }
    });

    insertTx();
  }

  removeTags(nodeId: string, tags: string[]): void {
    const exists = this.db
      .query<{ id: string }, [string]>("SELECT id FROM nodes WHERE id = ?")
      .get(nodeId);
    if (!exists) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const deleteTx = this.db.transaction(() => {
      for (const tag of tags) {
        this.db.query("DELETE FROM tags WHERE node_id = ? AND tag = ?").run(nodeId, tag);
      }
    });

    deleteTx();
  }

  createLink(fromId: string, toId: string, linkType: string): Link {
    // Verify both nodes exist before attempting insert
    const fromNode = this.db
      .query<{ id: string }, [string]>("SELECT id FROM nodes WHERE id = ?")
      .get(fromId);
    if (!fromNode) {
      throw new Error(`Node not found: ${fromId}`);
    }

    const toNode = this.db
      .query<{ id: string }, [string]>("SELECT id FROM nodes WHERE id = ?")
      .get(toId);
    if (!toNode) {
      throw new Error(`Node not found: ${toId}`);
    }

    const now = new Date().toISOString();

    this.db
      .query(
        "INSERT OR IGNORE INTO links (from_id, to_id, link_type, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(fromId, toId, linkType, now);

    const row = this.db
      .query<LinkRow, [string, string, string]>(
        "SELECT from_id, to_id, link_type, created_at FROM links WHERE from_id = ? AND to_id = ? AND link_type = ?",
      )
      .get(fromId, toId, linkType);

    if (!row) {
      throw new Error(`Failed to retrieve link after creation`);
    }

    return {
      created_at: row.created_at,
      from_id: row.from_id,
      link_type: row.link_type,
      to_id: row.to_id,
    };
  }

  deleteLink(fromId: string, toId: string, linkType: string): void {
    this.db
      .query("DELETE FROM links WHERE from_id = ? AND to_id = ? AND link_type = ?")
      .run(fromId, toId, linkType);
  }

  getLinks(nodeId: string, direction: "from" | "to" | "both"): Link[] {
    const rowToLink = (r: LinkRow): Link => ({
      created_at: r.created_at,
      from_id: r.from_id,
      link_type: r.link_type,
      to_id: r.to_id,
    });

    if (direction === "from") {
      const rows = this.db
        .query<LinkRow, [string]>(
          "SELECT from_id, to_id, link_type, created_at FROM links WHERE from_id = ?",
        )
        .all(nodeId);
      return rows.map(rowToLink);
    }

    if (direction === "to") {
      const rows = this.db
        .query<LinkRow, [string]>(
          "SELECT from_id, to_id, link_type, created_at FROM links WHERE to_id = ?",
        )
        .all(nodeId);
      return rows.map(rowToLink);
    }

    // Direction === "both"
    const fromRows = this.db
      .query<LinkRow, [string]>(
        "SELECT from_id, to_id, link_type, created_at FROM links WHERE from_id = ?",
      )
      .all(nodeId);
    const toRows = this.db
      .query<LinkRow, [string]>(
        "SELECT from_id, to_id, link_type, created_at FROM links WHERE to_id = ?",
      )
      .all(nodeId);

    return [...fromRows.map(rowToLink), ...toRows.map(rowToLink)];
  }

  search(params: {
    query?: string;
    kind?: string;
    tags?: string[];
    limit: number;
    offset: number;
  }): SearchResult {
    return this.searchIndex.search(params, (id) => this.getNodeWithRelations(id));
  }

  listKinds(): { kind: string; count: number }[] {
    const rows = this.db
      .query<{ kind: string; count: number }, []>(
        "SELECT kind, COUNT(*) as count FROM nodes GROUP BY kind ORDER BY count DESC",
      )
      .all();
    return rows;
  }

  listTags(): { tag: string; count: number }[] {
    const rows = this.db
      .query<{ tag: string; count: number }, []>(
        "SELECT tag, COUNT(*) as count FROM tags GROUP BY tag ORDER BY count DESC",
      )
      .all();
    return rows;
  }

  close(): void {
    this.db.close();
  }
}
