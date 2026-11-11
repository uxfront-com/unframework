import unframework from "@unframework.dev/unplugin/astro";
import { defineConfig } from "astro/config";

export default defineConfig({
  srcDir: "./src/plugin",
  devToolbar: { enabled: false },
  integrations: [unframework()],
});
