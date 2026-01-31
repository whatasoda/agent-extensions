import { defineConfig } from "@rslib/core";
import { createRslibEntry, detectExportFiles } from "./src/index";

const entries = await detectExportFiles({ packageDir: import.meta.dirname });

const libEntry = createRslibEntry(entries);

export default defineConfig({
  lib: [
    {
      format: "esm",
      dts: { bundle: false },
      source: { entry: libEntry },
    },
  ],
  output: {
    target: "node",
  },
});
