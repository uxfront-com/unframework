import { readFileSync } from "node:fs";
import { join } from "node:path";

// C3's rules: what a Playwright run obeys, from the plain module `playwright.config.ts` imports, so
// this test never loads `@playwright/test`.
import { TARGET_NAMES } from "@unframework/compiler";
import { describe, expect, it } from "vitest";

import { BROWSER_CASES_ENV, browserRun } from "./browser-run.ts";
import { listCases } from "./cases.ts";
import { CANARY_DIR, ROOT, storybookDir, storybookOutput } from "./paths.ts";
import {
  browserProjectName,
  DEFAULT_WORKERS,
  PAGE_RULES,
  PLAYWRIGHT_RULES,
  workersOf,
} from "./playwright-rules.ts";

describe("the rules of a run", () => {
  it("never retries, and runs spec files in parallel though they share a file", () => {
    expect(PLAYWRIGHT_RULES.retries).toBe(0);
    expect(PLAYWRIGHT_RULES.fullyParallel).toBe(true);
    expect(PLAYWRIGHT_RULES.forbidOnly).toBe(true);
  });

  it("opens more than one page by default, CI's three", () => {
    expect(DEFAULT_WORKERS).toBe(3);
    expect(workersOf({})).toBe(3);
    expect(workersOf({})).toBeGreaterThan(1);
  });

  it("takes another number from the environment, and refuses what isn't one", () => {
    expect(workersOf({ UF_WORKERS: "2" })).toBe(2);
    expect(workersOf({ UF_WORKERS: " " })).toBe(3);
    for (const value of ["0", "-1", "two", "1.5"]) {
      expect(() => workersOf({ UF_WORKERS: value }), value).toThrow(/UF_WORKERS must be/);
    }
  });

  it("names a project per target, as the Vitest project is, so a matrix keeps its keys", () => {
    const names = TARGET_NAMES.map(browserProjectName);
    expect(names).toHaveLength(7);
    expect(names).toEqual([
      "browser:react",
      "browser:vue",
      "browser:svelte",
      "browser:solid",
      "browser:angular",
      "browser:qwik",
      "browser:astro",
    ]);
  });

  it("gives the page Vitest's project config", () => {
    expect(PAGE_RULES).toEqual({
      pollTimeout: 5_000,
      testTimeout: 60_000,
      hookTimeout: 30_000,
      requireAssertions: true,
    });
  });
});

describe("the config", () => {
  const config = readFileSync(join(ROOT, "playwright.config.ts"), "utf8");

  it("obeys those rules, with no tolerance of its own", () => {
    expect(config).toContain("...PLAYWRIGHT_RULES");
    expect(config).toContain("workers: workersOf(process.env)");
    expect(config).toContain("browserProjectName(target)");
    // Firefox and WebKit get no Chromium switches: `launchArguments` is tested in its package.
    expect(config).toContain("browserName: browser");
    expect(config).toContain("launchOptions: { args: launchArguments(browser) }");
    // A later key would override the rules unseen, and no tolerance belongs here.
    for (const word of [
      "retries",
      "fullyParallel",
      "forbidOnly",
      "timeout",
      "maxDiffPixels",
      "maxDiffPixelRatio",
      "threshold",
      "toHaveScreenshot",
    ]) {
      expect(config, word).not.toContain(word);
    }
    expect(JSON.stringify(PLAYWRIGHT_RULES)).not.toMatch(/maxDiffPixel|threshold/);
  });
});

describe("a run", () => {
  const run = (env: NodeJS.ProcessEnv) => browserRun({ UF_RUN_ID: "fixture-1", ...env }, []);
  // From the corpus, not a number: a new case is a new spec file with no other edit.
  const corpus = listCases().filter((info) => info.spec).length;

  it("declares every spec file of the corpus, with nothing narrowing it", () => {
    const { specs, specCount, filter, targets } = run({});
    expect(specs).toHaveLength(corpus);
    expect(specCount).toBe(corpus);
    expect(filter).toBeUndefined();
    expect(targets).toHaveLength(7);
  });

  it("keeps the cases the environment names, and knows the corpus holds more", () => {
    const { specs, specCount, filter } = run({
      [BROWSER_CASES_ENV]: "basics/hello,state/counter",
    });
    expect(specs.map((file) => file.slice(file.indexOf("/cases/")))).toEqual([
      "/cases/basics/hello/hello.test.ts",
      "/cases/state/counter/counter.test.ts",
    ]);
    expect(specCount).toBe(corpus);
    expect(filter).toBe("cases basics/hello,state/counter");
  });

  it("refuses a case the corpus doesn't hold, and a canary that doesn't exist", () => {
    expect(() => run({ [BROWSER_CASES_ENV]: "basics/nope" })).toThrow("No such case: basics/nope.");
    expect(() => run({ UF_CANARY: "L0-nope" })).toThrow('Unknown canary "L0-nope"');
  });
});

describe("a target's build", () => {
  it("goes in its package, or a canary's directory, since a build holds its compile", () => {
    expect(storybookOutput("vue", null)).toBe(join(storybookDir("vue"), "storybook-static"));
    expect(storybookOutput("vue", "L8-render-nothing")).toBe(
      join(CANARY_DIR, "L8-render-nothing", "storybook-static", "vue"),
    );
  });
});
