import { fileURLToPath } from "node:url";

import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./src/package", import.meta.url)),
  plugins: [svelte()],
});
