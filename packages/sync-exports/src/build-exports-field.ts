import { getDistName, type ExportEntry } from "./detect-export-files";

export interface ExportsConfig {
  /** Custom condition name (e.g., "@agent-extensions") */
  conditionName: string;
  /** Distribution directory (default: "dist") */
  distDir?: string;
  /** Include types condition (default: true) */
  includeTypes?: boolean;
  /** Include import condition / ESM (default: true) */
  includeImport?: boolean;
  /** Include default condition (default: true) */
  includeDefault?: boolean;
  /** File extension for ESM output (default: ".js") */
  esmExtension?: string;
  /** File extension for types output (default: ".d.ts") */
  typesExtension?: string;
}

export interface ExportConditions {
  [condition: string]: string;
}

export interface ExportsField {
  [exportPath: string]: ExportConditions;
}

interface ResolvedExportsConfig {
  distDir: string;
  includeTypes: boolean;
  includeImport: boolean;
  includeDefault: boolean;
  esmExtension: string;
  typesExtension: string;
}

function resolveExportsConfig(
  config: Omit<ExportsConfig, "conditionName">,
): ResolvedExportsConfig {
  const {
    distDir = "dist",
    includeTypes = true,
    includeImport = true,
    includeDefault = true,
    esmExtension = ".js",
    typesExtension = ".d.ts",
  } = config;

  return {
    distDir,
    includeTypes,
    includeImport,
    includeDefault,
    esmExtension,
    typesExtension,
  };
}

/**
 * Build exports field from detected export entries
 */
export function buildExportsField(
  entries: ExportEntry[],
  config: ExportsConfig,
): ExportsField {
  const { conditionName } = config;
  const { distDir, includeTypes, includeImport, includeDefault, esmExtension, typesExtension } =
    resolveExportsConfig(config);

  const exports: ExportsField = {};

  for (const entry of entries) {
    const { exportPath, relativePath, filename } = entry;
    const distName = getDistName(entry);
    const conditions: ExportConditions = {};

    // Custom condition always points to source file
    conditions[conditionName] = `./${relativePath}`;

    if (includeTypes) {
      // DTS with bundle:false preserves source filename
      const dtsName = filename.replace(/\.(ts|tsx)$/, "");
      conditions["types"] = `./${distDir}/${dtsName}${typesExtension}`;
    }
    if (includeImport) {
      conditions["import"] = `./${distDir}/${distName}${esmExtension}`;
    }
    if (includeDefault) {
      conditions["default"] = `./${distDir}/${distName}${esmExtension}`;
    }

    exports[exportPath] = conditions;
  }

  return exports;
}

/**
 * Merge new exports into existing exports field.
 * Preserves entries not generated from @public-* files.
 */
export function mergeExportsField(
  existingExports: ExportsField | undefined,
  newExports: ExportsField,
  entries: ExportEntry[],
): ExportsField {
  if (!existingExports) {
    return newExports;
  }

  const result: ExportsField = { ...existingExports };

  const managedPaths = new Set(entries.map((e) => e.exportPath));

  // Update managed paths with new values
  for (const [exportPath, conditions] of Object.entries(newExports)) {
    result[exportPath] = conditions;
  }

  // Remove managed paths that are no longer in entries
  for (const existingPath of Object.keys(existingExports)) {
    if (managedPaths.has(existingPath) && !newExports[existingPath]) {
      delete result[existingPath];
    }
  }

  return result;
}
