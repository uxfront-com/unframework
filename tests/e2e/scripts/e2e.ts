// pnpm passes `--` on to the script, and Playwright would then ignore every flag after it, so
// `e2e -- --project 'vue:*'` would run all the projects and still exit 0.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const cli = createRequire(import.meta.url).resolve("@playwright/test/cli");
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const { status } = spawnSync(process.execPath, [cli, "test", ...args], { stdio: "inherit" });
process.exitCode = status ?? 1;
