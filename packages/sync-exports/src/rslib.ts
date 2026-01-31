import { getDistName, type ExportEntry } from "./detect-export-files";

/**
 * Generate rslib source.entry from detected export files (`@public-*`)
 *
 * @example
 * // rslib.config.ts
 * import { defineConfig } from "@rslib/core";
 * import { detectExportFiles, createRslibEntry } from "@agent-extensions/sync-exports";
 *
 * const entries = await detectExportFiles({ packageDir: import.meta.dirname });
 *
 * export default defineConfig({
 *   source: {
 *     entry: createRslibEntry(entries),
 *   },
 * });
 */
export function createRslibEntry(
  entries: ExportEntry[],
): Record<string, string> {
  const exportEntries = entries
    .filter((e) => !e.isPrivate)
    .map((e) => {
      const key = getDistName(e);
      const value = `./${e.relativePath}`;
      return [key, value] as const;
    });

  return Object.fromEntries(exportEntries);
}
