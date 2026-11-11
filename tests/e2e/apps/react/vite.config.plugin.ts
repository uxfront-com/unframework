import { fileURLToPath } from "node:url";

import unframework from "@unframework.dev/unplugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./src/plugin", import.meta.url)),
  // No `target`: the plugin detects React from plugin-react.
  plugins: [unframework(), react()],
});
