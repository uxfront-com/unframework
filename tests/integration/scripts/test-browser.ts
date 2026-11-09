// `test:browser <target> [cases…]`: a target's specs on Playwright, against its static Storybook
// build. A canary's build is always its own, under `.canary/<id>/`, since a build holds its compile,
// and holds only the cases the run judges: a canary can break the link of a case it isn't asked
// about, and each abort that causes costs another build. Otherwise the run reads the build
// `storybook:build` left, and makes one if there is none.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { BROWSER_CASES_ENV } from "../harness/browser-run.ts";
import { listCases, selectCases } from "../harness/cases.ts";
import { ROOT, storybookOutput } from "../harness/paths.ts";
import { browserProjectName } from "../harness/playwright-rules.ts";
import { STORYBOOK_TARGETS } from "../harness/storybook.ts";
import { selectTargets } from "../harness/targets.ts";
import { build } from "./storybook.ts";

const USAGE = "Usage: test-browser.ts <target> [<case>…]";

async function main(argv: readonly string[]): Promise<number> {
  const [target, ...cases] = argv.filter((arg) => arg !== "--");
  if (!target || [target, ...cases].some((arg) => arg.startsWith("-"))) throw new Error(USAGE);
  // Throws on a name that isn't a target.
  selectTargets(target);
  if (!STORYBOOK_TARGETS.includes(target)) {
    throw new Error(
      `The ${target} Storybook isn't proved yet: ${STORYBOOK_TARGETS.join(", ")} are.`,
    );
  }
  // Before the build, so a typo is one line rather than a build and a stack.
  const specless = selectCases(listCases(), cases.join(",")).filter(({ spec }) => !spec);
  if (cases.length && specless.length) {
    throw new Error(`No spec to run in: ${specless.map(({ id }) => id).join(", ")}.`);
  }
  const canary = process.env.UF_CANARY?.trim() || null;
  const directory = storybookOutput(target, canary);
  if (canary || !existsSync(join(directory, "index.json"))) {
    const built = await build(target, canary ? cases.join(",") : undefined);
    if (built !== 0) return built;
  } else {
    console.log(`Reading the build in ${directory}: storybook:build ${target} makes a new one.`);
  }
  const cli = join(
    dirname(createRequire(import.meta.url).resolve("@playwright/test/package.json")),
    "cli.js",
  );
  const { status } = spawnSync(
    process.execPath,
    [cli, "test", "--project", browserProjectName(target)],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        UF_TARGETS: target,
        ...(cases.length ? { [BROWSER_CASES_ENV]: cases.join(",") } : {}),
      },
    },
  );
  return status ?? 1;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  console.error(`[uf] ${(error as Error).message}`);
  process.exitCode = 1;
}
