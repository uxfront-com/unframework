// postinstall: installs the Chromium build the browser projects run, so `pnpm install && pnpm
// test` works on a clean clone. Playwright skips it when that build is already installed. CI
// skips it: the browser jobs run in the Playwright image, which ships the browsers, and the
// other jobs never start one. A browser project that cannot start a browser fails loudly.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

if (process.env.CI) {
  process.stdout.write("[uf] CI: the browser comes from the Playwright image; skipping install.\n");
} else {
  const require = createRequire(import.meta.url);
  const cli = join(dirname(require.resolve("playwright/package.json")), "cli.js");
  const { status } = spawnSync(process.execPath, [cli, "install", "chromium"], {
    stdio: "inherit",
  });
  process.exitCode = status ?? 1;
}
