import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  root: fileURLToPath(new URL("./src/package", import.meta.url)),
  plugins: [solid()],
});
