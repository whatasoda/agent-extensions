import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join } from "path";

describe("schema.sql", () => {
  it("loads DDL into an in-memory SQLite database without errors", () => {
    const ddlPath = join(import.meta.dir, "schema.sql");
    const ddlContent = readFileSync(ddlPath, "utf-8");

    const db = new Database(":memory:");
    db.run("PRAGMA foreign_keys = ON");

    expect(() => {
      db.run(ddlContent);
    }).not.toThrow();

    db.close();
  });

  it("creates the nodes table with expected columns", () => {
    const ddlPath = join(import.meta.dir, "schema.sql");
    const ddlContent = readFileSync(ddlPath, "utf-8");

    const db = new Database(":memory:");
    db.run("PRAGMA foreign_keys = ON");
    db.run(ddlContent);

    const info = db.query("PRAGMA table_info(nodes)").all() as {
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }[];

    const columns = info.map((col) => col.name);
    expect(columns).toContain("id");
    expect(columns).toContain("kind");
    expect(columns).toContain("body");
    expect(columns).toContain("properties");
    expect(columns).toContain("created_at");
    expect(columns).toContain("updated_at");

    db.close();
  });

  it("creates the tags table with FK to nodes", () => {
    const ddlPath = join(import.meta.dir, "schema.sql");
    const ddlContent = readFileSync(ddlPath, "utf-8");

    const db = new Database(":memory:");
    db.run("PRAGMA foreign_keys = ON");
    db.run(ddlContent);

    const info = db.query("PRAGMA table_info(tags)").all() as { name: string }[];
    const columns = info.map((col) => col.name);
    expect(columns).toContain("node_id");
    expect(columns).toContain("tag");

    db.close();
  });

  it("creates the links table with FK to nodes", () => {
    const ddlPath = join(import.meta.dir, "schema.sql");
    const ddlContent = readFileSync(ddlPath, "utf-8");

    const db = new Database(":memory:");
    db.run("PRAGMA foreign_keys = ON");
    db.run(ddlContent);

    const info = db.query("PRAGMA table_info(links)").all() as { name: string }[];
    const columns = info.map((col) => col.name);
    expect(columns).toContain("from_id");
    expect(columns).toContain("to_id");
    expect(columns).toContain("link_type");
    expect(columns).toContain("created_at");

    db.close();
  });

  it("creates the nodes_fts virtual table", () => {
    const ddlPath = join(import.meta.dir, "schema.sql");
    const ddlContent = readFileSync(ddlPath, "utf-8");

    const db = new Database(":memory:");
    db.run("PRAGMA foreign_keys = ON");
    db.run(ddlContent);

    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' OR type='shadow'")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("nodes_fts");

    db.close();
  });
});
