import { fileURLToPath } from "node:url";

import unframework from "@unframework.dev/unplugin/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  root: fileURLToPath(new URL("./src/plugin", import.meta.url)),
  // No `target`: the plugin detects Solid from vite-plugin-solid.
  plugins: [unframework(), solid()],
});
