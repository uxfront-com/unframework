// postinstall: installs the browser the browser projects run, so `pnpm install && pnpm test`
// works on a clean clone: Chromium, or the engine UF_BROWSER names (ADR-0066). Playwright skips
// it when that build is already installed. Any other name fails here, as the harness would refuse
// it: Playwright would install branded Chrome or Edge for `chrome` or `msedge`, system-wide. CI
// skips it: the browser jobs run in the Playwright image, which ships every engine, and the
// other jobs never start one. A browser project that cannot start a browser fails loudly.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

if (process.env.CI) {
  process.stdout.write("[uf] CI: the browser comes from the Playwright image; skipping install.\n");
} else {
  const require = createRequire(import.meta.url);
  const cli = join(dirname(require.resolve("playwright/package.json")), "cli.js");
  const browser = process.env.UF_BROWSER?.trim() || "chromium";
  // The harness's BROWSER_ENGINES, written out: a postinstall loads nothing from the workspace.
  if (!["chromium", "firefox", "webkit"].includes(browser)) {
    process.stderr.write(
      `[uf] UF_BROWSER must be chromium, firefox or webkit, not "${browser}".\n`,
    );
    process.exit(1);
  }
  const { status } = spawnSync(process.execPath, [cli, "install", browser], {
    stdio: "inherit",
  });
  process.exitCode = status ?? 1;
}
