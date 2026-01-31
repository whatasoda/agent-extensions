import * as fs from "node:fs/promises";
import path from "node:path";
import {
  buildExportsField,
  type ExportsField,
  mergeExportsField,
} from "./build-exports-field";
import {
  detectExportFiles,
  getConditionNameFromDir,
  getPackageDirName,
} from "./detect-export-files";

export interface SyncExportsOptions {
  /** Package directory to sync */
  packageDir: string;
  /** Dry run mode (don't write changes) */
  dryRun?: boolean;
  /** Custom condition name override */
  conditionName?: string;
}

export interface CollectPackageDirsResult {
  isWorkspace: boolean;
  packages: Array<{ dirName: string; packageDir: string }>;
}

/**
 * Collect package directories in a workspace.
 * If cwd is not a workspace root, returns it as a single package.
 */
export async function collectPackageDirs(
  cwd: string,
): Promise<CollectPackageDirsResult> {
  const packageJsonPath = path.join(cwd, "package.json");

  let workspaces: string[] | undefined;
  try {
    const content = await fs.readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content);
    workspaces = pkg.workspaces;
  } catch {
    return {
      isWorkspace: false,
      packages: [{ dirName: "root", packageDir: cwd }],
    };
  }

  if (!workspaces || !workspaces.includes("packages/*")) {
    return {
      isWorkspace: false,
      packages: [{ dirName: "root", packageDir: cwd }],
    };
  }

  const pkgsRootDir = path.join(cwd, "packages");
  const pkgDirNames = await fs.readdir(pkgsRootDir);

  const packages: Array<{ dirName: string; packageDir: string }> = [];
  for (const dirName of pkgDirNames) {
    const packageDir = path.join(pkgsRootDir, dirName);
    const stat = await fs.stat(packageDir);
    if (!stat.isDirectory()) continue;

    // Check that it has a package.json
    try {
      await fs.access(path.join(packageDir, "package.json"));
    } catch {
      continue;
    }

    packages.push({ dirName, packageDir });
  }

  return { isWorkspace: true, packages };
}

/**
 * Sync package.json exports field based on detected @public-* files.
 */
export async function syncExports(
  options: SyncExportsOptions,
): Promise<void> {
  const {
    packageDir,
    dryRun = false,
    conditionName: conditionNameOverride,
  } = options;

  const packageJsonPath = path.join(packageDir, "package.json");
  const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
  const packageJson = JSON.parse(packageJsonContent);

  const entries = await detectExportFiles({ packageDir });

  if (entries.length === 0) {
    console.info("No @public-*.ts files found.");
    return;
  }

  console.info(`Found ${entries.length} export file(s):`);
  for (const entry of entries) {
    console.info(`  ${entry.filename} -> exports["${entry.exportPath}"]`);
  }

  // Get condition name
  const packageDirName = await getPackageDirName(packageDir);
  const conditionName =
    conditionNameOverride ?? getConditionNameFromDir(packageDirName);
  console.info(`Using condition name: ${conditionName}`);

  // Build exports field
  const newExports = buildExportsField(entries, { conditionName });

  // Merge with existing exports
  const existingExports = packageJson.exports as ExportsField | undefined;
  const mergedExports = mergeExportsField(
    existingExports,
    newExports,
    entries,
  );

  packageJson.exports = mergedExports;

  if (dryRun) {
    console.info("\nDry run mode - would write:");
    console.info(JSON.stringify({ exports: mergedExports }, null, 2));
    return;
  }

  await fs.writeFile(
    packageJsonPath,
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );
  console.info("\nUpdated package.json.");
}
