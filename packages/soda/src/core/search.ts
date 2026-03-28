import type { Database as BunDatabase } from "bun:sqlite";
import type { Node, NodeWithRelations, SearchResult } from "./types.js";

interface RowidRow {
  rowid: number;
}

interface LastInsertRowidRow {
  rowid: number;
}

interface CountRow {
  total: number;
}

interface IdRow {
  id: string;
}

export class SearchIndex {
  constructor(private db: BunDatabase) {
    // Create mapping table: node_id -> fts rowid
    // With content='' (contentless FTS5), UNINDEXED columns are NOT stored,
    // So we maintain a separate mapping table to look up node_ids from FTS rowids.
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS fts_rowid_map (
        node_id TEXT PRIMARY KEY,
        fts_rowid INTEGER NOT NULL
      )`,
    );
  }

  indexNode(node: Node): void {
    const hasSummary = typeof node.properties.summary_en === "string";
    const hasKeywords =
      Array.isArray(node.properties.keywords_en) &&
      (node.properties.keywords_en as unknown[]).length > 0;

    // Only index nodes that have English metadata
    if (!hasSummary && !hasKeywords) {
      return;
    }

    const title = hasSummary ? (node.properties.summary_en as string) : "";
    const summary = node.body ? node.body.slice(0, 200) : "";
    const keywordsArr = hasKeywords ? (node.properties.keywords_en as string[]) : [];
    const keywords = keywordsArr.join(" ");

    this.db
      .query("INSERT INTO nodes_fts(node_id, title, summary, keywords) VALUES (?, ?, ?, ?)")
      .run(node.id, title, summary, keywords);

    const rowidRow = this.db
      .query<LastInsertRowidRow, []>("SELECT last_insert_rowid() as rowid")
      .get();
    if (rowidRow) {
      this.db
        .query("INSERT OR REPLACE INTO fts_rowid_map(node_id, fts_rowid) VALUES (?, ?)")
        .run(node.id, rowidRow.rowid);
    }
  }

  removeNode(nodeId: string, node: Node): void {
    const mapRow = this.db
      .query<RowidRow, [string]>("SELECT fts_rowid FROM fts_rowid_map WHERE node_id = ?")
      .get(nodeId);

    if (!mapRow) {
      return;
    } // Not in FTS index, nothing to remove

    const title = typeof node.properties.summary_en === "string" ? node.properties.summary_en : "";
    const summary = node.body ? node.body.slice(0, 200) : "";
    const keywordsArr = Array.isArray(node.properties.keywords_en)
      ? node.properties.keywords_en
      : [];
    const keywords = (keywordsArr as string[]).join(" ");

    this.db
      .query(
        "INSERT INTO nodes_fts(nodes_fts, rowid, node_id, title, summary, keywords) VALUES('delete', ?, ?, ?, ?, ?)",
      )
      .run(mapRow.rowid, nodeId, title, summary, keywords);

    this.db.query("DELETE FROM fts_rowid_map WHERE node_id = ?").run(nodeId);
  }

  search(
    params: {
      query?: string;
      kind?: string;
      tags?: string[];
      limit: number;
      offset: number;
    },
    getNodeWithRelations: (id: string) => NodeWithRelations | null,
  ): SearchResult {
    const { query, kind, tags, limit, offset } = params;

    const hasFts = query !== undefined && query.trim() !== "";
    const hasKind = kind !== undefined && kind.trim() !== "";
    const hasTags = tags !== undefined && tags.length > 0;

    const whereConditions: string[] = [];
    const queryParams: (string | number | boolean | null)[] = [];

    let fromClause: string;

    if (hasFts) {
      // JOIN nodes with FTS results via rowid mapping
      fromClause =
        "FROM nodes JOIN fts_rowid_map ON nodes.id = fts_rowid_map.node_id " +
        "JOIN nodes_fts ON fts_rowid_map.fts_rowid = nodes_fts.rowid";
      whereConditions.push("nodes_fts MATCH ?");
      queryParams.push(query);
    } else {
      fromClause = "FROM nodes";
    }

    if (hasKind) {
      whereConditions.push("nodes.kind = ?");
      queryParams.push(kind);
    }

    if (hasTags) {
      for (const tag of tags!) {
        whereConditions.push("nodes.id IN (SELECT node_id FROM tags WHERE tag = ?)");
        queryParams.push(tag);
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    const orderClause = hasFts ? "ORDER BY nodes_fts.rank" : "ORDER BY nodes.updated_at DESC";

    // Count total
    const countSql = `SELECT COUNT(*) as total ${fromClause} ${whereClause}`;
    const countRow = this.db
      .query<CountRow, (string | number | boolean | null)[]>(countSql)
      .get(...queryParams);
    const total = countRow ? countRow.total : 0;

    // Get paginated node ids
    const selectSql = `SELECT nodes.id ${fromClause} ${whereClause} ${orderClause} LIMIT ? OFFSET ?`;
    const selectParams = [...queryParams, limit, offset];
    const rows = this.db
      .query<IdRow, (string | number | boolean | null)[]>(selectSql)
      .all(...selectParams);

    const nodes: NodeWithRelations[] = [];
    for (const row of rows) {
      const node = getNodeWithRelations(row.id);
      if (node) {
        nodes.push(node);
      }
    }

    return { nodes, total };
  }
}
