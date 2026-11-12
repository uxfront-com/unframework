import { configDefaults, defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";

/**
 * The package's tests run in Node. The fixture projects under `test/fixtures/` are never this
 * package's tests: a visual run on one generates its specs there, for its own browser projects.
 */
const config: ViteUserConfig = defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "test/fixtures/**"],
  },
});

export default config;
