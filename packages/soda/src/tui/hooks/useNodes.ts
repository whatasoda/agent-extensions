import { useEffect, useRef, useState } from "react";
import { Database } from "../../core/database.js";
import { ensureDbDir } from "../../core/ensure-dirs.js";
import type { NodeWithRelations } from "../../core/types.js";
import os from "os";
import path from "path";

const DEFAULT_DB_PATH = path.join(os.homedir(), ".soda-agent-tools", "data.db");

export interface FilterParams {
  kind?: string;
  tag?: string;
  query?: string;
}

export function useNodes(filter: FilterParams) {
  const [nodes, setNodes] = useState<NodeWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dbRef = useRef<Database | null>(null);

  useEffect(() => {
    const dbPath = process.env["SODA_AGENT_TOOLS_DB"] ?? DEFAULT_DB_PATH;
    ensureDbDir(dbPath);
    dbRef.current = new Database(dbPath);
    return () => {
      dbRef.current?.close();
      dbRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!dbRef.current) {
      return;
    }
    setLoading(true);
    try {
      const result = dbRef.current.search({
        kind: filter.kind,
        limit: 100,
        offset: 0,
        query: filter.query,
        tags: filter.tag ? [filter.tag] : undefined,
      });
      setNodes(result.nodes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }, [filter.kind, filter.tag, filter.query]);

  return { error, loading, nodes };
}
