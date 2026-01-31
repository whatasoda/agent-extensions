// sync-exports orchestration
export {
  syncExports,
  collectPackageDirs,
  type SyncExportsOptions,
  type CollectPackageDirsResult,
} from "./sync-exports";
// Export file detection
export {
  detectExportFiles,
  getConditionNameFromDir,
  getDistName,
  getPackageDirName,
  type ExportEntry,
  type DetectExportFilesOptions,
} from "./detect-export-files";
// Exports field generation
export {
  buildExportsField,
  mergeExportsField,
  type ExportsConfig,
  type ExportsField,
  type ExportConditions,
} from "./build-exports-field";
// Rslib integration
export { createRslibEntry } from "./rslib";
