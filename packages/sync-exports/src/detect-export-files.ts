import * as fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";

/**
 * Pattern for public export files (included in published package)
 * @example @public-index.ts -> "."
 * @example @public-utils.ts -> "./utils"
 */
const PUBLIC_EXPORT_PATTERN = /^@public-(.+)\.(ts|tsx)$/;

export interface ExportEntry {
  /** Original filename (e.g., "@public-index.ts") */
  filename: string;
  /** Export path (e.g., "." or "./utils") */
  exportPath: string;
  /** Full path to source file */
  sourcePath: string;
  /** Relative path from package root */
  relativePath: string;
  /** Whether this is a private export (custom condition only) */
  isPrivate: boolean;
}

export interface DetectExportFilesOptions {
  /** Package directory to scan */
  packageDir: string;
  /** Subdirectory to scan (default: ".") */
  scanDir?: string;
}

/**
 * Detect @public-*.ts files in a package
 */
export async function detectExportFiles(
  options: DetectExportFilesOptions,
): Promise<ExportEntry[]> {
  const { packageDir, scanDir = "." } = options;
  const searchDir = path.join(packageDir, scanDir);

  const entries: ExportEntry[] = [];

  // Find all @public-*.ts files at root level
  const files = await glob("@public-*.{ts,tsx}", {
    cwd: searchDir,
    nodir: true,
  });

  for (const filename of files) {
    const match = filename.match(PUBLIC_EXPORT_PATTERN);
    if (!match) continue;

    const name = match[1];
    const exportPath = name === "index" ? "." : `./${name}`;
    const relativePath =
      scanDir === "." ? filename : path.join(scanDir, filename);

    entries.push({
      filename,
      exportPath,
      sourcePath: path.join(searchDir, filename),
      relativePath,
      isPrivate: false,
    });
  }

  // Sort by export path for consistent ordering
  entries.sort((a, b) => {
    if (a.exportPath === ".") return -1;
    if (b.exportPath === ".") return 1;
    return a.exportPath.localeCompare(b.exportPath);
  });

  // Check for duplicate export paths
  const exportPaths = entries.map((e) => e.exportPath);
  const duplicates = exportPaths.filter(
    (p, i) => exportPaths.indexOf(p) !== i,
  );
  if (duplicates.length > 0) {
    const uniqueDuplicates = [...new Set(duplicates)];
    const conflictingFiles = entries
      .filter((e) => uniqueDuplicates.includes(e.exportPath))
      .map((e) => e.relativePath);
    throw new Error(
      `Duplicate export paths detected: ${uniqueDuplicates.map((d) => `"${d}"`).join(", ")}. ` +
        `Conflicting files: ${conflictingFiles.join(", ")}. ` +
        `Each export path must be unique.`,
    );
  }

  return entries;
}

/**
 * Derive dist entry name from an ExportEntry.
 *
 * "." → "index", "./utils" → "utils"
 */
export function getDistName(entry: ExportEntry): string {
  return entry.exportPath === "." ? "index" : entry.exportPath.slice(2); // strip "./"
}

/**
 * Get the custom condition name from directory name
 * @param dirName Directory name (e.g., "agent-extensions")
 * @returns Custom condition name (e.g., "@agent-extensions")
 */
export function getConditionNameFromDir(dirName: string): string {
  return `@${dirName}`;
}

/**
 * Get directory name from package path.
 * For workspace packages, returns the workspace root's directory name
 * to ensure consistent condition names across all packages.
 */
export async function getPackageDirName(
  packageDir: string,
): Promise<string> {
  // 1. Check if this is a workspace root (has packages/ subdirectory)
  const packagesDir = path.join(packageDir, "packages");
  try {
    const stat = await fs.stat(packagesDir);
    if (stat.isDirectory()) {
      return path.basename(packageDir);
    }
  } catch {
    // packages directory doesn't exist
  }

  // 2. Check if this package is inside a workspace (parent is "packages" directory)
  const parentDir = path.dirname(packageDir);
  const parentName = path.basename(parentDir);

  if (parentName === "packages") {
    const workspaceRoot = path.dirname(parentDir);
    const workspacePackagesDir = path.join(workspaceRoot, "packages");
    try {
      const stat = await fs.stat(workspacePackagesDir);
      if (stat.isDirectory()) {
        return path.basename(workspaceRoot);
      }
    } catch {
      // Not a workspace structure
    }
  }

  // 3. Fallback: use the directory name directly
  return path.basename(packageDir);
}
