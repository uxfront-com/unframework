// pnpm passes `--` on to the script, and Playwright would then ignore every flag after it, so
// `e2e -- --project 'vue:*'` would run all the projects and still exit 0. The CLI runs in this
// process, so that a signal sent to the script reaches Playwright, with no wrapper between them.
import { createRequire } from "node:module";

const cli = createRequire(import.meta.url).resolve("@playwright/test/cli");
process.argv = [
  process.execPath,
  cli,
  "test",
  ...process.argv.slice(2).filter((arg) => arg !== "--"),
];
await import(cli);
