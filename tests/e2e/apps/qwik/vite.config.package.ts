import { fileURLToPath } from "node:url";

import { qwikVite } from "@qwik.dev/core/optimizer";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL("./src/package", import.meta.url));

export default defineConfig({
  root,
  // Client-rendered, so that it needs no server entry. The plugin's default `srcDir` is `<root>/src`.
  plugins: [qwikVite({ csr: true, srcDir: root })],
});
